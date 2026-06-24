import { MonitorToolError } from '@rgm-power-tools/core';
import { CHECKS, checkById } from './checks/index.js';
import {
  SEVERITY_RANK,
  type Finding,
  type MonitorSnapshot,
  type Severity,
} from './types.js';

/** Raised when an unknown check id is requested. */
export class UnknownCheckError extends MonitorToolError {}

export interface RunOptions {
  /** Restrict to these check ids. Empty/undefined runs all. */
  checks?: string[];
  /** Clock for time-based checks. Defaults to the current time. */
  now?: Date;
}

export interface DoctorReport {
  findings: Finding[];
  counts: Record<Severity, number>;
  total: number;
  /** Ids of the checks that ran. */
  checksRun: string[];
}

/** Run the selected checks over a snapshot and aggregate the findings. */
export function runChecks(
  snapshot: MonitorSnapshot,
  options: RunOptions = {},
): DoctorReport {
  const now = options.now ?? new Date();

  const selected =
    options.checks && options.checks.length > 0
      ? options.checks.map((id) => {
          const check = checkById(id);
          if (!check) throw new UnknownCheckError(`Unknown check: "${id}".`);
          return check;
        })
      : CHECKS;

  const findings: Finding[] = [];
  for (const check of selected) findings.push(...check.run(snapshot, now));

  findings.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.checkId.localeCompare(b.checkId) ||
      (a.subject ?? '').localeCompare(b.subject ?? ''),
  );

  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    findings,
    counts,
    total: findings.length,
    checksRun: selected.map((c) => c.id),
  };
}

/** Does the report contain any finding at or above `threshold`? */
export function hasFindingsAtOrAbove(
  report: DoctorReport,
  threshold: Severity,
): boolean {
  return report.findings.some(
    (f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[threshold],
  );
}
