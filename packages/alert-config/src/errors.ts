import { MonitorToolError } from '@rgm-power-tools/core';

/** One schema problem, tied back to a line in the source YAML where possible. */
export interface ValidationIssue {
  /** Dotted path into the config, e.g. `groups.0.alerts.cpu_utilization`. */
  path: string;
  message: string;
  /** 1-based line number in the source file, if it could be located. */
  line?: number;
  column?: number;
}

/** Raised when YAML fails schema validation. Carries per-issue details. */
export class ConfigValidationError extends MonitorToolError {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.issues = issues;
  }
}

/** Raised when a referenced config file cannot be read. */
export class ConfigFileError extends MonitorToolError {}
