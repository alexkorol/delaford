import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/utilities/socket.js', () => ({
  default: {
    emit: vi.fn(),
  },
}));

const { default: Client } = await import('@/core/client.js');
const { default: Socket } = await import('@/core/utilities/socket.js');

const makeClient = ({ mockReset = true } = {}) => {
  const client = Object.create(Client.prototype);
  client.player = {
    uuid: 'player-1',
    x: 10,
    y: 10,
    animation: { direction: 'right' },
  };
  client.map = null;
  client.monsters = [];
  if (mockReset) {
    client.resetOptimisticMovement = vi.fn();
  }
  client.setLocalAnimation = vi.fn();
  client.applyOptimisticMovement = vi.fn();
  return client;
};

describe('client combat movement prediction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not optimistically walk into a living monster when bump-attacking', () => {
    const client = makeClient();
    client.monsters = [{
      uuid: 'monster-1',
      x: 11,
      y: 10,
      stats: {
        resources: {
          health: { current: 12, max: 12 },
        },
      },
    }];

    client.move('right');

    expect(Socket.emit).toHaveBeenCalledWith('player:move', {
      id: 'player-1',
      direction: 'right',
    });
    expect(client.applyOptimisticMovement).not.toHaveBeenCalled();
    expect(client.resetOptimisticMovement).toHaveBeenCalled();
    expect(client.setLocalAnimation).toHaveBeenCalledWith('attack', expect.objectContaining({
      direction: 'right',
      skillId: 'primary-attack',
    }));
  });

  it('keeps normal optimistic movement when the next tile is clear', () => {
    const client = makeClient();

    client.move('right');

    expect(Socket.emit).toHaveBeenCalledWith('player:move', {
      id: 'player-1',
      direction: 'right',
    });
    expect(client.applyOptimisticMovement).toHaveBeenCalledWith('right');
    expect(client.setLocalAnimation).not.toHaveBeenCalled();
  });

  it('clears queued local movement when optimistic movement is reset', () => {
    const client = makeClient({ mockReset: false });
    const hardSync = vi.fn();
    client.player.optimisticQueue = [{ x: 11, y: 10 }];
    client.player.optimisticTarget = { x: 11, y: 10 };
    client.player.optimisticPosition = { x: 11, y: 10 };
    client.player.optimisticFacing = 'right';
    client.player.movement = { hardSync };
    client.setLocalIdle = vi.fn();

    client.resetOptimisticMovement();

    expect(client.player.optimisticQueue).toEqual([]);
    expect(client.player.optimisticTarget).toBeNull();
    expect(client.player.optimisticPosition).toEqual({ x: 10, y: 10 });
    expect(client.player.optimisticFacing).toBeNull();
    expect(hardSync).toHaveBeenCalledWith(10, 10);
    expect(client.setLocalIdle).toHaveBeenCalled();
  });
});
