/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { applyAura } from '#server/core/entities/monster/behaviours/buffer.js';

describe('monster aura buffer', () => {
  it('empowers only living nearby allies and records an expiring source', () => {
    const nearby = {
      uuid: 'nearby', x: 4, y: 2, isAlive: true, state: { effects: {} },
    };
    const far = {
      uuid: 'far', x: 20, y: 20, isAlive: true, state: { effects: {} },
    };
    const dead = {
      uuid: 'dead', x: 3, y: 2, isAlive: false, state: { effects: {} },
    };
    const buffer = {
      uuid: 'buffer',
      x: 2,
      y: 2,
      isAlive: true,
      state: { effects: {} },
      behaviour: {
        aura: { radius: 6, damageMultiplier: 1.12, durationMs: 2200 },
      },
      activeScene: { monsters: [], players: [{ uuid: 'player' }] },
    };
    buffer.activeScene.monsters = [buffer, nearby, far, dead];

    expect(applyAura(buffer, 5000)).toBe(true);
    expect(nearby.state.effects['aura:buffer']).toEqual({
      sourceId: 'buffer',
      label: 'Empowered',
      damageMultiplier: 1.12,
      expiresAt: 7200,
    });
    expect(far.state.effects).toEqual({});
    expect(dead.state.effects).toEqual({});
    expect(buffer.state.effects).toEqual({});
  });

  it('does no work for dormant instance scenes', () => {
    const buffer = {
      uuid: 'buffer', x: 0, y: 0, isAlive: true,
      state: { effects: {} }, behaviour: { aura: {} },
      activeScene: { monsters: [], players: [] },
    };
    buffer.activeScene.monsters = [buffer, {
      uuid: 'ally', x: 1, y: 0, isAlive: true, state: { effects: {} },
    }];
    expect(applyAura(buffer, 5000)).toBe(false);
    expect(buffer.state.lastAuraAt).toBeUndefined();
  });
});
