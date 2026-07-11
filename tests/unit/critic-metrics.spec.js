/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

import { normalizeCriticMetrics } from '../../playtest/critic.mjs';

const completeRun = {
  secondsToFirstCombat: 2,
  secondsToFirstDrop: 6,
  ttkSeconds: { level1: 3, level5: 1.5 },
  meaningfulChoices: { total: 6, treePoints: 2, equipSwaps: 1, zonePicks: 3 },
  deaths: 0,
  depthReached: 4,
};

describe('session critic metrics', () => {
  it('scores every proven session-arc objective', () => {
    expect(normalizeCriticMetrics(completeRun)).toEqual({ ...completeRun, criticScore: 100 });
  });

  it('rejects incomplete metrics instead of recording misleading trends', () => {
    expect(() => normalizeCriticMetrics({ ...completeRun, secondsToFirstDrop: undefined }))
      .toThrow('Invalid critic metric secondsToFirstDrop');
  });
});
