/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  buildCharacterSheet,
  CHARACTER_PORTRAIT_TILE,
  formatResistancePips,
  resolveDcssEquipmentTile,
} from '@/core/character-sheet.js';

describe('character sheet model', () => {
  it('formats DCSS-style resistance pips', () => {
    expect(formatResistancePips(0)).toBe('.');
    expect(formatResistancePips(2)).toBe('++');
    expect(formatResistancePips(-2)).toBe('--');
    expect(formatResistancePips(5)).toBe('+++');
  });

  it('derives combat ratings from equipped gear when combat totals are not present', () => {
    const sheet = buildCharacterSheet({
      username: 'Tester',
      level: 4,
      stats: {
        level: 4,
        resources: {
          health: { current: 48, max: 80 },
          mana: { current: 10, max: 30 },
        },
        attributes: {
          total: {
            strength: 14,
            dexterity: 12,
            intelligence: 9,
          },
        },
      },
      wear: {
        right_hand: {
          id: 'bronze-sword',
          name: 'Bronze Sword',
          stats: {
            attack: { stab: 4, slash: 3, crush: 0, range: 0 },
          },
        },
        left_hand: {
          id: 'bronze-shield',
          name: 'Bronze Shield',
          stats: {
            defense: { stab: 3, slash: 5, crush: 10, range: 6 },
          },
          resistances: {
            fire: 1,
          },
        },
        armor: {
          id: 'bronze-armor',
          name: 'Bronze Armor',
          stats: {
            defense: { stab: 15, slash: 14, crush: 9, range: 25 },
            resistances: { cold: -1 },
          },
        },
      },
    });

    expect(sheet.identity).toMatchObject({ name: 'Tester', level: 4 });
    expect(sheet.identity.tile).toEqual(CHARACTER_PORTRAIT_TILE);
    expect(sheet.resources.hp).toEqual({ current: 48, max: 80 });
    expect(sheet.offense.find(row => row.id === 'damage').value).toBeGreaterThan(1);
    expect(sheet.defenses.find(row => row.id === 'ac').value).toBeGreaterThan(0);
    expect(sheet.defenses.find(row => row.id === 'sh').value).toBeGreaterThan(0);
    expect(sheet.equipment.find(row => row.id === 'right_hand').name).toBe('Bronze Sword');
    expect(sheet.equipment.find(row => row.id === 'right_hand').tile).toMatchObject({
      atlas: 'objects',
      column: 1,
      row: 27,
    });
    expect(sheet.equipment.find(row => row.id === 'feet').name).toBe('Bare feet');
    expect(sheet.equipment.find(row => row.id === 'feet').tile).toMatchObject({
      atlas: 'objects',
      column: 8,
      row: 27,
    });
    expect(sheet.resistances.find(row => row.id === 'fire').pips).toBe('+');
    expect(sheet.resistances.find(row => row.id === 'cold').pips).toBe('-');
  });

  it('resolves DCSS equipment placeholders from explicit tiles, item names, and slots', () => {
    expect(resolveDcssEquipmentTile('ring', { dcssTile: { atlas: 'objects', column: 4, row: 26 } })).toMatchObject({
      atlas: 'objects',
      column: 4,
      row: 26,
    });

    expect(resolveDcssEquipmentTile('left_hand', { id: 'iron-buckler', name: 'Iron Buckler' })).toMatchObject({
      atlas: 'objects',
      column: 3,
      row: 27,
    });

    expect(resolveDcssEquipmentTile('necklace', null)).toMatchObject({
      atlas: 'objects',
      column: 1,
      row: 28,
    });

    expect(resolveDcssEquipmentTile('right_hand', {
      name: 'Flint Khopesh',
      graphics: { tileset: 'vessels', column: 4, row: 0 },
    })).toEqual({
      atlas: 'vessels',
      column: 4,
      row: 0,
      label: 'Flint Khopesh',
      tileSize: 32,
    });
  });

  it('sorts known skills in character-screen order', () => {
    const sheet = buildCharacterSheet({
      skills: {
        smithing: { level: 5, exp: 180 },
        attack: { level: 7, exp: 320 },
        mining: { level: 3, exp: 90 },
      },
    });

    expect(sheet.skills.map(skill => skill.id)).toEqual(['attack', 'mining', 'smithing']);
  });

  it('surfaces authoritative Vesselforge combat effects as percentages', () => {
    const sheet = buildCharacterSheet({
      combat: {
        blockChance: 4,
        criticalChance: 22,
        goodsFound: 10,
        damageAgainstBeasts: 14,
      },
    });

    expect(sheet.vesselEffects).toEqual([
      expect.objectContaining({ id: 'block', label: 'Block', value: 4, suffix: '%' }),
      expect.objectContaining({ id: 'critical', label: 'Critical', value: 22, suffix: '%' }),
      expect.objectContaining({ id: 'goods-found', label: 'Goods Found', value: 10, suffix: '%' }),
      expect.objectContaining({ id: 'beastbane', label: 'Beast Dmg', value: 14, suffix: '%' }),
    ]);
  });

  it('clamps malformed Vesselforge combat effects to their server caps', () => {
    const sheet = buildCharacterSheet({
      combat: {
        blockChance: -5,
        criticalChance: 120,
        goodsFound: 999,
        damageAgainstBeasts: 250,
      },
    });

    expect(sheet.vesselEffects.map(effect => effect.value)).toEqual([0, 75, 100, 100]);
  });
});
