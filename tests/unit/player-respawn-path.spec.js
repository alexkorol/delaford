/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import createPlayerStatsManager from '#server/core/entities/player/stats-manager.js';

// Regression: clicking around while dead used to queue a walking path that
// executed on respawn, striding the reborn character across the map. A real
// respawn must drop any stale path/queue.

const makeDeadPlayerWithPath = () => {
  const player = {
    uuid: 'player-1',
    level: 3,
    stats: {
      level: 3,
      attributes: { total: { strength: 10, dexterity: 10, intelligence: 10 } },
      resources: {
        health: { current: 0, max: 100 },
        mana: { current: 0, max: 40 },
      },
      lifecycle: {
        state: 'awaiting-respawn',
        respawn: {
          pending: true,
          at: 0,
          healthFraction: 0.5,
          manaFraction: 0.5,
        },
      },
    },
    path: {
      current: {
        walking: [{ x: 40, y: 40 }, { x: 41, y: 40 }, { x: 42, y: 40 }],
        set: [{ x: 42, y: 40 }],
        step: 1,
        length: 3,
        walkable: true,
        interrupted: false,
      },
    },
    queue: [{ action: 'walk' }],
  };
  return player;
};

describe('respawn clears a stale walking path', () => {
  it('drops the walking path and queue on a successful respawn', () => {
    const player = makeDeadPlayerWithPath();
    const stats = createPlayerStatsManager(player);

    const result = stats.tryRespawn({ force: true, now: Date.now() });

    expect(result.success).toBe(true);
    expect(player.stats.lifecycle.state).toBe('alive');
    expect(player.path.current.walking).toEqual([]);
    expect(player.path.current.set).toEqual([]);
    expect(player.path.current.walkable).toBe(false);
    expect(player.queue).toEqual([]);
  });

  it('leaves the path untouched when respawn is not ready', () => {
    const player = makeDeadPlayerWithPath();
    player.stats.lifecycle.respawn.at = Date.now() + 60000; // not ready yet
    const stats = createPlayerStatsManager(player);

    const result = stats.tryRespawn({ now: Date.now() });

    expect(result.success).toBe(false);
    expect(player.path.current.walking).toHaveLength(3);
  });
});
