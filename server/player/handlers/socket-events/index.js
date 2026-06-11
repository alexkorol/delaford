/**
 * Events from socket.
 * for example: (login, logout, queue. etc.)
 */
import Authentication from '#server/player/authentication.js';
import Combat from '#server/core/combat/index.js';
import Player from '#server/core/player.js';
import Socket from '#server/socket.js';
import config from '#server/config.js';
import playerGuest from '#server/core/data/helpers/player.json' with { type: 'json' };
import world from '#server/core/world.js';

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

export default {
  /**
   * A player logins into the game
   */
  'player:login': async (data, ws) => {
    const payload = data.data || {};

    try {
      if (!payload.useGuestAccount) {
        const { player, token } = await Authentication.login({ ...data, data: payload });
        Authentication.addPlayer(new Player(player, token, ws.id));
      } else {
        Authentication.addPlayer(new Player(playerGuest, 'none', ws.id));
      }
      ws.authenticated = true;
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
    context.constructor.close(ws, true);
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
    player.move(payload.direction, { startedAt, direction: payload.direction });

    Player.broadcastMovement(player);
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

    Player.broadcastAnimation(player);
    Socket.broadcast('player:combat:update', {
      playerId: player.uuid,
      combat: player.combat,
      animation: player.animation,
    }, world.getScenePlayers(player.sceneId));
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
  },
};
