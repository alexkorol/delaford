/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import createPlayerMovementHandler from '#server/core/entities/player/movement-handler.js';

const sceneId = 'test:player-movement-collision';

const makeOpenMap = () => {
  const tileCount = 200 * 200;
  return {
    background: new Array(tileCount).fill(1),
    foreground: new Array(tileCount).fill(0),
  };
};

const makePlayer = () => {
  const player = {
    uuid: 'player-path-block',
    socket_id: 'socket-path-block',
    username: 'Path Block Tester',
    x: 10,
    y: 10,
    sceneId,
    facing: 'right',
    moving: false,
    action: false,
    queue: [],
    blocked: { foreground: null, background: null },
    path: {
      current: {
        name: '',
        length: 2,
        path: {
          walking: [[10, 10], [11, 10], [12, 10]],
          set: [],
        },
        step: 0,
        walkable: true,
        interrupted: false,
        walkId: 0,
      },
    },
    movementStep: {
      sequence: 0,
      startedAt: 0,
      duration: 0,
      walkId: 0,
      stepIndex: 0,
      steps: 0,
      direction: null,
      blocked: false,
      interrupted: false,
    },
    animation: null,
  };

  player.movement = createPlayerMovementHandler(player);
  player.move = player.movement.move;
  player.walkPath = player.movement.walkPath;
  return player;
};

const makeMonsterBlocker = () => ({
  uuid: 'monster-path-block',
  x: 11,
  y: 10,
  isAlive: true,
  stats: {
    resources: {
      health: { current: 12, max: 12 },
    },
  },
});

describe('player movement collision', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    world.clients = [];
    world._players = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    world.scenes.delete(sceneId);
    world._players = [];
  });

  it('blocks server movement into a living monster tile', () => {
    const player = makePlayer();
    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [makeMonsterBlocker()],
      metadata: { portals: [], spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];
    world.players.push(player);

    expect(player.movement.canMoveTo(11, 10)).toBe(false);
    expect(player.move('right', {
      pathfind: true,
      startedAt: 1_000,
      walkId: 1,
      stepIndex: 1,
      steps: 2,
    })).toBe(false);
    expect(player.x).toBe(10);
    expect(player.y).toBe(10);
    expect(player.movementStep).toEqual(expect.objectContaining({
      blocked: true,
      direction: 'right',
      walkId: 1,
    }));
  });

  it('interrupts path following when the next path tile is occupied by a monster', async () => {
    vi.useFakeTimers();
    const player = makePlayer();
    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [makeMonsterBlocker()],
      metadata: { portals: [], spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];
    world.players.push(player);

    player.walkPath(0);
    await vi.advanceTimersByTimeAsync(150);

    expect(player.x).toBe(10);
    expect(player.y).toBe(10);
    expect(player.movementStep.blocked).toBe(true);
    expect(player.path.current.interrupted).toBe(true);
    expect(player.path.current.path.walking).toEqual([]);
    expect(player.path.current.walkable).toBe(false);
    expect(player.moving).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(player.x).toBe(10);
    expect(player.y).toBe(10);
  });
});
