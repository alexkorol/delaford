/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  createCharacterState,
  applyDamage,
  applyHealing,
  tryRespawn,
  syncShortcuts,
} from '#shared/stats/index.js';

describe('stat pipeline → combat integration', () => {
  const makePlayerState = (overrides = {}) => createCharacterState({
    level: 5,
    attributes: {
      base: { strength: 15, dexterity: 12, intelligence: 10 },
      equipment: { strength: 3, dexterity: 0, intelligence: 0 },
      bonuses: { strength: 0, dexterity: 0, intelligence: 0 },
      passives: { strength: 2, dexterity: 1, intelligence: 0 },
    },
    ...overrides,
  });

  it('creates a valid character state with all attribute sources', () => {
    const state = makePlayerState();
    expect(state.level).toBe(5);
    expect(state.attributes.total.strength).toBe(20); // 15 + 3 + 0 + 2
    expect(state.attributes.total.dexterity).toBe(13); // 12 + 0 + 0 + 1
    expect(state.attributes.total.intelligence).toBe(10);
    expect(state.resources.health.max).toBeGreaterThan(0);
    expect(state.resources.mana.max).toBeGreaterThan(0);
    expect(state.lifecycle.state).toBe('alive');
  });

  it('computes health based on strength and level', () => {
    const state = makePlayerState();
    // health = base(60) + perLevel(8) * (level-1)(4) + perStrength(5) * totalStr(20)
    // = 60 + 32 + 100 = 192
    expect(state.resources.health.max).toBe(192);
    expect(state.resources.health.current).toBe(192);
  });

  it('computes mana based on intelligence and level', () => {
    const state = makePlayerState();
    // mana = base(30) + perLevel(3) * (level-1)(4) + perIntelligence(6) * totalInt(10)
    // = 30 + 12 + 60 = 102
    expect(state.resources.mana.max).toBe(102);
    expect(state.resources.mana.current).toBe(102);
  });

  it('applies damage and reduces health', () => {
    const state = makePlayerState();
    const result = applyDamage(state, 50);
    expect(result.type).toBe('damage');
    expect(result.amount).toBe(50);
    expect(state.resources.health.current).toBe(142);
  });

  it('applies lethal damage and triggers death', () => {
    const state = makePlayerState();
    // Exhaust cheat-death first
    state.lifecycle.cheatDeath.charges = 0;

    const result = applyDamage(state, 9999);
    expect(result.type).toBe('death');
    expect(state.resources.health.current).toBe(0);
    expect(state.lifecycle.state).toBe('awaiting-respawn');
  });

  it('triggers cheat-death when available', () => {
    const state = makePlayerState();
    expect(state.lifecycle.cheatDeath.charges).toBe(1);

    const result = applyDamage(state, 9999, { allowCheatDeath: true });
    expect(result.type).toBe('cheat-death');
    expect(state.resources.health.current).toBeGreaterThan(0);
    expect(state.lifecycle.state).toBe('cheat-death');
    expect(state.lifecycle.cheatDeath.charges).toBe(0);
  });

  it('applies healing and restores health', () => {
    const state = makePlayerState();
    applyDamage(state, 100);
    expect(state.resources.health.current).toBe(92);

    const result = applyHealing(state, 50);
    expect(result.type).toBe('heal');
    expect(state.resources.health.current).toBe(142);
  });

  it('healing cannot exceed max health', () => {
    const state = makePlayerState();
    applyDamage(state, 10);
    applyHealing(state, 999);
    expect(state.resources.health.current).toBe(state.resources.health.max);
  });

  it('full lifecycle: damage → death → respawn', () => {
    const state = makePlayerState();
    state.lifecycle.cheatDeath.charges = 0;

    applyDamage(state, 9999);
    expect(state.lifecycle.state).toBe('awaiting-respawn');
    expect(state.resources.health.current).toBe(0);

    const respawn = tryRespawn(state, { force: true });
    expect(respawn.success).toBe(true);
    expect(state.lifecycle.state).toBe('alive');
    expect(state.resources.health.current).toBeGreaterThan(0);
    // Respawn at 50% health by default
    expect(state.resources.health.current).toBe(Math.max(1, Math.round(state.resources.health.max * 0.5)));
  });

  it('permadeath blocks respawn', () => {
    const state = makePlayerState({
      lifecycle: { mode: 'hard' },
    });
    state.lifecycle.cheatDeath.charges = 0;
    state.lifecycle.livesRemaining = 0;

    applyDamage(state, 9999);
    expect(state.lifecycle.state).toBe('permadead');

    const respawn = tryRespawn(state, { force: true });
    expect(respawn.success).toBe(false);
  });

  it('syncShortcuts correctly maps state to entity', () => {
    const state = makePlayerState();
    const entity = {};
    syncShortcuts(state, entity);

    expect(entity.stats).toBe(state);
    expect(entity.hp).toBe(state.resources.health);
    expect(entity.mana).toBe(state.resources.mana);
    expect(entity.lifecycle).toBe(state.lifecycle);
  });

  it('handles missing attribute sources gracefully', () => {
    const state = createCharacterState({
      level: 1,
      attributes: {
        base: { strength: 10, dexterity: 10, intelligence: 10 },
        // no equipment, bonuses, or passives
      },
    });

    expect(state.attributes.total.strength).toBe(10);
    expect(state.resources.health.max).toBeGreaterThan(0);
  });
});
