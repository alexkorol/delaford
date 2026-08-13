/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { constructWear } from '#server/core/entities/player/inventory-manager.js';
import ItemFactory from '#server/core/items/factory.js';
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

  it('preserves a rich equipped instance and immediately restores its rolled combat stats', () => {
    const saved = {
      id: 'bronze-sword',
      uuid: 'rolled-sword-1',
      name: 'Gleaming Bronze Sword of Sparks',
      displayName: 'Gleaming Bronze Sword of Sparks',
      slot: 13,
      boundTo: 'account-1',
      stats: {
        attack: { stab: 3, slash: 19, crush: 0, range: 0 },
        defense: { stab: 1, slash: 2, crush: 0, range: 0 },
      },
      affixes: { brand: { id: 'gleaming' }, bond: { id: 'sparks' } },
      vessel: { material: 'Bronze', item: { id: 'vessel-1' } },
    };
    const wear = constructWear({ right_hand: saved, armor: null });
    const combat = Wear.calculateCombat(wear);

    expect(wear.right_hand).toEqual(expect.objectContaining({
      id: 'bronze-sword',
      uuid: 'rolled-sword-1',
      name: 'Gleaming Bronze Sword of Sparks',
      boundTo: 'account-1',
      affixes: saved.affixes,
      vessel: saved.vessel,
      equipSlot: 'right_hand',
      slotType: 'right_hand',
    }));
    expect(wear.right_hand).not.toHaveProperty('slot');
    expect(combat.attack.slash).toBe(19);
    expect(combat.defense.slash).toBe(2);
  });

  it('drops the arrows key and preserves explicit nulls', () => {
    const wear = constructWear({ arrows: 'bronze-arrow', head: null });
    expect(wear).not.toHaveProperty('arrows');
    expect(wear.head).toBeNull();
  });

  it('restores an equipped Vessel shield block chance without rerolling it', () => {
    const shield = ItemFactory.createById('vessel-shield', { rng: () => 0, itemLevel: 10 });
    const wear = constructWear({ left_hand: shield });
    const combat = Wear.calculateCombat(wear);

    expect(wear.left_hand.uuid).toBe(shield.uuid);
    expect(wear.left_hand.combatBonuses.blockChance).toBe(4);
    expect(wear.left_hand.vessel.lines.some(line => line.section === 'implicit'
      && /Chance to Block/.test(line.text))).toBe(true);
    expect(combat.blockChance).toBe(4);
  });

  it('restores equipped Beastbane damage without rerolling the weapon', () => {
    const seededRng = (() => {
      let state = 19;
      return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const weapon = ItemFactory.createById('vessel-handaxe', {
      rng: seededRng,
      itemLevel: 40,
    });
    const wear = constructWear({ right_hand: weapon });
    const combat = Wear.calculateCombat(wear);

    expect(wear.right_hand.uuid).toBe(weapon.uuid);
    expect(wear.right_hand.combatBonuses.damageAgainstBeasts).toBe(14);
    expect(combat.damageAgainstBeasts).toBe(14);
  });
});
