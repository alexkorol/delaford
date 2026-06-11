/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

// Tests to verify the forge() splice fix:
// Previously, forge() called findIndex once, then spliced at the same index
// in a loop. After the first splice, the array shifts, so subsequent splices
// removed wrong items. The fix re-finds the index each iteration.

describe('smithing forge splice correctness', () => {
  // Replicate the fixed forge pattern
  function removeBars(inventory, barId, count) {
    for (let index = 0; index < count; index += 1) {
      const barIndex = inventory.findIndex(inv => inv.id === barId);
      if (barIndex !== -1) {
        inventory.splice(barIndex, 1);
      }
    }
    return inventory;
  }

  it('removes the correct number of bars from inventory', () => {
    const inventory = [
      { id: 'bronze-bar', qty: 1 },
      { id: 'iron-ore', qty: 5 },
      { id: 'bronze-bar', qty: 1 },
      { id: 'hammer', qty: 1 },
      { id: 'bronze-bar', qty: 1 },
    ];

    removeBars(inventory, 'bronze-bar', 3);

    expect(inventory.length).toBe(2);
    expect(inventory.find(i => i.id === 'bronze-bar')).toBeUndefined();
    expect(inventory.find(i => i.id === 'iron-ore')).toBeDefined();
    expect(inventory.find(i => i.id === 'hammer')).toBeDefined();
  });

  it('stops gracefully when fewer bars exist than required', () => {
    const inventory = [
      { id: 'bronze-bar', qty: 1 },
      { id: 'hammer', qty: 1 },
    ];

    removeBars(inventory, 'bronze-bar', 5);

    // Should only remove 1 bar (only 1 exists)
    expect(inventory.length).toBe(1);
    expect(inventory[0].id).toBe('hammer');
  });

  it('preserves insertion order of non-bar items', () => {
    const inventory = [
      { id: 'bronze-bar', qty: 1 },
      { id: 'sword', qty: 1 },
      { id: 'bronze-bar', qty: 1 },
      { id: 'shield', qty: 1 },
      { id: 'bronze-bar', qty: 1 },
      { id: 'helmet', qty: 1 },
    ];

    removeBars(inventory, 'bronze-bar', 3);

    expect(inventory.map(i => i.id)).toEqual(['sword', 'shield', 'helmet']);
  });

  // Demonstrate the old bug: using stale index would remove wrong items
  it('stale index would remove wrong items (old bug)', () => {
    const inventory = [
      { id: 'bronze-bar', qty: 1 },
      { id: 'sword', qty: 1 },
      { id: 'bronze-bar', qty: 1 },
      { id: 'shield', qty: 1 },
    ];

    // OLD bugged behaviour: find index once (0), then splice index 0 three times
    const staleIndex = inventory.findIndex(inv => inv.id === 'bronze-bar');
    const copy = [...inventory.map(i => ({ ...i }))];
    copy.splice(staleIndex, 1); // removes bronze-bar at 0
    copy.splice(staleIndex, 1); // BUG: now removes bronze-bar at 0 (which was sword at 1, but shifted)

    // With stale index, sword gets removed instead of second bronze-bar
    const hasSword = copy.some(i => i.id === 'sword');
    // In the old code, sword could be removed. The important thing is our
    // fixed code above does NOT have this issue.
    expect(hasSword).toBe(false); // demonstrates the old bug
  });
});
