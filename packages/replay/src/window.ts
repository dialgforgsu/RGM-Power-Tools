import type { TimeWindow } from '@rgm-power-tools/core';
import { ReplayError } from './types.js';

export interface WindowInput {
  from?: string;
  to?: string;
  /** Relative window ending now, e.g. "90m", "2h", "1d". */
  last?: string;
  /** Clock for relative windows. Defaults to now. */
  now?: Date;
}

const DURATION = /^(\d+)\s*(m|min|mins|h|hr|hrs|d|day|days)$/i;

/** Parse a duration like `90m`, `2h`, `1d` into milliseconds. */
export function parseDurationMs(spec: string): number {
  const match = DURATION.exec(spec.trim());
  if (!match) {
    throw new ReplayError(
      `Invalid duration "${spec}". Use e.g. 90m, 2h, or 1d.`,
    );
  }
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const mult = unit.startsWith('d')
    ? 86_400_000
    : unit.startsWith('h')
      ? 3_600_000
      : 60_000;
  return n * mult;
}

/**
 * Resolve an incident {@link TimeWindow} from either an explicit `from`/`to`
 * pair (ISO-8601) or a relative `last` duration ending now. Throws
 * {@link ReplayError} on missing/invalid/contradictory input.
 */
export function parseWindow(input: WindowInput): TimeWindow {
  const now = input.now ?? new Date();

  if (input.last) {
    if (input.from || input.to) {
      throw new ReplayError('Use either --last or --from/--to, not both.');
    }
    const end = now;
    const start = new Date(end.getTime() - parseDurationMs(input.last));
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
  }

  if (!input.from || !input.to) {
    throw new ReplayError(
      'Provide --from and --to (ISO timestamps), or --last <duration>.',
    );
  }
  const start = new Date(input.from);
  const end = new Date(input.to);
  if (Number.isNaN(start.getTime())) {
    throw new ReplayError(`Invalid --from timestamp: "${input.from}".`);
  }
  if (Number.isNaN(end.getTime())) {
    throw new ReplayError(`Invalid --to timestamp: "${input.to}".`);
  }
  if (start.getTime() >= end.getTime()) {
    throw new ReplayError('--from must be before --to.');
  }
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}
