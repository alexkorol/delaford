/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  getSkillDefinition,
  getSkillExecutionProfile,
  createQuickbarSlots,
  listSkills,
  listQuickbarTemplate,
} from '#shared/skills/index.js';
import { DEFAULT_SKILL_IDS } from '#shared/combat.js';
import { createSkillDefinition, createQuickbarSlot } from '#shared/skills/schema.js';

describe('skill registry integration', () => {
  it('all DEFAULT_SKILL_IDS with definitions are registered', () => {
    // primary-attack, dash, and abilities 1-4 should all be defined
    const expectedIds = [
      DEFAULT_SKILL_IDS.primary,
      DEFAULT_SKILL_IDS.dash,
      DEFAULT_SKILL_IDS.ability1,
      DEFAULT_SKILL_IDS.ability2,
      DEFAULT_SKILL_IDS.ability3,
      DEFAULT_SKILL_IDS.ability4,
    ];

    expectedIds.forEach((id) => {
      const skill = getSkillDefinition(id);
      expect(skill, `Skill ${id} should be registered`).not.toBeNull();
      expect(skill.id).toBe(id);
    });
  });

  it('secondary-attack is a declared ID but not yet implemented', () => {
    // This is an intentional design choice — secondary attack is planned
    const skill = getSkillDefinition(DEFAULT_SKILL_IDS.secondary);
    expect(skill).toBeNull();
  });

  it('getSkillDefinition returns null for unknown IDs', () => {
    expect(getSkillDefinition('nonexistent-skill')).toBeNull();
    expect(getSkillDefinition(null)).toBeNull();
    expect(getSkillDefinition('')).toBeNull();
  });
});

describe('skill execution profile', () => {
  it('returns profile with animation data for known skills', () => {
    const profile = getSkillExecutionProfile(DEFAULT_SKILL_IDS.primary);
    expect(profile).not.toBeNull();
    expect(profile.skill.id).toBe(DEFAULT_SKILL_IDS.primary);
    expect(profile.animationState).toBe('attack');
    expect(typeof profile.duration).toBe('number');
    expect(profile.duration).toBeGreaterThan(0);
  });

  it('returns null for unknown skills', () => {
    expect(getSkillExecutionProfile('does-not-exist')).toBeNull();
  });

  it('dash skill has correct mobility properties', () => {
    const profile = getSkillExecutionProfile(DEFAULT_SKILL_IDS.dash);
    expect(profile.animationState).toBe('dash');
    expect(profile.holdState).toBe('run');
  });
});

describe('quickbar integration', () => {
  it('creates correct number of quickbar slots', () => {
    const slots = createQuickbarSlots();
    expect(slots).toHaveLength(8);
  });

  it('first slot binds to primary attack', () => {
    const slots = createQuickbarSlots();
    expect(slots[0].skillId).toBe(DEFAULT_SKILL_IDS.primary);
    expect(slots[0].hotkey).toBe('1');
  });

  it('second slot binds to dash', () => {
    const slots = createQuickbarSlots();
    expect(slots[1].skillId).toBe(DEFAULT_SKILL_IDS.dash);
    expect(slots[1].hotkey).toBe('2');
  });

  it('last two slots are empty (no skill bound)', () => {
    const slots = createQuickbarSlots();
    expect(slots[6].skillId).toBeNull();
    expect(slots[7].skillId).toBeNull();
  });

  it('all bound slots have valid skill definitions', () => {
    const slots = createQuickbarSlots();
    slots.forEach((slot) => {
      if (slot.skillId) {
        const skill = getSkillDefinition(slot.skillId);
        expect(skill, `Slot ${slot.slotIndex} skill ${slot.skillId} should exist`).not.toBeNull();
      }
    });
  });

  it('quickbar template produces independent copies', () => {
    const template1 = listQuickbarTemplate();
    const template2 = listQuickbarTemplate();
    template1[0].hotkey = 'modified';
    expect(template2[0].hotkey).toBe('1');
  });
});

describe('schema validation', () => {
  it('createSkillDefinition fills in all required fields', () => {
    const skill = createSkillDefinition({ id: 'test', name: 'Test' });
    expect(skill.id).toBe('test');
    expect(skill.name).toBe('Test');
    expect(skill.category).toBeDefined();
    expect(skill.tags).toEqual([]);
  });

  it('createQuickbarSlot resolves skill reference', () => {
    const slot = createQuickbarSlot(
      { slotIndex: 0, hotkey: '1', skillId: DEFAULT_SKILL_IDS.primary },
      getSkillDefinition,
    );
    expect(slot.slotIndex).toBe(0);
    expect(slot.skillId).toBe(DEFAULT_SKILL_IDS.primary);
    expect(slot.label).toBeTruthy();
  });

  it('quickbar slot has all expected fields', () => {
    const slot = createQuickbarSlot(
      { slotIndex: 0, hotkey: '1', skillId: DEFAULT_SKILL_IDS.primary },
      getSkillDefinition,
    );
    expect(slot.slotIndex).toBe(0);
    expect(slot.hotkey).toBe('1');
    expect(slot.skillId).toBe(DEFAULT_SKILL_IDS.primary);
    expect(typeof slot.label).toBe('string');
    expect(slot.label.length).toBeGreaterThan(0);
  });
});
