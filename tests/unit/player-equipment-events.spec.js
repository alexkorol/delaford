import { describe, expect, it } from 'vitest';

import playerEvents from '@/core/player/events/player.js';

describe('player equipment event handlers', () => {
  const makeContext = () => ({
    game: {
      player: {
        uuid: 'player-1',
        inventory: [],
        wear: {},
        combat: {},
        stats: {
          level: 1,
          resources: {
            health: { current: 80, max: 100 },
            mana: { current: 20, max: 40 },
          },
          lifecycle: { state: 'alive' },
        },
      },
    },
  });

  it('applies refreshed stats and resources after equipping gear', () => {
    const context = makeContext();
    const stats = {
      level: 3,
      resources: {
        health: { current: 80, max: 130 },
        mana: { current: 20, max: 50 },
      },
      lifecycle: { state: 'alive' },
    };

    playerEvents['player:equippedAnItem']({
      data: {
        uuid: 'player-1',
        inventory: { slots: [{ uuid: 'item-1' }] },
        wear: { right_hand: { uuid: 'sword-1' } },
        combat: { attack: { slash: 3 } },
        stats,
      },
    }, context);

    expect(context.game.player.inventory).toEqual([{ uuid: 'item-1' }]);
    expect(context.game.player.wear.right_hand.uuid).toBe('sword-1');
    expect(context.game.player.combat.attack.slash).toBe(3);
    expect(context.game.player.stats).toBe(stats);
    expect(context.game.player.level).toBe(3);
    expect(context.game.player.hp).toEqual({ current: 80, max: 130 });
    expect(context.game.player.mana).toEqual({ current: 20, max: 50 });
    expect(context.game.player.lifecycle).toEqual({ state: 'alive' });
  });

  it('applies refreshed stats and resources after unequipping gear', () => {
    const context = makeContext();
    const stats = {
      resources: {
        health: { current: 80, max: 110 },
        mana: { current: 20, max: 40 },
      },
      lifecycle: { state: 'alive' },
    };

    playerEvents['player:unequippedAnItem']({
      data: {
        uuid: 'player-1',
        inventory: { slots: [{ uuid: 'sword-1' }] },
        wear: { right_hand: null },
        combat: { attack: { slash: 0 } },
        stats,
      },
    }, context);

    expect(context.game.player.inventory).toEqual([{ uuid: 'sword-1' }]);
    expect(context.game.player.wear.right_hand).toBeNull();
    expect(context.game.player.stats).toBe(stats);
    expect(context.game.player.hp).toEqual({ current: 80, max: 110 });
  });

  it('syncs top-level level from stats broadcasts', () => {
    const context = makeContext();
    context.game.player.level = 1;
    const stats = {
      level: 4,
      resources: {
        health: { current: 112, max: 112 },
        mana: { current: 54, max: 54 },
      },
      lifecycle: { state: 'alive' },
    };

    playerEvents['player:stats:update']({
      data: {
        playerId: 'player-1',
        stats,
        resources: stats.resources,
        lifecycle: stats.lifecycle,
      },
    }, context);

    expect(context.game.player.stats).toBe(stats);
    expect(context.game.player.level).toBe(4);
    expect(context.game.player.hp).toEqual({ current: 112, max: 112 });
    expect(context.game.player.mana).toEqual({ current: 54, max: 54 });
  });
});
