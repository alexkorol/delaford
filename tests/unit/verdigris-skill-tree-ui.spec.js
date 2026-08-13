/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_TOTALS,
} from '@/core/passives/verdigris-skill-tree.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('Verdigris skill tree UI copy', () => {
  it('uses the unified Verdigris point model in shared UI summaries', () => {
    expect(VERDIGRIS_SKILL_TREE_POINTS).toEqual({ skill: 123 });
    expect(VERDIGRIS_SKILL_TREE_TOTALS.layers).toBe(9);
    expect(VERDIGRIS_SKILL_TREE_TOTALS.nodes).toBe(271);
    expect(VERDIGRIS_SKILL_TREE_TOTALS.subtreeNodes).toBe(34);
  });

  it('does not expose how-to text in the skill tree overlay', () => {
    const source = readSource('src/components/passives/GeometricSkillTreePane.vue');

    expect(source).not.toContain('allocate or refund');
    expect(source).not.toContain('confirm route');
    expect(source).not.toContain('tune conduit');
    expect(source).not.toContain('Choose a path');
  });

  it('does not show the retired petal economy in the character screen summary', () => {
    const source = readSource('src/components/slots/Stats.vue');

    expect(source).not.toContain('petals spent');
    expect(source).not.toContain('flowerSummary');
  });

  it('adds authoritative quest rewards to the passive-point pool', () => {
    const source = readSource('src/components/passives/GeometricSkillTreePane.vue');

    expect(source).toContain('player?.quests?.questPoints');
    expect(source).toContain("'game.player.quests.questPoints'");
  });
});
