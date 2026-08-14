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
      this.sceneId = data.sceneId || 'town-1';
      this.chronicles = data.chronicles || null;
      this.stats = {
        resources: {
          health: { current: 110, max: 110 },
          mana: { current: 90, max: 90 },
        },
        lifecycle: {
          mode: 'soft',
          state: 'alive',
          deaths: 0,
          livesRemaining: 0,
          cheatDeath: { charges: 1, lastTriggerAt: null },
          respawn: { pending: false, at: null },
        },
      };
      this.hp = this.stats.resources.health;
      this.mana = this.stats.resources.mana;
      this.lifecycle = this.stats.lifecycle;
      this.combat = { inputHistory: [] };
      this.path = { grid: [] };
    }

    cancelPathfinding() {
      this.path.grid = null;
    }

    static broadcastMovement() {}

    static broadcastAnimation() {}
  },
}));

vi.mock('#server/core/world.js', () => ({
  default: {
    defaultTownId: 'town-1',
    players: [],
    clients: [],
    getScenePlayers: vi.fn(() => []),
    removePlayer: vi.fn(),
  },
}));

vi.mock('#server/player/handlers/party.js', () => ({
  partyService: {
    removePlayer: vi.fn(),
  },
}));

vi.mock('#server/core/repositories/guest-save-store.js', () => ({
  loadGuest: vi.fn(() => null),
  saveGuest: vi.fn(),
}));

const chroniclesStoreMock = vi.hoisted(() => ({
  snapshot: vi.fn(() => ({
    exists: false,
    revision: 0,
    state: { version: 3, houses: [], activeHouseId: null, activeScionId: null },
  })),
  findLivingScion: vi.fn(() => null),
  save: vi.fn(),
  mutate: vi.fn(),
  entomb: vi.fn(),
}));

vi.mock('#server/core/services/chronicles-store.js', () => ({
  default: chroniclesStoreMock,
}));

const { default: socketEvents } = await import('#server/player/handlers/socket-events/index.js');
const { default: Authentication } = await import('#server/player/authentication.js');
const { default: Socket } = await import('#server/socket.js');
const { default: world } = await import('#server/core/world.js');
const { partyService } = await import('#server/player/handlers/party.js');

describe('Chronicles login admission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.players.splice(0, world.players.length);
    chroniclesStoreMock.snapshot.mockReturnValue({
      exists: false,
      revision: 0,
      state: { version: 3, houses: [], activeHouseId: null, activeScionId: null },
    });
    chroniclesStoreMock.findLivingScion.mockReturnValue(null);
    chroniclesStoreMock.save.mockReturnValue({
      ok: true,
      revision: 1,
      state: { version: 3, houses: [], activeHouseId: null, activeScionId: null },
    });
    chroniclesStoreMock.mutate.mockReturnValue({
      ok: true,
      revision: 1,
      state: { version: 3, houses: [], activeHouseId: null, activeScionId: null },
    });
    chroniclesStoreMock.entomb.mockReturnValue({ ok: true });
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
        chroniclesRevision: 0,
        chroniclesExists: false,
        player: { socket_id: 'socket-a' },
      }),
    );

    socketEvents['player:chronicles:select']({ data: { scionName: 'Vesper' } }, ws);

    expect(ws.pendingPlayer).toBeNull();
    expect(Authentication.addPlayer).toHaveBeenCalledOnce();
    expect(Authentication.addPlayer.mock.calls[0][0].username).toBe('Vesper');
    expect(Authentication.addPlayer.mock.calls[0][0].accountUsername).toBe('dev');
  });

  it('holds a browser-specific guest on an isolated legacy Chronicle profile', async () => {
    const ws = { id: 'socket-browser-guest', authenticated: false };

    await socketEvents['player:login']({
      data: {
        useGuestAccount: true,
        guestId: 'browser-guest-1234',
        awaitChronicles: true,
      },
    }, ws);

    expect(ws.authenticated).toBe(true);
    expect(ws.chronicleAuth).toBeUndefined();
    expect(ws.pendingPlayer).toEqual(expect.objectContaining({
      uuid: 'browser-guest-browser-guest-1234',
      username: 'Guest-st1234',
    }));
    expect(Authentication.addPlayer).not.toHaveBeenCalled();
    expect(Socket.emit).toHaveBeenCalledWith('player:chronicles:ready', expect.objectContaining({
      player: { socket_id: 'socket-browser-guest' },
      chroniclesAccountId: 'browser-guest-browser-guest-1234',
      accountName: 'Guest-st1234',
    }));
    expect(Socket.emit).not.toHaveBeenCalledWith('chronicles:state', expect.anything());
  });

  it('persists a browser Chronicle and acknowledges the canonical revision', async () => {
    const player = { uuid: 'account-1', socket_id: 'socket-save' };
    const ws = { id: 'socket-save', authenticated: true, pendingPlayer: player };
    const state = { version: 3, houses: [], activeHouseId: null, activeScionId: null };
    chroniclesStoreMock.save.mockReturnValue({ ok: true, revision: 4, state });

    socketEvents['player:chronicles:save']({ data: { state } }, ws);

    expect(chroniclesStoreMock.save).toHaveBeenCalledWith('account-1', state);
    expect(Socket.emit).toHaveBeenCalledWith('player:chronicles:update', expect.objectContaining({
      player: { socket_id: 'socket-save' },
      chronicles: state,
      chroniclesRevision: 4,
      chroniclesExists: true,
    }));
  });

  it('applies a bounded Chronicle mutation and acknowledges the canonical revision', () => {
    const player = { uuid: 'account-1', socket_id: 'socket-mutate' };
    const ws = { id: 'socket-mutate', authenticated: true, pendingPlayer: player };
    const mutation = { type: 'select-house', houseId: 'house-real' };
    const state = { version: 3, houses: [], activeHouseId: null, activeScionId: null };
    chroniclesStoreMock.mutate.mockReturnValue({ ok: true, revision: 5, state });

    socketEvents['player:chronicles:mutate']({ data: mutation }, ws);

    expect(chroniclesStoreMock.mutate).toHaveBeenCalledWith('account-1', mutation);
    expect(Socket.emit).toHaveBeenCalledWith('player:chronicles:update', expect.objectContaining({
      chroniclesRevision: 5,
      chronicles: state,
    }));
  });

  it('uses the server-owned living identity instead of client-authored fields', () => {
    const player = {
      uuid: 'account-1',
      socket_id: 'socket-canonical',
      username: 'account',
      accountUsername: 'account',
      level: 27,
      inventory: [{ id: 'bronze-bar', uuid: 'inherited-bars', qty: 4 }],
      wear: { right_hand: { id: 'bronze-pickaxe', uuid: 'inherited-pickaxe' } },
      bank: [{ id: 'gold-ring', uuid: 'inherited-bank-item' }],
      passiveTree: { nodes: ['inherited-build'] },
      chronicles: null,
      stats: {
        resources: {
          health: { current: 10, max: 10 },
          mana: { current: 10, max: 10 },
        },
        lifecycle: {
          mode: 'soft',
          state: 'alive',
          cheatDeath: {},
          respawn: {},
        },
      },
      combat: { inputHistory: [] },
      cancelPathfinding: vi.fn(),
    };
    const ws = { id: 'socket-canonical', authenticated: true, pendingPlayer: player };
    chroniclesStoreMock.snapshot.mockReturnValue({
      exists: true,
      revision: 2,
      state: { version: 3, houses: [], activeHouseId: null, activeScionId: null },
    });
    chroniclesStoreMock.findLivingScion.mockReturnValue({
      house: { id: 'house-real' },
      scion: { id: 'scion-real', name: 'Vesper', mortal: true },
    });

    socketEvents['player:chronicles:select']({
      data: {
        houseId: 'house-forged',
        scionId: 'scion-forged',
        scionName: 'Impostor',
        mortal: false,
      },
    }, ws);

    const admitted = Authentication.addPlayer.mock.calls[0][0];
    expect(admitted).not.toBe(player);
    expect(admitted.username).toBe('Vesper');
    expect(admitted.chronicles).toEqual({
      houseId: 'house-real',
      scionId: 'scion-real',
      mortal: true,
    });
    expect(admitted.level).toBe(1);
    expect(admitted.inventory.map(item => item.id)).toEqual(['bronze-dagger', 'coins']);
    expect(admitted.bank).toEqual([]);
    expect(admitted.passiveTree).toBeNull();
    expect(Object.values(admitted.wear).every(item => item === null)).toBe(true);
  });

  it('preserves progression when reconnecting to the same server-owned Scion', () => {
    const player = {
      uuid: 'account-same',
      socket_id: 'socket-same',
      username: 'Vesper',
      accountUsername: 'account',
      level: 11,
      inventory: [{ id: 'vessel-handaxe', uuid: 'earned-axe' }],
      bank: [{ id: 'gold-ring', uuid: 'earned-ring' }],
      passiveTree: { nodes: ['0,0'] },
      friend_list: [],
      chronicles: { houseId: 'house-real', scionId: 'scion-real', mortal: true },
      stats: {
        resources: {
          health: { current: 7, max: 110 },
          mana: { current: 20, max: 90 },
        },
        lifecycle: { mode: 'hard', state: 'alive', respawn: {}, cheatDeath: {} },
      },
    };
    const ws = { id: 'socket-same', authenticated: true, pendingPlayer: player };
    chroniclesStoreMock.snapshot.mockReturnValue({
      exists: true,
      revision: 2,
      state: { version: 3, houses: [], activeHouseId: null, activeScionId: 'scion-real' },
    });
    chroniclesStoreMock.findLivingScion.mockReturnValue({
      house: { id: 'house-real' },
      scion: { id: 'scion-real', name: 'Vesper', mortal: true },
    });

    socketEvents['player:chronicles:select']({
      data: { scionId: 'scion-real', scionName: 'forged-name' },
    }, ws);

    const admitted = Authentication.addPlayer.mock.calls[0][0];
    expect(admitted).toBe(player);
    expect(admitted.level).toBe(11);
    expect(admitted.inventory).toEqual([{ id: 'vessel-handaxe', uuid: 'earned-axe' }]);
    expect(admitted.bank).toEqual([{ id: 'gold-ring', uuid: 'earned-ring' }]);
    expect(admitted.passiveTree).toEqual({ nodes: ['0,0'] });
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

  it('entombs a final-dead mortal identity and admits a living successor', async () => {
    const ws = { id: 'socket-mortal', authenticated: false };
    await socketEvents['player:login']({
      data: { useGuestAccount: true, awaitChronicles: true },
    }, ws);

    socketEvents['player:chronicles:select']({
      data: {
        houseId: 'house-morvayne',
        scionId: 'scion-morrow',
        scionName: 'Morrow',
        mortal: true,
      },
    }, ws);

    const mortal = Authentication.addPlayer.mock.calls[0][0];
    expect(mortal.chronicles).toEqual({
      houseId: 'house-morvayne',
      scionId: 'scion-morrow',
      mortal: true,
    });
    expect(mortal.stats.lifecycle.mode).toBe('hard');

    mortal.stats.lifecycle.state = 'permadead';
    mortal.stats.lifecycle.lastEvent = { type: 'permadeath', occurredAt: 1234 };
    mortal.stats.resources.health.current = 0;
    world.players.push(mortal);

    socketEvents['player:chronicles:return']({
      data: { houseId: 'house-morvayne', scionId: 'scion-morrow' },
    }, ws);

    expect(world.removePlayer).toHaveBeenCalledWith(mortal);
    expect(partyService.removePlayer).toHaveBeenCalledWith(mortal.uuid);
    expect(ws.pendingPlayer).toBe(mortal);
    expect(ws.retiredScionId).toBe('scion-morrow');
    expect(Socket.emit).toHaveBeenCalledWith(
      'player:chronicles:ready',
      expect.objectContaining({
        fallen: expect.objectContaining({ scionId: 'scion-morrow', scionName: 'Morrow' }),
      }),
    );

    socketEvents['player:chronicles:select']({
      data: {
        houseId: 'house-morvayne',
        scionId: 'scion-sable',
        scionName: 'Sable',
        mortal: false,
      },
    }, ws);

    expect(Authentication.addPlayer).toHaveBeenCalledTimes(2);
    const successor = Authentication.addPlayer.mock.calls[1][0];
    expect(successor).not.toBe(mortal);
    expect(mortal.username).toBe('Morrow');
    expect(mortal.stats.lifecycle.state).toBe('permadead');
    expect(successor.username).toBe('Sable');
    expect(successor.inventory.map(item => item.id)).toEqual(['bronze-dagger', 'coins']);
    expect(successor.stats.lifecycle).toEqual(expect.objectContaining({
      mode: 'soft',
      state: 'alive',
      deaths: 0,
    }));
    expect(successor.stats.resources.health.current).toBe(110);
    expect(successor.sceneId).toBe('town-1');
  });
});
