import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import DUNGEON_TILESET, { DUNGEON_FIRST_GID } from '#shared/dungeon-tiles.js';
import { createWorldLayout } from '#server/core/world-layout.js';
import { transitionPlayerIfOnPortal } from '#server/core/world-transitions.js';
import { ROADS } from '#server/core/world-web.js';
// Warm the zone-service module graph (map.js and friends) so the road gate's
// dynamic import resolves promptly inside the test's waitFor window.
import '#server/core/services/zone-service.js';

const localId = gid => (gid >= DUNGEON_FIRST_GID ? gid - DUNGEON_FIRST_GID : -1);
const blockedBackground = new Set(DUNGEON_TILESET.blockedBg || []);
const walkableForeground = new Set(DUNGEON_TILESET.walkableFg || []);

const registerLayout = (layout) => {
  const town = world.getDefaultTown();
  town.name = layout.town.name;
  town.type = layout.town.type;
  town.map = layout.town.map;
  town.metadata = layout.town.metadata;
  town.players = [];
};

const isWalkable = (scene, x, y) => {
  if (x < 0 || y < 0 || x >= 200 || y >= 200) {
    return false;
  }

  const index = (y * 200) + x;
  const background = localId(scene.map.background[index]);
  const foreground = localId(scene.map.foreground[index]);

  return !blockedBackground.has(background)
    && (foreground < 0 || foreground === -1 || walkableForeground.has(foreground));
};

const hasWalkablePath = (scene, start, destination) => {
  if (!isWalkable(scene, start.x, start.y) || !isWalkable(scene, destination.x, destination.y)) {
    return false;
  }

  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.x === destination.x && current.y === destination.y) {
      return true;
    }

    directions.forEach((direction) => {
      const next = {
        x: current.x + direction.x,
        y: current.y + direction.y,
      };
      const key = `${next.x},${next.y}`;
      if (!seen.has(key) && isWalkable(scene, next.x, next.y)) {
        seen.add(key);
        queue.push(next);
      }
    });
  }

  return false;
};

describe('the Crossroads layout', () => {
  it('uses only DCSS gids on the town map', () => {
    const layout = createWorldLayout();
    const scene = layout.town;

    expect(scene.map.background).toHaveLength(200 * 200);
    expect(scene.map.foreground).toHaveLength(200 * 200);
    expect(scene.map.background.every(gid => gid >= DUNGEON_FIRST_GID)).toBe(true);
    expect(scene.map.foreground.every(gid => gid === 0 || gid >= DUNGEON_FIRST_GID)).toBe(true);
  });

  it('is truce-ground: sanctuary, no monster definitions', () => {
    const layout = createWorldLayout();
    expect(layout.town.metadata.sanctuary).toBe(true);
    expect(layout.town.metadata.monsterDefinitions).toEqual([]);
    expect(layout.scenes).toEqual([]);
  });

  it('has one road gate per world-web road, on a walkable pad', () => {
    const layout = createWorldLayout();
    const scene = layout.town;
    const portals = scene.metadata.portals;
    const roadIds = new Set(ROADS.map(road => road.id));

    expect(portals).toHaveLength(ROADS.length);
    portals.forEach((portal) => {
      expect(roadIds.has(portal.destination.road)).toBe(true);
      expect(scene.map.foreground[(portal.y * 200) + portal.x]).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
      for (let y = portal.y - 1; y <= portal.y + 1; y += 1) {
        for (let x = portal.x - 1; x <= portal.x + 1; x += 1) {
          expect(isWalkable(scene, x, y)).toBe(true);
        }
      }
    });
    expect(new Set(portals.map(portal => portal.destination.road)).size).toBe(ROADS.length);
  });

  it('keeps the spawn connected to every road gate and wagon pitch', () => {
    const layout = createWorldLayout();
    const scene = layout.town;
    const [spawn] = scene.metadata.spawnPoints;

    scene.metadata.portals.forEach((portal) => {
      expect(hasWalkablePath(scene, spawn, portal)).toBe(true);
    });

    expect(scene.metadata.wagonPitches.length).toBeGreaterThanOrEqual(8);
    scene.metadata.wagonPitches.forEach((pitch) => {
      expect(isWalkable(scene, pitch.x, pitch.y)).toBe(true);
      expect(hasWalkablePath(scene, spawn, pitch)).toBe(true);
    });
  });

  it('keeps the fountain amenity where the roads cross', () => {
    const layout = createWorldLayout();
    const fountainGid = layout.town.map.foreground[(115 * 200) + 38];
    expect(fountainGid).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
  });
});

describe('road gate transitions', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});

    world.clients = [];
    world._players = [];
    registerLayout(createWorldLayout());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the road chart instead of teleporting', async () => {
    const player = {
      uuid: 'player-1',
      socket_id: 'socket-1',
      username: 'Tester',
      houseId: 'house-test-1',
      houseName: 'Testers',
      x: 38,
      y: 94,
      sceneId: world.defaultTownId,
      path: { grid: 'stale' },
      cancelPathfinding: vi.fn(),
    };
    world.addPlayer(player);

    const transitioned = transitionPlayerIfOnPortal(player);
    expect(transitioned).toBe(true);

    // The chart opens through a dynamic import; flush it.
    await vi.waitFor(() => {
      const chartEvent = Socket.emit.mock.calls.find(([event, payload]) => (
        event === 'open:screen' && payload.screen === 'chart'
      ));
      expect(chartEvent).toBeTruthy();
      expect(chartEvent[1].payload.roadId).toBe('tin');
      expect(chartEvent[1].payload.nodes.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // The player has not left the Crossroads.
    expect(player.sceneId).toBe(world.defaultTownId);
  });
});
