import { describe, expect, it } from 'vitest';

import MovementController from '../../src/core/utilities/movement-controller.js';
import { TILE_SIZE } from '../../src/core/config/movement.js';

describe('MovementController', () => {
  it('applies server timing metadata with elapsed progress', () => {
    const controller = new MovementController();
    controller.initialise(0, 0, 0);

    const step = {
      startedAt: 100,
      duration: 150,
      sequence: 1,
    };

    const meta = {
      sentAt: 160,
      receivedAt: 200,
    };

    const applied = controller.applyServerStep(1, 0, step, meta);
    expect(applied).toBe(true);
    expect(controller.sequence).toBe(1);

    const position = controller.getPosition(meta.receivedAt);
    const expected = (0.5 * TILE_SIZE) + ((TILE_SIZE) * 0.4);
    expect(position.x).toBeCloseTo(expected, 3);
  });

  it('reaches the authoritative destination after the movement ETA', () => {
    const controller = new MovementController();
    controller.initialise(0, 0, 0);

    const step = {
      startedAt: 0,
      duration: 150,
      sequence: 1,
    };

    controller.applyServerStep(1, 0, step, { sentAt: 0, receivedAt: 0 });

    const endPosition = controller.update(step.duration + 10);
    expect(endPosition.x).toBeCloseTo(1.5 * TILE_SIZE, 5);
    expect(endPosition.y).toBeCloseTo(0.5 * TILE_SIZE, 5);
  });

  it('ignores stale sequences', () => {
    const controller = new MovementController();
    controller.initialise(0, 0, 0);

    const first = controller.applyServerStep(1, 0, {
      startedAt: 0,
      duration: 150,
      sequence: 1,
    }, { sentAt: 10, receivedAt: 10 });

    expect(first).toBe(true);

    const second = controller.applyServerStep(2, 0, {
      startedAt: 200,
      duration: 150,
      sequence: 1,
    }, { sentAt: 210, receivedAt: 220 });

    expect(second).toBe(false);
    expect(controller.tile.x).toBe(1);
  });

  it('hard syncs when movement is blocked', () => {
    const controller = new MovementController();
    controller.initialise(0, 0, 0);

    const step = {
      startedAt: 0,
      duration: 0,
      sequence: 1,
      blocked: true,
    };

    controller.applyServerStep(0, 0, step, { sentAt: 0, receivedAt: 50 });

    const position = controller.getPosition(1000);
    const expected = (0.5 * TILE_SIZE);
    expect(position.x).toBeCloseTo(expected, 5);
    expect(controller.sequence).toBe(1);
  });
});
