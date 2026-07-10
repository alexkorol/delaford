import Socket from './socket.js';
import ClientDiagnostics from './client-diagnostics.js';

class ConnectionManager {
  constructor({
    url,
    WebSocketImpl = globalThis.WebSocket,
    onMessage = () => {},
    onStatus = () => {},
    onError = () => {},
    shouldAutoLogin = () => false,
    baseDelayMs = 750,
    maxDelayMs = 8000,
  }) {
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.onError = onError;
    this.shouldAutoLogin = shouldAutoLogin;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.generation = 0;
    this.stopped = false;
  }

  start(existingSocket = null) {
    this.stopped = false;
    this.attach(existingSocket || this.createSocket());
  }

  createSocket() {
    return new this.WebSocketImpl(this.url);
  }

  attach(socket) {
    if (!socket) {
      throw new Error('Cannot attach an empty WebSocket.');
    }

    this.clearReconnectTimer();
    this.socket = socket;
    this.generation += 1;
    const generation = this.generation;
    if (typeof window !== 'undefined') {
      window.ws = socket;
    }
    Socket.setAuthenticated(false);

    socket.onmessage = event => this.handleMessage(event, socket, generation);
    socket.onopen = () => this.handleOpen(socket, generation);
    socket.onclose = event => this.handleClose(event, socket, generation);
    socket.onerror = event => this.handleError(event, socket, generation);

    if (socket.readyState === this.WebSocketImpl.OPEN) {
      queueMicrotask(() => this.handleOpen(socket, generation));
    }
  }

  isCurrent(socket, generation) {
    return !this.stopped && socket === this.socket && generation === this.generation;
  }

  handleOpen(socket, generation) {
    if (!this.isCurrent(socket, generation)) {
      return;
    }

    this.reconnectAttempts = 0;
    this.onStatus({ state: 'open', attempts: 0 });
    ClientDiagnostics.record('socket:open', { url: this.url, generation });

    const autoLogin = Boolean(Socket.lastLoginPayload && this.shouldAutoLogin());
    if (autoLogin) {
      Socket.sendNow('player:login', Socket.lastLoginPayload);
      ClientDiagnostics.record('socket:auto-login', { generation });
      return;
    }

    // Only queued login messages may leave before authentication. Gameplay
    // and persisted UI state wait for markAuthenticated().
    Socket.flushQueue();
  }

  handleMessage(event, socket, generation) {
    if (!this.isCurrent(socket, generation)) {
      return;
    }
    this.onMessage(event);
  }

  handleClose(event, socket, generation) {
    if (!this.isCurrent(socket, generation)) {
      return;
    }

    Socket.setAuthenticated(false);
    ClientDiagnostics.record('socket:close', {
      code: event && event.code,
      reason: event && event.reason,
      wasClean: event && event.wasClean,
      generation,
    });
    this.onStatus({
      state: 'reconnecting',
      attempts: this.reconnectAttempts,
      code: event && event.code,
    });
    this.scheduleReconnect();
  }

  handleError(event, socket, generation) {
    if (!this.isCurrent(socket, generation)) {
      return;
    }
    ClientDiagnostics.record('socket:error', { generation, type: event && event.type });
    this.onError(event);
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * (2 ** Math.min(this.reconnectAttempts, 4)),
    );
    this.reconnectAttempts += 1;
    ClientDiagnostics.record('socket:reconnect-scheduled', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopped) {
        return;
      }
      try {
        this.attach(this.createSocket());
      } catch (error) {
        ClientDiagnostics.record('socket:reconnect-create-failed', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  markAuthenticated() {
    Socket.setAuthenticated(true);
    Socket.flushQueue();
    ClientDiagnostics.record('socket:authenticated');
  }

  markLoggedOut() {
    Socket.setAuthenticated(false);
    Socket.queue = Socket.queue.filter(entry => entry.event === 'player:login');
    ClientDiagnostics.record('socket:logged-out');
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  stop({ close = false } = {}) {
    this.stopped = true;
    this.clearReconnectTimer();
    Socket.setAuthenticated(false);
    if (close && this.socket && this.socket.readyState < this.WebSocketImpl.CLOSING) {
      this.socket.close(1000, 'client shutdown');
    }
    this.socket = null;
  }
}

export default ConnectionManager;
