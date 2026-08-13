/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { QUEST_DEFINITIONS } from '#shared/quests.js';

describe('quest journal', () => {
  it('ships a complete first gameplay commission', () => {
    const quest = QUEST_DEFINITIONS[0];

    expect(quest.id).toBe('aldwyns-charge');
    expect(quest.objectives.map(objective => objective.trigger)).toEqual([
      'move', 'attack', 'slay', 'loot', 'delve',
    ]);
    expect(quest.rewards).toEqual({ passivePoints: 1, houseRenown: 5 });
  });

  it('renders live objectives instead of the legacy placeholder', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/components/slots/Quests.vue', import.meta.url)),
      'utf8',
    );

    expect(source).toContain('activeQuest.objectives');
    expect(source).toContain('questState.objectiveIndex');
    expect(source).not.toContain('Haunted Trails');
  });
});
