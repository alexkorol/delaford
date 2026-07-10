/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { buildScionSnapshot } from '#server/core/services/chronicles.js';
import { buildGuestSnapshot } from '#server/core/repositories/guest-save-store.js';

const rolledAxe = {
  id: 'steel-battleaxe',
  uuid: 'rolled-axe-1',
  name: 'Steel Battleaxe',
  displayName: 'The Long Road',
  stats: {
    attack: { stab: -2, slash: 23, crush: 15, range: 0 },
    defense: { stab: 0, slash: 1, crush: 2, range: 2 },
  },
  affixes: { brand: { id: 'heavy', roll: 4 } },
};

const makePlayer = () => ({
  x: 10,
  y: 20,
  sceneId: 'town:delaford',
  level: 2,
  skills: {},
  wear: { right_hand: rolledAxe, armor: null },
  inventory: { slots: [] },
  bank: [],
  passiveTree: null,
  stats: {
    lifecycle: { mode: 'hard', state: 'alive' },
    resources: {},
  },
});

describe('worn item persistence', () => {
  it.each([
    ['Chronicle SQLite', buildScionSnapshot],
    ['legacy guest save', buildGuestSnapshot],
  ])('keeps complete rolled gear in the %s snapshot', (_label, buildSnapshot) => {
    const snapshot = buildSnapshot(makePlayer());
    expect(snapshot.wear.right_hand).toEqual(rolledAxe);
    expect(snapshot.wear.right_hand).not.toBe(rolledAxe);
  });
});
