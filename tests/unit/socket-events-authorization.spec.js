import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
  },
}));

vi.mock('#server/core/player.js', () => ({
  default: {
    broadcastMovement: vi.fn(),
    broadcastAnimation: vi.fn(),
  },
}));

vi.mock('#server/player/authentication.js', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    addPlayer: vi.fn(),
  },
}));

vi.mock('#server/config.js', () => ({
  default: {
    map: {
      viewport: { x: 16, y: 10 },
    },
  },
}));

vi.mock('#server/core/world.js', () => ({
  default: {
    _players: [],
    get players() { return this._players; },
    set players(value) { this._players = value; },
    getScenePlayers: vi.fn(() => []),
  },
}));

const { default: socketEvents } = await import('#server/player/handlers/socket-events/index.js');
const { default: Socket } = await import('#server/socket.js');
const { default: Player } = await import('#server/core/player.js');
const { default: world } = await import('#server/core/world.js');

const createPlayer = (overrides = {}) => ({
  uuid: 'player-a',
  socket_id: 'socket-a',
  username: 'Alice',
  x: 10,
  y: 10,
  sceneId: 'town',
  queue: [],
  currentPane: 'inventory',
  combat: { sequence: 0 },
  animation: { state: 'idle' },
  move: vi.fn(),
  recordSkillInput: vi.fn(() => true),
  ...overrides,
});

describe('socket event authorization', () => {
  let alice;
  let bob;

  beforeEach(() => {
    vi.clearAllMocks();
    alice = createPlayer();
    bob = createPlayer({
      uuid: 'player-b',
      socket_id: 'socket-b',
      username: 'Bob',
      x: 12,
      y: 10,
      currentPane: 'stats',
    });
    world.players = [alice, bob];
    world.getScenePlayers.mockReturnValue([alice, bob]);
  });

  it('moves only the player bound to the authenticated socket', () => {
    socketEvents['player:move'](
      { data: { id: 'player-a', direction: 'up' } },
      { id: 'socket-a' },
    );

    expect(alice.move).toHaveBeenCalledWith('up', expect.objectContaining({ direction: 'up' }));
    expect(bob.move).not.toHaveBeenCalled();
    expect(Player.broadcastMovement).toHaveBeenCalledWith(alice);
  });

  it('rejects movement attempts that spoof another player uuid', () => {
    socketEvents['player:move'](
      { data: { id: 'player-b', direction: 'left' } },
      { id: 'socket-a' },
    );

    expect(alice.move).not.toHaveBeenCalled();
    expect(bob.move).not.toHaveBeenCalled();
    expect(Player.broadcastMovement).not.toHaveBeenCalled();
  });

  it('uses the socket-bound player as the chat speaker instead of the client-supplied id', () => {
    socketEvents['player:say'](
      { data: { id: 'socket-b', said: 'hello' } },
      { id: 'socket-a' },
    );

    expect(Socket.broadcast).toHaveBeenCalledWith(
      'player:say',
      { username: 'Alice', type: 'chat', text: 'hello' },
      [alice, bob],
    );
  });

  it('queues actions on the socket-bound player and rewrites spoofed socket ids', () => {
    const action = {
      player: { socket_id: 'socket-b' },
      actionToQueue: 'mine',
    };

    socketEvents['player:queueAction'](action, { id: 'socket-a' });

    expect(alice.queue).toHaveLength(1);
    expect(alice.queue[0].player.socket_id).toBe('socket-a');
    expect(alice.action).toBe('mine');
    expect(bob.queue).toHaveLength(0);
  });

  it('closes only the pane owned by the socket-bound player', () => {
    socketEvents['player:pane:close'](
      { data: { id: 'player-a' } },
      { id: 'socket-a' },
    );

    expect(alice.currentPane).toBe(false);
    expect(bob.currentPane).toBe('stats');
  });

  it('rejects pane-close attempts that spoof another player uuid', () => {
    socketEvents['player:pane:close'](
      { data: { id: 'player-b' } },
      { id: 'socket-a' },
    );

    expect(alice.currentPane).toBe('inventory');
    expect(bob.currentPane).toBe('stats');
  });
});
