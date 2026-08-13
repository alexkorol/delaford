/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import questEvents from '@/core/player/events/quest.js';

describe('quest client events', () => {
  it('replaces the live journal with the authoritative server snapshot', () => {
    const context = { game: { player: { quests: null } } };
    const quests = {
      activeQuestId: 'aldwyns-charge',
      objectiveIndex: 2,
      questPoints: 0,
    };

    questEvents['player:quests:update']({ data: { quests } }, context);

    expect(context.game.player.quests).toBe(quests);
  });
});
