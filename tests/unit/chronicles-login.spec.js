/** @vitest-environment node */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
  },
}));

vi.mock('#server/player/authentication.js', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    addPlayer: vi.fn(),
  },
}));

vi.mock('#server/core/player.js', () => ({
  default: class MockPlayer {
    constructor(data, token, socketId) {
      Object.assign(this, data);
      this.accountUsername = data.username;
      this.token = token;
      this.socket_id = socketId;
      this.passiveTree = data.passiveTree || null;
    }

    static broadcastMovement() {}

    static broadcastAnimation() {}
  },
}));

vi.mock('#server/core/world.js', () => ({
  default: {
    players: [],
    clients: [],
    getScenePlayers: vi.fn(() => []),
    removePlayer: vi.fn(),
  },
}));

vi.mock('#server/core/repositories/guest-save-store.js', () => ({
  loadGuest: vi.fn(() => null),
  saveGuest: vi.fn(),
}));

const { default: socketEvents } = await import('#server/player/handlers/socket-events/index.js');
const { default: Authentication } = await import('#server/player/authentication.js');
const { default: Socket } = await import('#server/socket.js');

describe('Chronicles login admission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('holds a browser login outside the world until a Scion is selected', async () => {
    const ws = { id: 'socket-a', authenticated: false };

    await socketEvents['player:login']({
      data: { useGuestAccount: true, awaitChronicles: true },
    }, ws);

    expect(ws.authenticated).toBe(true);
    expect(ws.pendingPlayer).toBeTruthy();
    expect(Authentication.addPlayer).not.toHaveBeenCalled();
    expect(Socket.emit).toHaveBeenCalledWith(
      'player:chronicles:ready',
      expect.objectContaining({
        accountName: 'dev',
        player: { socket_id: 'socket-a' },
      }),
    );

    socketEvents['player:chronicles:select']({ data: { scionName: 'Vesper' } }, ws);

    expect(ws.pendingPlayer).toBeNull();
    expect(Authentication.addPlayer).toHaveBeenCalledOnce();
    expect(Authentication.addPlayer.mock.calls[0][0].username).toBe('Vesper');
    expect(Authentication.addPlayer.mock.calls[0][0].accountUsername).toBe('dev');
  });

  it('keeps the raw headless login contract unchanged', async () => {
    const ws = { id: 'socket-headless', authenticated: false };

    await socketEvents['player:login']({ data: { useGuestAccount: true } }, ws);

    expect(Authentication.addPlayer).toHaveBeenCalledOnce();
    expect(Authentication.addPlayer.mock.calls[0][0].username).toBe('dev');
    expect(Socket.emit).not.toHaveBeenCalledWith('player:chronicles:ready', expect.anything());
  });

  it('re-enters the world directly with the remembered Scion on reconnect', async () => {
    const ws = { id: 'socket-reconnect', authenticated: false };

    await socketEvents['player:login']({
      data: {
        useGuestAccount: true,
        awaitChronicles: true,
        scionName: 'Orun',
      },
    }, ws);

    expect(ws.pendingPlayer).toBeNull();
    expect(Authentication.addPlayer).toHaveBeenCalledOnce();
    expect(Authentication.addPlayer.mock.calls[0][0].username).toBe('Orun');
  });

  it('rejects invalid names and keeps the pending session recoverable', async () => {
    const ws = { id: 'socket-invalid', authenticated: true, pendingPlayer: { username: 'dev' } };

    socketEvents['player:chronicles:select']({ data: { scionName: 'x' } }, ws);

    expect(ws.pendingPlayer).toBeTruthy();
    expect(Authentication.addPlayer).not.toHaveBeenCalled();
    expect(Socket.emit).toHaveBeenCalledWith(
      'player:chronicles:error',
      expect.objectContaining({ message: 'Scion name must be at least 2 characters.' }),
    );
  });
});
