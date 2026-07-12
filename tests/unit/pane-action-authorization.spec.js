/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import actionEvents from '#server/player/handlers/actions/index.js';
import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import Inventory from '#server/core/utilities/common/player/inventory.js';
import world from '#server/core/world.js';

const resetWorld = () => {
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
  town.npcs = [];
  town.respawns = {
    items: [],
    monsters: [],
    resources: [],
  };
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
  world.instances.clear();
  world.shops = [];
};

const makePlayer = () => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  username: 'Pane Tester',
  inventory: {
    slots: [
      {
        id: 'coins',
        qty: 10,
        slot: 0,
      },
    ],
  },
  bank: [],
  currentPane: 'bank',
  combat: {},
});

const makeFillers = (count, startSlot = 0, prefix = 'filler') => (
  Array.from({ length: count }, (_value, index) => ({
    id: `${prefix}-${index}`,
    qty: 1,
    slot: startSlot + index,
  }))
);

const attachInventory = (player, slots) => {
  player.inventory = new Inventory(slots, player.socket_id);
};

const withStackableCopperOre = () => {
  const originalGetItemData = Query.getItemData.bind(Query);
  vi.spyOn(Query, 'getItemData').mockImplementation((id) => {
    const item = originalGetItemData(id);
    if (id === 'copper-ore' && item) {
      return {
        ...item,
        stackable: true,
      };
    }
    return item;
  });
};

const makeGeneralStore = (player, inventory = []) => {
  world.shops = [{
    id: 2,
    npcId: 2,
    name: 'General Store',
    type: 'general',
    originalStock: inventory.map(item => item.id),
    inventory,
  }];
  player.objectId = 2;
  player.currentPane = 'shop';
};

describe('pane action authorization', () => {
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    resetWorld();
    player = makePlayer();
    world.addPlayer(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('uses the authenticated player payload for bank actions when id is absent', async () => {
    await actionEvents['player:screen:bank:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'coins',
        params: { quantity: 5 },
      },
      doing: 'deposit',
    });

    expect(player.inventory.slots).toEqual([
      {
        id: 'coins',
        qty: 5,
        slot: 0,
      },
    ]);
    expect(player.bank).toEqual([
      {
        id: 'coins',
        qty: 5,
        slot: 0,
      },
    ]);
    expect(Socket.emit).toHaveBeenCalledWith('core:refresh:inventory', expect.objectContaining({
      player: { socket_id: player.socket_id },
      data: player.inventory.slots,
    }));
    expect(Socket.emit).toHaveBeenCalledWith('core:bank:refresh', expect.objectContaining({
      player: { socket_id: player.socket_id },
      data: player.bank,
    }));
  });

  it('opens the bank only for the authenticated socket beside the town banker', () => {
    player.x = 31;
    player.y = 122;
    player.sceneId = world.defaultTownId;
    world.getDefaultTown().npcs = [{ id: 4, x: 31, y: 121 }];

    actionEvents['player:screen:bank'](
      { data: { item: { id: 4 } } },
      { id: player.socket_id },
    );

    expect(player.currentPane).toBe('bank');
    expect(Socket.emit).toHaveBeenCalledWith('open:screen', expect.objectContaining({
      player: { socket_id: player.socket_id },
      screen: 'bank',
      payload: expect.objectContaining({ carriedCoins: 10, house: null }),
    }));

    vi.mocked(Socket.emit).mockClear();
    player.x = 1;
    actionEvents['player:screen:bank'](
      { data: { item: { id: 4 } } },
      { id: player.socket_id },
    );
    expect(Socket.emit).not.toHaveBeenCalledWith('open:screen', expect.anything());
  });

  it('opens a reachable shop display from the full socket message shape', () => {
    player.x = 45;
    player.y = 102;
    player.sceneId = world.defaultTownId;
    const stock = [{ id: 'bronze-sword', qty: 10, slot: 0 }];
    makeGeneralStore(player, stock);
    world.getDefaultTown().items = [{
      id: 'bronze-sword',
      x: 45,
      y: 101,
      shopDisplay: true,
      shopNpcId: 2,
    }];

    actionEvents['player:screen:shop-display'](
      { data: { item: { id: 2, shopItemId: 'bronze-sword' } } },
      { id: player.socket_id },
    );

    expect(player.currentPane).toBe('shop');
    expect(Socket.emit).toHaveBeenCalledWith('open:screen', expect.objectContaining({
      player: { socket_id: player.socket_id },
      screen: 'shop',
      payload: world.shops[0],
    }));
  });

  it('deposits stackable items into an existing full-bank stack', async () => {
    player.inventory.slots = [
      { id: 'coins', qty: 10, slot: 0 },
    ];
    player.bank = [
      { id: 'coins', qty: 100, slot: 0 },
      ...makeFillers(199, 1, 'bank-filler'),
    ];

    await actionEvents['player:screen:bank:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'coins',
        params: { quantity: 5 },
      },
      doing: 'deposit',
    });

    expect(player.inventory.slots.find(item => item.id === 'coins').qty).toBe(5);
    expect(player.bank).toHaveLength(200);
    expect(player.bank.find(item => item.id === 'coins')).toMatchObject({
      qty: 105,
      slot: 0,
    });
  });

  it('withdraws stackable items into an existing full-inventory stack', async () => {
    player.inventory.slots = [
      { id: 'coins', qty: 10, slot: 0 },
      ...makeFillers(83, 1, 'inventory-filler'),
    ];
    player.bank = [
      { id: 'coins', qty: 100, slot: 0 },
    ];

    await actionEvents['player:screen:bank:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'coins',
        params: { quantity: 5 },
      },
      doing: 'withdraw',
    });

    expect(player.inventory.slots).toHaveLength(84);
    expect(player.inventory.slots.find(item => item.id === 'coins').qty).toBe(15);
    expect(player.bank.find(item => item.id === 'coins').qty).toBe(95);
  });

  it('rejects stackable deposits into a full bank without an existing stack', async () => {
    player.inventory.slots = [
      { id: 'coins', qty: 10, slot: 0 },
    ];
    player.bank = makeFillers(200, 0, 'bank-filler');

    await actionEvents['player:screen:bank:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'coins',
        params: { quantity: 5 },
      },
      doing: 'deposit',
    });

    expect(player.inventory.slots).toEqual([
      { id: 'coins', qty: 10, slot: 0 },
    ]);
    expect(player.bank).toHaveLength(200);
    expect(player.bank.some(item => item.id === 'coins')).toBe(false);
    expect(player.bank.some(item => item.qty === 0 || item.slot === false)).toBe(false);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      player: { socket_id: player.socket_id },
      text: 'Not enough space to deposit.',
    }));
  });

  it('buys the requested stackable shop quantity and spends matching coins', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'coins', qty: 100, slot: 0 },
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 10, slot: 0 },
    ]);

    await actionEvents['player:screen:npc:trade:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'copper-ore',
        params: { quantity: 5 },
      },
      doing: 'buy',
    });

    expect(player.inventory.slots.find(item => item.id === 'copper-ore')).toMatchObject({
      id: 'copper-ore',
      qty: 5,
    });
    expect(player.inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      qty: 55,
    });
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 5,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Bought 5 Copper Ore for 45 coins.',
    }));
  });

  it('accepts the full socket envelope used by the shop buy-one button', () => {
    attachInventory(player, [
      { id: 'coins', qty: 500, slot: 0 },
    ]);
    makeGeneralStore(player, [
      { id: 'bronze-sword', qty: 10, slot: 0 },
    ]);

    actionEvents['player:screen:npc:trade:action']({
      data: {
        player: { socket_id: player.socket_id },
        doing: 'buy',
        item: { id: 'bronze-sword', params: { quantity: 1 } },
      },
    });

    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(true);
    expect(world.shops[0].inventory[0].qty).toBe(9);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringMatching(/^Bought 1 Bronze Sword for \d+ coins\.$/),
    }));
  });

  it('merges stackable shop buys into an existing full-inventory stack', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'coins', qty: 100, slot: 0 },
      { id: 'copper-ore', qty: 2, slot: 1 },
      ...makeFillers(82, 2, 'inventory-filler'),
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 10, slot: 0 },
    ]);

    await actionEvents['player:screen:npc:trade:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'copper-ore',
        params: { quantity: 5 },
      },
      doing: 'buy',
    });

    expect(player.inventory.slots).toHaveLength(84);
    expect(player.inventory.slots.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 7,
    });
    expect(player.inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      qty: 55,
    });
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 5,
    });
  });

  it('does not create zero-quantity stacks when a shop purchase cannot be afforded', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'coins', qty: 1, slot: 0 },
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 10, slot: 0 },
    ]);

    await actionEvents['player:screen:npc:trade:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'copper-ore',
        params: { quantity: 5 },
      },
      doing: 'buy',
    });

    expect(player.inventory.slots).toEqual([
      expect.objectContaining({ id: 'coins', qty: 1 }),
    ]);
    expect(player.inventory.slots.some(item => item.id === 'copper-ore')).toBe(false);
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 10,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      player: { socket_id: player.socket_id },
      text: 'Not enough gold to purchase.',
    }));
  });

  it('sells only the requested stack quantity and pays for every sold item', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'coins', qty: 10, slot: 0 },
      { id: 'copper-ore', qty: 10, slot: 1 },
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 1, slot: 0 },
    ]);

    await actionEvents['player:screen:npc:trade:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'copper-ore',
        params: { quantity: 5 },
      },
      doing: 'sell',
    });

    expect(player.inventory.slots.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 5,
    });
    expect(player.inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      qty: 55,
    });
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 6,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Sold 5 Copper Ore for 45 coins.',
    }));
  });

  it('rejects partial stack sales when full inventory has no coin slot for payment', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'copper-ore', qty: 10, slot: 0 },
      ...makeFillers(83, 1, 'inventory-filler'),
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 1, slot: 0 },
    ]);

    await actionEvents['player:screen:npc:trade:action']({
      player: {
        uuid: player.uuid,
        socket_id: player.socket_id,
      },
      item: {
        id: 'copper-ore',
        params: { quantity: 5 },
      },
      doing: 'sell',
    });

    expect(player.inventory.slots.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 10,
    });
    expect(player.inventory.slots.some(item => item.id === 'coins')).toBe(false);
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 1,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      player: { socket_id: player.socket_id },
      text: 'Not enough space in inventory.',
    }));
  });
});
