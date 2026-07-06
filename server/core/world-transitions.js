import Socket from '#server/socket.js';
import world from './world.js';

const clone = value => JSON.parse(JSON.stringify(value || {}));

export const publicSceneMetadata = (metadata = {}) => {
  const {
    monsterDefinitions: _monsterDefinitions,
    ...safeMetadata
  } = metadata || {};

  return clone(safeMetadata);
};

export const buildScenePayload = (scene) => {
  if (!scene) {
    return null;
  }

  return {
    id: scene.id,
    type: scene.type,
    name: scene.name,
    map: scene.map,
    npcs: scene.npcs,
    monsters: Array.isArray(scene.monsters)
      ? scene.monsters.map((monster) => (monster && typeof monster.toJSON === 'function'
        ? monster.toJSON()
        : monster))
      : [],
    droppedItems: scene.items,
    metadata: publicSceneMetadata(scene.metadata || {}),
  };
};

const sendMessage = (player, text) => {
  if (!player || !player.socket_id || !text) {
    return;
  }

  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
};

const broadcastJoinedPlayers = (scene) => {
  const recipients = world.getScenePlayers(scene.id);
  const meta = {
    players: recipients.map((player) => ({
      uuid: player.uuid,
      movementStep: player.movementStep,
    })),
  };

  Socket.broadcast('player:joined', recipients, recipients, { meta });
};

export const transitionPlayerToPortalDestination = (player, portal) => {
  if (!player || !portal || !portal.destination) {
    return false;
  }

  const { sceneId, x, y } = portal.destination;
  const destinationScene = world.getScene(sceneId);
  if (!destinationScene || !destinationScene.id) {
    sendMessage(player, 'The way is sealed.');
    return false;
  }

  const previousScene = world.getSceneForPlayer(player);
  const previousPlayers = previousScene
    ? world.getScenePlayers(previousScene.id).filter(p => p.uuid !== player.uuid)
    : [];

  if (typeof player.cancelPathfinding === 'function') {
    player.cancelPathfinding();
  }

  player.x = Number.isFinite(x) ? x : player.x;
  player.y = Number.isFinite(y) ? y : player.y;
  player.lastPortalTransitionAt = Date.now();

  world.assignPlayerToScene(player, destinationScene.id);

  if (player.path) {
    player.path.grid = null;
  }

  if (previousPlayers.length) {
    Socket.broadcast('player:left', player.socket_id, previousPlayers);
  }

  Socket.emit('world:scene:transition', {
    player: { socket_id: player.socket_id },
    scene: buildScenePayload(destinationScene),
    playerState: {
      uuid: player.uuid,
      x: player.x,
      y: player.y,
      sceneId: player.sceneId,
    },
    portal: {
      id: portal.id,
      name: portal.name,
      message: portal.message,
    },
  });

  sendMessage(player, portal.message || `You enter ${destinationScene.name}.`);
  broadcastJoinedPlayers(destinationScene);
  return true;
};

export const transitionPlayerIfOnPortal = (player) => {
  if (!player) {
    return false;
  }

  const scene = world.getSceneForPlayer(player);
  const portals = scene && scene.metadata && Array.isArray(scene.metadata.portals)
    ? scene.metadata.portals
    : [];

  const portal = portals.find(entry => entry.x === player.x && entry.y === player.y);
  if (!portal) {
    return false;
  }

  // Instance gates: physical entrances in the world that drop the player
  // into a generated zone — continuity instead of a dropdown menu. Dynamic
  // import keeps the handler layer out of this module's dependency graph.
  if (portal.destination && portal.destination.instance) {
    const { template, layout } = portal.destination.instance;
    sendMessage(player, portal.message || 'The gate takes hold of you...');
    import('#server/player/handlers/party.js')
      .then(({ partyService }) => partyService.startSoloInstance(player, { template, layout }))
      .catch((error) => console.error('[world] Instance gate failed:', error));
    return true;
  }

  return transitionPlayerToPortalDestination(player, portal);
};

export default {
  buildScenePayload,
  publicSceneMetadata,
  transitionPlayerIfOnPortal,
  transitionPlayerToPortalDestination,
};
