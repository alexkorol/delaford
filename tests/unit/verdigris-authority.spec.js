/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  earnedVerdigrisPoints,
  resolveVerdigrisTree,
} from '#server/core/passives/verdigris-authority.js';

const firstAllocation = overrides => ({
  nodes: ['0,0', '1,0'],
  conduits: [{ id: '0,0:1,0', variant: 'outer' }],
  points: { skill: 997 },
  earned: 999,
  selectedNodeId: '1,0',
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
    expect(earnedVerdigrisPoints(999)).toBe(100);
  });
});
