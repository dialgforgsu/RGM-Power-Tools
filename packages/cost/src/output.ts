import chalk from 'chalk';
import type { CostReport, Projection } from './types.js';

/** Format an amount with thousands separators and an optional currency label. */
export function formatMoney(amount: number, currency: string): string {
  const n = amount.toLocaleString('en-US');
  return currency ? `${n} ${currency}` : n;
}

function utilizationColor(pct: number): (s: string) => string {
  if (pct >= 90) return chalk.red;
  if (pct >= 75) return chalk.yellow;
  return chalk.green;
}

/** Render a license-utilization report. `out` receives one line at a time. */
export function renderReport(
  report: CostReport,
  out: (msg?: string) => void,
): void {
  const color = utilizationColor(report.utilizationPct);
  out(chalk.bold('License utilization'));
  out(
    `  ${report.usedSlots}/${report.totalSlots} slots used ` +
      `(${color(`${report.utilizationPct}%`)}), ${report.freeSlots} free.`,
  );
  if (report.licenseCost != null) {
    out(`  License cost: ${formatMoney(report.licenseCost, report.currency)}.`);
  }
  out('');

  if (report.wastedSlots === 0) {
    out(
      chalk.green(
        `✓ No wasted slots — every licensed server has sent data in the last ` +
          `${report.idleDays} days.`,
      ),
    );
  } else {
    const headline =
      report.wastedSpend != null
        ? `${report.wastedSlots} wasted slot(s) = ${formatMoney(report.wastedSpend, report.currency)} reclaimable`
        : `${report.wastedSlots} wasted slot(s)`;
    out(chalk.yellow(chalk.bold(headline)));
    out(
      chalk.dim(
        `Licensed servers with no data in ${report.idleDays}+ days:`,
      ),
    );
    for (const s of report.idleServers) {
      const age =
        s.daysIdle == null ? 'never sent data' : `idle ${s.daysIdle} days`;
      out(`  ${chalk.red('•')} ${s.name} ${chalk.dim(`(${s.status}, ${age})`)}`);
    }
  }
}

/** Render an onboarding projection. */
export function renderProjection(
  projection: Projection,
  out: (msg?: string) => void,
): void {
  out(chalk.bold(`Projection: onboard ${projection.addServers} server(s)`));
  out(`  Free slots available now: ${projection.freeSlots}.`);
  if (projection.withinLicense) {
    out(
      chalk.green(
        `  ✓ Fits within your existing license — no additional slots needed.`,
      ),
    );
  } else {
    out(
      chalk.yellow(
        `  Needs ${projection.additionalSlotsNeeded} new slot(s).`,
      ),
    );
  }
  if (projection.additionalSpend != null) {
    out(
      `  Additional spend: ${formatMoney(projection.additionalSpend, projection.currency)}.`,
    );
    out(
      `  Projected license cost: ${formatMoney(projection.projectedLicenseCost ?? 0, projection.currency)}.`,
    );
  }
}
