import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Socket from '@/core/utilities/socket.js';

const resetSocketState = () => {
  Socket.reset();
};

const setWebSocketEnvironment = (WebSocketImpl, socketInstance) => {
  global.WebSocket = WebSocketImpl;
  global.window = {
    ...(global.window || {}),
    WebSocket: WebSocketImpl,
    ws: socketInstance,
  };
};

describe('client Socket helper', () => {
  const originalWindow = global.window;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetSocketState();
  });

  afterEach(() => {
    resetSocketState();
    vi.restoreAllMocks();

    if (typeof originalWindow === 'undefined') {
      delete global.window;
    } else {
      global.window = originalWindow;
    }

    if (typeof originalWebSocket === 'undefined') {
      delete global.WebSocket;
    } else {
      global.WebSocket = originalWebSocket;
    }
  });

  it('skips emitting when WebSocket is unavailable', () => {
    delete global.window;
    delete global.WebSocket;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => Socket.emit('test:event', { value: 1 })).not.toThrow();
    expect(Socket.queue).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('caps safe persisted-state messages while waiting for a socket', () => {
    class FakeWebSocket {}
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSED = 3;

    setWebSocketEnvironment(FakeWebSocket);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const attempts = Socket.MAX_QUEUE_SIZE + 5;
    for (let index = 0; index < attempts; index += 1) {
      Socket.emit('player:skilltree:save', { index });
    }

    expect(Socket.queue.length).toBe(Socket.MAX_QUEUE_SIZE);
    expect(Socket.waitForOpen).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('sends immediately when a socket is open', () => {
    class FakeWebSocket {
      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        this.messages = [];
      }

      addEventListener() {}

      send(message) {
        this.messages.push(message);
      }
    }
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSED = 3;

    const socket = new FakeWebSocket();
    setWebSocketEnvironment(FakeWebSocket, socket);
    Socket.setAuthenticated(true);

    Socket.emit('game:update', { payload: true });

    expect(socket.messages).toHaveLength(1);
    expect(Socket.queue).toHaveLength(0);
  });

  it('does not replay stale gameplay input after a disconnect', () => {
    class FakeWebSocket {}
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSED = 3;

    setWebSocketEnvironment(FakeWebSocket);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(Socket.emit('player:move', { direction: 'up' })).toBe(false);
    expect(Socket.queue).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('stale gameplay actions'));
  });

  it('holds persisted state until login authentication completes', () => {
    class FakeWebSocket {
      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        this.messages = [];
      }

      send(message) {
        this.messages.push(JSON.parse(message));
      }
    }
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSED = 3;

    const socket = new FakeWebSocket();
    setWebSocketEnvironment(FakeWebSocket, socket);
    Socket.enqueue('player:skilltree:save', { snapshot: true });

    expect(Socket.flushQueue()).toBe(0);
    expect(socket.messages).toEqual([]);

    Socket.setAuthenticated(true);
    expect(Socket.flushQueue()).toBe(1);
    expect(socket.messages[0].event).toBe('player:skilltree:save');
  });
});
