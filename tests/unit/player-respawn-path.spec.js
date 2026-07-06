/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import createPlayerStatsManager from '#server/core/entities/player/stats-manager.js';
import createPlayerMovementHandler from '#server/core/entities/player/movement-handler.js';

// Regression (twice over): clicking around while dead used to queue a walking
// path that executed on respawn. The first "fix" cleared path.current.walking
// — but the walk loop reads path.current.path.walking and is keyed on walkId,
// so the stale route STILL resumed (observed live). Respawn now goes through
// the real cancelPathfinding: walkId bump + nested arrays + queue.

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
    // The REAL path shape from the Player constructor.
    path: {
      grid: {},
      current: {
        name: '',
        length: 3,
        path: {
          walking: [{ x: 40, y: 40 }, { x: 41, y: 40 }, { x: 42, y: 40 }],
          set: [{ x: 42, y: 40 }],
        },
        step: 1,
        walkable: true,
        interrupted: false,
        walkId: 7,
      },
    },
    queue: [{ action: 'walk' }],
    moving: true,
  };
  const movement = createPlayerMovementHandler(player);
  player.cancelPathfinding = () => movement.cancelPathfinding();
  return player;
};

describe('respawn clears a stale walking path', () => {
  it('drops the walking path, bumps walkId, and empties the queue on respawn', () => {
    const player = makeDeadPlayerWithPath();
    const stats = createPlayerStatsManager(player);

    const result = stats.tryRespawn({ force: true, now: Date.now() });

    expect(result.success).toBe(true);
    expect(player.stats.lifecycle.state).toBe('alive');
    expect(player.path.current.path.walking).toEqual([]);
    expect(player.path.current.path.set).toEqual([]);
    expect(player.path.current.walkId).toBe(8); // invalidates the walk loop
    expect(player.queue).toEqual([]);
    expect(player.moving).toBe(false);
  });

  it('leaves the path untouched when respawn is not ready', () => {
    const player = makeDeadPlayerWithPath();
    player.stats.lifecycle.respawn.at = Date.now() + 60000; // not ready yet
    const stats = createPlayerStatsManager(player);

    const result = stats.tryRespawn({ now: Date.now() });

    expect(result.success).toBe(false);
    expect(player.path.current.path.walking).toHaveLength(3);
    expect(player.path.current.walkId).toBe(7);
  });
});
