/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';
import monsterEvents from '../../src/core/player/events/monster.js';

describe('boss telegraph client event', () => {
  it('forwards the server-authored danger circle to the map renderer', () => {
    const addGroundTelegraph = vi.fn();
    const payload = {
      attackerId: 'warden',
      skillId: 'boss:ground-slam',
      x: 20,
      y: 10,
      radius: 2.5,
      durationMs: 1000,
    };

    monsterEvents['monster:telegraph'](
      { data: payload },
      { game: { map: { addGroundTelegraph } } },
    );

    expect(addGroundTelegraph).toHaveBeenCalledWith(payload);
  });
});
