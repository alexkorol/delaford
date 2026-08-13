/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import world from '#server/core/world.js';
import { positionFromSlot } from '#shared/inventory-footprints.js';
import chroniclesStore from '#server/core/services/chronicles-store.js';
import playerPersistence from '#server/core/services/player-persistence.js';

const makeStack = (uuid, slot, qty) => ({
  id: 'coins',
  uuid,
  slot,
  position: positionFromSlot(slot),
  stackable: true,
  maxStack: 99,
  qty,
});

const makeFiller = slot => ({
  id: `filler-${slot}`,
  uuid: `filler-${slot}`,
  slot,
  position: positionFromSlot(slot),
  size: { width: 1, height: 1 },
  context: 'item',
});

const makePlayer = () => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  x: 20,
  y: 20,
  inventory: {
    slots: [
      makeStack('coins-a', 0, 5),
      makeStack('coins-b', 1, 2),
    ],
  },
  wear: {},
  combat: {},
  refreshDerivedStats: vi.fn(),
});

const resetWorld = () => {
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
  town.respawns = {
    items: [],
    monsters: [],
    resources: [],
  };
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
  world.instances.clear();
};

describe('inventory commit identity validation', () => {
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    resetWorld();
    player = makePlayer();
    world.addPlayer(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('rejects stale source uuids instead of moving a matching id or slot', () => {
    actionEvents['player:inventory:commit']({
      data: {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        action: 'move',
        item: {
          uuid: 'missing-source',
          id: 'coins',
          slot: 0,
        },
        target: {
          position: { x: 5, y: 0 },
          slot: 5,
        },
      },
    });

    expect(player.inventory.slots.find(item => item.uuid === 'coins-a')).toMatchObject({
      slot: 0,
      position: { x: 0, y: 0 },
      qty: 5,
    });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'That item is no longer in your inventory.',
    }));
  });

  it('rejects stale stack-target uuids instead of stacking onto a matching id or slot', () => {
    actionEvents['player:inventory:commit']({
      data: {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        action: 'stack',
        item: {
          uuid: 'coins-b',
          id: 'coins',
          slot: 1,
        },
        target: {
          stackTargetUuid: 'missing-target',
          stackTargetId: 'coins',
          stackTargetSlot: 0,
        },
      },
    });

    expect(player.inventory.slots).toHaveLength(2);
    expect(player.inventory.slots.find(item => item.uuid === 'coins-a').qty).toBe(5);
    expect(player.inventory.slots.find(item => item.uuid === 'coins-b').qty).toBe(2);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Those items cannot be stacked.',
    }));
  });

  it('rejects stacking onto a full stack as a no-op', () => {
    player.inventory.slots = [
      makeStack('coins-a', 0, 99),
      makeStack('coins-b', 1, 2),
    ];

    actionEvents['player:inventory:commit']({
      data: {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        action: 'stack',
        item: {
          uuid: 'coins-b',
          id: 'coins',
          slot: 1,
        },
        target: {
          stackTargetUuid: 'coins-a',
          stackTargetId: 'coins',
          stackTargetSlot: 0,
        },
      },
    });

    expect(player.inventory.slots).toHaveLength(2);
    expect(player.inventory.slots.find(item => item.uuid === 'coins-a').qty).toBe(99);
    expect(player.inventory.slots.find(item => item.uuid === 'coins-b').qty).toBe(2);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'That stack is already full.',
    }));
  });

  it('drops inventory items into the player active scene instead of default town', () => {
    const scene = world.ensureScene('zone:inventory-drop-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    world.assignPlayerToScene(player, scene.id);

    actionEvents['player:inventory:commit']({
      data: {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        action: 'world-drop',
        item: {
          uuid: 'coins-a',
          id: 'coins',
          slot: 0,
        },
      },
    });

    expect(scene.items).toHaveLength(1);
    expect(scene.items[0]).toMatchObject({
      id: 'coins',
      uuid: 'coins-a',
      x: player.x,
      y: player.y,
      qty: 5,
    });
    expect(world.items).toEqual([]);
    expect(player.inventory.slots.map(item => item.uuid)).toEqual(['coins-b']);
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', scene.items, [player]);
    expect(Socket.broadcast).toHaveBeenCalledWith('item:change', scene.items, [player]);
  });

  it('takes ground items from the player active scene without touching town drops', () => {
    const scene = world.ensureScene('zone:inventory-take-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    const townItem = {
      id: 'coins',
      uuid: 'town-drop',
      x: player.x,
      y: player.y,
      qty: 1,
    };
    const sceneItem = {
      id: 'coins',
      uuid: 'scene-drop',
      x: player.x,
      y: player.y,
      qty: 7,
    };
    world.items = [townItem];
    scene.items = [sceneItem];
    scene.respawns.items = [{
      id: 'coins',
      x: player.x,
      y: player.y,
      respawn: true,
      respawnIn: '5s',
    }];
    player.inventory.slots = [];
    player.inventory.add = vi.fn();
    world.assignPlayerToScene(player, scene.id);

    actionEvents['player:take']({
      playerIndex: 0,
      todo: {
        item: {
          id: 'coins',
          uuid: 'scene-drop',
        },
        at: {
          x: player.x,
          y: player.y,
        },
      },
    });

    expect(scene.items).toEqual([]);
    expect(world.items).toEqual([townItem]);
    expect(player.inventory.add).toHaveBeenCalledWith('coins', 7, {
      uuid: 'scene-drop',
      existingItem: sceneItem,
    });
    expect(scene.respawns.items[0].pickedUp).toBe(true);
    expect(scene.respawns.items[0].willRespawnIn).toBeInstanceOf(Date);
    expect(Socket.broadcast).toHaveBeenCalledWith('item:change', scene.items, [player]);
  });

  it('marks a circulating heirloom recovered after its exact pickup is persisted', async () => {
    const scene = world.ensureScene('zone:heirloom-take-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    const heirloom = {
      id: 'bronze-sword',
      uuid: 'heirloom-1',
      name: 'Verdant Bronze Sword',
      type: 'weapon',
      boundTo: player.uuid,
      x: player.x,
      y: player.y,
      chroniclesRelic: {
        id: 'heirloom-1',
        scionName: 'Morrow',
      },
    };
    scene.items = [heirloom];
    player.inventory.slots = [];
    player.inventory.add = vi.fn();
    world.assignPlayerToScene(player, scene.id);
    const save = vi.spyOn(playerPersistence, 'savePlayer').mockResolvedValue({ saved: true });
    const recover = vi.spyOn(chroniclesStore, 'recoverRelic').mockReturnValue({ ok: true });
    vi.spyOn(Socket, 'sendMessageToPlayer').mockImplementation(() => {});

    actionEvents['player:take']({
      playerIndex: 0,
      todo: {
        item: { id: heirloom.id, uuid: heirloom.uuid },
        at: { x: player.x, y: player.y },
      },
    });

    await vi.waitFor(() => {
      expect(recover).toHaveBeenCalledWith(player.uuid, heirloom.chroniclesRelic.id);
    });
    expect(save).toHaveBeenCalledWith(player, { force: true });
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(recover.mock.invocationCallOrder[0]);
    expect(player.inventory.add).toHaveBeenCalledWith('bronze-sword', 1, {
      uuid: heirloom.uuid,
      existingItem: heirloom,
    });
    expect(scene.items).toEqual([]);
  });

  it('keeps ground items in the scene when the backpack is full', () => {
    const scene = world.ensureScene('zone:inventory-full-pickup-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    const sceneItem = {
      id: 'bronze-sword',
      uuid: 'full-pickup-sword',
      x: player.x,
      y: player.y,
    };
    scene.items = [sceneItem];
    scene.respawns.items = [{
      id: 'bronze-sword',
      x: player.x,
      y: player.y,
      respawn: true,
      respawnIn: '5s',
    }];
    player.inventory.slots = Array.from({ length: 84 }, (_, slot) => makeFiller(slot));
    player.inventory.add = vi.fn();
    world.assignPlayerToScene(player, scene.id);

    actionEvents['player:take']({
      playerIndex: 0,
      todo: {
        item: {
          id: 'bronze-sword',
          uuid: 'full-pickup-sword',
        },
        at: {
          x: player.x,
          y: player.y,
        },
      },
    });

    expect(scene.items).toEqual([sceneItem]);
    expect(player.inventory.add).not.toHaveBeenCalled();
    expect(scene.respawns.items[0].pickedUp).toBeUndefined();
    expect(scene.respawns.items[0].willRespawnIn).toBeUndefined();
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'There is no room in your backpack.',
    }));
    expect(Socket.broadcast).not.toHaveBeenCalledWith('item:change', expect.anything(), expect.anything());
  });
});
