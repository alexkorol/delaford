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
import Item from '#server/core/item.js';
import Mining from '#server/core/skills/mining.js';
import Inventory from '#server/core/utilities/common/player/inventory.js';
import { createWorldLayout } from '#server/core/world-layout.js';
import Socket from '#server/socket.js';
import { dungeonGid } from '#shared/dungeon-tiles.js';
import world from '#server/core/world.js';

const COPPER = { id: 280, x: 61, y: 129 };
const mapIndex = ({ x, y }) => (y * 200) + x;

const resetTown = () => {
  const layout = createWorldLayout();
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
  town.map = layout.town.map;
  town.metadata = layout.town.metadata;
  town.respawns = { items: [], monsters: [], resources: [] };
};

const makePlayer = (suffix = 'one') => {
  const player = {
    uuid: `miner-${suffix}`,
    socket_id: `miner-socket-${suffix}`,
    username: `Miner ${suffix}`,
    x: COPPER.x - 1,
    y: COPPER.y,
    sceneId: world.defaultTownId,
    wear: { right_hand: null },
    skills: { mining: { level: 1, exp: 0 } },
  };
  player.inventory = new Inventory([{ id: 'bronze-pickaxe', qty: 1, slot: 0 }], player.socket_id);
  world.addPlayer(player);
  return player;
};

const miningPayload = (player, overrides = {}) => ({
  playerIndex: world.players.indexOf(player),
  todo: {
    item: { id: COPPER.id },
    actionToQueue: {
      onTile: mapIndex(COPPER),
      world: { x: COPPER.x, y: COPPER.y },
      ...overrides,
    },
  },
});

describe('authoritative mining flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z'));
    resetTown();
    Mining._activeMiningLocks.clear();
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'sendMessageToPlayer').mockImplementation(() => {});
  });

  afterEach(() => {
    Mining._activeMiningLocks.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetTown();
  });

  it('depletes and restores the generated rock tile and interaction together', async () => {
    const player = makePlayer();
    const town = world.getDefaultTown();
    const interaction = town.metadata.interactions.find(entry => entry.id === 'delaford-copper-rock');
    const promise = actionEvents['player:resource:mining:rock'](miningPayload(player));

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(player.inventory.slots.some(item => item.id === 'copper-ore')).toBe(true);
    expect(player.skills.mining.exp).toBe(16);
    expect(interaction.objectId).toBe(279);
    expect(town.map.foreground[mapIndex(COPPER)]).toBe(dungeonGid('rock_depleted'));
    expect(town.respawns.resources).toHaveLength(1);
    expect(town.respawns.resources[0]).toMatchObject({
      interactionId: interaction.id,
      setToObjectId: COPPER.id,
      setToTile: dungeonGid('rock_copper'),
      onTile: mapIndex(COPPER),
    });

    town.respawns.resources[0].willRespawnIn = new Date(Date.now() - 1);
    Item.resourcesCheck();

    expect(interaction.objectId).toBe(COPPER.id);
    expect(town.map.foreground[mapIndex(COPPER)]).toBe(dungeonGid('rock_copper'));
    expect(town.respawns.resources).toEqual([]);
  });

  it('rejects a client tile index that does not match the clicked coordinates', async () => {
    const player = makePlayer();
    const town = world.getDefaultTown();

    await actionEvents['player:resource:mining:rock'](miningPayload(player, {
      onTile: mapIndex(COPPER) + 1,
    }));

    expect(player.inventory.slots.some(item => item.id === 'copper-ore')).toBe(false);
    expect(player.skills.mining.exp).toBe(0);
    expect(town.metadata.interactions.find(entry => entry.id === 'delaford-copper-rock').objectId)
      .toBe(COPPER.id);
    expect(town.respawns.resources).toEqual([]);
  });

  it('interrupts the delayed gather when the player leaves the rock', async () => {
    const player = makePlayer();
    const town = world.getDefaultTown();
    const promise = actionEvents['player:resource:mining:rock'](miningPayload(player));
    player.x -= 4;

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(player.inventory.slots.some(item => item.id === 'copper-ore')).toBe(false);
    expect(player.skills.mining.exp).toBe(0);
    expect(town.metadata.interactions.find(entry => entry.id === 'delaford-copper-rock').objectId)
      .toBe(COPPER.id);
    expect(town.map.foreground[mapIndex(COPPER)]).toBe(dungeonGid('rock_copper'));
    expect(town.respawns.resources).toEqual([]);
    expect(Socket.sendMessageToPlayer).toHaveBeenCalledWith(
      world.players.indexOf(player),
      'Mining interrupted.',
    );
  });

  it('awards a shared rock to only one miner when two delayed actions race', async () => {
    const firstPlayer = makePlayer('one');
    const secondPlayer = makePlayer('two');
    const first = actionEvents['player:resource:mining:rock'](miningPayload(firstPlayer));
    const second = actionEvents['player:resource:mining:rock'](miningPayload(secondPlayer));

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);

    const oreCount = [firstPlayer, secondPlayer]
      .flatMap(player => player.inventory.slots)
      .filter(item => item.id === 'copper-ore')
      .length;
    expect(oreCount).toBe(1);
    expect(firstPlayer.skills.mining.exp + secondPlayer.skills.mining.exp).toBe(16);
    expect(world.getDefaultTown().respawns.resources).toHaveLength(1);
    expect(Socket.sendMessageToPlayer.mock.calls.filter(([, message]) => (
      /successfully mined/i.test(message)
    ))).toHaveLength(1);
  });
});
