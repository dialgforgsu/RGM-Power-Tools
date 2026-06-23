/**
 * Typed errors thrown by the core package. The CLI layer catches these and
 * renders friendly messages; only `--verbose` surfaces the underlying cause.
 */

/** Base class for all known/expected errors in the toolkit. */
export class MonitorToolError extends Error {
  /** Optional underlying error for `--verbose` output. */
  override readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.cause = options?.cause;
  }
}

/** Raised when required auth/connection details are missing or incomplete. */
export class AuthError extends MonitorToolError {}

/** Raised when the PowerShell layer fails (module missing, cmdlet error, etc.). */
export class PowerShellError extends MonitorToolError {}

/** Raised when a connection to Monitor cannot be established. */
export class ConnectionError extends MonitorToolError {}
