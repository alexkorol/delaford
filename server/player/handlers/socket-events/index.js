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
import { loadGuest, saveGuest } from '#server/core/repositories/guest-save-store.js';
import world from '#server/core/world.js';
import { validateScionName } from '#shared/chronicles.js';

// One character, one session. When the same account logs in again (second
// tab, another machine, an automated playtest), the OLD session used to be
// silently replaced mid-play — its client got "foreign player reference"
// rejections and its unsaved loot was lost. Now: flush the old session's
// state to disk FIRST (so the new login loads it), tell the old client it
// was replaced (so it doesn't auto-reconnect into a steal war), and close it.
const replaceExistingSession = (uuid, newSocketId) => {
  const existing = world.players.find(p => p.uuid === uuid && p.socket_id !== newSocketId);
  if (!existing) {
    return;
  }

  if (!existing.token || existing.token === 'none') {
    saveGuest(existing);
  }

  Socket.emit('player:session-replaced', {
    player: { socket_id: existing.socket_id },
  });

  const oldWs = world.clients.find(client => client.id === existing.socket_id);
  world.removePlayer(existing);
  if (oldWs) {
    setTimeout(() => {
      try {
        oldWs.close();
      } catch (error) { /* already gone */ }
    }, 150);
  }
};

// Guest accounts have no backing API, so their skill-tree allocations live in
// process memory keyed by uuid — surviving relogs within a server run.
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

const applyScionIdentity = (player, name) => {
  const validation = validateScionName(name);
  if (!validation.valid) {
    return validation;
  }

  player.username = validation.value;
  return validation;
};

const emitChroniclesError = (ws, message) => {
  Socket.emit('player:chronicles:error', {
    player: { socket_id: ws.id },
    message,
  });
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
      let player;
      if (!payload.useGuestAccount) {
        const authenticated = await Authentication.login({ ...data, data: payload });
        replaceExistingSession(authenticated.player.uuid, ws.id);
        player = new Player(authenticated.player, authenticated.token, ws.id);
      } else {
        // Flush + kick any existing session for this guest FIRST, so the
        // snapshot loaded below carries its up-to-the-second loot.
        replaceExistingSession(playerGuest.uuid, ws.id);

        // Guests persist to a local file (same shape as the template), so
        // loot, levels, bank, and the skill tree survive relogins — merge the
        // saved snapshot over the template before constructing the player.
        const saved = loadGuest(playerGuest.uuid);
        const guestData = saved ? { ...playerGuest, ...saved } : playerGuest;
        player = new Player(guestData, 'none', ws.id);
        // In-process fallback for the skill tree (covers saves made moments
        // before a crash, ahead of the next file flush).
        if (!player.passiveTree && guestPassiveTrees.has(player.uuid)) {
          player.passiveTree = guestPassiveTrees.get(player.uuid);
        }
      }

      ws.authenticated = true;

      const scionValidation = payload.scionName
        ? applyScionIdentity(player, payload.scionName)
        : null;

      if (payload.scionName && !scionValidation.valid) {
        emitChroniclesError(ws, scionValidation.reason);
        ws.pendingPlayer = player;
        return;
      }

      if (payload.awaitChronicles && !payload.scionName) {
        ws.pendingPlayer = player;
        Socket.emit('player:chronicles:ready', {
          player: { socket_id: ws.id },
          accountName: player.accountUsername || player.username,
          level: player.level,
        });
        return;
      }

      ws.pendingPlayer = null;
      Authentication.addPlayer(player);
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
   * Admit an authenticated browser session to the world under its selected
   * Chronicles scion. Headless/API clients can continue using player:login
   * directly and never enter this pending state.
   */
  'player:chronicles:select': ({ data }, ws) => {
    const player = ws && ws.pendingPlayer;
    if (!player) {
      emitChroniclesError(ws, 'This Chronicles session is no longer awaiting a scion.');
      return;
    }

    const validation = applyScionIdentity(player, data && data.scionName);
    if (!validation.valid) {
      emitChroniclesError(ws, validation.reason);
      return;
    }

    ws.pendingPlayer = null;
    Authentication.addPlayer(player);
  },

  /**
   * A player logs out of the game
   */
  'player:logout': async (data, ws, context) => {
    context.constructor.close(ws, true);
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

    // Guests have no backing API — skip the network save (it would only log
    // errors); the in-memory copies above already cover them.
    if (player.token && player.token !== 'none') {
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

    data.player = { ...(data.player || {}), socket_id: player.socket_id };
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
