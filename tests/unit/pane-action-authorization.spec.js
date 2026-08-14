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
  town.npcs = [];
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
  currentPane: false,
  currentPaneAnchor: null,
  objectId: null,
  sceneId: world.defaultTownId,
  x: 10,
  y: 10,
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
  // The ore catalogue is retired; synthesize a stackable trade good under the
  // old id so the stack-merge shop contracts stay covered.
  const originalGetItemData = Query.getItemData.bind(Query);
  vi.spyOn(Query, 'getItemData').mockImplementation((id) => {
    if (id === 'copper-ore') {
      return {
        id: 'copper-ore',
        name: 'Copper Ore',
        examine: 'A stackable trade good.',
        price: 9,
        type: 'trade-good',
        stackable: true,
        graphics: { tileset: 'general', row: 0, column: 0 },
        actions: ['take', 'examine', 'drop', 'deposit', 'withdraw', 'buy', 'sell', 'value'],
      };
    }
    return originalGetItemData(id);
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
  // Trade actions re-verify current presence: the shopkeeper stands beside
  // the seat the beforeEach gives the player (31,122), and a market display
  // covers the stall-adjacency path.
  world.getDefaultTown().items = [{
    id: 'general-store-stall',
    x: 31,
    y: 123,
    shopDisplay: true,
    shopNpcId: 2,
  }];
  actionEvents['player:screen:npc:trade']({
    playerIndex: world.players.indexOf(player),
    player: { uuid: player.uuid, socket_id: player.socket_id },
    todo: {
      item: { id: 2 },
      actionToQueue: { world: { x: 30, y: 122 } },
    },
  });
};

const addServiceNpcs = () => {
  world.getDefaultTown().npcs = [
    {
      id: 2,
      name: 'Shop keeper',
      x: 30,
      y: 122,
      actions: ['trade', 'examine'],
    },
    {
      id: 4,
      name: 'Bank gnome',
      x: 31,
      y: 121,
      actions: ['bank', 'examine'],
    },
  ];
};

const openBank = (player) => {
  actionEvents['player:screen:bank']({
    playerIndex: world.players.indexOf(player),
    player: { uuid: player.uuid, socket_id: player.socket_id },
    todo: {
      item: { id: 4 },
      actionToQueue: { world: { x: 31, y: 121 } },
    },
  });
};

describe('pane action authorization', () => {
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    resetWorld();
    player = makePlayer();
    // Bank transfers now verify current presence: seat the player beside the
    // countinghouse banker, exactly where a real client that just opened the
    // pane would be standing.
    player.sceneId = world.defaultTownId;
    player.x = 31;
    player.y = 122;
    world.getDefaultTown().type = 'town';
    world.getDefaultTown().npcs = [{ id: 4, x: 31, y: 121 }];
    world.addPlayer(player);
    addServiceNpcs();
    openBank(player);
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

  it('rejects forged bank state without a server-issued NPC anchor', async () => {
    player.currentPane = 'bank';
    player.currentPaneAnchor = null;
    player.objectId = 4;

    await actionEvents['player:screen:bank:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      item: { id: 'coins', params: { quantity: 5 } },
      doing: 'deposit',
    });

    expect(player.inventory.slots.find(item => item.id === 'coins').qty).toBe(10);
    expect(player.bank).toEqual([]);
  });

  it('rejects bank transfers after the player leaves the service point', async () => {
    player.x = 30;
    player.y = 30;

    await actionEvents['player:screen:bank:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      item: { id: 'coins', params: { quantity: 5 } },
      doing: 'deposit',
    });

    expect(player.inventory.slots.find(item => item.id === 'coins').qty).toBe(10);
    expect(player.bank).toEqual([]);
  });

  it('does not open banking from a remote or mismatched NPC interaction', () => {
    player.currentPane = false;
    player.currentPaneAnchor = null;
    player.objectId = null;

    actionEvents['player:screen:bank']({
      playerIndex: world.players.indexOf(player),
      todo: {
        item: { id: 2 },
        actionToQueue: { world: { x: 80, y: 80 } },
      },
    });

    expect(player.currentPane).toBe(false);
    expect(player.currentPaneAnchor).toBeNull();
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

  it('rejects shop purchases after the player leaves the service point', async () => {
    withStackableCopperOre();
    attachInventory(player, [
      { id: 'coins', qty: 100, slot: 0 },
    ]);
    makeGeneralStore(player, [
      { id: 'copper-ore', qty: 10, slot: 0 },
    ]);
    player.x = 30;
    player.y = 30;

    await actionEvents['player:screen:npc:trade:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      item: { id: 'copper-ore', params: { quantity: 5 } },
      doing: 'buy',
    });

    expect(player.inventory.slots).toEqual([
      expect.objectContaining({ id: 'coins', qty: 100 }),
    ]);
    expect(world.shops[0].inventory[0]).toMatchObject({ id: 'copper-ore', qty: 10 });
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

  it('allows sales into the carried-gold balance when the backpack grid is full', async () => {
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
      qty: 5,
    });
    expect(player.inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      qty: 45,
      slot: null,
      position: null,
    });
    expect(world.shops[0].inventory.find(item => item.id === 'copper-ore')).toMatchObject({
      qty: 6,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      player: { socket_id: player.socket_id },
      text: 'Sold 5 Copper Ore for 45 coins.',
    }));
  });
});
