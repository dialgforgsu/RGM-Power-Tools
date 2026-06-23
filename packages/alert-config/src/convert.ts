/**
 * The conversion layer between YAML's snake_case and TypeScript's camelCase.
 *
 * The Zod schema and on-disk YAML are canonically snake_case. When code wants
 * to work with idiomatic camelCase objects, run the validated config through
 * {@link camelizeKeys}; to serialize back out, run it through
 * {@link snakeizeKeys}. The two are exact inverses for the keys we use.
 *
 * Only object *keys* are transformed — string values (slack channels, emails,
 * server names) are never touched.
 */

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapKeys(value: unknown, transform: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapKeys(item, transform));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[transform(k)] = mapKeys(v, transform);
    }
    return out;
  }
  return value;
}

/** Deep-convert all object keys from snake_case to camelCase. */
export function camelizeKeys<T = unknown>(value: unknown): T {
  return mapKeys(value, snakeToCamel) as T;
}

/** Deep-convert all object keys from camelCase to snake_case. */
export function snakeizeKeys<T = unknown>(value: unknown): T {
  return mapKeys(value, camelToSnake) as T;
}
