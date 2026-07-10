/**
 * Events from socket.
 * for example: (login, logout, queue. etc.)
 */
import Authentication from '#server/player/authentication.js';
import Combat from '#server/core/combat/index.js';
import Player from '#server/core/player.js';
import Socket from '#server/socket.js';
import config from '#server/config.js';
import { notifyTutorial } from '#server/core/tutorial.js';
import playerGuest from '#server/core/data/helpers/player.json' with { type: 'json' };
import playerPersistence from '#server/core/services/player-persistence.js';
import { beginScionSession, sendChronicleState } from '#server/core/services/chronicles.js';
import world from '#server/core/world.js';

// Fast in-process mirror; authoritative scion snapshots also persist this in
// SQLite through PlayerPersistenceService.
const guestPassiveTrees = new Map();

// Whitelist and bound the client-sent skill tree snapshot; never trust shapes
// straight off the wire.
const sanitisePassiveTree = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.conduits)) {
    return null;
  }
  if (snapshot.nodes.length > 512 || snapshot.conduits.length > 1024) {
    return null;
  }

  return {
    nodes: snapshot.nodes.filter(id => typeof id === 'string').slice(0, 512),
    conduits: snapshot.conduits
      .filter(entry => entry && typeof entry.id === 'string')
      .map(entry => ({
        id: entry.id,
        variant: typeof entry.variant === 'string' ? entry.variant : null,
      }))
      .slice(0, 1024),
    points: { skill: Math.max(0, Math.floor(Number(snapshot.points && snapshot.points.skill) || 0)) },
    earned: Math.max(0, Math.floor(Number(snapshot.earned) || 0)),
    selectedNodeId: typeof snapshot.selectedNodeId === 'string' ? snapshot.selectedNodeId : '0,0',
  };
};

const getPlayerBySocket = (ws) => {
  if (!ws || !ws.id) {
    return null;
  }

  return world.players.find(player => player.socket_id === ws.id) || null;
};

const isSpoofedPlayerPayload = (player, payload = {}) => (
  Boolean(payload.id && payload.id !== player.uuid)
  || Boolean(payload.uuid && payload.uuid !== player.uuid)
  || Boolean(payload.socket_id && payload.socket_id !== player.socket_id)
);

const registerBlockedCombatStep = (player, direction, startedAt) => {
  if (typeof player.setFacing === 'function') {
    player.setFacing(direction);
  }

  if (typeof player.registerMovementStep === 'function') {
    player.registerMovementStep({
      duration: 0,
      startedAt,
      direction,
      blocked: true,
    });
  }
};

const broadcastCombatInput = (player, outcome) => {
  Player.broadcastAnimation(player);
  if (!outcome || !outcome.triggered) {
    return;
  }

  Socket.broadcast('player:combat:update', {
    playerId: player.uuid,
    combat: player.combat,
    animation: player.animation,
  }, world.getScenePlayers(player.sceneId));
};

export default {
  /**
   * A player logins into the game
   */
  'player:login': async (data, ws) => {
    const payload = data.data || {};

    try {
      let profile;
      let token;
      let isGuest = false;
      if (!payload.useGuestAccount) {
        const authenticated = await Authentication.login({ ...data, data: payload });
        profile = authenticated.player;
        token = authenticated.token;
      } else {
        profile = playerGuest;
        token = 'none';
        isGuest = true;
      }

      const guestId = typeof payload.guestId === 'string'
        && /^[a-zA-Z0-9-]{8,64}$/.test(payload.guestId)
        ? payload.guestId
        : profile.uuid;
      const accountId = `${isGuest ? 'guest:' : 'account:'}${isGuest ? guestId : profile.uuid}`;
      ws.chronicleAuth = { accountId, profile, token, isGuest };
      ws.authenticated = true;
      if (typeof payload.resumeScionId === 'string' && payload.resumeScionId) {
        const resumed = await beginScionSession(ws, payload.resumeScionId, { resume: true });
        if (resumed.ok) return;
      }
      sendChronicleState(ws);
    } catch (error) {
      console.log(error);
      const username = typeof payload.username === 'string' ? payload.username : 'unknown user';
      console.log(`${username} logged in with a bad password.`);

      Socket.emit('player:login-error', {
        data: error && error.message ? error.message : 'Login failed.',
        player: { socket_id: ws.id },
      });
    }
  },

  /**
   * A player logs out of the game
   */
  'player:logout': async (data, ws, context) => {
    await context.constructor.close(ws, true);
    ws.authenticated = false;
  },

  /**
   * A player saves their skill-tree allocations. Stored on the live Player
   * (so reopening the pane restores it), cached for guest relogs, and pushed
   * to the account API for real accounts.
   */
  'player:skilltree:save': ({ data }, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player) {
      return;
    }

    const sanitised = sanitisePassiveTree(data && data.snapshot);
    if (!sanitised) {
      return;
    }

    player.passiveTree = sanitised;
    guestPassiveTrees.set(player.uuid, sanitised);
    playerPersistence.markDirty(player);

    // Chronicle scions save to SQLite even for guests; only legacy guests
    // without a scion skip the remote account API.
    if (player.scionId || (player.token && player.token !== 'none')) {
      playerPersistence.savePlayer(player).catch(() => {});
    }
  },

  /**
   * A player sends a chat message to everyone
   */
  'player:say': ({ data }, ws) => {
    const { said } = data || {};
    const { viewport } = config.map;

    if (typeof said !== 'string' || !said.trim()) {
      return;
    }

    const speaker = getPlayerBySocket(ws);
    if (!speaker) {
      return;
    }

    const { username, x, y } = speaker;

    // Put a limit on the length of a player message to 50 characters.
    const text = said.length > 50 ? said.substring(0, 50) : said;

    // Get viewport values based on player and viewport x, y
    const viewportValues = {
      minX: x - Math.floor(0.5 * viewport.x),
      minY: y - Math.floor(0.5 * viewport.y),
      maxX: x + Math.floor(0.5 * viewport.x),
      maxY: y + Math.floor(0.5 * viewport.y),
    };

    // Get nearby Players
    const scenePlayers = world.getScenePlayers(speaker.sceneId);
    const nearbyPlayers = scenePlayers.filter((p) => {
      const playerInX = p.x >= viewportValues.minX && p.x <= viewportValues.maxX;
      const playerInY = p.y >= viewportValues.minY && p.y <= viewportValues.maxY;
      return playerInX && playerInY;
    });

    Socket.broadcast('player:say', {
      username,
      type: 'chat',
      text,
    }, nearbyPlayers);
  },

  /**
   * A player moves to a new tile via keyboard
   */
  'player:move': (data, ws) => {
    const payload = data.data || {};
    const player = getPlayerBySocket(ws);
    if (!player || isSpoofedPlayerPayload(player, payload) || !Combat.isPlayerAlive(player)) {
      return;
    }
    const startedAt = Date.now();

    if (Combat.findStepTarget(player, payload.direction)) {
      registerBlockedCombatStep(player, payload.direction, startedAt);
      const outcome = Combat.tryPrimaryAttackIntoStep(player, payload.direction);
      Player.broadcastMovement(player);
      broadcastCombatInput(player, outcome);
      return;
    }

    Combat.clearAutoAttack(player, 'movement');
    player.move(payload.direction, { startedAt, direction: payload.direction });
    notifyTutorial(player, 'move');

    if (!player.lastPortalTransitionAt || player.lastPortalTransitionAt < startedAt) {
      Player.broadcastMovement(player);
    }
  },

  'player:skill:trigger': (data, ws) => {
    const payload = data.data || {};
    const player = getPlayerBySocket(ws);
    if (!player || isSpoofedPlayerPayload(player, payload)) {
      return;
    }

    const outcome = Combat.tryUseSkill(player, payload);
    if (!outcome || !outcome.triggered) {
      return;
    }

    broadcastCombatInput(player, outcome);
  },

  /**
   * Queue up a player action to be executed when they reach their destination
   */
  'player:queueAction': (data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player) {
      return;
    }

    data.player = {
      ...(data.player || {}),
      uuid: player.uuid,
      socket_id: player.socket_id,
    };
    if (player.queue.length >= 20) {
      return;
    }
    player.queue.push(data);
    player.action = data.actionToQueue;
  },

  'player:pane:close': (data, ws) => {
    const payload = data.data || {};
    const player = getPlayerBySocket(ws);
    if (!player || isSpoofedPlayerPayload(player, payload)) {
      return;
    }

    player.currentPane = false;
    player.currentPaneData = null;
    player.objectId = null;
  },
};
