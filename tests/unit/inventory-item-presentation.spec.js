/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  acceptedInventoryArtIds,
  hasInventoryItemArt,
  resolveInventoryItemArt,
  resolveInventoryItemArtId,
} from '@/core/inventory/item-art.js';
import {
  getInventoryAttunement,
  getInventoryCombatLines,
  getInventoryItemRarity,
  getInventoryTooltipLines,
  getInventoryVesselPips,
} from '@/core/inventory/item-presentation.js';

const vesselItem = (overrides = {}) => ({
  vessel: 5,
  brands: [{ modId: 'keen' }],
  bonds: [{ modId: 'shieldwall' }],
  trophies: [{ trophyId: 'boar' }],
  scars: 1,
  att: { xp: 25, next: 100 },
  ...overrides,
});

describe('inventory item art bridge', () => {
  it('indexes the finalized WIZARD art catalog and resolves legacy catalogue ids', () => {
    expect(acceptedInventoryArtIds.length).toBeGreaterThan(100);
    expect(hasInventoryItemArt('dagger_bronze')).toBe(true);
    expect(resolveInventoryItemArtId({ id: 'bronze-dagger' })).toBe('dagger_bronze');
    expect(resolveInventoryItemArt({ id: 'bronze-dagger' })).toMatch(/dagger_bronze/i);
  });

  it('prefers explicit art ids and safely falls back for unmapped items', () => {
    expect(resolveInventoryItemArtId({
      id: 'future-catalogue-item',
      artId: 'coral_ring.png',
    })).toBe('coral_ring');
    expect(resolveInventoryItemArtId({ id: 'future-catalogue-item' })).toBeNull();
    expect(resolveInventoryItemArt({ id: 'future-catalogue-item' })).toBeNull();
  });
});

describe('inventory item presentation', () => {
  it('derives rarity from both legacy affixes and Vesselforge state', () => {
    expect(getInventoryItemRarity(null)).toBe('normal');
    expect(getInventoryItemRarity({})).toBe('normal');
    expect(getInventoryItemRarity({ affixes: { brand: { id: 'brand' } } })).toBe('magic');
    expect(getInventoryItemRarity({
      affixes: { brand: { id: 'brand' }, bond: { id: 'bond' } },
    })).toBe('rare');
    expect(getInventoryItemRarity({ vessel: { item: { awakened: { name: 'Relic' } } } })).toBe('unique');
  });

  it('builds vessel pips without exceeding the vessel capacity', () => {
    expect(getInventoryVesselPips(null)).toEqual([]);
    const pips = getInventoryVesselPips({ vessel: { item: vesselItem() } });

    expect(pips).toHaveLength(5);
    expect(pips.map(pip => pip.kind)).toEqual([
      'brand',
      'bond',
      'trophy',
      'scar',
      'empty',
    ]);
  });

  it('renders real combat stats and keeps generated vessel stats out of the tooltip', () => {
    const item = {
      stats: {
        attack: { stab: 4, slash: 2, crush: -1, range: 0 },
        defense: { stab: 1, slash: 0, crush: 2, range: 0 },
      },
      affixes: {
        brand: { name: "Soldier's", tier: 2 },
        bond: null,
      },
      vessel: {
        item: vesselItem(),
        lines: [
          { section: 'name', text: 'Generated vessel name' },
          { section: 'stat', text: 'Damage 999–999' },
          { section: 'brand', text: '✦ +10% damage' },
          { section: 'attune', text: 'Attunement 25/100' },
        ],
      },
    };

    expect(getInventoryCombatLines(item)).toEqual([
      'Attack · Stab +4 · Slash +2 · Crush -1',
      'Defense · Stab +1 · Crush +2',
    ]);
    expect(getInventoryTooltipLines(item)).toEqual([
      { section: 'brand', text: "✦ Soldier's · Tier 2", tone: 'brand' },
      { section: 'brand', text: '✦ +10% damage', tone: 'normal' },
    ]);
  });

  it('normalises attunement progress for the custom progress bar', () => {
    expect(getInventoryAttunement({ vessel: { item: vesselItem() } })).toEqual({
      current: 25,
      next: 100,
      percent: 25,
    });
    expect(getInventoryAttunement({})).toBeNull();
  });
});
