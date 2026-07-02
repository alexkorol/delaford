/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import world from '#server/core/world.js';
import {
  INVENTORY_SLOT_COUNT,
  positionFromSlot,
} from '#shared/inventory-footprints.js';

const makeFiller = slot => ({
  id: `filler-${slot}`,
  uuid: `filler-${slot}`,
  slot,
  position: positionFromSlot(slot),
  size: { width: 1, height: 1 },
  context: 'item',
});

const cellsFor = (slot, size) => {
  const position = positionFromSlot(slot);
  const cells = new Set();
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      cells.add(((position.y + y) * 12) + position.x + x);
    }
  }
  return cells;
};

const makeInventoryAroundSource = (sourceItem) => {
  const occupiedBySource = cellsFor(sourceItem.slot, sourceItem.size);
  const fillers = [];

  for (let slot = 0; slot < INVENTORY_SLOT_COUNT; slot += 1) {
    if (!occupiedBySource.has(slot)) {
      fillers.push(makeFiller(slot));
    }
  }

  return [sourceItem, ...fillers];
};

const makePlayer = ({ equipped, sourceItem }) => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  inventory: {
    slots: makeInventoryAroundSource(sourceItem),
  },
  wear: {
    right_hand: equipped,
    left_hand: null,
    armor: null,
    head: null,
    back: null,
    necklace: null,
    arrows: null,
    gloves: null,
    feet: null,
    ring: null,
  },
  combat: {},
  refreshDerivedStats: vi.fn(),
});

const makeEquippedOnlyPlayer = ({ equipped }) => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  x: 20,
  y: 20,
  inventory: {
    slots: [],
  },
  wear: {
    right_hand: equipped,
    left_hand: null,
    armor: null,
    head: null,
    back: null,
    necklace: null,
    arrows: null,
    gloves: null,
    feet: null,
    ring: null,
  },
  combat: {},
  refreshDerivedStats: vi.fn(),
});

const resetScenes = () => {
  world._players = [];
  world.getDefaultTown().players = [];
  world.getDefaultTown().items = [];
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
};

describe('equipment replacement inventory safety', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    resetScenes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetScenes();
  });

  it('swaps replaced gear into the source footprint when the backpack has no spare open cells', async () => {
    const sourceItem = {
      id: 'bronze-sword',
      uuid: 'new-sword',
      slot: 0,
      position: positionFromSlot(0),
      size: { width: 1, height: 3 },
      context: 'item',
    };
    const player = makePlayer({
      sourceItem,
      equipped: {
        id: 'bronze-dagger',
        uuid: 'old-dagger',
        size: { width: 1, height: 2 },
        context: 'item',
      },
    });
    world.addPlayer(player);

    await actionEvents['item:equip']({
      id: player.uuid,
      item: {
        uuid: sourceItem.uuid,
        id: sourceItem.id,
        miscData: { slot: sourceItem.slot },
      },
    });

    expect(player.wear.right_hand.uuid).toBe('new-sword');
    expect(player.inventory.slots.some(item => item.uuid === 'new-sword')).toBe(false);
    expect(player.inventory.slots.find(item => item.uuid === 'old-dagger')).toMatchObject({
      slot: 0,
      position: { x: 0, y: 0 },
    });
    expect(player.inventory.slots.some(item => item.slot === false)).toBe(false);
  });

  it('rejects replacement when the old equipped item cannot fit in a full backpack', async () => {
    const sourceItem = {
      id: 'bronze-dagger',
      uuid: 'new-dagger',
      slot: 0,
      position: positionFromSlot(0),
      size: { width: 1, height: 2 },
      context: 'item',
    };
    const player = makePlayer({
      sourceItem,
      equipped: {
        id: 'bronze-sword',
        uuid: 'old-sword',
        size: { width: 1, height: 3 },
        context: 'item',
      },
    });
    world.addPlayer(player);

    await actionEvents['item:equip']({
      id: player.uuid,
      item: {
        uuid: sourceItem.uuid,
        id: sourceItem.id,
        miscData: { slot: sourceItem.slot },
      },
    });

    expect(player.wear.right_hand.uuid).toBe('old-sword');
    expect(player.inventory.slots.some(item => item.uuid === 'new-dagger')).toBe(true);
    expect(player.inventory.slots.some(item => item.slot === false)).toBe(false);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'You need more room in your backpack before unequipping that.',
    }));
  });

  it('rejects stale replacement equips before unequipping current gear', async () => {
    const player = makeEquippedOnlyPlayer({
      equipped: {
        id: 'bronze-sword',
        uuid: 'old-sword',
        size: { width: 1, height: 3 },
        context: 'item',
      },
    });
    world.addPlayer(player);

    await actionEvents['item:equip']({
      id: player.uuid,
      item: {
        uuid: 'missing-dagger',
        id: 'bronze-dagger',
      },
    });

    expect(player.wear.right_hand.uuid).toBe('old-sword');
    expect(player.inventory.slots).toEqual([]);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'That item is no longer in your inventory.',
    }));
  });

  it('rejects drops onto an incompatible paperdoll slot before mutating equipment', async () => {
    const sourceItem = {
      id: 'bronze-sword',
      uuid: 'new-sword',
      slot: 0,
      position: positionFromSlot(0),
      size: { width: 1, height: 3 },
      context: 'item',
      equipSlot: 'right_hand',
      slotType: 'right_hand',
    };
    const player = makePlayer({
      sourceItem,
      equipped: null,
    });
    world.addPlayer(player);

    await actionEvents['item:equip']({
      id: player.uuid,
      item: {
        uuid: sourceItem.uuid,
        id: sourceItem.id,
        targetSlot: 'head',
        miscData: {
          slot: sourceItem.slot,
          targetSlot: 'head',
        },
      },
    });

    expect(player.wear.right_hand).toBeNull();
    expect(player.inventory.slots.some(item => item.uuid === 'new-sword')).toBe(true);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'That item cannot be equipped there.',
    }));
  });

  it('supports uuid-based equip payloads without miscData and ignores malformed payloads safely', async () => {
    const sourceItem = {
      id: 'bronze-sword',
      uuid: 'new-sword',
      slot: 0,
      position: positionFromSlot(0),
      size: { width: 1, height: 3 },
      context: 'item',
    };
    const player = makePlayer({
      sourceItem,
      equipped: null,
    });
    world.addPlayer(player);

    await expect(actionEvents['item:equip']({
      id: player.uuid,
      item: {
        uuid: sourceItem.uuid,
        id: sourceItem.id,
      },
    })).resolves.toBeUndefined();

    expect(player.wear.right_hand.uuid).toBe('new-sword');
    expect(player.inventory.slots.some(item => item.uuid === 'new-sword')).toBe(false);

    await expect(actionEvents['item:equip']({
      id: player.uuid,
    })).resolves.toBeUndefined();

    expect(() => actionEvents['item:unequip']({
      id: player.uuid,
      player,
      item: {},
    })).not.toThrow();
    expect(player.wear.right_hand.uuid).toBe('new-sword');
  });

  it('unequips paperdoll drag-outs into the requested backpack slot without client wear payload', async () => {
    const player = makeEquippedOnlyPlayer({
      equipped: {
        id: 'bronze-sword',
        uuid: 'old-sword',
        context: 'item',
      },
    });
    world.addPlayer(player);

    actionEvents['item:unequip']({
      id: player.uuid,
      player: { socket_id: player.socket_id },
      item: {
        slot: 'right_hand',
        miscData: {
          slot: 'right_hand',
          targetInventorySlot: 5,
        },
      },
    });
    await Promise.resolve();

    expect(player.wear.right_hand).toBeNull();
    expect(player.inventory.slots).toHaveLength(1);
    expect(player.inventory.slots[0]).toMatchObject({
      id: 'bronze-sword',
      uuid: 'old-sword',
      slot: 5,
      position: positionFromSlot(5),
    });
    expect(player.refreshDerivedStats).toHaveBeenCalled();
  });

  it('drops equipped paperdoll items into the active scene', () => {
    const player = makeEquippedOnlyPlayer({
      equipped: {
        id: 'bronze-sword',
        uuid: 'old-sword',
        context: 'item',
      },
    });
    const scene = world.ensureScene('zone:equipped-drop-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    world.addPlayer(player);
    world.assignPlayerToScene(player, scene.id);

    actionEvents['item:unequip']({
      id: player.uuid,
      player: { socket_id: player.socket_id },
      item: {
        slot: 'right_hand',
        miscData: {
          slot: 'right_hand',
          action: 'world-drop',
        },
      },
    });

    expect(player.wear.right_hand).toBeNull();
    expect(player.inventory.slots).toEqual([]);
    expect(scene.items).toHaveLength(1);
    expect(scene.items[0]).toMatchObject({
      id: 'bronze-sword',
      uuid: 'old-sword',
      x: player.x,
      y: player.y,
    });
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', scene.items, [player]);
    expect(Socket.broadcast).toHaveBeenCalledWith('item:change', scene.items, [player]);
    expect(Socket.broadcast).toHaveBeenCalledWith('player:unequippedAnItem', player);
  });
});
