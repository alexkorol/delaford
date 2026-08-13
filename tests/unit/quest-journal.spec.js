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

  it('continues into an elite hunt and native Vessel equipment commission', () => {
    const quest = QUEST_DEFINITIONS[1];

    expect(quest.id).toBe('proof-of-temper');
    expect(quest.objectives.map(objective => objective.trigger)).toEqual([
      'slay-elite', 'loot-vessel', 'equip-vessel',
    ]);
    expect(quest.rewards).toEqual({ passivePoints: 1, houseRenown: 10 });
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

  it('keeps the journal reachable from the HUD and Q hotkey', () => {
    const rootSource = readFileSync(
      fileURLToPath(new URL('../../src/Delaford.vue', import.meta.url)),
      'utf8',
    );
    const containerSource = readFileSync(
      fileURLToPath(new URL('../../src/components/layout/GameContainer.vue', import.meta.url)),
      'utf8',
    );

    expect(rootSource).toContain("q: 'quests'");
    expect(rootSource).toContain('@request-pane="requestPane"');
    expect(containerSource).toContain("@click=\"$emit('request-pane', 'quests')\"");
    expect(containerSource).toContain('Quest journal (Q)');
  });
});
