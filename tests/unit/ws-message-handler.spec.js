/**
 * @vitest-environment node
 *
 * Tests for the WebSocket message handler security in Delaford.js.
 * Verifies that the real Delaford.connection method correctly handles
 * malformed, unknown, missing-event, unauthenticated, and rate-limited
 * messages without crashes.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Mock all server-side dependencies so Delaford can be imported in isolation
vi.mock('#server/socket.js', () => {
  class MockSocket {
    constructor() {
      this.ws = { on: vi.fn(), off: vi.fn(), clients: new Set() };
      this.clients = [];
    }

    close() {}
  }

  MockSocket.emit = vi.fn();
  MockSocket.broadcast = vi.fn();
  MockSocket.sendMessageToPlayer = vi.fn();

  return { default: MockSocket };
});

vi.mock('#server/core/world.js', () => ({
  default: {
    socket: { ws: { on: vi.fn(), off: vi.fn() } },
    clients: [],
    _players: [],
    get players() { return this._players; },
    set players(v) { this._players = v; },
    items: [],
    respawns: { items: [], monsters: [], resources: [] },
    map: { foreground: [], background: [] },
    npcs: [],
    monsters: [],
    shops: [],
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    removePlayerBySocket: vi.fn(() => null),
    getScene: vi.fn(() => ({
      id: 'test',
      name: 'Test',
      players: [],
      npcs: [],
      monsters: [],
      items: [],
    })),
    getDefaultTown: vi.fn(() => ({
      id: 'town:delaford',
      name: 'Delaford',
      players: [],
      npcs: [],
      monsters: [],
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    })),
    getSceneForPlayer: vi.fn(() => ({
      id: 'town:delaford',
      map: { foreground: [], background: [] },
      npcs: [],
      monsters: [],
      items: [],
    })),
    getScenePlayers: vi.fn(() => []),
  },
}));

vi.mock('#server/player/authentication.js', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    addPlayer: vi.fn(),
  },
}));

vi.mock('#server/player/handler.js', () => ({
  default: {
    'player:login': vi.fn(),
    'player:chronicles:select': vi.fn(),
    'player:chronicles:save': vi.fn(),
    'player:chronicles:mutate': vi.fn(),
    'player:move': vi.fn(),
    'player:say': vi.fn(),
    'player:context-menu:action': vi.fn(),
  },
}));

vi.mock('#server/core/data/items/index.js', () => ({
  general: [],
  wearableItems: [],
  smithing: [],
}));

vi.mock('#server/core/npc.js', () => ({
  default: { load: vi.fn(), movement: vi.fn() },
}));

vi.mock('#server/core/monster.js', () => ({
  default: { load: vi.fn(), tick: vi.fn() },
}));

vi.mock('#server/core/item.js', () => ({
  default: { check: vi.fn(), resourcesCheck: vi.fn() },
}));

vi.mock('#server/core/map.js', () => ({
  LAYOUT_IDS: ['warren', 'clearings', 'gauntlet'],
  default: vi.fn().mockImplementation(() => ({
    foreground: [],
    background: [],
  })),
}));

vi.mock('#server/core/services/player-persistence.js', () => ({
  default: { flushAllPlayers: vi.fn() },
}));

vi.mock('#server/player/handlers/party.js', () => ({
  partyService: {
    evaluateInstances: vi.fn(),
    removePlayer: vi.fn(),
    sendPartyUpdate: vi.fn(),
  },
}));

vi.mock('node-emoji', () => ({
  get: vi.fn(() => ''),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-0001'),
}));

const { default: Handler } = await import('#server/player/handler.js');
const { default: Authentication } = await import('#server/player/authentication.js');
const { default: Socket } = await import('#server/socket.js');
const { default: world } = await import('#server/core/world.js');
const { partyService } = await import('#server/player/handlers/party.js');

// Import the real Delaford class
const { default: Delaford } = await import('#server/Delaford.js');

/**
 * Creates a mock WebSocket that mimics the ws library's interface.
 */
const createMockWs = (id = 'test-socket-001') => {
  const listeners = {};
  return {
    id,
    authenticated: false,
    readyState: 1,
    send: vi.fn(),
    on: vi.fn((event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    _listeners: listeners,
    _triggerMessage(msg) {
      const handlers = listeners.message || [];
      return Promise.all(handlers.map((h) => h(msg)));
    },
  };
};

describe('Delaford.close – failure-tolerant disconnect cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.clients = [];
    world.players = [];
    world.removePlayerBySocket.mockReset().mockReturnValue(null);
    world.getScenePlayers.mockReset().mockReturnValue([]);
  });

  it('saves a guest without calling the account API and completes all cleanup', async () => {
    const ws = { id: 'guest-socket' };
    const peer = { id: 'peer-socket' };
    const player = {
      uuid: 'guest-player',
      username: 'Guest',
      token: 'none',
      sceneId: 'town:delaford',
      update: vi.fn().mockResolvedValue(undefined),
    };
    world.clients = [ws, peer];
    world.removePlayerBySocket.mockReturnValue(player);

    await Delaford.close(ws);

    expect(player.update).toHaveBeenCalledOnce();
    expect(Authentication.logout).not.toHaveBeenCalled();
    expect(world.clients).toEqual([peer]);
    expect(partyService.removePlayer).toHaveBeenCalledWith(player.uuid);
    expect(Socket.broadcast).toHaveBeenCalledWith('player:left', ws.id, []);
  });

  it('still removes party state and broadcasts when save and account logout fail', async () => {
    const ws = { id: 'account-socket' };
    const player = {
      uuid: 'account-player',
      username: 'Account',
      token: 'jwt-token',
      sceneId: 'town:delaford',
      update: vi.fn().mockRejectedValue(new Error('save unavailable')),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    world.clients = [ws];
    world.removePlayerBySocket.mockReturnValue(player);
    Authentication.logout.mockRejectedValue(new Error('account API unavailable'));

    await Delaford.close(ws);

    expect(Authentication.logout).toHaveBeenCalledWith(player.token);
    expect(world.clients).toEqual([]);
    expect(partyService.removePlayer).toHaveBeenCalledWith(player.uuid);
    expect(Socket.broadcast).toHaveBeenCalledWith('player:left', ws.id, []);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('pushes the authoritative roster to party members who remain connected', async () => {
    const ws = { id: 'member-socket' };
    const player = {
      uuid: 'departing-member',
      username: 'Departing',
      token: 'none',
      sceneId: 'town:delaford',
      update: vi.fn().mockResolvedValue(undefined),
    };
    const updatedParty = {
      id: 'party-1',
      leaderId: 'remaining-member',
      members: new Map([['remaining-member', { uuid: 'remaining-member' }]]),
    };
    world.clients = [ws];
    world.removePlayerBySocket.mockReturnValue(player);
    partyService.removePlayer.mockReturnValue(updatedParty);

    await Delaford.close(ws);

    expect(partyService.sendPartyUpdate).toHaveBeenCalledWith(updatedParty, {
      meta: {
        reason: 'member-disconnected',
        playerUuid: player.uuid,
      },
    });
  });

  it('reaps a socket that disconnects before creating a player', async () => {
    const ws = { id: 'anonymous-socket' };
    const peer = { id: 'peer-socket' };
    world.clients = [ws, peer];

    await Delaford.close(ws);

    expect(world.clients).toEqual([peer]);
    expect(partyService.removePlayer).not.toHaveBeenCalled();
    expect(Socket.broadcast).not.toHaveBeenCalled();
  });
});

describe('Delaford.connection – message handler validation', () => {
  let game;
  let ws;

  beforeEach(() => {
    world.clients = [];
    vi.clearAllMocks();

    // Create Delaford instance (skips constructor side effects via mocks)
    const mockServer = { on: vi.fn() };
    game = new Delaford(mockServer);

    // Create a mock WebSocket and run it through the real connection method
    ws = createMockWs();
    game.connection(ws);
    world.players = [{ uuid: 'abc', socket_id: ws.id }];
    // After connection, ws.authenticated is still false (requires login)
    // Set authenticated for general handler tests
    ws.authenticated = true;
  });

  afterEach(() => {
    game.shutdown();
  });

  it('rejects malformed JSON gracefully without crashing', async () => {
    // Send non-JSON text through the real message handler
    await ws._triggerMessage('not json at all{{{');
    // No handler should have been called
    expect(Handler['player:login']).not.toHaveBeenCalled();
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });

  it('rejects messages missing the event field', async () => {
    await ws._triggerMessage(JSON.stringify({ data: {} }));
    expect(Handler['player:login']).not.toHaveBeenCalled();
  });

  it('rejects messages with non-string event field', async () => {
    await ws._triggerMessage(JSON.stringify({ event: 42 }));
    expect(Handler['player:login']).not.toHaveBeenCalled();
  });

  it('rejects unknown event names', async () => {
    await ws._triggerMessage(JSON.stringify({ event: 'player:exploit' }));
    expect(Handler['player:login']).not.toHaveBeenCalled();
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });

  it('dispatches valid events to the correct handler', async () => {
    const msg = JSON.stringify({ event: 'player:move', data: { id: 'abc', direction: 'up' } });
    await ws._triggerMessage(msg);
    expect(Handler['player:move']).toHaveBeenCalledOnce();
  });

  it('passes data and ws to the handler', async () => {
    const payload = { event: 'player:say', data: { said: 'hello' } };
    await ws._triggerMessage(JSON.stringify(payload));
    expect(Handler['player:say']).toHaveBeenCalledWith(
      {
        event: 'player:say',
        data: {
          said: 'hello',
          player: { uuid: 'abc', socket_id: ws.id },
        },
      },
      ws,
      game,
    );
  });

  it('rejects authenticated messages that reference another player', async () => {
    const msg = JSON.stringify({
      event: 'player:context-menu:action',
      data: { player: { socket_id: 'other-socket' } },
    });

    await ws._triggerMessage(msg);

    expect(Handler['player:context-menu:action']).not.toHaveBeenCalled();
  });

  it('rejects null message body', async () => {
    await ws._triggerMessage('null');
    expect(Handler['player:login']).not.toHaveBeenCalled();
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });
});

describe('Delaford.connection – authentication gate', () => {
  let game;
  let ws;

  beforeEach(() => {
    world.clients = [];
    vi.clearAllMocks();

    const mockServer = { on: vi.fn() };
    game = new Delaford(mockServer);
    ws = createMockWs();
    game.connection(ws);
    // ws.authenticated defaults to false after connection
  });

  afterEach(() => {
    game.shutdown();
  });

  it('allows player:login without authentication', async () => {
    const msg = JSON.stringify({ event: 'player:login', data: {} });
    await ws._triggerMessage(msg);
    expect(Handler['player:login']).toHaveBeenCalledOnce();
  });

  it('rejects non-login events from unauthenticated connections', async () => {
    const msg = JSON.stringify({ event: 'player:move', data: {} });
    await ws._triggerMessage(msg);
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });

  it('allows non-login events after authentication', async () => {
    world.players = [{ uuid: 'abc', socket_id: ws.id }];
    ws.authenticated = true;
    const msg = JSON.stringify({ event: 'player:move', data: {} });
    await ws._triggerMessage(msg);
    expect(Handler['player:move']).toHaveBeenCalledOnce();
  });

  it('allows an authenticated pending player to select a Chronicles Scion', async () => {
    ws.authenticated = true;
    ws.pendingPlayer = { uuid: 'abc', socket_id: ws.id };
    const msg = JSON.stringify({
      event: 'player:chronicles:select',
      data: { scionName: 'Vesper' },
    });

    await ws._triggerMessage(msg);

    expect(Handler['player:chronicles:select']).toHaveBeenCalledOnce();
  });

  it('allows an authenticated pending player to migrate a Chronicles record', async () => {
    ws.authenticated = true;
    ws.pendingPlayer = { uuid: 'abc', socket_id: ws.id };
    const msg = JSON.stringify({
      event: 'player:chronicles:save',
      data: { state: { houses: [] } },
    });

    await ws._triggerMessage(msg);

    expect(Handler['player:chronicles:save']).toHaveBeenCalledOnce();
  });

  it('allows an authenticated pending player to mutate a Chronicles record', async () => {
    ws.authenticated = true;
    ws.pendingPlayer = { uuid: 'abc', socket_id: ws.id };
    const msg = JSON.stringify({
      event: 'player:chronicles:mutate',
      data: { type: 'select-house', houseId: 'house-a' },
    });

    await ws._triggerMessage(msg);

    expect(Handler['player:chronicles:mutate']).toHaveBeenCalledOnce();
  });

  it('rejects Chronicles selection without a socket-bound pending player', async () => {
    ws.authenticated = true;
    const msg = JSON.stringify({
      event: 'player:chronicles:select',
      data: { scionName: 'Vesper' },
    });

    await ws._triggerMessage(msg);

    expect(Handler['player:chronicles:select']).not.toHaveBeenCalled();
  });
});

describe('Delaford.connection – rate limiting', () => {
  let game;
  let ws;

  beforeEach(() => {
    world.clients = [];
    vi.clearAllMocks();

    const mockServer = { on: vi.fn() };
    game = new Delaford(mockServer);
    ws = createMockWs();
    game.connection(ws);
    world.players = [{ uuid: 'abc', socket_id: ws.id }];
    ws.authenticated = true;
  });

  afterEach(() => {
    game.shutdown();
  });

  it('allows messages when rate limit tokens are available', async () => {
    const msg = JSON.stringify({ event: 'player:move', data: {} });
    await ws._triggerMessage(msg);
    expect(Handler['player:move']).toHaveBeenCalledOnce();
  });

  it('rejects messages when the rate limit bucket is exhausted', async () => {
    // Movement rides the CRITICAL bucket (40 tokens) so held-key input is
    // never starved by chatty UI events; both buckets still cap out.
    const move = JSON.stringify({ event: 'player:move', data: {} });
    for (let i = 0; i < 40; i += 1) {
      await ws._triggerMessage(move);
    }
    vi.clearAllMocks();
    await ws._triggerMessage(move);
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });

  it('keeps movement flowing while chatty UI events exhaust the general bucket', async () => {
    const uiSpam = JSON.stringify({ event: 'player:context-menu:build', data: {} });
    for (let i = 0; i < 35; i += 1) {
      await ws._triggerMessage(uiSpam); // drains the general bucket
    }
    vi.clearAllMocks();

    const move = JSON.stringify({ event: 'player:move', data: {} });
    await ws._triggerMessage(move);
    expect(Handler['player:move']).toHaveBeenCalled();
  });
});
