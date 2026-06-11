import { describe, it, expect } from 'vitest';

import Handler from '../../server/player/handler.js';

describe('Handler dispatch safety', () => {
  it('is a plain object with string-keyed event handlers', () => {
    expect(Handler).toBeTypeOf('object');
    expect(Handler).not.toBeNull();

    const keys = Object.keys(Handler);
    expect(keys.length).toBeGreaterThan(0);

    keys.forEach((key) => {
      expect(key).toBeTypeOf('string');
      expect(Handler[key]).toBeTypeOf('function');
    });
  });

  it('does not expose inherited Object prototype methods as handlers', () => {
    const dangerousKeys = [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
      '__defineGetter__',
      '__defineSetter__',
    ];

    dangerousKeys.forEach((key) => {
      expect(
        Object.prototype.hasOwnProperty.call(Handler, key),
      ).toBe(false);
    });
  });

  it('contains the expected core event handlers', () => {
    const expectedEvents = [
      'player:login',
      'player:logout',
      'player:say',
      'player:move',
      'player:queueAction',
      'player:context-menu:build',
      'player:context-menu:action',
      'player:walk-here',
      'player:take',
      'player:inventory-drop',
      'player:examine',
    ];

    expectedEvents.forEach((event) => {
      expect(
        Object.prototype.hasOwnProperty.call(Handler, event),
        `Handler should have "${event}"`,
      ).toBe(true);
    });
  });

  it('all handler values are functions (not accidental data leaks)', () => {
    Object.entries(Handler).forEach(([key, value]) => {
      expect(value, `Handler["${key}"] should be a function`).toBeTypeOf('function');
    });
  });

  it('hasOwnProperty check correctly distinguishes own vs inherited props', () => {
    // Simulates the guard we added in Delaford.js connection handler
    const hasOwn = (event) => Object.prototype.hasOwnProperty.call(Handler, event);

    expect(hasOwn('player:login')).toBe(true);
    expect(hasOwn('player:move')).toBe(true);

    expect(hasOwn('constructor')).toBe(false);
    expect(hasOwn('toString')).toBe(false);
    expect(hasOwn('nonexistent:event')).toBe(false);
  });
});
