import { afterEach, describe, expect, it, vi } from 'vitest';

import Authentication from '#server/player/authentication.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

describe('authentication login payload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    world._players = [];
    const town = world.getDefaultTown();
    town.players = [];
    town.map = { foreground: [], background: [] };
    town.npcs = [];
    town.items = [];
    town.monsters = [];
    town.metadata = {};
  });

  it('includes public scene metadata needed by the minimap without leaking monster definitions', () => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});

    const town = world.getDefaultTown();
    town.map = { foreground: [1], background: [2] };
    town.metadata = {
      seed: 123,
      portals: [
        {
          id: 'town-north-old-wood',
          x: 38,
          y: 94,
          destination: { sceneId: 'zone:old-wood', x: 100, y: 176 },
        },
      ],
      monsterDefinitions: [
        { id: 'secret-spawn-template', spawn: { x: 10, y: 10 } },
      ],
    };

    Authentication.addPlayer({
      uuid: 'player-1',
      socket_id: 'socket-1',
      username: 'Tester',
      sceneId: world.defaultTownId,
    });

    const loginCall = Socket.emit.mock.calls.find(([event]) => event === 'player:login');

    expect(loginCall).toBeTruthy();
    expect(loginCall[1].scene.metadata.portals).toEqual(town.metadata.portals);
    expect(loginCall[1].scene.metadata.seed).toBe(123);
    expect(loginCall[1].scene.metadata.monsterDefinitions).toBeUndefined();
  });

  it('returns stale surface coordinates outside the village to the plaza spawn', () => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});

    const town = world.getDefaultTown();
    town.map = {
      foreground: new Array(200 * 200).fill(0),
      background: new Array(200 * 200).fill(541),
    };
    town.metadata = { spawnPoints: [{ x: 42, y: 115 }] };
    const player = {
      uuid: 'player-stale-position',
      socket_id: 'socket-stale-position',
      username: 'Stranded',
      sceneId: world.defaultTownId,
      x: 26,
      y: 161,
    };

    Authentication.addPlayer(player);

    expect({ x: player.x, y: player.y }).toEqual({ x: 42, y: 115 });
  });
});
