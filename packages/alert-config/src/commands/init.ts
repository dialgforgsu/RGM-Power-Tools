import { resolve } from 'node:path';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import chalk from 'chalk';
import { DEFAULT_CONFIG_FILE } from '../constants.js';
import type { CliIO } from '../io.js';

export interface InitOptions {
  /** Overwrite existing files instead of skipping them. */
  force?: boolean;
}

const STARTER_YAML = `version: 1

# Connection details. These are placeholders — the real URL and token are read
# from --url/--auth-token, the MONITOR_URL/MONITOR_AUTH_TOKEN environment
# variables, or .monitor-config.json. The token is NEVER written here.
connection:
  base_monitor_url: \${MONITOR_URL}
  auth_token: \${MONITOR_AUTH_TOKEN}

groups:
  - name: Production
    description: Customer-facing production servers
    servers:
      - PROD-SQL-01
      - PROD-SQL-02
    alerts:
      cpu_utilization:
        enabled: true
        thresholds:
          high:
            value: 90
            duration_seconds: 600
          medium:
            value: 75
            duration_seconds: 300
        notifications:
          email:
            - dba-oncall@example.com
          slack: "#prod-alerts"
      long_running_query:
        enabled: true
        threshold_seconds: 600
      disk_space:
        enabled: true
        thresholds:
          high:
            value: 95
          medium:
            value: 85

  - name: Development
    inherits_from: Production
    servers:
      - DEV-SQL-01
    overrides:
      alerts:
        cpu_utilization:
          enabled: false
        long_running_query:
          threshold_seconds: 1800
`;

const GITIGNORE_ENTRIES = ['.monitor-config.json', '.env', '.env.*'];

const LOCAL_CONFIG_TEMPLATE = `{
  "url": "https://your-monitor-instance.example.com",
  "authToken": "paste-your-token-here"
}
`;

/**
 * Scaffold a new config repo: a starter YAML, a .gitignore (so the local config
 * with the token is never committed), and a .monitor-config.json template.
 * Existing files are skipped unless --force is given.
 */
export async function runInit(
  options: InitOptions,
  io: CliIO,
): Promise<number> {
  const force = Boolean(options.force);

  const wrote: string[] = [];
  const skipped: string[] = [];

  const writeIfAbsent = (name: string, content: string) => {
    const path = resolve(io.cwd, name);
    if (existsSync(path) && !force) {
      skipped.push(name);
      return;
    }
    writeFileSync(path, content, 'utf8');
    wrote.push(name);
  };

  writeIfAbsent(DEFAULT_CONFIG_FILE, STARTER_YAML);
  writeIfAbsent('.monitor-config.json', LOCAL_CONFIG_TEMPLATE);
  ensureGitignore(io.cwd);

  for (const name of wrote) io.out(chalk.green(`  created  ${name}`));
  for (const name of skipped)
    io.out(
      chalk.yellow(`  skipped  ${name} (exists; use --force to overwrite)`),
    );

  io.out('');
  io.out(chalk.bold('Next steps:'));
  io.out('  1. Put your Monitor URL and token in .monitor-config.json');
  io.out('     (or set MONITOR_URL / MONITOR_AUTH_TOKEN).');
  io.out(`  2. Edit ${DEFAULT_CONFIG_FILE} to match your environments.`);
  io.out('  3. Run "monitor-config validate" to schema-check it.');
  io.out('  4. Run "monitor-config export" to pull live settings, or');
  io.out('     "monitor-config diff" to compare your config against live.');
  return 0;
}

/** Create or append our entries to .gitignore without clobbering existing rules. */
function ensureGitignore(cwd: string): void {
  const path = resolve(cwd, '.gitignore');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const missing = GITIGNORE_ENTRIES.filter(
    (entry) => !existing.split(/\r?\n/).includes(entry),
  );
  if (missing.length === 0) return;
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  const block = `${prefix}\n# Added by monitor-config init — never commit secrets\n${missing.join('\n')}\n`;
  writeFileSync(path, existing + block, 'utf8');
}
