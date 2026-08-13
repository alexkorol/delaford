/** @vitest-environment node */

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import actionEvents from '#server/player/handlers/actions/index.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

// Regression: the socket dispatch hands handlers the full message
// ({ event, data: {...} }), so item:equip/unequip must read the payload from
// data.data — reading data.item (top level) silently no-ops and nothing
// equips, which is exactly what happened in-game.

const resetWorld = () => {
  world._players = [];
};

const makePlayer = () => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  username: 'Equip Tester',
  inventory: {
    slots: [
      {
        id: 'bronze-sword',
        uuid: 'sword-uuid-1',
        slot: 0,
        equipSlot: 'right_hand',
        slotType: 'right_hand',
        graphics: { tileset: 'weapons', row: 0, column: 0 },
        position: { x: 0, y: 0 },
      },
    ],
  },
  wear: {
    right_hand: null,
    left_hand: null,
    head: null,
    armor: null,
    gloves: null,
    feet: null,
    back: null,
    necklace: null,
    ring: null,
  },
  combat: { attack: {}, defense: {} },
  refreshDerivedStats: vi.fn(),
});

const wrappedEquip = uuid => ({
  event: 'item:equip',
  data: {
    id: 'player-1',
    player: { uuid: 'player-1', socket_id: 'socket-1' },
    item: {
      uuid,
      id: 'bronze-sword',
      targetSlot: 'right_hand',
      miscData: { slot: 0, targetSlot: 'right_hand' },
    },
  },
});

const contextActionEquip = uuid => ({
  id: 'player-1',
  player: { uuid: 'player-1', socket_id: 'socket-1' },
  item: {
    uuid,
    id: 'bronze-sword',
    miscData: { slot: 0 },
    action: { actionId: 'item:equip', name: 'Equip' },
  },
  data: {
    miscData: { slot: 0 },
  },
});

describe('item:equip socket handler', () => {
  beforeEach(() => {
    resetWorld();
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('equips an item addressed by the wrapped data.data payload', async () => {
    const player = makePlayer();
    world._players.push(player);

    await actionEvents['item:equip'](wrappedEquip('sword-uuid-1'));

    expect(player.wear.right_hand).toBeTruthy();
    expect(player.wear.right_hand.id).toBe('bronze-sword');
    expect(player.inventory.slots.find(item => item && item.uuid === 'sword-uuid-1')).toBeUndefined();
  });

  it('does nothing for an item not in the inventory (no crash, stays unarmed)', async () => {
    const player = makePlayer();
    player.inventory.slots = []; // nothing to equip
    world._players.push(player);

    await actionEvents['item:equip'](wrappedEquip('sword-uuid-1'));

    expect(player.wear.right_hand).toBeNull();
  });

  it('equips from the server-built context-action envelope', async () => {
    const player = makePlayer();
    world._players.push(player);

    await actionEvents['item:equip'](contextActionEquip('sword-uuid-1'));

    expect(player.wear.right_hand).toEqual(expect.objectContaining({
      id: 'bronze-sword',
      uuid: 'sword-uuid-1',
    }));
    expect(player.inventory.slots).toHaveLength(0);
  });

  it('unequips from the server-built context-action envelope', async () => {
    const player = makePlayer();
    const sword = player.inventory.slots.shift();
    player.wear.right_hand = sword;
    world._players.push(player);

    actionEvents['item:unequip']({
      id: 'player-1',
      player: { uuid: 'player-1', socket_id: 'socket-1' },
      item: {
        uuid: sword.uuid,
        id: sword.id,
        miscData: { slot: 'right_hand' },
        action: { actionId: 'item:unequip', name: 'Unequip' },
      },
      data: {
        miscData: { slot: 'right_hand' },
      },
    });

    await vi.waitFor(() => {
      expect(player.wear.right_hand).toBeNull();
    });
    expect(player.inventory.slots).toEqual([
      expect.objectContaining({ id: 'bronze-sword', uuid: 'sword-uuid-1' }),
    ]);
  });
});
