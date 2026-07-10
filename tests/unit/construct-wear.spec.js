/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { constructWear } from '#server/core/entities/player/inventory-manager.js';
import Wear from '#server/core/utilities/wear.js';

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

  it('rebuilds combat bonuses from persisted worn gear before world insertion', () => {
    const player = {
      wear: constructWear({ right_hand: 'steel-sword', armor: null }),
    };

    expect(Wear.updateCombat(player)).toMatchObject({
      attack: { stab: 11, slash: 8, crush: 2, range: 0 },
      defense: { stab: 0, slash: 4, crush: 3, range: 0 },
    });
  });

  it('preserves the identity and rolled stats of a full persisted item', () => {
    const wear = constructWear({
      right_hand: {
        id: 'steel-battleaxe',
        uuid: 'rolled-axe-1',
        displayName: 'The Long Road',
        stats: {
          attack: { stab: -2, slash: 23, crush: 15, range: 0 },
          defense: { stab: 0, slash: 1, crush: 2, range: 2 },
        },
        affixes: { brand: { id: 'heavy' } },
      },
    });

    expect(wear.right_hand).toMatchObject({
      id: 'steel-battleaxe',
      uuid: 'rolled-axe-1',
      displayName: 'The Long Road',
      stats: { attack: { slash: 23 } },
      affixes: { brand: { id: 'heavy' } },
    });
    expect(Wear.updateCombat({ wear }).attack.slash).toBe(23);
  });
});
