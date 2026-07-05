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
  },
}));

vi.mock('node-emoji', () => ({
  get: vi.fn(() => ''),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-0001'),
}));

const { default: Handler } = await import('#server/player/handler.js');
const { default: world } = await import('#server/core/world.js');

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
    const msg = JSON.stringify({ event: 'player:move', data: {} });

    // The rate limiter starts with 30 tokens. Exhaust them all.
    for (let i = 0; i < 30; i += 1) {
      await ws._triggerMessage(msg);
    }

    vi.clearAllMocks();

    // The 31st message should be rate-limited
    await ws._triggerMessage(msg);
    expect(Handler['player:move']).not.toHaveBeenCalled();
  });
});
