import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import InputController from '../../src/core/utilities/input-controller.js';
import { PLAYER_MOVE_SAMPLE_MS } from '#shared/movement.js';

const keyEvent = (key, extra = {}) => ({
  key,
  preventDefault: vi.fn(),
  ...extra,
});

describe('InputController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps displayed quickbar number keys to their skills while the canvas has focus', () => {
    const onSkill = vi.fn();
    const controller = new InputController({ onSkill });

    expect(controller.handleKeyDown(keyEvent('1'))).toBe(true);
    expect(controller.handleKeyDown(keyEvent('2'))).toBe(true);
    expect(controller.handleKeyDown(keyEvent('6'))).toBe(true);

    expect(onSkill).toHaveBeenNthCalledWith(1, expect.objectContaining({
      skillId: 'primary-attack',
      phase: 'start',
    }));
    expect(onSkill).toHaveBeenNthCalledWith(2, expect.objectContaining({
      skillId: 'dash',
      phase: 'start',
    }));
    expect(onSkill).toHaveBeenNthCalledWith(3, expect.objectContaining({
      skillId: 'ability-4',
      phase: 'start',
    }));
  });

  it('keeps legacy combat key aliases available', () => {
    const onSkill = vi.fn();
    const controller = new InputController({ onSkill });

    [' ', 'Shift', 'q', 'e', 'r', 'f'].forEach((key) => {
      expect(controller.handleKeyDown(keyEvent(key))).toBe(true);
    });

    expect(onSkill).toHaveBeenCalledTimes(6);
    expect(onSkill.mock.calls.map(([payload]) => payload.skillId)).toEqual([
      'primary-attack',
      'dash',
      'ability-1',
      'ability-2',
      'ability-3',
      'ability-4',
    ]);
  });

  it('ignores repeated press-skill keydown events', () => {
    const onSkill = vi.fn();
    const controller = new InputController({ onSkill });

    expect(controller.handleKeyDown(keyEvent('3'))).toBe(true);
    expect(controller.handleKeyDown(keyEvent('3', { repeat: true }))).toBe(true);

    expect(onSkill).toHaveBeenCalledTimes(1);
  });

  it('samples held cardinal and diagonal movement at the same continuous cadence', () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    const controller = new InputController({ onMove });

    controller.handleKeyDown(keyEvent('w'));
    expect(onMove).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PLAYER_MOVE_SAMPLE_MS);
    expect(onMove).toHaveBeenCalledTimes(2);

    controller.handleKeyDown(keyEvent('d'));
    expect(onMove).toHaveBeenLastCalledWith('up-right', { initial: true });
    const callsAtDiagonalStart = onMove.mock.calls.length;
    vi.advanceTimersByTime(PLAYER_MOVE_SAMPLE_MS);
    expect(onMove).toHaveBeenCalledTimes(callsAtDiagonalStart + 1);
    expect(onMove).toHaveBeenLastCalledWith('up-right', { repeated: true });

    controller.destroy();
  });
});
