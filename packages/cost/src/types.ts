import type { MonitoringStatus } from '@rgm-power-tools/core';

export interface CostOptions {
  /** Days without data before a licensed server counts as waste. */
  idleDays: number;
  /** Cost per licensed slot per billing period. Optional (slots-only if unset). */
  costPerSlot?: number;
  /** Currency/unit label for display, e.g. "USD" or "£". */
  currency: string;
}

/** A licensed server that isn't pulling its weight. */
export interface IdleServer {
  name: string;
  status: MonitoringStatus;
  lastDataUtc: string | null;
  /** Whole days since last data, or null if it has never sent any. */
  daysIdle: number | null;
}

export interface CostReport {
  totalSlots: number;
  usedSlots: number;
  freeSlots: number;
  /** Used / total, 0–100, rounded. */
  utilizationPct: number;
  idleDays: number;
  /** Licensed servers idle beyond the threshold (or never seen). */
  idleServers: IdleServer[];
  wastedSlots: number;
  currency: string;
  costPerSlot?: number;
  /** totalSlots × costPerSlot — what the license costs you. */
  licenseCost?: number;
  /** wastedSlots × costPerSlot — reclaimable spend. */
  wastedSpend?: number;
}

export interface Projection {
  addServers: number;
  freeSlots: number;
  /** New slots that must be purchased: max(0, addServers − freeSlots). */
  additionalSlotsNeeded: number;
  /** Whether the new servers fit within the existing license. */
  withinLicense: boolean;
  currency: string;
  costPerSlot?: number;
  /** additionalSlotsNeeded × costPerSlot. */
  additionalSpend?: number;
  /** (totalSlots + additionalSlotsNeeded) × costPerSlot. */
  projectedLicenseCost?: number;
}
