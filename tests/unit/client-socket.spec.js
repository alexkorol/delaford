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
  Socket.queue.length = 0;
  Socket.waitForOpen = false;
  Socket.socketsWithListeners = new WeakSet();
  Socket.lastLoginPayload = null;
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

  it('caps the queue while waiting for a socket to initialise', () => {
    class FakeWebSocket {}
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSED = 3;

    setWebSocketEnvironment(FakeWebSocket);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const attempts = Socket.MAX_QUEUE_SIZE + 5;
    for (let index = 0; index < attempts; index += 1) {
      Socket.emit('queued:event', { index });
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

    Socket.emit('game:update', { payload: true });

    expect(socket.messages).toHaveLength(1);
    expect(Socket.queue).toHaveLength(0);
  });

  it('routes browser logins through Chronicles and remembers the selected Scion', () => {
    class FakeWebSocket {
      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        this.messages = [];
      }

      addEventListener() {}

      send(message) {
        this.messages.push(JSON.parse(message));
      }
    }
    FakeWebSocket.OPEN = 1;

    const socket = new FakeWebSocket();
    setWebSocketEnvironment(FakeWebSocket, socket);

    Socket.emit('player:login', { useGuestAccount: true });
    expect(socket.messages[0].data).toEqual({
      useGuestAccount: true,
      awaitChronicles: true,
    });

    expect(Socket.rememberScion('Vesper')).toBe(true);
    expect(Socket.lastLoginPayload.scionName).toBe('Vesper');
  });
});
