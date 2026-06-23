import { z } from 'zod';

/**
 * Zod schema for the monitor-config YAML. This is the single source of truth:
 * the TypeScript types, runtime validation, and (via {@link buildJsonSchema})
 * an editor-facing JSON Schema all derive from it.
 *
 * YAML is authored in snake_case to match Monitor conventions; see
 * `convert.ts` for the camelCase domain view used inside TypeScript.
 */

// --- Reusable leaf schemas ---------------------------------------------------

const notificationsSchema = z
  .object({
    email: z.array(z.string().email()).optional(),
    slack: z.string().min(1).optional(),
  })
  .strict();

/** A percentage threshold that also has a sustain duration. */
const durationThresholdSchema = z
  .object({
    value: z.number().min(0).max(100),
    duration_seconds: z.number().int().min(0).optional(),
  })
  .strict();

/** A bare percentage threshold (no duration). */
const percentThresholdSchema = z
  .object({
    value: z.number().min(0).max(100),
  })
  .strict();

// --- Per-alert schemas (the curated, strongly-typed subset) ------------------

const cpuUtilizationSchema = z
  .object({
    enabled: z.boolean(),
    thresholds: z
      .object({
        high: durationThresholdSchema,
        medium: durationThresholdSchema.optional(),
      })
      .strict(),
    notifications: notificationsSchema.optional(),
  })
  .strict();

const memoryUtilizationSchema = cpuUtilizationSchema;

const diskSpaceSchema = z
  .object({
    enabled: z.boolean(),
    thresholds: z
      .object({
        high: percentThresholdSchema,
        medium: percentThresholdSchema.optional(),
      })
      .strict(),
    notifications: notificationsSchema.optional(),
  })
  .strict();

const longRunningQuerySchema = z
  .object({
    enabled: z.boolean(),
    threshold_seconds: z.number().int().min(0),
    notifications: notificationsSchema.optional(),
  })
  .strict();

const blockingProcessSchema = longRunningQuerySchema;

const deadlockSchema = z
  .object({
    enabled: z.boolean(),
    notifications: notificationsSchema.optional(),
  })
  .strict();

const jobFailedSchema = deadlockSchema;

/**
 * The set of supported alerts. Adding a new curated alert is a matter of
 * adding a key here plus an entry in `alert-types.ts`.
 */
const ALERT_SHAPES = {
  cpu_utilization: cpuUtilizationSchema,
  memory_utilization: memoryUtilizationSchema,
  disk_space: diskSpaceSchema,
  long_running_query: longRunningQuerySchema,
  blocking_process: blockingProcessSchema,
  deadlock: deadlockSchema,
  job_failed: jobFailedSchema,
} as const;

export type AlertName = keyof typeof ALERT_SHAPES;
export const ALERT_NAMES = Object.keys(ALERT_SHAPES) as AlertName[];

const alertsSchema = z
  .object(
    Object.fromEntries(
      Object.entries(ALERT_SHAPES).map(([k, v]) => [k, v.optional()]),
    ) as { [K in AlertName]: z.ZodOptional<(typeof ALERT_SHAPES)[K]> },
  )
  .strict();

/** Overrides may set any subset of an alert's fields, so go deep-partial. */
const overrideAlertsSchema = z
  .object(
    Object.fromEntries(
      Object.entries(ALERT_SHAPES).map(([k, v]) => [
        k,
        (v as z.AnyZodObject).deepPartial().optional(),
      ]),
    ),
  )
  .strict();

// --- Top-level schema --------------------------------------------------------

const connectionSchema = z
  .object({
    base_monitor_url: z.string().min(1),
    auth_token: z.string().min(1),
  })
  .strict();

const groupSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    servers: z.array(z.string().min(1)).optional(),
    alerts: alertsSchema.optional(),
    inherits_from: z.string().min(1).optional(),
    overrides: z
      .object({ alerts: overrideAlertsSchema.optional() })
      .strict()
      .optional(),
  })
  .strict();

export const configSchema = z
  .object({
    version: z.literal(1),
    connection: connectionSchema,
    groups: z.array(groupSchema).min(1),
  })
  .strict();

/** The validated YAML config (snake_case, as authored). */
export type ConfigFile = z.infer<typeof configSchema>;
export type GroupConfig = z.infer<typeof groupSchema>;
export type AlertsConfig = z.infer<typeof alertsSchema>;
export type Notifications = z.infer<typeof notificationsSchema>;

/**
 * Build a JSON Schema from the Zod schema, e.g. for editor autocompletion or
 * to publish alongside the YAML. Imported lazily so the dependency is only
 * loaded when actually requested.
 */
export async function buildJsonSchema(): Promise<unknown> {
  const { zodToJsonSchema } = await import('zod-to-json-schema');
  return zodToJsonSchema(configSchema, 'MonitorConfig');
}
