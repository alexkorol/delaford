import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import Monster from '#server/core/monster.js';
import { SURFACE_MONSTER_COLUMNS } from '#shared/actor-graphics.js';
import DUNGEON_TILESET, { DUNGEON_FIRST_GID, dungeonGid } from '#shared/dungeon-tiles.js';
import { createWorldLayout } from '#server/core/world-layout.js';
import { transitionPlayerIfOnPortal } from '#server/core/world-transitions.js';
import npcDefinitions from '#server/core/data/npcs.js';

const allScenes = layout => [layout.town, ...layout.scenes];
const localId = gid => (gid >= DUNGEON_FIRST_GID ? gid - DUNGEON_FIRST_GID : -1);
const blockedBackground = new Set(DUNGEON_TILESET.blockedBg || []);
const walkableForeground = new Set(DUNGEON_TILESET.walkableFg || []);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const defaultViewport = { x: 24, y: 15 };
const entityViewportPadding = 1;

const registerLayout = (layout) => {
  const town = world.getDefaultTown();
  town.name = layout.town.name;
  town.type = layout.town.type;
  town.map = layout.town.map;
  town.metadata = layout.town.metadata;
  town.players = [];

  layout.scenes.forEach((scene) => {
    world.ensureScene(scene.id, scene);
    world.getScene(scene.id).players = [];
  });
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

const isVisibleFromArrival = (arrival, point) => {
  const cropX = arrival.x - Math.floor(0.5 * defaultViewport.x);
  const cropY = arrival.y - Math.floor(0.5 * defaultViewport.y);

  return point.x >= cropX - entityViewportPadding
    && point.x <= cropX + defaultViewport.x + entityViewportPadding
    && point.y >= cropY - entityViewportPadding
    && point.y <= cropY + defaultViewport.y + entityViewportPadding;
};

describe('DCSS world layout', () => {
  it('uses only DCSS gids on generated world maps', () => {
    const layout = createWorldLayout();

    allScenes(layout).forEach((scene) => {
      expect(scene.map.background).toHaveLength(200 * 200);
      expect(scene.map.foreground).toHaveLength(200 * 200);
      expect(scene.map.background.every(gid => gid >= DUNGEON_FIRST_GID)).toBe(true);
      expect(scene.map.foreground.every(gid => gid === 0 || gid >= DUNGEON_FIRST_GID)).toBe(true);
    });
  });

  it('connects every portal to a registered scene and valid destination tile', () => {
    const layout = createWorldLayout();
    const sceneIds = new Set(allScenes(layout).map(scene => scene.id));
    const scenesById = new Map(allScenes(layout).map(scene => [scene.id, scene]));

    allScenes(layout).forEach((scene) => {
      expect(scene.metadata.portals.length).toBeGreaterThan(0);
      scene.metadata.portals.forEach((portal) => {
        expect(scene.map.foreground[(portal.y * 200) + portal.x]).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
        expect(isWalkable(scene, portal.x, portal.y)).toBe(true);

        // Instance gates lead into generated zones, not static scenes.
        if (portal.destination.instance) {
          expect(typeof portal.destination.instance.template).toBe('string');
          expect(typeof portal.destination.instance.layout).toBe('string');
          return;
        }

        expect(sceneIds.has(portal.destination.sceneId)).toBe(true);
        expect(portal.destination.x).toBeGreaterThanOrEqual(0);
        expect(portal.destination.x).toBeLessThan(200);
        expect(portal.destination.y).toBeGreaterThanOrEqual(0);
        expect(portal.destination.y).toBeLessThan(200);
        expect(isWalkable(scenesById.get(portal.destination.sceneId), portal.destination.x, portal.destination.y)).toBe(true);
      });
    });
  });

  it('keeps portal pads clear of blocking walls and trees', () => {
    const layout = createWorldLayout();

    allScenes(layout).forEach((scene) => {
      scene.metadata.portals.forEach((portal) => {
        for (let y = portal.y - 1; y <= portal.y + 1; y += 1) {
          for (let x = portal.x - 1; x <= portal.x + 1; x += 1) {
            expect(isWalkable(scene, x, y)).toBe(true);
          }
        }
      });
    });
  });

  it('keeps every scene spawn connected to every portal', () => {
    const layout = createWorldLayout();

    allScenes(layout).forEach((scene) => {
      const spawnPoints = scene.metadata.spawnPoints || [];
      scene.metadata.portals.forEach((portal) => {
        expect(
          spawnPoints.some(spawn => hasWalkablePath(scene, spawn, portal)),
        ).toBe(true);
      });
    });
  });

  it('places reachable furnace and anvil interactions in the rebuilt village', () => {
    const layout = createWorldLayout();
    const interactions = layout.town.metadata.interactions || [];
    const stations = interactions.filter(interaction => [217, 287].includes(interaction.objectId));
    const stationIds = new Set(stations.map(interaction => interaction.objectId));

    expect(stationIds).toEqual(new Set([217, 287]));
    stations.forEach((interaction) => {
      const stationIndex = (interaction.y * 200) + interaction.x;
      expect(layout.town.map.foreground[stationIndex]).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
      expect([
        { x: interaction.x - 1, y: interaction.y },
        { x: interaction.x + 1, y: interaction.y },
        { x: interaction.x, y: interaction.y - 1 },
        { x: interaction.x, y: interaction.y + 1 },
      ].some(point => (
        isWalkable(layout.town, point.x, point.y)
        && hasWalkablePath(layout.town, layout.town.metadata.spawnPoints[0], point)
      ))).toBe(true);
    });
  });

  it('places reachable copper and tin rocks beside the rebuilt smithy', () => {
    const layout = createWorldLayout();
    const resources = (layout.town.metadata.interactions || [])
      .filter(interaction => [280, 281].includes(interaction.objectId));

    expect(new Set(resources.map(resource => resource.objectId))).toEqual(new Set([280, 281]));
    resources.forEach((resource) => {
      const resourceIndex = (resource.y * 200) + resource.x;
      const expectedGid = resource.objectId === 280
        ? dungeonGid('rock_copper')
        : dungeonGid('rock_tin');
      expect(layout.town.map.foreground[resourceIndex]).toBe(expectedGid);
      expect(resource.depletedGid).toBe(dungeonGid('rock_depleted'));
      expect([
        { x: resource.x - 1, y: resource.y },
        { x: resource.x + 1, y: resource.y },
        { x: resource.x, y: resource.y - 1 },
        { x: resource.x, y: resource.y + 1 },
      ].some(point => (
        isWalkable(layout.town, point.x, point.y)
        && hasWalkablePath(layout.town, layout.town.metadata.spawnPoints[0], point)
      ))).toBe(true);
    });
  });

  it('keeps every town NPC spawn walkable and reachable', () => {
    const layout = createWorldLayout();
    const townSpawn = layout.town.metadata.spawnPoints[0];

    npcDefinitions.forEach((npc) => {
      expect(isWalkable(layout.town, npc.spawn.x, npc.spawn.y)).toBe(true);
      expect(hasWalkablePath(layout.town, townSpawn, npc.spawn)).toBe(true);
    });
  });

  it('places a visible monster encounter near every non-town arrival', () => {
    const layout = createWorldLayout();
    const scenesById = new Map(allScenes(layout).map(scene => [scene.id, scene]));

    allScenes(layout).forEach((scene) => {
      scene.metadata.portals.forEach((portal) => {
        const destination = scenesById.get(portal.destination.sceneId);
        if (!destination || destination.type === 'town') {
          return;
        }

        const monsters = destination.metadata.monsterDefinitions || [];
        expect(monsters.some(monster => (
          distance(portal.destination, monster.spawn) <= 16
          && isVisibleFromArrival(portal.destination, monster.spawn)
        ))).toBe(true);
      });
    });
  });

  it('keeps monster spawns walkable and reachable from scene arrivals', () => {
    const layout = createWorldLayout();
    const scenesById = new Map(allScenes(layout).map(scene => [scene.id, scene]));

    allScenes(layout).forEach((scene) => {
      scene.metadata.portals.forEach((portal) => {
        const destination = scenesById.get(portal.destination.sceneId);
        if (!destination || destination.type === 'town') {
          return;
        }

        const monsters = destination.metadata.monsterDefinitions || [];
        expect(monsters.length).toBeGreaterThan(0);
        expect(monsters.some(monster => (
          isWalkable(destination, monster.spawn.x, monster.spawn.y)
          && hasWalkablePath(destination, portal.destination, monster.spawn)
        ))).toBe(true);
      });
    });
  });
});

describe('world portal transitions', () => {
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

  it('moves a player standing on a portal into the destination scene', () => {
    const player = {
      uuid: 'player-1',
      socket_id: 'socket-1',
      username: 'Tester',
      x: 38,
      y: 94,
      sceneId: world.defaultTownId,
      path: { grid: 'stale' },
      cancelPathfinding: vi.fn(),
    };
    world.addPlayer(player);

    const transitioned = transitionPlayerIfOnPortal(player);

    expect(transitioned).toBe(true);
    expect(player.sceneId).toBe('zone:old-wood');
    expect(player.x).toBe(100);
    expect(player.y).toBe(176);
    expect(player.path.grid).toBe(null);
    expect(player.cancelPathfinding).toHaveBeenCalled();

    const sceneEvent = Socket.emit.mock.calls.find(([event]) => event === 'world:scene:transition');
    expect(sceneEvent).toBeTruthy();
    expect(sceneEvent[1].scene.id).toBe('zone:old-wood');
    expect(sceneEvent[1].playerState.sceneId).toBe('zone:old-wood');
  });

  it('includes instantiated destination monsters in portal transition payloads', () => {
    Monster.load();

    const player = {
      uuid: 'player-1',
      socket_id: 'socket-1',
      username: 'Tester',
      x: 38,
      y: 94,
      sceneId: world.defaultTownId,
      path: { grid: 'stale' },
      cancelPathfinding: vi.fn(),
    };
    world.addPlayer(player);

    const transitioned = transitionPlayerIfOnPortal(player);

    expect(transitioned).toBe(true);

    const sceneEvent = Socket.emit.mock.calls.find(([event]) => event === 'world:scene:transition');
    expect(sceneEvent).toBeTruthy();
    expect(sceneEvent[1].scene.id).toBe('zone:old-wood');
    expect(sceneEvent[1].scene.monsters).toHaveLength(3);
    expect(sceneEvent[1].scene.monsters[0]).toEqual(expect.objectContaining({
      name: 'Old Wood Wolf',
      x: 100,
      y: 170,
      column: SURFACE_MONSTER_COLUMNS['oldwood-wolf'],
      row: 0,
    }));
    expect(sceneEvent[1].scene.monsters[0].uuid).toBeTruthy();
    expect(sceneEvent[1].scene.metadata.monsterDefinitions).toBeUndefined();
  });
});
