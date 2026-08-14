/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import ItemFactory from '#server/core/items/factory.js';
import { vesselTooltip } from '#server/core/items/vesselforge/adapter.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import world from '#server/core/world.js';

const resetWorld = () => {
  world._players = [];
  world.getDefaultTown().players = [];
};

const buildPlayer = () => {
  const item = ItemFactory.createById('bronze-pike', {
    itemLevel: 20,
    rng: () => 0.01,
  });
  item.vessel.item.brands = [];
  item.vessel.lines = vesselTooltip(item.vessel.item);
  item.slot = 1;
  item.position = { x: 1, y: 0 };
  return {
    uuid: 'forge-player',
    socket_id: 'forge-socket',
    sceneId: world.defaultTownId,
    inventory: {
      slots: [
        { id: 'coins', uuid: 'forge-coins', qty: 150, slot: 0, position: { x: 0, y: 0 } },
        item,
      ],
    },
    wear: {},
    combat: {},
  };
};

describe('Vesselforge town surfacing', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    resetWorld();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('adds one brand, spends exact coins, and refreshes the vessel tooltip', () => {
    const player = buildPlayer();
    world.addPlayer(player);
    const item = player.inventory.slots.find(entry => entry.id === 'bronze-pike');

    actionEvents['player:vesselforge:add-brand']({
      id: player.uuid,
      item: { id: item.id, uuid: item.uuid },
    });

    expect(item.vessel.item.brands).toHaveLength(1);
    expect(item.vessel.lines.some(line => line.section === 'brand')).toBe(true);
    expect(player.inventory.slots.find(entry => entry.id === 'coins').qty).toBe(50);
    expect(Socket.emit).toHaveBeenCalledWith('core:refresh:inventory', expect.objectContaining({
      data: player.inventory.slots,
    }));
  });

  it('does not mutate a vessel when the player leaves town', () => {
    const player = buildPlayer();
    const scene = world.ensureScene('instance:forge-test', {
      type: 'instance',
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    world.addPlayer(player);
    world.assignPlayerToScene(player, scene.id);
    const item = player.inventory.slots.find(entry => entry.id === 'bronze-pike');

    actionEvents['player:vesselforge:add-brand']({
      id: player.uuid,
      item: { id: item.id, uuid: item.uuid },
    });

    expect(item.vessel.item.brands).toHaveLength(0);
    expect(player.inventory.slots.find(entry => entry.id === 'coins').qty).toBe(150);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('Delaford forge'),
    }));
  });
});
