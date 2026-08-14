/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Monster from '#server/core/monster.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const SCENE_ID = 'test:boss-ground-slam';

const makePlayer = () => ({
  uuid: 'ground-slam-target',
  socket_id: 'ground-slam-socket',
  username: 'Target',
  x: 11,
  y: 10,
  sceneId: SCENE_ID,
  combat: {},
  stats: {
    resources: {
      health: { current: 100, max: 100 },
      mana: { current: 50, max: 50 },
    },
    lifecycle: { state: 'alive' },
  },
  setAnimationState: vi.fn(),
  applyDamage: vi.fn(amount => ({ type: 'damage', amount })),
});

const makeBoss = () => new Monster({
  id: 'warden-test',
  name: 'Warden of the Deep',
  level: 4,
  archetype: 'brute',
  rarity: 'elite',
  sceneId: SCENE_ID,
  spawn: { x: 10, y: 10, radius: 0 },
  behaviour: {
    type: 'melee',
    attack: {
      range: 1,
      intervalMs: 1500,
      windupMs: 1000,
      skillId: 'boss:ground-slam',
      skillName: 'Ground Slam',
      radius: 2.5,
    },
  },
});

describe('boss ground slam', () => {
  let boss;
  let player;

  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    boss = makeBoss();
    player = makePlayer();
    const scene = world.ensureScene(SCENE_ID, {
      type: 'test',
      map: { background: [], foreground: [] },
      monsters: [boss],
    });
    scene.players = [player];
  });

  afterEach(() => {
    world.scenes.delete(SCENE_ID);
    vi.restoreAllMocks();
  });

  it('broadcasts its radius and dodge window before damage', () => {
    expect(boss.tryAttack(player, 5_000)).toBe(true);
    expect(Socket.broadcast).toHaveBeenCalledWith(
      'monster:telegraph',
      expect.objectContaining({
        attackerId: boss.uuid,
        skillId: 'boss:ground-slam',
        radius: 2.5,
        durationMs: 1000,
      }),
      [player],
    );
    expect(player.applyDamage).not.toHaveBeenCalled();
  });

  it('misses a target who leaves the announced circle', () => {
    boss.tryAttack(player, 5_000);
    player.x = 13;

    expect(boss.resolvePendingAttack(6_000)).toBe(false);
    expect(player.applyDamage).not.toHaveBeenCalled();
  });

  it('labels the impact when a target remains inside', () => {
    boss.tryAttack(player, 5_000);

    expect(boss.resolvePendingAttack(6_000)).toBe(true);
    expect(player.applyDamage).toHaveBeenCalledOnce();
    expect(Socket.broadcast).toHaveBeenCalledWith(
      'combat:hit',
      expect.objectContaining({
        attackerId: boss.uuid,
        skillId: 'boss:ground-slam',
        skillName: 'Ground Slam',
        attackStyle: 'crush',
      }),
      [player],
    );
  });
});
