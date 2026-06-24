import { spawn } from 'node:child_process';
import { PowerShellError } from './errors.js';

/**
 * Runs a PowerShell script and returns its stdout. This is the only place in
 * the toolkit that actually shells out — everything above it treats PowerShell
 * as an implementation detail behind {@link PowerShellExecutor}, so the client
 * can later swap to direct HTTP without touching callers.
 */
export interface PowerShellExecutor {
  /**
   * Execute a PowerShell `script` and resolve with its stdout (trimmed). Any
   * non-zero exit, missing interpreter, or stderr output rejects with
   * {@link PowerShellError}.
   */
  run(script: string): Promise<string>;
}

export interface PowerShellExecutorOptions {
  /**
   * Interpreter to use. Defaults to `pwsh` (PowerShell 7+) and falls back to
   * `powershell.exe` on Windows if `pwsh` is not found.
   */
  executable?: string;
  /** Per-invocation timeout in milliseconds. Default 120000. */
  timeoutMs?: number;
}

/** Pick a sensible default interpreter for the current platform. */
function defaultExecutable(): string {
  // pwsh is cross-platform PowerShell 7+. On Windows, fall back handled in run().
  return 'pwsh';
}

export class ChildProcessPowerShellExecutor implements PowerShellExecutor {
  private readonly executable: string;
  private readonly timeoutMs: number;

  constructor(options: PowerShellExecutorOptions = {}) {
    this.executable = options.executable ?? defaultExecutable();
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async run(script: string): Promise<string> {
    try {
      return await this.invoke(this.executable, script);
    } catch (err) {
      // On Windows, fall back to the built-in Windows PowerShell if pwsh is
      // absent from PATH.
      if (
        this.executable === 'pwsh' &&
        process.platform === 'win32' &&
        err instanceof PowerShellError &&
        /ENOENT|not recognized|cannot find/i.test(String(err.message))
      ) {
        return this.invoke('powershell.exe', script);
      }
      throw err;
    }
  }

  private invoke(executable: string, script: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      // The script embeds the Monitor auth token. Passing it as a `-Command`
      // argument would expose it in the process command line (Task Manager,
      // WMI Win32_Process.CommandLine, `ps`, /proc/<pid>/cmdline) to any local
      // user. `-Command -` reads the script from stdin instead, so the secret
      // never reaches the process table.
      const child = spawn(
        executable,
        ['-NoProfile', '-NonInteractive', '-Command', '-'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );

      // Feed the script over stdin, then close it so PowerShell executes and
      // exits. Swallow EPIPE in case the process died before we finished
      // writing — that path is already handled by the 'error'/'close' events.
      child.stdin.on('error', () => {});
      child.stdin.write(script);
      child.stdin.end();

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));

      child.on('error', (cause) => {
        clearTimeout(timer);
        reject(
          new PowerShellError(
            `Failed to launch PowerShell ("${executable}"). Is it installed ` +
              'and on your PATH?',
            { cause },
          ),
        );
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(
            new PowerShellError(
              `PowerShell command timed out after ${this.timeoutMs}ms.`,
            ),
          );
          return;
        }
        if (code !== 0) {
          reject(
            new PowerShellError(
              `PowerShell exited with code ${code}: ${stderr.trim() || '(no stderr)'}`,
            ),
          );
          return;
        }
        resolvePromise(stdout.trim());
      });
    });
  }
}
