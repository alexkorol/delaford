/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/core/utilities/socket.js', () => ({
  default: { emit: vi.fn() },
}));

const { getBrowserGuestId, startBrowserGuestSession } = await import('@/core/auth/guest-session.js');
const { default: Socket } = await import('@/core/utilities/socket.js');

describe('guest identifier generation (cand-008)', () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates a CSPRNG UUID and reuses it across sessions', () => {
    const first = getBrowserGuestId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(first).not.toContain('guest-');
    expect(getBrowserGuestId()).toBe(first);
  });

  it('fails closed when crypto.randomUUID is unavailable (no Date.now/Math.random fallback)', () => {
    vi.stubGlobal('crypto', undefined);

    expect(() => getBrowserGuestId()).toThrow(/secure browser context/);
    expect(values.size).toBe(0);
    expect(() => startBrowserGuestSession()).toThrow();
    expect(Socket.emit).not.toHaveBeenCalled();
  });

  it('still reconnects a previously saved guest id even without crypto', () => {
    values.set('verdigris_guest_id', 'guest-legacy-saved1');
    vi.stubGlobal('crypto', undefined);

    expect(getBrowserGuestId()).toBe('guest-legacy-saved1');
    startBrowserGuestSession();
    expect(Socket.emit).toHaveBeenCalledWith('player:login', expect.objectContaining({
      useGuestAccount: true,
      guestId: 'guest-legacy-saved1',
    }));
  });
});
