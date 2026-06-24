import { describe, it, expect } from 'vitest';
import {
  parseTagSet,
  parseTagFilters,
  matchesTagFilters,
  filterByTags,
  tagsForGroup,
  TagError,
  type TagSet,
} from './index.js';

const SAMPLE = `version: 1
groups:
  - name: Production
    tags:
      owner: dba-team
      business_unit: Payments
      criticality: high
      cost_center: 4200
  - name: Staging
    tags:
      owner: dba-team
      criticality: low
  - name: Sandbox
`;

describe('parseTagSet', () => {
  it('parses groups and coerces non-string values to strings', () => {
    const set = parseTagSet(SAMPLE);
    expect(set.groups).toHaveLength(3);
    const prod = set.groups[0]!;
    expect(prod.tags.cost_center).toBe('4200');
    expect(prod.tags.criticality).toBe('high');
    // A group with no tags block normalizes to an empty object.
    expect(set.groups[2]!.tags).toEqual({});
  });

  it('treats an empty file as an empty set', () => {
    expect(parseTagSet('').groups).toEqual([]);
  });

  it('rejects duplicate group names', () => {
    const dup = `version: 1
groups:
  - name: A
  - name: A
`;
    expect(() => parseTagSet(dup)).toThrow(TagError);
  });

  it('rejects unknown top-level keys', () => {
    expect(() => parseTagSet('version: 1\nbogus: true\n')).toThrow(TagError);
  });

  it('drops prototype-polluting tag keys', () => {
    const evil = `version: 1
groups:
  - name: A
    tags:
      __proto__: polluted
      owner: real
`;
    const set = parseTagSet(evil);
    expect(set.groups[0]!.tags.owner).toBe('real');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(set.groups[0]!.tags, '__proto__')).toBe(
      false,
    );
  });
});

describe('parseTagFilters', () => {
  it('parses key=value pairs', () => {
    expect(parseTagFilters(['owner=dba-team', 'criticality=high'])).toEqual([
      { key: 'owner', value: 'dba-team' },
      { key: 'criticality', value: 'high' },
    ]);
  });

  it('keeps values that contain =', () => {
    expect(parseTagFilters(['note=a=b'])).toEqual([{ key: 'note', value: 'a=b' }]);
  });

  it('rejects malformed expressions', () => {
    expect(() => parseTagFilters(['owner'])).toThrow(TagError);
    expect(() => parseTagFilters(['=value'])).toThrow(TagError);
    expect(() => parseTagFilters(['owner='])).toThrow(TagError);
  });
});

describe('matchesTagFilters / filterByTags', () => {
  const set: TagSet = parseTagSet(SAMPLE);

  it('matches everything with no filters', () => {
    expect(matchesTagFilters({ owner: 'x' }, [])).toBe(true);
  });

  it('is case-insensitive on values', () => {
    expect(
      matchesTagFilters({ criticality: 'High' }, parseTagFilters(['criticality=high'])),
    ).toBe(true);
  });

  it('ANDs across distinct keys', () => {
    const f = parseTagFilters(['owner=dba-team', 'criticality=high']);
    expect(filterByTags(set, ['Production', 'Staging', 'Sandbox'], f)).toEqual([
      'Production',
    ]);
  });

  it('ORs within a repeated key', () => {
    const f = parseTagFilters(['criticality=high', 'criticality=low']);
    expect(filterByTags(set, ['Production', 'Staging', 'Sandbox'], f)).toEqual([
      'Production',
      'Staging',
    ]);
  });

  it('excludes groups missing the filtered key', () => {
    const f = parseTagFilters(['owner=dba-team']);
    expect(filterByTags(set, ['Production', 'Staging', 'Sandbox'], f)).toEqual([
      'Production',
      'Staging',
    ]);
  });

  it('returns the input unchanged with no filters', () => {
    expect(filterByTags(set, ['Sandbox', 'Production'], [])).toEqual([
      'Sandbox',
      'Production',
    ]);
  });
});

describe('tagsForGroup', () => {
  const set = parseTagSet(SAMPLE);
  it('returns tags for a known group', () => {
    expect(tagsForGroup(set, 'Staging').criticality).toBe('low');
  });
  it('returns an empty object for an unknown group', () => {
    expect(tagsForGroup(set, 'Nope')).toEqual({});
  });
});
