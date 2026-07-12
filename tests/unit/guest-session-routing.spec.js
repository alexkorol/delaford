/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/utilities/socket.js', () => ({
  default: { emit: vi.fn() },
}));

const { startBrowserGuestSession } = await import('@/core/auth/guest-session.js');
const { default: Socket } = await import('@/core/utilities/socket.js');

describe('explicit browser guest routing', () => {
  const values = new Map();

  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
    globalThis.window = {
      localStorage: {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
      },
    };
  });

  it('opens a separate persistent browser guest without account credentials', () => {
    startBrowserGuestSession();
    startBrowserGuestSession();

    expect(Socket.emit).toHaveBeenCalledTimes(2);
    const first = Socket.emit.mock.calls[0][1];
    const second = Socket.emit.mock.calls[1][1];
    expect(first).toEqual(expect.objectContaining({
      username: '',
      password: '',
      useGuestAccount: true,
      guestId: expect.any(String),
    }));
    expect(first).not.toHaveProperty('quickGuest');
    expect(second.guestId).toBe(first.guestId);
  });

  it('reserves immediate dungeon entry for the explicit quick-start URL', () => {
    startBrowserGuestSession({ quickStart: true });

    expect(Socket.emit).toHaveBeenCalledWith('player:login', expect.objectContaining({
      useGuestAccount: true,
      quickGuest: true,
    }));
  });
});

