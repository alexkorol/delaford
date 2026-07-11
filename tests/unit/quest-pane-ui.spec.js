/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { presentFirstGoal } from '@/core/quests.js';
import playerEvents from '../../src/core/player/events/player.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('authoritative quest pane', () => {
  it('presents each server stage as a concrete player objective', () => {
    expect(presentFirstGoal({ stage: 'available' }).objective).toMatch(/Speak with Aldwyn/i);
    expect(presentFirstGoal({ stage: 'clear-floor' }).objective).toMatch(/Old Barrow.*floor 1/i);
    expect(presentFirstGoal({ stage: 'return-to-town' }).objective).toMatch(/Return to Aldwyn/i);
    expect(presentFirstGoal({ stage: 'complete' })).toMatchObject({
      completed: true,
      reward: '1 Verdigris point',
    });
  });

  it('renders from the live player quest snapshot, not placeholder copy', () => {
    const source = readSource('src/components/slots/Quests.vue');
    expect(source).toContain('game.player?.quests?.firstGoal');
    expect(source).toContain('presentFirstGoal');
    expect(source).not.toContain('Haunted Trails');
    expect(readSource('src/Delaford.vue')).toContain("q: 'quests'");
  });

  it('applies server-pushed quest stages to the live player', () => {
    const player = { quests: {}, questPoints: 0, passiveTree: null };
    const quests = { firstGoal: { stage: 'return-to-town' } };
    const passiveTree = { earned: 3, points: { skill: 3 } };

    playerEvents['quest:update']({
      data: { quests, questPoints: 1, passiveTree },
    }, { game: { player } });

    expect(player).toMatchObject({ quests, questPoints: 1, passiveTree });
  });
});
