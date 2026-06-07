import { describe, expect, it, vi } from 'vitest';

import InputController from '../../src/core/utilities/input-controller.js';

const keyEvent = (key, extra = {}) => ({
  key,
  preventDefault: vi.fn(),
  ...extra,
});

describe('InputController', () => {
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
});
