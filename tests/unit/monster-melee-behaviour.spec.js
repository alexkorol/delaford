import { describe, it, expect, vi, beforeEach } from 'vitest';

import registerMeleeBehaviour from '../../server/core/entities/monster/behaviours/melee.js';
import { createWorld } from '../../server/core/entities/ai/ecs-lite.js';
import {
  euclideanDistance,
  manhattanDistance,
} from '../../server/core/entities/monster/movement-handler.js';

describe('melee behaviour', () => {
  let world;
  let entity;
  let monster;

  beforeEach(() => {
    world = createWorld();
    entity = world.createEntity('monster-1');

    monster = {
      id: 'monster-1',
      x: 5,
      y: 5,
      spawn: { x: 5, y: 5 },
      state: {
        mode: null,
        pendingAttack: null,
        respawnAt: null,
      },
      behaviour: {},
      isAlive: true,
      respawn: { delayMs: 5_000 },
      respawnNow: vi.fn(),
      resolvePendingAttack: vi.fn(() => false),
      resolveTarget: vi.fn(() => null),
      tryAttack: vi.fn(() => true),
      pursue: vi.fn(() => true),
      returnToSpawn: vi.fn(() => true),
      patrol: vi.fn(() => true),
    };
  });

  it('registers components and a system on the ECS world', () => {
    const system = registerMeleeBehaviour({ world, entity, monster });

    expect(system).toBeTypeOf('function');
    expect(world.systems).toHaveLength(1);
    expect(world.systems[0]).toBe(system);

    expect(entity.getComponent('behaviour')).toEqual({ type: 'melee' });
    expect(entity.getComponent('lifecycle')).toEqual({ dirty: false });
    expect(entity.getComponent('monster')).toEqual({ ref: monster });
  });

  it('patrols when alive with no target and at spawn', () => {
    registerMeleeBehaviour({ world, entity, monster });

    world.update(16, { now: 1_000 });

    expect(monster.resolveTarget).toHaveBeenCalledWith(1_000);
    expect(monster.patrol).toHaveBeenCalledWith(1_000);
    expect(monster.state.mode).toBe('patrolling');

    const lifecycle = entity.getComponent('lifecycle');
    expect(lifecycle.dirty).toBe(true);
  });

  it('engages and attacks when target is within melee range', () => {
    const target = { x: 5, y: 6 };
    monster.resolveTarget.mockReturnValue(target);

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 2_000 });

    expect(monster.state.mode).toBe('engaged');
    expect(monster.tryAttack).toHaveBeenCalledWith(target, 2_000);
    expect(monster.pursue).not.toHaveBeenCalled();
  });

  it('engages and pursues when target is beyond melee range', () => {
    const target = { x: 10, y: 10 };
    monster.resolveTarget.mockReturnValue(target);

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 3_000 });

    expect(monster.state.mode).toBe('engaged');
    expect(monster.pursue).toHaveBeenCalledWith(target, 3_000);
    expect(monster.tryAttack).not.toHaveBeenCalled();
  });

  it('returns to spawn when away from spawn with no target', () => {
    monster.x = 20;
    monster.y = 20;

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 4_000 });

    expect(monster.state.mode).toBe('returning');
    expect(monster.returnToSpawn).toHaveBeenCalledWith(4_000);
    expect(monster.patrol).not.toHaveBeenCalled();
  });

  it('sets respawn timer when monster is dead', () => {
    monster.isAlive = false;

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 10_000 });

    expect(monster.state.respawnAt).toBe(15_000);
    expect(monster.respawnNow).not.toHaveBeenCalled();

    const lifecycle = entity.getComponent('lifecycle');
    expect(lifecycle.dirty).toBe(true);
  });

  it('calls respawnNow when respawn timer expires', () => {
    monster.isAlive = false;
    monster.state.respawnAt = 9_000;

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 10_000 });

    expect(monster.respawnNow).toHaveBeenCalledWith(10_000);
  });

  it('does not respawn if timer has not elapsed', () => {
    monster.isAlive = false;
    monster.state.respawnAt = 20_000;

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 10_000 });

    expect(monster.respawnNow).not.toHaveBeenCalled();
  });

  it('resolves pending attack before other behaviour', () => {
    monster.state.pendingAttack = { resolveAt: 500 };
    monster.resolvePendingAttack.mockReturnValueOnce(true);

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 1_000 });

    expect(monster.resolvePendingAttack).toHaveBeenCalledWith(1_000);
    // Should still continue to patrol after resolving
    expect(monster.patrol).toHaveBeenCalled();
  });

  it('skips pending attack if timer has not elapsed', () => {
    monster.state.pendingAttack = { resolveAt: 5_000 };

    registerMeleeBehaviour({ world, entity, monster });
    world.update(16, { now: 1_000 });

    expect(monster.resolvePendingAttack).not.toHaveBeenCalled();
  });

  it('resets lifecycle.dirty to false at the start of each tick', () => {
    registerMeleeBehaviour({ world, entity, monster });

    const lifecycle = entity.getComponent('lifecycle');
    lifecycle.dirty = true;

    monster.patrol.mockReturnValue(false);
    world.update(16, { now: 1_000 });

    // patrol returned false so dirty should stay false (was reset at tick start)
    expect(lifecycle.dirty).toBe(false);
  });
});

describe('movement-handler distance utilities', () => {
  it('computes euclidean distance correctly', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(euclideanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
  });

  it('computes manhattan distance correctly', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    expect(manhattanDistance({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(1);
  });

  it('handles missing coordinate properties gracefully', () => {
    expect(euclideanDistance({}, {})).toBe(0);
    expect(manhattanDistance({}, { x: 3 })).toBe(3);
  });
});
