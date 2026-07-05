/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { constructWear } from '#server/core/entities/player/inventory-manager.js';

// Regression: constructWear runs inside the Player constructor on every login.
// A saved character can carry a worn item id that no longer exists in the item
// database (e.g. after an item-pack rename/overhaul). Destructuring the missing
// definition used to throw a TypeError and crash the entire player load, so the
// character could never log in again. Unknown slots must degrade to empty.

describe('constructWear', () => {
  it('hydrates a known worn item into a full slot object', () => {
    const wear = constructWear({ right_hand: 'bronze-sword', armor: null });

    expect(wear.armor).toBeNull();
    expect(wear.right_hand).toEqual(expect.objectContaining({
      id: 'bronze-sword',
      name: 'Bronze Sword',
    }));
    expect(wear.right_hand.uuid).toBeTruthy();
  });

  it('clears an unknown worn item id instead of crashing the login', () => {
    expect(() => constructWear({
      right_hand: 'a-removed-legacy-item-id',
      armor: 'bronze-sword',
    })).not.toThrow();

    const wear = constructWear({
      right_hand: 'a-removed-legacy-item-id',
      armor: 'bronze-sword',
    });

    expect(wear.right_hand).toBeNull();
    // valid siblings are still hydrated
    expect(wear.armor).toEqual(expect.objectContaining({ id: 'bronze-sword' }));
  });

  it('drops the arrows key and preserves explicit nulls', () => {
    const wear = constructWear({ arrows: 'bronze-arrow', head: null });
    expect(wear).not.toHaveProperty('arrows');
    expect(wear.head).toBeNull();
  });
});
