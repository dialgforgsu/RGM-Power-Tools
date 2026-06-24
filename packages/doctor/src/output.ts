import chalk from 'chalk';
import { CHECKS } from './checks/index.js';
import type { DoctorReport } from './run.js';
import type { Severity } from './types.js';

const LABEL: Record<Severity, string> = {
  error: chalk.red('error'),
  warning: chalk.yellow('warning'),
  info: chalk.blue('info'),
};

/** Render a doctor report, npm-audit style. `out` receives one line at a time. */
export function renderReport(
  report: DoctorReport,
  out: (msg?: string) => void,
): void {
  if (report.total === 0) {
    out(chalk.green('✓ No issues found. Your Monitor installation looks healthy.'));
    return;
  }

  for (const f of report.findings) {
    const subject = f.subject ? chalk.bold(f.subject) : '';
    out(`${LABEL[f.severity]}  ${f.title}${subject ? ` — ${subject}` : ''}`);
    if (f.detail) out(`        ${chalk.dim(f.detail)}`);
    out(chalk.dim(`        [${f.checkId}]`));
  }

  out('');
  out(summaryLine(report));
}

/** A one-line summary, e.g. "4 issues: 2 errors, 2 warnings". */
export function summaryLine(report: DoctorReport): string {
  const parts: string[] = [];
  if (report.counts.error) parts.push(chalk.red(`${report.counts.error} error(s)`));
  if (report.counts.warning)
    parts.push(chalk.yellow(`${report.counts.warning} warning(s)`));
  if (report.counts.info) parts.push(chalk.blue(`${report.counts.info} info`));
  return `${report.total} issue(s): ${parts.join(', ')}.`;
}

/** List every available check (for `monitor-doctor list`). */
export function renderCheckList(out: (msg?: string) => void): void {
  out(chalk.bold('Available checks:'));
  for (const c of CHECKS) {
    out(`  ${chalk.cyan(c.id)} ${chalk.dim(`(${c.severity})`)}`);
    out(`      ${c.description}`);
  }
}
