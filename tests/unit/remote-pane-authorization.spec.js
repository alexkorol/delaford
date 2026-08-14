/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import actionEvents from '#server/player/handlers/actions/index.js';
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
  town.type = 'town';
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
  uuid: 'player-remote',
  socket_id: 'socket-remote',
  username: 'Remote Tester',
  sceneId: world.defaultTownId,
  x: 10,
  y: 10,
  inventory: { slots: [{ id: 'coins', qty: 500, slot: 0 }] },
  bank: [],
  currentPane: null,
  combat: {},
});
const makeShop = () => {
  world.shops = [{
    id: 2,
    npcId: 2,
    name: 'General Store',
    type: 'general',
    originalStock: ['bronze-sword'],
    inventory: [{ id: 'bronze-sword', qty: 5, slot: 0 }],
  }];
};

describe('legacy shop lane adjacency (cand-004)', () => {
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    resetWorld();
    player = makePlayer();
    world.addPlayer(player);
    makeShop();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('refuses to open the trade pane away from the shopkeeper', () => {
    world.getDefaultTown().npcs = [{ id: 2, x: 50, y: 50 }];

    actionEvents['player:screen:npc:trade']({
      player: { uuid: player.uuid },
      item: { id: 2 },
    });

    expect(player.currentPane).not.toBe('shop');
    expect(player.objectId).toBeUndefined();
    expect(Socket.emit).not.toHaveBeenCalledWith('open:screen', expect.anything());
  });

  it('opens the trade pane beside the shopkeeper', () => {
    world.getDefaultTown().npcs = [{ id: 2, x: 50, y: 50 }];
    player.x = 50;
    player.y = 51;

    actionEvents['player:screen:npc:trade']({
      player: { uuid: player.uuid },
      item: { id: 2 },
    });

    expect(player.currentPane).toBe('shop');
    expect(player.objectId).toBe(2);
    expect(Socket.emit).toHaveBeenCalledWith('open:screen', expect.objectContaining({
      screen: 'shop',
      payload: world.shops[0],
    }));
  });

  it('blocks trade actions issued away from the shop even with the pane open', () => {
    world.getDefaultTown().npcs = [{ id: 2, x: 50, y: 50 }];
    player.inventory = new Inventory([{ id: 'coins', qty: 500, slot: 0 }], player.socket_id);
    player.currentPane = 'shop';
    player.objectId = 2;

    actionEvents['player:screen:npc:trade:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'buy',
      item: { id: 'bronze-sword', params: { quantity: 1 } },
    });

    expect(world.shops[0].inventory[0].qty).toBe(5);
    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(false);
    expect(Socket.emit).not.toHaveBeenCalledWith('core:refresh:inventory', expect.anything());
  });

  it('allows buying beside the shopkeeper on the legacy lane', () => {
    world.getDefaultTown().npcs = [{ id: 2, x: 50, y: 50 }];
    player.x = 50;
    player.y = 51;
    player.inventory = new Inventory([{ id: 'coins', qty: 500, slot: 0 }], player.socket_id);
    player.currentPane = 'shop';
    player.objectId = 2;

    actionEvents['player:screen:npc:trade:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'buy',
      item: { id: 'bronze-sword', params: { quantity: 1 } },
    });

    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(true);
    expect(world.shops[0].inventory[0].qty).toBe(4);
  });

  it('allows buying beside one of the shop market displays', () => {
    world.getDefaultTown().items = [{
      id: 'stall-sword', x: 10, y: 11, shopDisplay: true, shopNpcId: 2,
    }];
    player.inventory = new Inventory([{ id: 'coins', qty: 500, slot: 0 }], player.socket_id);
    player.currentPane = 'shop';
    player.objectId = 2;

    actionEvents['player:screen:npc:trade:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'buy',
      item: { id: 'bronze-sword', params: { quantity: 1 } },
    });

    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(true);
    expect(world.shops[0].inventory[0].qty).toBe(4);
  });
});

describe('bank transfer presence gate (cand-005)', () => {
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    resetWorld();
    player = makePlayer();
    world.getDefaultTown().npcs = [{ id: 4, x: 31, y: 121 }];
    world.addPlayer(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('blocks deposits issued away from the countinghouse banker', async () => {
    player.currentPane = 'bank';

    await actionEvents['player:screen:bank:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'deposit',
      item: { id: 'coins', params: { quantity: 5 } },
    });

    expect(player.inventory.slots[0].qty).toBe(500);
    expect(player.bank).toEqual([]);
    expect(Socket.emit).not.toHaveBeenCalledWith('core:bank:refresh', expect.anything());
  });

  it('blocks deposits with a different pane open even beside the banker', async () => {
    player.x = 31;
    player.y = 122;
    player.currentPane = 'shop';

    await actionEvents['player:screen:bank:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'deposit',
      item: { id: 'coins', params: { quantity: 5 } },
    });

    expect(player.inventory.slots[0].qty).toBe(500);
    expect(player.bank).toEqual([]);
  });

  it('allows deposits beside the banker with the bank pane open', async () => {
    player.x = 31;
    player.y = 122;
    player.currentPane = 'bank';

    await actionEvents['player:screen:bank:action']({
      player: { uuid: player.uuid, socket_id: player.socket_id },
      doing: 'deposit',
      item: { id: 'coins', params: { quantity: 5 } },
    });

    expect(player.inventory.slots[0].qty).toBe(495);
    expect(player.bank).toEqual([{ id: 'coins', qty: 5, slot: 0 }]);
    expect(Socket.emit).toHaveBeenCalledWith('core:bank:refresh', expect.objectContaining({
      player: { socket_id: player.socket_id },
    }));
  });
});
