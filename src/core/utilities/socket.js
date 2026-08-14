const QUEUEABLE_EVENTS = new Set([
  'player:login',
  'player:skilltree:save',
]);

class Socket {
  static queue = [];

  static waitForOpen = false;

  static MAX_QUEUE_SIZE = 100;

  static authenticated = false;

  static lastLoginPayload = null;

  static enqueue(event, data) {
    if (!QUEUEABLE_EVENTS.has(event)) {
      console.warn(`[socket] Dropping ${event} while disconnected; stale gameplay actions are not replayed.`);
      return false;
    }

    Socket.queue.push({ event, data });
    if (Socket.queue.length > Socket.MAX_QUEUE_SIZE) {
      Socket.queue.shift();
      console.warn('[socket] Queue full; discarded the oldest persisted-state message.');
    }
    return true;
  }

  static setAuthenticated(value) {
    Socket.authenticated = Boolean(value);
  }

  /**
   * Attach open/close bookkeeping to the current window.ws exactly once per
   * socket instance, so queued persisted-state messages flush when a
   * (re)connection opens.
   */
  static ensureListeners() {
    if (typeof window === 'undefined' || !window.ws) {
      return;
    }

    if (!Socket.socketsWithListeners) {
      Socket.socketsWithListeners = new WeakSet();
    }

    if (Socket.socketsWithListeners.has(window.ws)) {
      return;
    }

    const socket = window.ws;
    socket.addEventListener('open', Socket.flushQueue);
    socket.addEventListener('close', () => {
      Socket.waitForOpen = false;
      if (Socket.socketsWithListeners) {
        Socket.socketsWithListeners.delete(socket);
      }
    });
    Socket.socketsWithListeners.add(socket);
  }

  static canSend(event) {
    return event === 'player:login' || Socket.authenticated;
  }

  static sendNow(event, data) {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return false;
    }
    if (!window.ws || window.ws.readyState !== WebSocket.OPEN || !Socket.canSend(event)) {
      return false;
    }

    try {
      window.ws.send(JSON.stringify({ event, data }));
      return true;
    } catch (error) {
      console.error(`[socket] Failed to send ${event}:`, error);
      return false;
    }
  }

  static flushQueue = () => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return 0;
    }
    if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
      return 0;
    }

    let sent = 0;
    const retained = [];
    Socket.queue.forEach(({ event, data }) => {
      if (!Socket.canSend(event) || !Socket.sendNow(event, data)) {
        retained.push({ event, data });
        return;
      }
      sent += 1;
    });
    Socket.queue = retained;
    Socket.waitForOpen = Socket.queue.length > 0;
    return sent;
  };

  static chroniclesAccountId = null;

  static rememberScion(identity) {
    if (!Socket.lastLoginPayload) {
      return false;
    }

    const scion = typeof identity === 'string' ? { name: identity } : identity;
    if (!scion || !scion.name) {
      return false;
    }

    Socket.lastLoginPayload = {
      ...Socket.lastLoginPayload,
      awaitChronicles: true,
      scionName: scion.name,
      scionId: scion.id || scion.scionId || null,
      houseId: scion.houseId || null,
      mortal: Boolean(scion.mortal),
    };
    return true;
  }

  static emit(event, data) {
    if (event === 'player:login') {
      // Quick-guest and resume logins drive their own admission through the
      // chronicle-auth flow; only interactive logins park on the Chronicles
      // screen (awaitChronicles).
      const quickFlow = data && (data.quickGuest === true || data.resumeScionId);
      Socket.lastLoginPayload = {
        ...data,
        ...(quickFlow ? {} : { awaitChronicles: true }),
      };
      data = Socket.lastLoginPayload;
    }

    if (Socket.sendNow(event, data)) {
      return true;
    }

    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      console.warn(`[socket] Unable to emit ${event}: WebSocket not available in this environment.`);
      return false;
    }

    const queued = Socket.enqueue(event, data);
    Socket.waitForOpen = queued;
    if (queued && window.ws) {
      Socket.ensureListeners();
    }
    return queued;
  }

  static setResumeScion(scionId) {
    if (!Socket.lastLoginPayload) return;
    Socket.lastLoginPayload = {
      ...Socket.lastLoginPayload,
      resumeScionId: scionId || null,
    };
  }

  static reset() {
    Socket.queue = [];
    Socket.waitForOpen = false;
    Socket.authenticated = false;
    Socket.lastLoginPayload = null;
  }
}

export default Socket;
