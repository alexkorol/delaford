import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const createClient = ({ id, readyState }) => ({
  id,
  readyState,
  send: vi.fn(),
});

describe('Socket.broadcast', () => {
  const originalClients = world.clients;
  const originalPlayers = [...world.players];

  beforeEach(() => {
    world.clients = [];
    world._players = [];
  });

  afterEach(() => {
    world.clients = originalClients;
    world._players = [...originalPlayers];
  });

  it('sends a single payload to connected clients and removes closed ones', () => {
    const openClient = createClient({ id: 'open', readyState: 1 });
    const closedClient = createClient({ id: 'closed', readyState: 3 });

    world.clients = [openClient, closedClient];
    world._players = [
      { socket_id: 'open' },
      { socket_id: 'closed' },
    ];

    const players = [
      { socket_id: 'open' },
      { socket_id: 'closed' },
    ];

    Socket.broadcast('game:update', { foo: 'bar' }, players);

    expect(openClient.send).toHaveBeenCalledTimes(1);
    const [payloadString] = openClient.send.mock.calls[0];
    const payload = JSON.parse(payloadString);

    expect(payload.event).toBe('game:update');
    expect(payload.data).toEqual({ foo: 'bar' });
    expect(typeof payload.meta.sentAt).toBe('number');

    expect(closedClient.send).not.toHaveBeenCalled();
    expect(world.clients).toEqual([openClient]);
  });

  it('ignores clients outside of the provided player list while pruning closed sockets', () => {
    const targetedClient = createClient({ id: 'target', readyState: 1 });
    const ignoredClient = createClient({ id: 'ignored', readyState: 1 });
    const closedClient = createClient({ id: 'closed', readyState: 3 });

    world.clients = [targetedClient, ignoredClient, closedClient];
    world._players = [
      { socket_id: 'target' },
      { socket_id: 'ignored' },
      { socket_id: 'closed' },
    ];

    const players = [
      { socket_id: 'target' },
    ];

    Socket.broadcast('game:event', { value: 42 }, players);

    expect(targetedClient.send).toHaveBeenCalledTimes(1);
    expect(ignoredClient.send).not.toHaveBeenCalled();
    expect(closedClient.send).not.toHaveBeenCalled();

    expect(world.clients).toEqual([targetedClient, ignoredClient]);
  });

  it('contains send races instead of crashing the server', () => {
    const racingClient = createClient({ id: 'racing', readyState: 1 });
    racingClient.send.mockImplementation(() => {
      throw new Error('socket closed during send');
    });
    world.clients = [racingClient];
    world._players = [{ socket_id: 'racing' }];

    expect(() => Socket.broadcast('game:update', { value: 1 }, world.players)).not.toThrow();
    expect(world.clients).toEqual([]);
  });
});
