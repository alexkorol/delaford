import { describe, expect, it } from 'vitest';

import {
  buildCombatLogEntry,
  formatCombatExperience,
  formatCombatLogText,
  formatCombatSkillName,
} from '@/core/combat-log.js';

describe('combat log formatting', () => {
  it('uses shared skill labels for player attacks', () => {
    expect(formatCombatSkillName({ skillId: 'ability-1' })).toBe('Ember Volley');
  });

  it('formats player kill lines with monster names and experience', () => {
    const text = formatCombatLogText({
      attacker: 'You',
      target: 'Ashen Wolf',
      payload: {
        targetType: 'monster',
        skillName: 'Blade Sweep',
        amount: 12,
        died: true,
        experience: {
          skillId: 'attack',
          amount: 24,
          level: 1,
          levelledUp: false,
        },
      },
    });

    expect(text).toBe('You hit Ashen Wolf with Blade Sweep for 12. Ashen Wolf died. +24 Attack XP.');
  });

  it('includes level-up detail when a kill awards a skill level', () => {
    expect(formatCombatExperience({
      skillId: 'attack',
      amount: 80,
      level: 2,
      levelledUp: true,
    })).toBe(' +80 Attack XP. Attack level 2.');
  });

  it('formats incoming player damage without leaking monster skill internals', () => {
    const entry = buildCombatLogEntry({
      attackerName: 'Bramble Horror',
      targetType: 'player',
      skillId: 'monster:attack',
      skillName: 'Attack',
      amount: 9,
      died: false,
    }, {
      attacker: 'Bramble Horror',
      target: 'You',
    });

    expect(entry).toEqual({
      type: 'combat',
      text: 'Bramble Horror hit you for 9.',
      color: '#ff8a80',
    });
  });

  it('reports a block as defense rather than a zero-damage hit', () => {
    expect(formatCombatLogText({
      attacker: 'Pale Archer',
      target: 'You',
      payload: { amount: 0, blocked: true },
    })).toBe("You blocked Pale Archer's attack.");
  });

  it('names critical hits instead of presenting an unexplained damage spike', () => {
    expect(formatCombatLogText({
      attacker: 'You',
      target: 'Mire Stalker',
      payload: {
        skillName: 'Blade Sweep', amount: 18, critical: true,
      },
    })).toBe('You critically hit Mire Stalker with Blade Sweep for 18.');
  });

  it('names Beastbane hits instead of presenting an unexplained damage bonus', () => {
    expect(formatCombatLogText({
      attacker: 'You',
      target: 'Ashen Wolf',
      payload: {
        skillName: 'Blade Sweep', amount: 14, beastbane: true,
      },
    })).toBe('You hit Ashen Wolf with Blade Sweep for 14 (Beastbane).');
  });
});
