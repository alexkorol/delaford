/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConnectionManager from '@/core/utilities/connection-manager.js';
import ClientDiagnostics from '@/core/utilities/client-diagnostics.js';
import Socket from '@/core/utilities/socket.js';

class FakeWebSocket {
  static CONNECTING = 0;

  static OPEN = 1;

  static CLOSING = 2;

  static CLOSED = 3;

  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.messages = [];
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({ type: 'open' });
  }

  send(payload) {
    this.messages.push(JSON.parse(payload));
  }

  close(code = 1006, reason = 'test close') {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }
}

describe('ConnectionManager', () => {
  const originalWindow = global.window;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    Socket.reset();
    ClientDiagnostics.reset();
    global.WebSocket = FakeWebSocket;
    global.window = {
      ws: null,
      sessionStorage: { setItem: vi.fn() },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    Socket.reset();
    ClientDiagnostics.reset();
    global.WebSocket = originalWebSocket;
    global.window = originalWindow;
  });

  it('re-authenticates before flushing persisted state after reconnect', () => {
    let inGame = false;
    const statuses = [];
    const first = new FakeWebSocket('ws://game.test');
    const manager = new ConnectionManager({
      url: 'ws://game.test',
      WebSocketImpl: FakeWebSocket,
      shouldAutoLogin: () => inGame,
      onStatus: status => statuses.push(status.state),
      baseDelayMs: 10,
      maxDelayMs: 10,
    });
    manager.start(first);
    first.open();

    Socket.lastLoginPayload = { useGuestAccount: true };
    manager.markAuthenticated();
    inGame = true;
    first.close();
    Socket.emit('player:skilltree:save', { snapshot: { nodes: ['0,0'] } });

    vi.advanceTimersByTime(10);
    const replacement = FakeWebSocket.instances.at(-1);
    replacement.open();

    expect(replacement.messages.map(message => message.event)).toEqual(['player:login']);
    expect(Socket.queue).toHaveLength(1);

    manager.markAuthenticated();
    expect(replacement.messages.map(message => message.event)).toEqual([
      'player:login',
      'player:skilltree:save',
    ]);
    expect(statuses).toContain('reconnecting');
  });

  it('ignores stale socket events and keeps only one reconnect timer', () => {
    const first = new FakeWebSocket('ws://game.test');
    const manager = new ConnectionManager({
      url: 'ws://game.test',
      WebSocketImpl: FakeWebSocket,
      baseDelayMs: 10,
      maxDelayMs: 10,
    });
    manager.start(first);
    first.open();
    first.close();
    first.onclose?.({ code: 1006, reason: 'duplicate close' });

    vi.advanceTimersByTime(10);

    expect(FakeWebSocket.instances).toHaveLength(2);
    manager.stop();
  });

  it('records close codes and cancels pending reconnects on stop', () => {
    const first = new FakeWebSocket('ws://game.test');
    const manager = new ConnectionManager({
      url: 'ws://game.test',
      WebSocketImpl: FakeWebSocket,
      baseDelayMs: 10,
      maxDelayMs: 10,
    });
    manager.start(first);
    first.open();
    first.close(4001, 'server restart');
    manager.stop();
    vi.advanceTimersByTime(20);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(ClientDiagnostics.snapshot().records).toContainEqual(expect.objectContaining({
      kind: 'socket:close',
      details: expect.objectContaining({ code: 4001, reason: 'server restart' }),
    }));
  });
});
