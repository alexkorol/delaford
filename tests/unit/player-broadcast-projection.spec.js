/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
    sendMessageToPlayer: vi.fn(),
  },
}));

vi.mock('#server/core/tutorial.js', () => ({
  maybeStartTutorial: vi.fn(),
  notifyTutorial: vi.fn(),
}));

vi.mock('#server/core/services/identity-registry.js', () => ({
  default: { authenticateLogin: vi.fn() },
}));

const { default: Socket } = await import('#server/socket.js');
const { default: world } = await import('#server/core/world.js');
const { publicPlayerProjection } = await import('#server/core/entities/player/public-projection.js');
const { default: Authentication } = await import('#server/player/authentication.js');
const { default: playersPipeline } = await import('#server/player/pipeline/players.js');

const SENSITIVE_FIELDS = [
  'bank',
  'inventory',
  'token',
  'socket_id',
  'accountId',
  'houseId',
  'scionId',
  'isGuest',
  'quickStart',
  'passiveTree',
  'passiveTreeStats',
  'quests',
  'questPoints',
  'skills',
  'stats',
  'combat',
  'path',
  'queue',
  'friend_list',
  'currentPane',
  'objectId',
  'chronicleRun',
  'preInstancePosition',
];

describe('public player projection (cand-007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world._players = [];
    world.clients = [];
    world.getDefaultTown().players = [];
  });

  afterEach(() => {
    world._players = [];
    world.clients = [];
    world.getDefaultTown().players = [];
  });

  it('keeps the public render fields and drops every private field', () => {
    const secret = {
      uuid: 'u1',
      username: 'Vesper',
      x: 3,
      y: 4,
      level: 5,
      facing: 'down',
      animation: { state: 'idle' },
      wear: { weapon: { id: 'bronze-sword' } },
      movementStep: { sequence: 2 },
      sceneId: 'town',
      houseName: 'Ashford',
      bank: [{ id: 'coins', qty: 99 }],
      inventory: { slots: [{ id: 'gold-ring' }] },
      token: 'local:u1',
      socket_id: 'sock-1',
      accountId: 'guest:secret-id',
      houseId: 'house-1',
      scionId: 'scion-1',
      isGuest: true,
      quickStart: true,
      passiveTree: { nodes: ['a'] },
      passiveTreeStats: {},
      quests: { q: 1 },
      questPoints: 3,
      skills: { attack: { level: 9 } },
      stats: { resources: {} },
      combat: { attack: {} },
      path: {},
      queue: [],
      friend_list: ['x'],
      currentPane: 'bank',
      objectId: 4,
      chronicleRun: 7,
      preInstancePosition: { x: 1, y: 1 },
    };

    const projection = publicPlayerProjection(secret);

    expect(projection).toEqual({
      uuid: 'u1',
      username: 'Vesper',
      x: 3,
      y: 4,
      level: 5,
      facing: 'down',
      animation: { state: 'idle' },
      wear: { weapon: { id: 'bronze-sword' } },
      movementStep: { sequence: 2 },
      sceneId: 'town',
      houseName: 'Ashford',
    });
    SENSITIVE_FIELDS.forEach(field => expect(projection).not.toHaveProperty(field));
  });

  it('player:joined broadcasts projections instead of live Player internals', () => {
    const player = {
      uuid: 'joined-1',
      username: 'Joiner',
      socket_id: 'sock-joined-1',
      sceneId: world.defaultTownId,
      x: 12,
      y: 13,
      level: 2,
      facing: 'up',
      animation: { state: 'idle' },
      wear: {},
      movementStep: { sequence: 1 },
      houseName: 'Emberveil',
      bank: [{ id: 'coins', qty: 1 }],
      accountId: 'guest:joined-secret',
      token: 'none',
      inventory: { slots: [] },
      quickStart: true,
    };

    Authentication.addPlayer(player);

    const joinedCall = Socket.broadcast.mock.calls.find(call => call[0] === 'player:joined');
    expect(joinedCall).toBeTruthy();
    const [, data, recipients, options] = joinedCall;
    expect(Array.isArray(data)).toBe(true);
    const entry = data.find(item => item.uuid === 'joined-1');
    expect(entry).toMatchObject({
      username: 'Joiner', x: 12, y: 13, houseName: 'Emberveil',
    });
    SENSITIVE_FIELDS.forEach(field => expect(entry).not.toHaveProperty(field));
    expect(recipients).toContain(player);
    expect(options.meta.players).toEqual([{ uuid: 'joined-1', movementStep: { sequence: 1 } }]);
  });

  it('player:equippedAnItem broadcasts a projection and still applies the equip', () => {
    const player = {
      uuid: 'equip-1',
      username: 'Armand',
      socket_id: 'sock-equip-1',
      sceneId: world.defaultTownId,
      x: 8,
      y: 9,
      level: 4,
      facing: 'left',
      animation: { state: 'idle' },
      wear: {},
      movementStep: { sequence: 0 },
      houseName: null,
      combat: { attack: {}, defense: {} },
      bank: [{ id: 'gold-ring', qty: 1 }],
      accountId: 'guest:equip-secret',
      token: 'local:equip-1',
      inventory: { slots: [{ uuid: 'sword-uuid-1', id: 'bronze-sword', slot: 0 }] },
      refreshDerivedStats: vi.fn(),
    };
    world.addPlayer(player);

    playersPipeline.equippedAnItem({ id: 'equip-1', item: { uuid: 'sword-uuid-1', id: 'bronze-sword' } });

    const call = Socket.broadcast.mock.calls.find(entry => entry[0] === 'player:equippedAnItem');
    expect(call).toBeTruthy();
    const [, data] = call;
    expect(data).toMatchObject({ uuid: 'equip-1', username: 'Armand' });
    // The projection relays the server-resolved wear object verbatim; the
    // physical seat an item lands in is chosen by the server's wear-slot
    // rules (grouped slots like rings have more than one seat), so assert
    // the equipped item is publicly visible in wear rather than pinned to
    // a hardcoded seat key.
    const equippedItem = Object.values(player.wear).find(item => item && item.id === 'bronze-sword');
    expect(equippedItem).toBeTruthy();
    expect(data.wear).toEqual(player.wear);
    expect(Object.values(data.wear).some(item => item && item.id === 'bronze-sword')).toBe(true);
    SENSITIVE_FIELDS.forEach(field => expect(data).not.toHaveProperty(field));
    expect(Socket.emit).toHaveBeenCalledWith('core:refresh:inventory', {
      player: { socket_id: player.socket_id },
      data: player.inventory.slots,
    });
  });
});
