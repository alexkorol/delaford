/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import actionEvents from '#server/player/handlers/actions/index.js';
import Inventory from '#server/core/utilities/common/player/inventory.js';
import Smithing from '#server/core/skills/smithing.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const resetWorld = () => {
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
};

const inventoryItems = ids => ids.map((id, slot) => ({
  id,
  qty: 1,
  slot,
}));

const makePlayer = ({ level = 1, inventory = [] } = {}) => {
  const player = {
    uuid: 'smith-player',
    socket_id: 'smith-socket',
    username: 'Smith',
    x: 38,
    y: 115,
    sceneId: world.defaultTownId,
    skills: {
      smithing: { level, exp: 0 },
    },
    currentPane: false,
    currentPaneData: null,
  };
  player.inventory = new Inventory(inventoryItems(inventory), player.socket_id);
  world.addPlayer(player);
  return player;
};

const actionPayload = (player, slot) => ({
  data: {
    player: {
      uuid: player.uuid,
      socket_id: player.socket_id,
    },
    data: { miscData: { slot } },
  },
});

const openResourcePane = (player, type) => {
  const furnace = type === 'furnace';
  actionEvents[furnace
    ? 'player:resource:smelt:furnace:pane'
    : 'player:resource:smith:anvil:pane']({
    playerIndex: world.players.indexOf(player),
    todo: {
      item: { id: furnace ? 217 : 287 },
      actionToQueue: { world: { x: player.x + 1, y: player.y } },
    },
  });
};

describe('authoritative smithing flow', () => {
  beforeEach(() => {
    resetWorld();
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'sendMessageToPlayer').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('opens resource panes only for the matching nearby world fixture', () => {
    const player = makePlayer({ inventory: ['hammer', 'bronze-bar'] });

    actionEvents['player:resource:smith:anvil:pane']({
      playerIndex: 0,
      todo: {
        item: { id: 217 },
        actionToQueue: { world: { x: player.x + 1, y: player.y } },
      },
    });
    expect(player.currentPane).toBe(false);

    openResourcePane(player, 'anvil');
    expect(player.currentPane).toBe('anvil');
    expect(player.currentPaneData).toEqual(Smithing.getItemsToSmith('bronze-bar'));
  });

  it('does not grant experience when a locked recipe is rejected', async () => {
    const player = makePlayer({ level: 1, inventory: ['hammer', 'bronze-bar'] });
    openResourcePane(player, 'anvil');

    await actionEvents['player:resource:smelt:anvil:action'](actionPayload(player, 4));

    expect(player.skills.smithing.exp).toBe(0);
    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(false);
    expect(player.inventory.slots.filter(item => item.id === 'bronze-bar')).toHaveLength(1);
  });

  it('does not grant experience or consume bars when materials are insufficient', async () => {
    const player = makePlayer({ level: 4, inventory: ['hammer', 'bronze-bar'] });
    openResourcePane(player, 'anvil');

    await actionEvents['player:resource:smelt:anvil:action'](actionPayload(player, 4));

    expect(player.skills.smithing.exp).toBe(0);
    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(false);
    expect(player.inventory.slots.filter(item => item.id === 'bronze-bar')).toHaveLength(1);
  });

  it('rejects crafting after the player leaves the station', async () => {
    const player = makePlayer({ level: 1, inventory: ['hammer', 'bronze-bar'] });
    openResourcePane(player, 'anvil');
    player.x += 4;

    await actionEvents['player:resource:smelt:anvil:action'](actionPayload(player, 0));

    expect(player.skills.smithing.exp).toBe(0);
    expect(player.inventory.slots.some(item => item.id === 'bronze-dagger')).toBe(false);
    expect(player.inventory.slots.some(item => item.id === 'bronze-bar')).toBe(true);
  });

  it('forges armor through the real recipe and inventory implementation', async () => {
    const player = makePlayer({ level: 3, inventory: ['hammer', 'bronze-bar'] });
    openResourcePane(player, 'anvil');

    await actionEvents['player:resource:smelt:anvil:action'](actionPayload(player, 3));

    expect(player.skills.smithing.exp).toBe(21);
    expect(player.inventory.slots.some(item => item.id === 'bronze-bar')).toBe(false);
    expect(player.inventory.slots.some(item => item.id === 'bronze-med-helm')).toBe(true);
    expect(Socket.sendMessageToPlayer).toHaveBeenCalledWith(
      0,
      'You successfully smithed a Bronze Med Helm.',
    );
  });

  it('forges the final sword recipe and grants experience once', async () => {
    const player = makePlayer({
      level: 4,
      inventory: ['hammer', 'bronze-bar', 'bronze-bar'],
    });
    openResourcePane(player, 'anvil');

    await actionEvents['player:resource:smelt:anvil:action'](actionPayload(player, 4));

    expect(player.skills.smithing.exp).toBe(25);
    expect(player.inventory.slots.some(item => item.id === 'bronze-bar')).toBe(false);
    expect(player.inventory.slots.some(item => item.id === 'bronze-sword')).toBe(true);
  });

  it('returns promptly without consuming ore or granting experience on a failed smelt', async () => {
    const player = makePlayer({ inventory: ['tin-ore'] });
    openResourcePane(player, 'furnace');

    await actionEvents['player:resource:smelt:furnace:action'](actionPayload(player, 0));

    expect(player.skills.smithing.exp).toBe(0);
    expect(player.inventory.slots.some(item => item.id === 'tin-ore')).toBe(true);
    expect(player.inventory.slots.some(item => item.id === 'bronze-bar')).toBe(false);
    expect(Socket.sendMessageToPlayer).toHaveBeenCalledWith(0, 'You do not have enough ore.');
  });

  it('smelts server-owned ingredients into a bar and grants experience once', async () => {
    const player = makePlayer({ inventory: ['tin-ore', 'copper-ore'] });
    openResourcePane(player, 'furnace');

    await actionEvents['player:resource:smelt:furnace:action'](actionPayload(player, 0));

    expect(player.skills.smithing.exp).toBe(7);
    expect(player.inventory.slots.some(item => item.id === 'tin-ore')).toBe(false);
    expect(player.inventory.slots.some(item => item.id === 'copper-ore')).toBe(false);
    expect(player.inventory.slots.some(item => item.id === 'bronze-bar')).toBe(true);
  });
});
