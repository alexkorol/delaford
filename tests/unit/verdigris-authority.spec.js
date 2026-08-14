/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  earnedVerdigrisPoints,
  resolvePersistedVerdigrisTree,
  resolveVerdigrisTree,
} from '#server/core/passives/verdigris-authority.js';
import { VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION } from '@/core/passives/verdigris-geometric-tree.js';

const firstAllocation = overrides => ({
  schemaVersion: VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION,
  nodes: ['0,0', '1,0'],
  conduits: [{ id: '0,0:1,0', variant: 'outer' }],
  points: { skill: 997 },
  earned: 999,
  selectedNodeId: '1,0',
  classOrder: [],
  ...overrides,
});

describe('server-authoritative Verdigris tree', () => {
  it('derives the point budget and attributes instead of trusting the client', () => {
    const result = resolveVerdigrisTree(firstAllocation(), 1);
    expect(result.ok).toBe(true);
    expect(result.snapshot.earned).toBe(2);
    expect(result.snapshot.points.skill).toBe(0);
    expect(Object.values(result.attributes).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
  });

  it('rejects unknown, disconnected, and invalid conduit allocations', () => {
    expect(resolveVerdigrisTree(firstAllocation({ nodes: ['0,0', 'not-a-node'] }), 10).ok).toBe(false);
    expect(resolveVerdigrisTree(firstAllocation({ nodes: ['0,0', '2,0'], conduits: [] }), 10).ok).toBe(false);
    expect(resolveVerdigrisTree(firstAllocation({
      conduits: [{ id: '0,0:1,0', variant: 'invented' }],
    }), 10).ok).toBe(false);
  });

  it('caps level-earned points at the declared level source budget', () => {
    expect(earnedVerdigrisPoints(1)).toBe(2);
    expect(earnedVerdigrisPoints(50)).toBe(50);
    expect(earnedVerdigrisPoints(999)).toBe(117);
    expect(earnedVerdigrisPoints(100, 1)).toBe(101);
    expect(earnedVerdigrisPoints(117, 999)).toBe(140);
  });

  it('adds earned quest points to the authoritative allocation budget', () => {
    const result = resolveVerdigrisTree(firstAllocation(), 1, 1);
    expect(result.ok).toBe(true);
    expect(result.snapshot.earned).toBe(3);
    expect(result.snapshot.points.skill).toBe(1);
  });

  it('resets obsolete persisted trees once and preserves current snapshots', () => {
    const reset = resolvePersistedVerdigrisTree({
      nodes: ['0,0', '1,0'],
      conduits: [{ id: '0,0:1,0', variant: 'outer' }],
    }, 12, 2);
    expect(reset.ok).toBe(true);
    expect(reset.snapshot).toMatchObject({
      schemaVersion: VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION,
      nodes: ['0,0'],
      conduits: [],
      points: { skill: 14 },
    });

    const current = resolvePersistedVerdigrisTree(firstAllocation(), 12, 2);
    expect(current.ok).toBe(true);
    expect(current.snapshot.nodes).toContain('1,0');
  });
});
