/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  pruneUnrecoveredRelics,
  removeItemIdentity,
  selectScionRelic,
  unrecoveredRelicUuids,
} from '#server/core/services/scion-relics.js';

const sword = (uuid = 'sword-1') => ({
  id: 'bronze-sword',
  uuid,
  name: 'Verdant Bronze Sword',
  displayName: 'Verdant Bronze Sword',
  type: 'weapon',
  stackable: false,
  equipSlot: 'right_hand',
  stats: {
    attack: { stab: 3, slash: 8, crush: 0, range: 0 },
    defense: { stab: 0, slash: 0, crush: 0, range: 0 },
  },
  affixes: { brand: { id: 'verdant' }, bond: null },
  vessel: { ilvl: 5, rarity: 'uncommon' },
});

const playerWith = ({ wear = {}, inventory = [] } = {}) => ({
  wear,
  inventory: { slots: inventory },
  combat: {},
  refreshDerivedStats: vi.fn(),
});

describe('fallen Scion relic selection', () => {
  it('chooses equipped main-hand gear before backpack gear without changing identity', () => {
    const equipped = sword('equipped-sword');
    const backpack = sword('backpack-sword');
    const player = playerWith({
      wear: { right_hand: equipped },
      inventory: [backpack],
    });

    const selected = selectScionRelic(player);

    expect(selected.location).toEqual({ type: 'wear', slot: 'right_hand' });
    expect(selected.item).toEqual(equipped);
    expect(selected.item).not.toBe(equipped);
  });

  it('removes an exact identity and recalculates equipped combat stats', () => {
    const kept = sword('kept-sword');
    const removed = sword('removed-sword');
    const player = playerWith({
      wear: { right_hand: removed, left_hand: null },
      inventory: [removed, kept],
    });

    expect(removeItemIdentity(player, 'removed-sword')).toBe(true);
    expect(player.wear.right_hand).toBeNull();
    expect(player.inventory.slots.map(item => item.uuid)).toEqual(['kept-sword']);
    expect(player.combat.attack.slash).toBe(0);
    expect(player.refreshDerivedStats).toHaveBeenCalledOnce();
  });

  it('prunes queued or circulating duplicates but keeps recovered heirlooms', () => {
    const player = playerWith({
      wear: { right_hand: sword('queued-relic') },
      inventory: [sword('circulating-relic'), sword('recovered-relic')],
    });
    const chronicles = {
      houses: [{
        crypt: [
          { relic: { status: 'queued', item: { uuid: 'queued-relic' } } },
          { relic: { status: 'circulating', item: { uuid: 'circulating-relic' } } },
          { relic: { status: 'recovered', item: { uuid: 'recovered-relic' } } },
        ],
      }],
    };

    expect([...unrecoveredRelicUuids(chronicles)]).toEqual([
      'queued-relic',
      'circulating-relic',
    ]);
    expect(pruneUnrecoveredRelics(player, chronicles)).toBe(2);
    expect(player.inventory.slots.map(item => item.uuid)).toEqual(['recovered-relic']);
  });
});
