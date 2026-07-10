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

  static emit(event, data) {
    if (event === 'player:login') {
      Socket.lastLoginPayload = data;
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
    return queued;
  }

  static reset() {
    Socket.queue = [];
    Socket.waitForOpen = false;
    Socket.authenticated = false;
    Socket.lastLoginPayload = null;
  }
}

export default Socket;
