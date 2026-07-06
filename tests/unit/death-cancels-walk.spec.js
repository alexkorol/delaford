/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/core/world.js', () => ({
  default: {
    players: [],
    getScenePlayers: () => [],
    getScene: () => null,
    getSceneForPlayer: () => null,
  },
}));

vi.mock('#server/socket.js', () => ({
  default: { emit: vi.fn(), broadcast: vi.fn() },
}));

const { default: createPlayerStatsManager } = await import('#server/core/entities/player/stats-manager.js');
const { createCharacterState } = await import('#shared/stats/index.js');

// Playtest feedback: "there's still a movement queue that can activate after
// death/resurrection". The old respawn cleanup wrote to path.current.walking,
// but the walk loop reads path.current.path.walking and is keyed on walkId —
// so the stale route resumed after respawn. Death and respawn must both go
// through cancelPathfinding (walkId bump + queue clear).

describe('death and respawn cancel in-flight walking', () => {
  let player;
  let manager;

  beforeEach(() => {
    player = {
      uuid: 'walker-1',
      username: 'Walker',
      cancelPathfinding: vi.fn(),
      stats: createCharacterState({
        level: 1,
        attributes: { base: { strength: 10, dexterity: 10, intelligence: 10 } },
      }),
    };
    manager = createPlayerStatsManager(player);
  });

  it('cancels the walk the moment a hit kills the player', () => {
    const result = manager.applyDamage(9999, { now: 1000, allowCheatDeath: false });
    expect(result.type).toBe('death');
    expect(player.cancelPathfinding).toHaveBeenCalledTimes(1);
  });

  it('does not cancel walking on a survivable hit', () => {
    const result = manager.applyDamage(5, { now: 1000 });
    expect(result.type).toBe('damage');
    expect(player.cancelPathfinding).not.toHaveBeenCalled();
  });

  it('cancels again on respawn so nothing stale resumes', () => {
    manager.applyDamage(9999, { now: 1000, allowCheatDeath: false });
    player.cancelPathfinding.mockClear();

    const result = manager.tryRespawn({ now: 999999, force: true });
    expect(result.success).toBe(true);
    expect(player.cancelPathfinding).toHaveBeenCalledTimes(1);
  });
});
