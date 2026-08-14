/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  createFreshScionProfile,
  createScionSessionProfile,
} from '#server/core/entities/player/fresh-scion-profile.js';
import { WEAR_SLOTS } from '#server/shared/wear-slots.js';

describe('fresh Scion profiles', () => {
  it('starts each character with isolated, authored starter gear', () => {
    const first = createFreshScionProfile({ username: 'Mara', uuid: 'scion-mara' });
    const second = createFreshScionProfile({ username: 'Orun', uuid: 'scion-orun' });

    expect(first.level).toBe(1);
    expect(first.bank).toEqual([]);
    expect(first.passiveTree).toBeNull();
    expect(first.inventory.map(item => item.id)).toEqual(['bronze-dagger', 'coins']);
    expect(first.inventory.some(item => item.id.includes('pickaxe') || item.id === 'bronze-bar'))
      .toBe(false);
    expect(first.inventory[0]).toMatchObject({
      boundTo: 'scion-mara',
      size: { width: 1, height: 2 },
    });
    expect(first.inventory[0].actions).toEqual([
      'take', 'examine', 'drop', 'equip', 'unequip',
      'deposit', 'withdraw', 'buy', 'sell', 'value',
    ]);
    expect(first.inventory.map(item => item.uuid)).not.toEqual(second.inventory.map(item => item.uuid));
    expect(Object.keys(first.wear)).toEqual(WEAR_SLOTS);
    expect(Object.values(first.wear).every(item => item === null)).toBe(true);
  });

  it('never treats account progression as a new Scion snapshot', () => {
    const contaminatedAccount = {
      level: 42,
      inventory: [
        { id: 'bronze-pickaxe', uuid: 'legacy-pickaxe' },
        { id: 'bronze-bar', uuid: 'legacy-bars', qty: 99 },
      ],
      wear: { right_hand: { id: 'steel-sword', uuid: 'old-sword' } },
      bank: [{ id: 'gold-ring', uuid: 'old-bank-item' }],
      passiveTree: { nodes: ['old-build'] },
      friend_list: ['friend-account'],
    };
    const fresh = createScionSessionProfile({
      accountProfile: contaminatedAccount,
      scion: { id: 'new-scion', name: 'Newblood' },
    });

    expect(fresh).toMatchObject({
      uuid: 'new-scion',
      username: 'Newblood',
      level: 1,
      bank: [],
      passiveTree: null,
      friend_list: ['friend-account'],
    });
    expect(fresh.inventory.map(item => item.id)).toEqual(['bronze-dagger', 'coins']);
    expect(Object.values(fresh.wear).every(item => item === null)).toBe(true);
  });

  it('restores progression only from that Scion\'s saved snapshot', () => {
    const saved = {
      level: 8,
      inventory: [{ id: 'vessel-handaxe', uuid: 'saved-axe' }],
      bank: [{ id: 'gold-ring', uuid: 'saved-ring' }],
      passiveTree: { nodes: ['0,0'] },
    };
    const resumed = createScionSessionProfile({
      accountProfile: { level: 99, inventory: [{ id: 'bronze-bar' }] },
      snapshot: saved,
      scion: { id: 'saved-scion', name: 'Veteran' },
    });

    expect(resumed).toMatchObject({
      uuid: 'saved-scion',
      username: 'Veteran',
      level: 8,
      inventory: [{ id: 'vessel-handaxe', uuid: 'saved-axe' }],
      bank: [{ id: 'gold-ring', uuid: 'saved-ring' }],
      passiveTree: { nodes: ['0,0'] },
    });
  });
});
