/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import Player, { normalisePlayerSkills } from '#server/core/player.js';
import Inventory from '#server/core/utilities/common/player/inventory.js';
import playerTemplate from '#server/core/data/helpers/player.json';

describe('stale player snapshot tolerance', () => {
  it('rebuilds the canonical skill set from malformed and renamed entries', () => {
    const skills = normalisePlayerSkills({
      attack: null,
      defence: { exp: 'old-number', level: 99 },
      mining: { exp: -50 },
      renamedCraft: { exp: 5000 },
    });

    expect(Object.keys(skills)).toEqual([
      'attack', 'defence', 'mining', 'smithing', 'fishing', 'cooking',
    ]);
    expect(skills.attack).toMatchObject({ exp: 0, level: 1 });
    expect(skills.defence).toMatchObject({ exp: 0, level: 1 });
    expect(skills.mining).toMatchObject({ exp: 0, level: 1 });
    expect(skills).not.toHaveProperty('renamedCraft');
  });

  it('drops malformed records and preserves removed ids as inert legacy items', () => {
    const inventory = new Inventory([
      null,
      'old-string-record',
      { id: 'removed-item-id', slot: 0 },
      { id: 'coins', uuid: 'valid-coins', slot: 1, qty: 7 },
    ], 'socket-stale', 'player-stale');

    expect(inventory.slots).toHaveLength(2);
    expect(inventory.slots.find(item => item.id === 'removed-item-id')).toMatchObject({ actions: [] });
    expect(inventory.slots.find(item => item.id === 'coins'))
      .toMatchObject({ uuid: 'valid-coins', qty: 7 });
  });

  it('constructs a playable Player from a fuzzed old Chronicle snapshot', () => {
    const stale = {
      ...structuredClone(playerTemplate),
      uuid: 'stale-player',
      username: 'Old Scion',
      skills: { attack: null, oldAlchemy: { exp: 500 } },
      inventory: { 0: { id: 'removed-item-id' } },
      bank: 'old-bank-shape',
      friend_list: null,
      wear: { right_hand: 'removed-item-id' },
      passiveTree: {
        nodes: ['renamed-node-id'],
        conduits: ['renamed-conduit-id'],
        selectedNodeId: 'renamed-node-id',
      },
    };

    let player;
    expect(() => {
      player = new Player(stale, 'none', 'socket-stale');
    }).not.toThrow();

    expect(player.inventory.slots).toEqual([]);
    expect(player.bank).toEqual([]);
    expect(player.wear.right_hand).toBeNull();
    expect(player.passiveTree).toBeNull();
    expect(player.skills.attack).toMatchObject({ exp: 0, level: 1 });
    expect(player.skills.cooking).toMatchObject({ exp: 0, level: 1 });
  });
});
