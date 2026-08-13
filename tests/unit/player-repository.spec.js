/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { PlayerRepository } from '#server/core/repositories/player-repository.js';

describe('PlayerRepository identity persistence', () => {
  it('persists the account username while a Scion is the live display name', () => {
    const repository = new PlayerRepository({ baseUrl: 'https://example.test' });
    const data = repository.buildPlayerData({
      accountUsername: 'account-owner',
      username: 'Vesper',
      x: 12,
      y: 18,
      hp: { current: 8, max: 10 },
    });

    expect(data.username).toBe('account-owner');
  });
});
