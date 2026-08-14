/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';
import monsterEvents from '../../src/core/player/events/monster.js';

describe('combat effect client events', () => {
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

  it('forwards successful skill casts to the authored effect renderer', () => {
    const addSkillEffect = vi.fn();
    const payload = {
      sourceId: 'scion-1',
      skillId: 'ability-2',
      fromX: 20,
      fromY: 10,
      radius: 2,
      durationMs: 900,
    };

    monsterEvents['world:skill:effect'](
      { data: payload },
      { game: { map: { addSkillEffect } } },
    );

    expect(addSkillEffect).toHaveBeenCalledWith(payload);
  });
});
