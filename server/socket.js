import { WebSocketServer, WebSocket } from 'ws';
import world from '#server/core/world.js';
import { recordRuntimeEvent } from '#server/core/services/runtime-diagnostics.js';

/**
 * IDEA: Create seperate socket classes,
 * one for server and one for player???
 */

class Socket {
  constructor(server) {
    this.ws = new WebSocketServer({ server });
    this.clients = world.clients;
    this.heartbeatIntervalMs = Number(process.env.WS_HEARTBEAT_INTERVAL_MS) || 30000;

    this.ws.on('connection', (client) => {
      client.isAlive = true;
      client.on('pong', () => {
        client.isAlive = true;
      });
    });

    this.heartbeat = setInterval(() => {
      if (!this.ws) {
        return;
      }
      this.ws.clients.forEach((client) => {
        if (client.isAlive === false) {
          recordRuntimeEvent('socket:heartbeat-timeout', { socketId: client.id || null });
          try {
            client.terminate();
          } catch (error) {
            recordRuntimeEvent('socket:terminate-error', {
              socketId: client.id || null,
              message: error.message,
            });
          }
          return;
        }
        client.isAlive = false;
        try {
          client.ping();
        } catch (error) {
          recordRuntimeEvent('socket:heartbeat-error', {
            socketId: client.id || null,
            message: error.message,
          });
          try {
            client.terminate();
          } catch (terminateError) {
            recordRuntimeEvent('socket:terminate-error', {
              socketId: client.id || null,
              message: terminateError.message,
            });
          }
        }
      });
    }, this.heartbeatIntervalMs);
    this.heartbeat.unref();
  }

  close() {
    if (!this.ws) {
      return;
    }

    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    for (const client of this.ws.clients) {
      try {
        client.terminate();
      } catch (error) {
        process.stderr.write(`[socket] Failed to terminate client. ${error}\n`);
      }
    }

    try {
      this.ws.close();
    } catch (error) {
      process.stderr.write(`[socket] Failed to close WebSocket server. ${error}\n`);
    } finally {
      this.ws = null;
    }
  }

  static safeSend(client, serializedPayload, event) {
    if (!client || client.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      client.send(serializedPayload);
      return true;
    } catch (error) {
      recordRuntimeEvent('socket:send-error', {
        socketId: client.id || null,
        event,
        message: error.message,
      });
      console.warn(`[socket] Failed to send ${event} to ${client.id || 'unknown socket'}: ${error.message}`);
      return false;
    }
  }

  /**
   * Emit an event to a single client
   *
   * @param {string} event The type of event being emitted
   * @param {object} data The data associated with the event
   */
  static emit(event, data, options = {}) {
    if (!data || !data.player || !data.player.socket_id) {
      console.warn(`[socket] Unable to emit ${event}: missing player socket id.`);
      return false;
    }

    // Find player wanting the emit request
    const player = world.clients.find(p => p.id === data.player.socket_id);

    if (!player) {
      console.warn(`[socket] Unable to emit ${event}: socket ${data.player.socket_id} not found.`);
      return false;
    }

    if (player.readyState !== WebSocket.OPEN) {
      console.warn(`[socket] Unable to emit ${event}: socket ${data.player.socket_id} not open (state ${player.readyState}).`);
      return false;
    }

    // Send the player back their needed data
    const payload = {
      event,
      data,
    };

    if (options.meta || options.includeTimestamp) {
      const meta = {
        sentAt: Date.now(),
        ...(options.meta || {}),
      };

      payload.meta = meta;
    }

    return Socket.safeSend(player, JSON.stringify(payload), event);
  }

  /**
   * Broadcast an event to all clients connected in-game
   *
   * @param {string} event The type of event I am broadcasting
   * @param {object} data Data associated with the event
   */
  static broadcast(event, data, players, options = {}) {
    const meta = {
      sentAt: Date.now(),
      ...(options.meta || {}),
    };

    const payload = {
      event,
      data,
      meta,
    };

    const serializedPayload = JSON.stringify(payload);
    const allowedSocketIds = players ? new Set(players.map(player => player.socket_id)) : null;
    const disconnectedClientIds = [];

    world.clients.forEach(client => {
      if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        disconnectedClientIds.push(client.id);
        return;
      }

      if (allowedSocketIds && !allowedSocketIds.has(client.id)) {
        return;
      }

      const sender = world.players.find(p => p.socket_id === client.id);

      if (!world.players.length || !sender) {
        return;
      }

      if (client.readyState === WebSocket.OPEN
        && !Socket.safeSend(client, serializedPayload, event)) {
        disconnectedClientIds.push(client.id);
      }
    });

    if (disconnectedClientIds.length) {
      const disconnectedSet = new Set(disconnectedClientIds);
      world.clients = world.clients.filter(client => !disconnectedSet.has(client.id));
    }
  }

  static sendMessageToPlayer(playerIndex, message) {
    const player = playerIndex && typeof playerIndex === 'object'
      ? playerIndex
      : typeof playerIndex === 'string'
        ? world.players.find(entry => entry.uuid === playerIndex || entry.socket_id === playerIndex)
        : world.players[playerIndex];
    if (!player || !player.socket_id) {
      return;
    }
    this.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text: message,
    });
  }
}

export default Socket;
