import { general, wearableItems, smithing } from '#server/core/data/items/index.js';

import Authentication from '#server/player/authentication.js';
import Combat from '#server/core/combat/index.js';
import Handler from '#server/player/handler.js';
import Item from '#server/core/item.js';
import Map from '#server/core/map.js';
import NPC from '#server/core/npc.js';
import Monster from '#server/core/monster.js';
import Socket from '#server/socket.js';
import * as emoji from 'node-emoji';
import { v4 as uuid } from 'uuid';
import { performance } from 'node:perf_hooks';
import playerPersistenceService from '#server/core/services/player-persistence.js';
import world from '#server/core/world.js';
import { partyService } from '#server/player/handlers/party.js';
import zoneService from '#server/core/services/zone-service.js';
import wagonService from '#server/core/services/wagon-service.js';
import { recordRuntimeEvent } from '#server/core/services/runtime-diagnostics.js';

class Delaford {
  constructor(server) {
    // Port setting
    world.socket = new Socket(server);

    // Start the game server
    console.log(`${emoji.get('rocket')}  Starting game server...`);

    // Load the map and spawn the default entities
    this.constructor.loadMap();
    this.loadEntities();

    this.loopHandle = null;
    this.loopLastTick = 0;
    this.loopInterval = Number(process.env.GAME_LOOP_INTERVAL_MS) || 100;
    this.schedulerLogInterval = Number(process.env.GAME_LOOP_LOG_INTERVAL_MS) || 10000;
    this.schedulerStats = { tickCount: 0, totalDelta: 0, maxDelta: 0, lastLog: performance.now() };
    this.playerAutoSaveInterval = Number(process.env.PLAYER_AUTO_SAVE_INTERVAL_MS) || 120000;
    this.periodicTasks = [];
    this.handleConnection = this.connection.bind(this);
    this.loopActive = false;
  }

  /**
   * Load the new map after the game starts
   */
  static loadMap() {
    console.log(`${emoji.get('european_castle')}  Creating a new map...`);
    world.map = new Map('surface');
  }

  /**
   * Load default entities before the start of game world
   */
  loadEntities() {
    NPC.load(this);
    Monster.load(this);
  }

  static getSocketPlayer(ws) {
    if (!ws || !ws.id) {
      return null;
    }

    return world.players.find(player => player.socket_id === ws.id) || null;
  }

  static isForeignIdentifier(player, value) {
    return Boolean(value && value !== player.uuid && value !== player.socket_id);
  }

  static hasForeignPlayerReference(player, payload = {}) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    if (Delaford.isForeignIdentifier(player, payload.id)
      || Delaford.isForeignIdentifier(player, payload.uuid)
      || Delaford.isForeignIdentifier(player, payload.socket_id)) {
      return true;
    }

    if (payload.player && typeof payload.player === 'object') {
      return Delaford.isForeignIdentifier(player, payload.player.id)
        || Delaford.isForeignIdentifier(player, payload.player.uuid)
        || Delaford.isForeignIdentifier(player, payload.player.socket_id);
    }

    return false;
  }

  static authorizeSocketMessage(data, ws, publicEvents, unboundAuthEvents = new Set()) {
    if (publicEvents.has(data.event)) {
      return true;
    }

    // Chronicles intentionally authenticates before the player is admitted
    // to the world. These record operations are therefore bound to the
    // pending Player on the socket rather than to world.players.
    if (data.event === 'player:chronicles:select'
      || data.event === 'player:chronicles:save'
      || data.event === 'player:chronicles:mutate') {
      return Boolean(
        ws.pendingPlayer
        && ws.pendingPlayer.socket_id === ws.id,
      );
    }

    // Chronicle selection happens after account authentication but before a
    // scion exists in the world, so these few events bind to the server-held
    // account context rather than a client-supplied player id.
    if (unboundAuthEvents.has(data.event) && ws.chronicleAuth?.accountId) {
      return true;
    }

    const player = Delaford.getSocketPlayer(ws);
    if (!player) {
      console.warn(`[socket] Authenticated socket ${ws.id.substring(0, 5)}... has no bound player for "${data.event}".`);
      return false;
    }

    const payload = data.data || {};
    // Reject any client-supplied identity that names another player. This must
    // cover the TOP LEVEL of the message too: a genuine client only ever sends
    // `{ event, data }`, so top-level identity fields (data.id, data.player,
    // data.playerIndex, data.todo, ...) are never legitimate on the wire — they
    // are injected only by the server-side Action dispatcher. Several handlers
    // resolve the acting player from those fields (player:inventory-drop reads
    // data.id, the smelt handlers read data.player.uuid, goldenplaque reads
    // data.playerIndex), so leaving them untrusted let a raw socket act as, or
    // for, another player.
    if (Delaford.hasForeignPlayerReference(player, data)
      || Delaford.hasForeignPlayerReference(player, payload)
      || Delaford.hasForeignPlayerReference(player, payload.data || {})) {
      console.warn(`[socket] Rejected foreign player reference from ${ws.id.substring(0, 5)}... event="${data.event}".`);
      return false;
    }

    const identity = { uuid: player.uuid, socket_id: player.socket_id };

    // Bind identity to the socket's real owner and drop the internal-only
    // routing fields a client must never provide. After this, every handler —
    // whether it reads the top level or the nested payload — resolves the same
    // authenticated player, and internal-dispatch-only handlers reached over
    // the wire fall back to safe no-ops instead of operating on a spoofed id.
    data.id = player.uuid;
    data.uuid = player.uuid;
    data.socket_id = player.socket_id;
    data.player = {
      ...(data.player && typeof data.player === 'object' && !Array.isArray(data.player) ? data.player : {}),
      ...identity,
    };
    delete data.playerIndex;
    delete data.playerUuid;
    delete data.socketId;
    delete data.todo;

    if (payload && typeof payload === 'object') {
      payload.player = {
        ...(payload.player || {}),
        ...identity,
      };
    }

    return true;
  }

  /**
   * Create the new server with the port
   */
  start() {
    this.registerPeriodicTasks();
    this.startGameLoop();

    // Bind the websocket connection to the `this` context
    if (world.socket?.ws) {
      if (typeof world.socket.ws.on === 'function') {
        world.socket.ws.on('connection', this.handleConnection);
      }
      if (typeof world.socket.startHeartbeat === 'function') {
        world.socket.startHeartbeat();
      }
    }
  }

  stopGameLoop() {
    this.loopActive = false;

    if (this.loopHandle) {
      clearTimeout(this.loopHandle);
      this.loopHandle = null;
    }
  }

  /**
   * Log the user out and save the player profile
   *
   * @param {WebSocket} ws The socket connection of the player
   * @param {boolean} logout Whether the connection was via player or interruption
   */
  static async close(ws, logout = false) {
    const player = world.removePlayerBySocket(ws.id);

    // A socket can disappear before login creates a Player. Always reap the
    // transport entry on an actual disconnect so unauthenticated connections
    // cannot accumulate in world.clients. An explicit logout leaves the socket
    // alive until its subsequent close event, preserving the existing flow.
    if (!logout) {
      world.clients = world.clients.filter(c => c.id !== ws.id);
    }

    if (!player) {
      return;
    }

    // Persistence and the account API are independent teardown steps. Neither
    // is allowed to suppress party cleanup or the player:left notification.
    try {
      await player.update();
    } catch (error) {
      console.error(`[disconnect] Failed to save ${player.username}: ${error instanceof Error ? error.message : error}`);
    }

    console.log(`${emoji.get('red_circle')}  Player ${player.username} left the game`);

    // Guest players carry the sentinel token "none" and have no account API
    // session. Calling logout for them produces an invalid URL in local play.
    if (player.token && player.token !== 'none') {
      try {
        await Authentication.logout(player.token);
      } catch (error) {
        console.error(`[disconnect] Account logout failed for ${player.username}: ${error instanceof Error ? error.message : error}`);
      }
    }

    try {
      const updatedParty = partyService.removePlayer(player.uuid);
      if (updatedParty) {
        partyService.sendPartyUpdate(updatedParty, {
          meta: {
            reason: 'member-disconnected',
            playerUuid: player.uuid,
          },
        });
      }
    } catch (error) {
      console.error(`[disconnect] Party cleanup failed for ${player.username}: ${error instanceof Error ? error.message : error}`);
    }

    // The wagon leaves the pitch when the House's last scion does.
    try {
      wagonService.releaseWagonIfEmpty(player.houseId);
    } catch (error) {
      console.error(`[disconnect] Wagon release failed for ${player.username}: ${error instanceof Error ? error.message : error}`);
    }

    try {
      const scenePlayers = world.getScenePlayers(player.sceneId);
      Socket.broadcast('player:left', ws.id, scenePlayers);
    } catch (error) {
      console.error(`[disconnect] Departure broadcast failed for ${player.username}: ${error instanceof Error ? error.message : error}`);
    }

    console.log(`${emoji.get('red_circle')}  Player ${player.username} left the game`);
  }

  registerPeriodicTasks() {
    if (this.periodicTasks.length > 0) {
      return;
    }

    this.addPeriodicTask('npc:movement', 2000, () => NPC.movement());
    this.addPeriodicTask('monster:tick', 600, () => Monster.tick());
    this.addPeriodicTask('items:tick', 1000, () => {
      Item.check();
      Item.resourcesCheck();
    });
    this.addPeriodicTask('party:instances', 1500, () => partyService.evaluateInstances());
    this.addPeriodicTask('party:stairs', 300, () => partyService.checkStairTransitions());
    this.addPeriodicTask('zones:gates', 300, () => zoneService.checkGateTransitions());
    this.addPeriodicTask('zones:sweep', 1500, () => zoneService.sweepZones());
    this.addPeriodicTask('player:auto-attack', 150, () => Combat.processAutoAttacks());
    this.addPeriodicTask('player:respawn', 1000, () => Combat.processPlayerRespawns());
    this.addPeriodicTask('player:regen', 2000, () => Combat.processResourceRegeneration());
    this.addPeriodicTask('player:auto-save', this.playerAutoSaveInterval, () => playerPersistenceService.flushAllPlayers());
  }

  addPeriodicTask(name, interval, handler) {
    this.periodicTasks.push({
      name,
      interval,
      handler,
      accumulator: 0,
    });
  }

  startGameLoop() {
    if (this.loopHandle) {
      return;
    }

    this.loopActive = true;
    this.loopLastTick = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = now - this.loopLastTick;
      this.loopLastTick = now;

      this.updatePeriodicTasks(delta);
      this.logSchedulerStats(delta, now);

      if (!this.loopActive) {
        return;
      }

      this.loopHandle = setTimeout(tick, this.loopInterval);
    };

    this.loopHandle = setTimeout(tick, this.loopInterval);
  }

  updatePeriodicTasks(delta) {
    this.periodicTasks.forEach((task) => {
      task.accumulator += delta;

      if (task.accumulator < task.interval) {
        return;
      }

      const executions = Math.floor(task.accumulator / task.interval);
      task.accumulator -= executions * task.interval;

      for (let i = 0; i < executions; i += 1) {
        try {
          const result = task.handler(delta);

          if (result && typeof result.then === 'function') {
            result.catch((err) => console.error(`[Scheduler] Task ${task.name} rejected`, err));
          }
        } catch (err) {
          console.error(`[Scheduler] Task ${task.name} failed`, err);
        }
      }
    });
  }

  logSchedulerStats(delta, now) {
    this.schedulerStats.tickCount += 1;
    this.schedulerStats.totalDelta += delta;
    this.schedulerStats.maxDelta = Math.max(this.schedulerStats.maxDelta, delta);

    if ((now - this.schedulerStats.lastLog) < this.schedulerLogInterval) {
      return;
    }

    const averageDelta = this.schedulerStats.totalDelta / this.schedulerStats.tickCount;
    const cadence = 1000 / Math.max(averageDelta, 0.0001);

    console.log(
      `${emoji.get('alarm_clock')}  Scheduler cadence: avg ${averageDelta.toFixed(2)}ms/tick (${cadence.toFixed(2)} Hz), `
      + `max ${this.schedulerStats.maxDelta.toFixed(2)}ms over ${this.schedulerStats.tickCount} ticks.`,
    );

    this.schedulerStats.tickCount = 0;
    this.schedulerStats.totalDelta = 0;
    this.schedulerStats.maxDelta = 0;
    this.schedulerStats.lastLog = now;
  }

  /**
   * Connect all incoming websocket calls to their approrpriate methods
   *
   * @param {WebSocket} ws The websocket connection
   */
  connection(ws) {
    // Assign UUID to every connection
    ws.id = uuid();
    ws.authenticated = false;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Per-connection rate limiting: latency-critical gameplay input gets its
    // own bucket so held-key movement (~20 msg/s) plus skills can NEVER be
    // starved by chatty UI traffic (hover context-menu builds were draining
    // the shared bucket and eating player:move — felt like random input loss).
    const CRITICAL_EVENTS = new Set(['player:move', 'player:skill:trigger', 'player:take:underfoot']);
    const buckets = {
      critical: { tokens: 40, max: 40, refill: 25, last: Date.now() },
      general: { tokens: 30, max: 30, refill: 10, last: Date.now() },
      // Development diagnostics are production-gated and can poll rapidly in
      // the playability harness. Keep them from starving real UI writes such
      // as a skill-tree save or harness control command on the same connection.
      developmentRead: { tokens: 20, max: 20, refill: 10, last: Date.now() },
      developmentControl: { tokens: 20, max: 20, refill: 10, last: Date.now() },
    };

    const consumeRateToken = (eventName) => {
      const bucket = eventName === 'dev:state'
        ? buckets.developmentRead
        : eventName.startsWith('dev:')
          ? buckets.developmentControl
        : CRITICAL_EVENTS.has(eventName) ? buckets.critical : buckets.general;
      const now = Date.now();
      bucket.tokens = Math.min(bucket.max, bucket.tokens + (((now - bucket.last) / 1000) * bucket.refill));
      bucket.last = now;
      if (bucket.tokens < 1) {
        return false;
      }
      bucket.tokens -= 1;
      return true;
    };

    // Events that don't require authentication
    const PUBLIC_EVENTS = new Set(['player:login']);
    const UNBOUND_AUTH_EVENTS = new Set([
      'chronicles:house:found',
      'chronicles:house:claim-daily',
      'chronicles:house:upgrade',
      'chronicles:scion:create',
      'chronicles:scion:set-out',
    ]);

    // Add player to server's player list
    console.log(`${emoji.get('computer')}  A client (${ws.id.substring(0, 5)}...) connected.`);
    recordRuntimeEvent('socket:connected', { socketId: ws.id });
    world.clients.push(ws);

    // Only return needed values for client
    const allItems = [...wearableItems, ...general, ...smithing].map((i) => {
      const item = {
        name: i.name,
        id: i.id,
        type: i.type,
        slot: i.slot,
        size: i.size,
        stackable: i.stackable,
        twoHanded: i.twoHanded,
        artId: i.artId,
        graphics: i.graphics,
      };

      return item;
    });

    // Send player server items
    Socket.emit('server:send:items', {
      player: { socket_id: ws.id },
      items: allItems,
    });

    ws.on('message', async (msg) => {
      const messageBytes = Buffer.byteLength(msg);
      if (messageBytes > 32 * 1024) {
        console.warn(`[socket] Oversized message from ${ws.id.substring(0, 5)}... (${messageBytes} bytes)`);
        return;
      }
      let data;
      try {
        data = JSON.parse(msg);
      } catch {
        console.warn(`[socket] Malformed message from ${ws.id.substring(0, 5)}...`);
        return;
      }

      if (!data || typeof data.event !== 'string') {
        console.warn(`[socket] Missing event field from ${ws.id.substring(0, 5)}...`);
        return;
      }

      if (data.data !== undefined
        && (data.data === null || typeof data.data !== 'object' || Array.isArray(data.data))) {
        console.warn(`[socket] Invalid payload shape from ${ws.id.substring(0, 5)}...`);
        return;
      }

      recordRuntimeEvent('socket:message', {
        socketId: ws.id,
        playerId: Delaford.getSocketPlayer(ws)?.uuid || null,
        event: data.event,
        bytes: Buffer.byteLength(msg),
      });

      if (typeof Handler[data.event] !== 'function') {
        console.warn(`[socket] Unknown event "${data.event}" from ${ws.id.substring(0, 5)}...`);
        return;
      }

      // Rate limit: drop messages when the bucket is empty
      if (!consumeRateToken(data.event)) {
        console.warn(`[socket] Rate limited ${ws.id.substring(0, 5)}... event="${data.event}"`);
        return;
      }

      // Require authentication for non-public events
      if (!PUBLIC_EVENTS.has(data.event) && !ws.authenticated) {
        console.warn(`[socket] Unauthenticated event "${data.event}" from ${ws.id.substring(0, 5)}...`);
        return;
      }

      if (!this.constructor.authorizeSocketMessage(data, ws, PUBLIC_EVENTS, UNBOUND_AUTH_EVENTS)) {
        return;
      }

      try {
        await Handler[data.event](data, ws, this);
      } catch (err) {
        recordRuntimeEvent('socket:handler-error', {
          socketId: ws.id,
          event: data.event,
          message: err.message,
          stack: err.stack,
        });
        console.error(`[socket] Handler error for "${data.event}":`, err);
      }
    });

    ws.on('error', (error) => {
      recordRuntimeEvent('socket:error', {
        socketId: ws.id,
        message: error.message,
      });
      console.error(error, `${ws.id} has left`);
    });
    ws.on('close', (code, reason) => {
      recordRuntimeEvent('socket:closed', {
        socketId: ws.id,
        playerId: Delaford.getSocketPlayer(ws)?.uuid || null,
        code,
        reason: reason ? reason.toString() : '',
      });
      this.constructor.close(ws);
    });
  }

  shutdown() {
    this.stopGameLoop();
    this.periodicTasks = [];

    if (world.socket?.ws) {
      const listener = this.handleConnection;
      if (listener) {
        if (typeof world.socket.ws.off === 'function') {
          world.socket.ws.off('connection', listener);
        } else if (typeof world.socket.ws.removeListener === 'function') {
          world.socket.ws.removeListener('connection', listener);
        }
      }
    }

    if (world.socket && typeof world.socket.close === 'function') {
      world.socket.close();
    }

    this.handleConnection = null;
  }
}

export default Delaford;
