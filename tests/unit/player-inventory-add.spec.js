/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Inventory from '#server/core/utilities/common/player/inventory.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const resetWorld = () => {
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
  town.respawns = { items: [], monsters: [], resources: [] };
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
  world.instances.clear();
};

const makePlayer = (slots = []) => {
  const player = {
    uuid: 'inventory-player',
    socket_id: 'inventory-socket',
    username: 'Pack Tester',
    x: 22,
    y: 31,
    sceneId: world.defaultTownId,
  };
  player.inventory = new Inventory(slots, player.socket_id);
  return player;
};

const fillers = (count, startSlot = 0) => Array.from({ length: count }, (_entry, index) => ({
  id: `filler-${startSlot + index}`,
  uuid: `filler-uuid-${startSlot + index}`,
  slot: startSlot + index,
  size: { width: 1, height: 1 },
}));

describe('authoritative inventory grants', () => {
  beforeEach(() => {
    resetWorld();
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('resolves the owner after Player constructs inventory before joining the world', async () => {
    const player = makePlayer();
    expect(player.inventory.playerIndex).toBe(-1);
    world.addPlayer(player);

    const result = await player.inventory.add('bronze-sword', 1);

    expect(result).toMatchObject({ requested: 1, added: 1, dropped: 0, rejected: 0 });
    expect(player.inventory.slots).toHaveLength(1);
    expect(player.inventory.slots[0]).toMatchObject({
      id: 'bronze-sword',
      boundTo: player.uuid,
    });
  });

  it('adds currency to its existing stack even when every grid cell is occupied', async () => {
    const player = makePlayer([
      { id: 'coins', uuid: 'coins-stack', qty: 100, slot: 0, stackable: true },
      ...fillers(83, 1),
    ]);
    world.addPlayer(player);

    const result = await player.inventory.add('coins', 25);

    expect(result).toMatchObject({ requested: 25, added: 25, stacked: 25, dropped: 0 });
    expect(player.inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      uuid: 'coins-stack',
      qty: 125,
    });
    expect(world.items).toEqual([]);
  });

  it('drops an exact bound item at the player when the backpack is full', async () => {
    const player = makePlayer(fillers(84));
    world.addPlayer(player);

    const result = await player.inventory.add('bronze-sword', 1);

    expect(result).toMatchObject({ requested: 1, added: 0, dropped: 1, rejected: 0 });
    expect(player.inventory.slots).toHaveLength(84);
    expect(world.items).toHaveLength(1);
    expect(world.items[0]).toMatchObject({
      id: 'bronze-sword',
      uuid: result.groundItems[0].uuid,
      boundTo: player.uuid,
      x: player.x,
      y: player.y,
    });
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', world.items, [player]);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Your backpack is full. 1 item fell at your feet.',
    }));
  });
});
