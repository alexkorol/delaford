class Socket {
  static queue = [];

  static waitForOpen = false;

  static socketsWithListeners = new WeakSet();

  static MAX_QUEUE_SIZE = 100;

  static enqueue(message) {
    Socket.queue.push(message);

    if (Socket.queue.length > Socket.MAX_QUEUE_SIZE) {
      Socket.queue.shift();
    }
  }

  static flushQueue = () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (typeof WebSocket === 'undefined') {
      return;
    }

    if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    Socket.waitForOpen = false;

    while (Socket.queue.length > 0) {
      const message = Socket.queue.shift();
      window.ws.send(message);
    }
  };

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

  /**
   * Send an event to the server
   *
   * @param {string} event The event to send out
   * @param {object} data The data regarding the event
   */
  static lastLoginPayload = null;

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
    // Remember the credentials so a reconnect can log straight back in
    // after a server restart instead of dumping the player at the login
    // screen.
    if (event === 'player:login') {
      Socket.lastLoginPayload = {
        ...data,
        awaitChronicles: true,
      };
      data = Socket.lastLoginPayload;
    }

    const payload = JSON.stringify({
      event,
      data,
    });

    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      console.warn(`[socket] Unable to emit ${event}: WebSocket not available in this environment.`);
      return;
    }

    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.send(payload);
      return;
    }

    if (!window.ws) {
      console.warn(`[socket] Queuing ${event}, waiting for websocket to initialise.`);
      Socket.enqueue(payload);
      Socket.waitForOpen = true;
      return;
    }

    Socket.enqueue(payload);
    Socket.waitForOpen = true;

    if (window.ws) {
      Socket.ensureListeners();
      Socket.flushQueue();
    }
  }
}

export default Socket;
