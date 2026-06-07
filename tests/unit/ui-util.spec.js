import { describe, expect, it } from 'vitest';
import UI from '#shared/ui.js';

describe('UI utilities', () => {
  describe('getOpenSlot', () => {
    it('returns 0 when inventory is empty', () => {
      expect(UI.getOpenSlot([])).toBe(0);
    });

    it('returns the first available slot and ignores invalid entries', () => {
      const inventory = [
        { slot: 0 },
        { slot: 2 },
        { slot: 'x' },
        {},
      ];

      expect(UI.getOpenSlot(inventory)).toBe(1);
    });

    it('returns false when the inventory is full', () => {
      const filled = Array.from({ length: 84 }, (_value, index) => ({ slot: index }));

      expect(UI.getOpenSlot(filled)).toBe(false);
    });

    it('returns false for unknown locations', () => {
      expect(UI.getOpenSlot([], 'unknown')).toBe(false);
    });

    it('uses item footprint placement when an inventory item is provided', () => {
      const inventory = [
        { id: 'iron-halberd', slot: 0, type: 'weapon', twoHanded: true },
      ];

      expect(UI.getOpenSlot(inventory, 'inventory', { id: 'coins', stackable: true })).toBe(2);
    });
  });
});
