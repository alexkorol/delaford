/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  buildItemTooltipModel,
  getItemRarity,
  itemTooltipAriaLabel,
} from '@/core/inventory/item-tooltip.js';

describe('inventory item tooltip', () => {
  it('turns Vesselforge lines into styled client-safe rows', () => {
    const item = {
      name: 'Bronze Hunger',
      type: 'weapon',
      equipSlot: 'right_hand',
      boundTo: 'house-account',
      chroniclesRelic: { houseName: 'Vaelmont', scionName: 'Vesper' },
      stats: { attack: { stab: 4, slash: -2, crush: 0 } },
      vessel: {
        item: {
          brands: [{ id: 'keen' }],
          bonds: [{ id: 'battle-rhythm' }],
          trophies: [],
        },
        lines: [
          { section: 'name', text: 'Bronze Hunger', tone: 'bonded' },
          { section: 'kind', text: 'One-hand weapon · Bronze (tier 3)' },
          { section: 'brand', text: '✦ +12% increased Physical Damage' },
          { section: 'bond', text: '◈ Battle Rhythm', tone: 'bond' },
        ],
      },
    };

    const model = buildItemTooltipModel(item, { width: 1, height: 3 });

    expect(model).toMatchObject({
      name: 'Bronze Hunger',
      rarity: 'rare',
      meta: ['Weapon', 'Right Hand', '1 × 3'],
      binding: 'House Vaelmont heirloom · carried by Vesper',
    });
    expect(model.vesselLines).toEqual([
      { section: 'kind', text: 'One-hand weapon · Bronze (tier 3)', tone: 'normal' },
      { section: 'brand', text: '✦ +12% increased Physical Damage', tone: 'normal' },
      { section: 'bond', text: '◈ Battle Rhythm', tone: 'bond' },
    ]);
    expect(model.statLines).toEqual(['+4 Stab Attack', '-2 Slash Attack']);
  });

  it('classifies generated and legacy affixed gear without trusting arbitrary rarity values', () => {
    expect(getItemRarity({ vessel: { item: { awakened: { power: 'Echo' } } } })).toBe('awakened');
    expect(getItemRarity({ affixes: { brand: { id: 'keen' } } })).toBe('magic');
    expect(getItemRarity({ rarity: 'mythic' })).toBe('normal');
    expect(itemTooltipAriaLabel({ name: 'Bronze Pickaxe' }, { width: 1, height: 3 }))
      .toBe('Bronze Pickaxe (1 x 3)');
  });

  it('replaces the browser title with the floating tooltip component', () => {
    const gridSource = readFileSync(
      fileURLToPath(new URL('../../src/components/inventory/InventoryGrid.vue', import.meta.url)),
      'utf8',
    );
    const tooltipSource = readFileSync(
      fileURLToPath(new URL('../../src/components/inventory/ItemTooltip.vue', import.meta.url)),
      'utf8',
    );

    expect(gridSource).toContain('<ItemTooltip');
    expect(gridSource).toContain(':aria-label="itemAriaLabel(item)"');
    expect(gridSource).toContain('@focus="showTooltip($event, item)"');
    expect(gridSource).not.toContain(':title="itemTooltip(item)"');
    expect(tooltipSource).toContain('role="tooltip"');
    expect(tooltipSource).toContain('item-tooltip__line--tone-');
  });
});
