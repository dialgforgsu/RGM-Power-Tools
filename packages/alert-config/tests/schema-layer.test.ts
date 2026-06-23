import { describe, it, expect } from 'vitest';
import { camelizeKeys, snakeizeKeys } from '../src/convert.js';
import { parseConfig, serializeConfig } from '../src/yaml-io.js';
import { resolveConfig } from '../src/resolve.js';
import { VALID_CONFIG } from './helpers.js';

describe('convert (snake <-> camel)', () => {
  it('round-trips keys without touching values', () => {
    const snake = {
      base_monitor_url: 'https://x',
      groups: [{ threshold_seconds: 600, slack: '#prod-alerts' }],
    };
    const camel = camelizeKeys<Record<string, unknown>>(snake);
    expect(camel).toEqual({
      baseMonitorUrl: 'https://x',
      groups: [{ thresholdSeconds: 600, slack: '#prod-alerts' }],
    });
    expect(snakeizeKeys(camel)).toEqual(snake);
  });
});

describe('yaml-io serialize', () => {
  it('is deterministic across runs', () => {
    const config = parseConfig(VALID_CONFIG);
    expect(serializeConfig(config)).toBe(serializeConfig(config));
  });

  it('round-trips through parse -> serialize -> parse', () => {
    const config = parseConfig(VALID_CONFIG);
    const reparsed = parseConfig(serializeConfig(config));
    expect(reparsed).toEqual(config);
  });
});

describe('resolve inheritance', () => {
  it('flattens overrides onto the parent', () => {
    const config = parseConfig(
      VALID_CONFIG +
        `  - name: Dev
    inherits_from: Production
    overrides:
      alerts:
        cpu_utilization:
          enabled: false
        long_running_query:
          threshold_seconds: 1800
`,
    );
    const resolved = resolveConfig(config);
    const dev = resolved.groups.find((g) => g.name === 'Dev')!;
    expect(dev.alerts.cpu_utilization?.enabled).toBe(false);
    // value inherited from Production, enabled overridden
    expect(dev.alerts.cpu_utilization?.thresholds.high.value).toBe(90);
    expect(dev.alerts.long_running_query?.threshold_seconds).toBe(1800);
  });

  it('detects inheritance cycles', () => {
    const config = parseConfig(`version: 1
connection:
  base_monitor_url: x
  auth_token: y
groups:
  - name: A
    inherits_from: B
    overrides: { alerts: {} }
  - name: B
    inherits_from: A
    overrides: { alerts: {} }
`);
    expect(() => resolveConfig(config)).toThrow(/cycle/i);
  });
});
