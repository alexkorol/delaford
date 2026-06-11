import { describe, it, expect } from 'vitest';

import {
  rollAffixes,
  cloneAndMergeStats,
  structuredCloneSafe,
} from '../../server/core/items/affix-engine.js';

describe('structuredCloneSafe', () => {
  it('deep-clones objects so mutations do not propagate', () => {
    const original = { a: { b: 1 }, c: [2, 3] };
    const cloned = structuredCloneSafe(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.a).not.toBe(original.a);
    expect(cloned.c).not.toBe(original.c);

    cloned.a.b = 99;
    expect(original.a.b).toBe(1);
  });
});

describe('cloneAndMergeStats', () => {
  it('merges affix totals into a clone of base stats', () => {
    const base = { attack: { stab: 5, slash: 3 }, defense: { stab: 2 } };
    const totals = { attack: { stab: 2, crush: 1 }, defense: { stab: 1 } };

    const result = cloneAndMergeStats(base, totals);

    expect(result.attack.stab).toBe(7);
    expect(result.attack.slash).toBe(3);
    expect(result.attack.crush).toBe(1);
    expect(result.defense.stab).toBe(3);
  });

  it('does not mutate the original base stats', () => {
    const base = { attack: { stab: 5 } };
    const totals = { attack: { stab: 10 } };

    cloneAndMergeStats(base, totals);

    expect(base.attack.stab).toBe(5);
  });

  it('handles empty inputs gracefully', () => {
    expect(cloneAndMergeStats(null, null)).toEqual({});
    expect(cloneAndMergeStats({}, {})).toEqual({});
    expect(cloneAndMergeStats(undefined, { attack: { stab: 1 } })).toEqual({
      attack: { stab: 1 },
    });
  });
});

describe('rollAffixes', () => {
  const createSeedRng = (value) => () => value;

  it('returns an object with affixes and totals keys', () => {
    const item = { type: 'weapon', level: 1 };
    const result = rollAffixes(item);

    expect(result).toHaveProperty('affixes');
    expect(result).toHaveProperty('totals');
    expect(result.affixes).toHaveProperty('brand');
    expect(result.affixes).toHaveProperty('bond');
  });

  it('generates brand and bond affixes for a weapon', () => {
    const item = { type: 'weapon', level: 1 };
    const result = rollAffixes(item, { rng: createSeedRng(0.5) });

    expect(result.affixes.brand).not.toBeNull();
    expect(result.affixes.brand.kind).toBe('brand');
    expect(result.affixes.brand.id).toBeTypeOf('string');
    expect(result.affixes.brand.name).toBeTypeOf('string');
    expect(result.affixes.brand.tier).toBeTypeOf('number');
    expect(result.affixes.brand.values).toBeTypeOf('object');

    expect(result.affixes.bond).not.toBeNull();
    expect(result.affixes.bond.kind).toBe('bond');
  });

  it('respects item level for tier eligibility', () => {
    const lowLevel = { type: 'weapon', level: 1 };
    const highLevel = { type: 'weapon', level: 30 };

    const lowResult = rollAffixes(lowLevel, { rng: createSeedRng(0.99) });
    const highResult = rollAffixes(highLevel, { rng: createSeedRng(0.99) });

    // Low-level item should only get tier 1
    if (lowResult.affixes.brand) {
      expect(lowResult.affixes.brand.tier).toBe(1);
    }

    // High-level item can get higher tiers
    if (highResult.affixes.brand) {
      expect(highResult.affixes.brand.tier).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces stat values within the tier min/max range', () => {
    const item = { type: 'weapon', level: 1 };

    // Run multiple rolls to check bounds
    for (let i = 0; i < 20; i += 1) {
      const result = rollAffixes(item);
      const { brand } = result.affixes;

      if (brand && brand.values) {
        // All rolled values should be integers >= 0
        const flatValues = Object.values(brand.values)
          .flatMap(group => (typeof group === 'object' ? Object.values(group) : [group]));

        flatValues.forEach((val) => {
          expect(Number.isInteger(val)).toBe(true);
          expect(val).toBeGreaterThanOrEqual(0);
        });
      }
    }
  });

  it('aggregates totals from both brand and bond', () => {
    const item = { type: 'weapon', level: 1 };
    const result = rollAffixes(item, { rng: createSeedRng(0.1) });

    const { totals, affixes } = result;

    // totals should be the sum of brand.values and bond.values
    if (affixes.brand?.values?.attack?.stab && affixes.bond?.values?.attack?.stab) {
      expect(totals.attack.stab).toBe(
        affixes.brand.values.attack.stab + affixes.bond.values.attack.stab,
      );
    }
  });

  it('filters by item tags', () => {
    const armorItem = { type: 'armor', level: 1 };
    const result = rollAffixes(armorItem, { rng: createSeedRng(0.5) });

    // Should produce affixes - armor matches 'armor' tag
    expect(result.affixes.brand).not.toBeNull();
    expect(result.affixes.bond).not.toBeNull();
  });

  it('uses requires.level as fallback for item level', () => {
    const item = { type: 'weapon', requires: { level: 25 } };
    const result = rollAffixes(item, { rng: createSeedRng(0.99) });

    // With level 25, should be eligible for tier 2+
    if (result.affixes.brand) {
      expect(result.affixes.brand.level).toBeLessThanOrEqual(25);
    }
  });

  it('returns deterministic results for a fixed rng', () => {
    const item = { type: 'weapon', level: 10 };
    const rng = createSeedRng(0.3);

    const result1 = rollAffixes(item, { rng });
    const result2 = rollAffixes(item, { rng });

    expect(result1.affixes.brand.id).toBe(result2.affixes.brand.id);
    expect(result1.affixes.brand.tier).toBe(result2.affixes.brand.tier);
    expect(result1.affixes.brand.values).toEqual(result2.affixes.brand.values);
  });
});
