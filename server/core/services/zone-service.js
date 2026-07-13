/**
 * World-web zone lifecycle (docs/crossroads-world-web.md).
 *
 * Zones are per-House instances keyed `zone:<houseId>:<nodeId>`. They are
 * NOT party instances: they outlive the party that opened them, lingering
 * ZONE_LINGER_MS after the last player steps out ("the land holds your
 * footprints for a quarter hour"), then the green closes over them and the
 * next visit rolls a fresh layout of the same node.
 *
 * Progression: each zone's exit is held by its Warden (the boss the
 * generator already places over the stairs). While the Warden lives, the
 * onward gates refuse. When it dies the node is marked cleared for the
 * owning House and the child nodes unlock — permanently, in SQLite.
 */
import Socket from '#server/socket.js';
import config from '#server/config.js';
import world from '#server/core/world.js';
import GameMap from '#server/core/map.js';
import Monster from '#server/core/monster.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import { buildScenePayload } from '#server/core/world-transitions.js';
import { dungeonGid } from '#shared/dungeon-tiles.js';
import {
  buildChart,
  getNode,
  isNodeUnlocked,
} from '#server/core/world-web.js';
import {
  notifyFirstGoalReturned,
  notifyFirstGoalWardenDown,
} from '#server/core/first-goal.js';

export const ZONE_LINGER_MS = Number(process.env.ZONE_LINGER_MS) || (15 * 60 * 1000);

// A lingering zone must stay cleared: the default instance respawn (10 min)
// would resurrect packs and the Warden inside the linger window.
const ZONE_RESPAWN_MS = 24 * 60 * 60 * 1000;

const GATE_DENIED_THROTTLE_MS = 3000;

export const zoneKeyFor = (houseId, nodeId) => `zone:${houseId}:${nodeId}`;

const sendMessage = (player, text) => {
  if (!player || !player.socket_id || !text) return;
  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
};

const partyMembersOf = async (player) => {
  // partyService lives in the handler layer; dynamic import keeps this
  // service importable from anywhere without a cycle.
  const { partyService } = await import('#server/player/handlers/party.js');
  const party = partyService.getPartyForPlayer(player.uuid);
  if (!party) return { party: null, members: [player] };
  const members = [];
  partyService.forEachMember(party, member => members.push(member));
  return { party, members: members.length ? members : [player] };
};

const transitionPlayerIntoScene = (player, scene, spawn) => {
  const fromScene = world.getScene(player.sceneId);
  if (!fromScene || fromScene.type !== 'instance') {
    player.preInstancePosition = {
      x: player.x,
      y: player.y,
      sceneId: fromScene ? fromScene.id : null,
    };
  }

  if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y)) {
    player.x = spawn.x;
    player.y = spawn.y;
  }

  world.assignPlayerToScene(player, scene.id);
  if (typeof player.cancelPathfinding === 'function') {
    player.cancelPathfinding();
  }
  if (player.path) {
    player.path.grid = null;
  }

  Socket.emit('world:scene:transition', {
    player: { socket_id: player.socket_id },
    scene: buildScenePayload(scene),
    playerState: {
      uuid: player.uuid,
      x: player.x,
      y: player.y,
      sceneId: player.sceneId,
    },
  });
};

const tileIsOpenOn = (map, width, x, y) => {
  const index = (y * width) + x;
  return Number.isFinite(map.background[index]) && map.background[index] !== 0;
};

class ZoneService {
  constructor() {
    this.transitioning = new Set();
  }

  clearedNodesFor(houseId) {
    return chroniclesRepository.getClearedZoneNodes(houseId);
  }

  openRoadChart(player, roadId) {
    if (!player?.houseId) {
      sendMessage(player, 'Only a sworn scion of a House can read its chart.');
      return;
    }
    const chart = buildChart(player.houseId, roadId, this.clearedNodesFor(player.houseId));
    if (!chart) return;
    player.currentPane = 'chart';
    Socket.emit('open:screen', {
      player: { socket_id: player.socket_id },
      screen: 'chart',
      payload: {
        ...chart,
        houseName: player.houseName || null,
      },
    });
  }

  /**
   * Generate a fresh instance of a node. Layout seed is rolled fresh every
   * instantiation — node identity is stable, its terrain is not.
   */
  async generateZoneScene(houseId, houseName, node) {
    const generation = await GameMap.generateInstance({
      seed: Date.now(),
      template: node.template,
      layout: node.layout,
      depth: node.tier,
    });

    // The generator guards the stairs with the floor's only elite: that is
    // the Warden. Rename it for the node and pin its respawn far past the
    // linger window, along with the rest of the population.
    let wardenTemplateId = null;
    (generation.monsters || []).forEach((definition) => {
      definition.respawn = { ...(definition.respawn || {}), delayMs: ZONE_RESPAWN_MS };
      if (definition.rarity === 'elite' && !wardenTemplateId) {
        wardenTemplateId = definition.id;
        definition.name = node.wardenName;
      }
    });

    // Gates: the entry stairs return to the Crossroads; the exit stairs
    // become the first onward gate. A branching node gets a second gate
    // painted beside the first.
    const { metadata, map } = generation;
    const width = config?.map?.size?.x || 200;

    const childNodes = node.childIds
      .map(childId => getNode(houseId, childId))
      .filter(Boolean);

    const zoneGates = [];
    if (metadata.stairsDown && childNodes.length) {
      const base = metadata.stairsDown;
      const gateSpots = [
        { x: base.x, y: base.y },
        { x: base.x + 2, y: base.y },
        { x: base.x - 2, y: base.y },
        { x: base.x, y: base.y + 2 },
      ];
      childNodes.slice(0, 2).forEach((child, order) => {
        const spot = gateSpots.find(candidate => (
          !zoneGates.some(gate => gate.x === candidate.x && gate.y === candidate.y)
          && tileIsOpenOn(map, width, candidate.x, candidate.y)
        )) || gateSpots[order];
        // Carve the gate pad open and paint the portal art.
        const index = (spot.y * width) + spot.x;
        map.foreground[index] = dungeonGid('exit_portal');
        zoneGates.push({
          x: spot.x,
          y: spot.y,
          nodeId: child.id,
          name: child.name,
          levelHint: child.levelHint,
        });
      });
    }

    const alreadyCleared = this.clearedNodesFor(houseId).includes(node.id);

    const scene = world.createZoneScene(zoneKeyFor(houseId, node.id), {
      name: node.name,
      map: generation.map,
      npcs: generation.npcs,
      items: generation.items,
      respawns: generation.respawns,
      metadata: {
        ...metadata,
        ownerHouseId: houseId,
        ownerHouseName: houseName || null,
        nodeId: node.id,
        nodeName: node.name,
        roadId: node.roadId,
        roadName: node.roadName,
        tier: node.tier,
        wardenTemplateId,
        wardenName: node.wardenName,
        wardenDead: false,
        wardenAnnounced: alreadyCleared,
        entryGate: metadata.stairsUp ? { ...metadata.stairsUp } : null,
        zoneGates,
        emptySince: null,
      },
    });

    scene.monsters = (generation.monsters || []).map((definition, index) => new Monster({
      ...definition,
      sceneId: scene.id,
      instanceId: `${scene.id}:${definition.id || index}`,
    }));

    return scene;
  }

  /**
   * Enter a node on the acting player's House chart. Party members follow
   * (a party shares one chart); only the leader may set the destination.
   */
  async enterZoneNode(player, nodeIdValue, { announce = true } = {}) {
    if (!player) return false;
    if (!player.houseId) {
      sendMessage(player, 'Only a sworn scion of a House can walk its chart.');
      return false;
    }
    if (this.transitioning.has(player.uuid)) return false;

    const node = getNode(player.houseId, nodeIdValue);
    if (!node) {
      sendMessage(player, 'That country is not on your chart.');
      return false;
    }

    const cleared = this.clearedNodesFor(player.houseId);
    if (!isNodeUnlocked(player.houseId, node.id, cleared)) {
      sendMessage(player, `No road holds through to ${node.name} yet — its Warden's ground is uncharted.`);
      return false;
    }

    const { party, members } = await partyMembersOf(player);
    if (party && party.members.size > 1 && party.leaderId !== player.uuid) {
      sendMessage(player, 'The wagon-lead sets the road. Only your party leader can chart the way.');
      return false;
    }

    this.transitioning.add(player.uuid);
    try {
      const zoneKey = zoneKeyFor(player.houseId, node.id);
      let scene = world.getZoneScene(zoneKey);
      if (!scene) {
        scene = await this.generateZoneScene(player.houseId, player.houseName, node);
      }
      scene.metadata.emptySince = null;

      const spawnPoints = Array.isArray(scene.metadata.spawnPoints) && scene.metadata.spawnPoints.length
        ? scene.metadata.spawnPoints
        : [{ x: player.x, y: player.y }];

      members.forEach((member, index) => {
        const spawn = spawnPoints[index % spawnPoints.length];
        transitionPlayerIntoScene(member, scene, spawn);
        if (announce) {
          sendMessage(member, `You take ${node.roadName} into ${node.name}.`);
        }
      });
      return true;
    } catch (error) {
      console.error(`[zones] Failed to enter ${nodeIdValue}:`, error);
      sendMessage(player, 'The way would not hold. Try again.');
      return false;
    } finally {
      this.transitioning.delete(player.uuid);
    }
  }

  /** Individual exit: the zone persists behind whoever steps out. */
  returnToCrossroads(player, { message = 'You walk back to the Crossroads.' } = {}) {
    const town = world.getDefaultTown();
    const back = player.preInstancePosition;
    const backScene = back && back.sceneId ? world.getScene(back.sceneId) : null;
    const returnScene = backScene && backScene.type !== 'instance' ? backScene : town;

    if (back && Number.isFinite(back.x) && Number.isFinite(back.y)) {
      player.x = back.x;
      player.y = back.y;
    } else if (Array.isArray(town.metadata?.spawnPoints) && town.metadata.spawnPoints[0]) {
      player.x = town.metadata.spawnPoints[0].x;
      player.y = town.metadata.spawnPoints[0].y;
    }
    player.preInstancePosition = null;

    world.assignPlayerToScene(player, returnScene.id);
    if (typeof player.cancelPathfinding === 'function') {
      player.cancelPathfinding();
    }
    if (player.path) {
      player.path.grid = null;
    }

    Socket.emit('world:scene:transition', {
      player: { socket_id: player.socket_id },
      scene: buildScenePayload(returnScene),
      playerState: {
        uuid: player.uuid,
        x: player.x,
        y: player.y,
        sceneId: player.sceneId,
      },
    });
    sendMessage(player, message);
    if (returnScene.type === 'town') {
      notifyFirstGoalReturned(player);
    }
  }

  /**
   * Fast sweep (~300ms): players standing on zone gates. Entry waymark
   * returns to the Crossroads; onward gates press deeper if the Warden is
   * down.
   */
  checkGateTransitions() {
    world.forEachZoneScene((scene) => {
      const metadata = scene.metadata || {};
      const players = Array.isArray(scene.players) ? [...scene.players] : [];

      players.forEach((player) => {
        if (!player || this.transitioning.has(player.uuid)) return;

        const entry = metadata.entryGate;
        if (entry && player.x === entry.x && player.y === entry.y) {
          this.returnToCrossroads(player);
          return;
        }

        const gate = (metadata.zoneGates || [])
          .find(candidate => candidate.x === player.x && candidate.y === player.y);
        if (!gate) return;

        const wardenHolds = !metadata.wardenDead
          && !this.clearedNodesFor(metadata.ownerHouseId).includes(metadata.nodeId);
        if (wardenHolds) {
          const now = Date.now();
          if (!player.lastGateDeniedAt || now - player.lastGateDeniedAt > GATE_DENIED_THROTTLE_MS) {
            player.lastGateDeniedAt = now;
            sendMessage(player, `No road holds past a living Warden. ${metadata.wardenName} still keeps ${metadata.nodeName}.`);
          }
          return;
        }

        this.enterZoneNode(player, gate.nodeId, { announce: false })
          .then((entered) => {
            if (entered) {
              sendMessage(player, `You press on into ${gate.name}.`);
            }
          })
          .catch(error => console.error('[zones] Onward gate failed:', error));
      });
    });
  }

  /**
   * Slow sweep (~1.5s): Warden deaths (unlock + announce) and empty-zone
   * expiry ("the green closes over your footprints").
   */
  sweepZones() {
    const now = Date.now();
    const expired = [];

    world.forEachZoneScene((scene, zoneKey) => {
      const metadata = scene.metadata || {};

      if (!metadata.wardenDead && metadata.wardenTemplateId) {
        const warden = (scene.monsters || [])
          .find(monster => monster.templateId === metadata.wardenTemplateId);
        if (warden && !warden.isAlive) {
          metadata.wardenDead = true;
          const changed = chroniclesRepository.markZoneNodeCleared(
            metadata.ownerHouseId,
            metadata.nodeId,
          );
          if (!metadata.wardenAnnounced) {
            metadata.wardenAnnounced = true;
            const onward = (metadata.zoneGates || []).map(gate => gate.name);
            const onwardText = onward.length
              ? ` The road holds through to ${onward.join(' and ')}.`
              : ' This is the end of the chartline — for now.';
            (scene.players || []).forEach((player) => {
              sendMessage(player, `The ${metadata.wardenName} is down. ${metadata.nodeName} lies still.${onwardText}`);
              notifyFirstGoalWardenDown(player, { tier: metadata.tier });
            });
            if (changed) {
              (scene.players || []).forEach((player) => {
                Socket.emit('world:chart:updated', {
                  player: { socket_id: player.socket_id },
                  roadId: metadata.roadId,
                  clearedNodeId: metadata.nodeId,
                });
              });
            }
          }
        }
      }

      const occupied = Array.isArray(scene.players) && scene.players.length > 0;
      if (occupied) {
        metadata.emptySince = null;
      } else if (!metadata.emptySince) {
        metadata.emptySince = now;
      } else if (now - metadata.emptySince > ZONE_LINGER_MS) {
        expired.push(zoneKey);
      }
    });

    expired.forEach(zoneKey => world.destroyZoneScene(zoneKey));
  }
}

export const zoneService = new ZoneService();

export default zoneService;
