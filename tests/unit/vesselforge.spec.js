/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import VesselForge, { createForge, validatePack } from '#server/core/items/vesselforge/engine.js';
import pack from '#server/core/items/vesselforge/verdigris-pack.js';
import { createVesselBlock, vesselEligible } from '#server/core/items/vesselforge/adapter.js';
import ItemFactory from '#server/core/items/factory.js';

const forge = createForge(pack, { seed: 12345 });

describe('Vesselforge pack validation', () => {
  it('validates the Verdigris pack clean', () => {
    expect(validatePack(pack)).toEqual([]);
    expect(VesselForge.validatePack(pack)).toEqual([]);
  });

  it('uses plain mechanical language in player-facing item labels', () => {
    const labels = [
      ...Object.values(pack.forms).map(form => form.implicit?.label),
      ...Object.values(pack.brandMods).map(mod => mod.label),
      ...Object.values(pack.themes).flatMap(theme => Object.values(theme.mods).map(mod => mod.label)),
      ...Object.values(pack.trophies).flatMap(trophy => [
        ...trophy.mods.map(mod => mod.label),
        trophy.completionBonus?.label,
      ]),
    ].filter(Boolean).join('\n');

    expect(labels).not.toMatch(/Ember (?:Damage|Resistance)|River Resistance/);
    expect(labels).not.toMatch(/Maximum Spirit|Rite Power|Goods Found|\bWard\b/);
    expect(pack.brandMods.emberward.label).toContain('Fire Resistance');
    expect(pack.brandMods.riverblessed.label).toContain('Cold Resistance');
  });

  it('catches a broken pack', () => {
    const bad = {
      id: 'x',
      settings: {},
      materials: { a: { tier: 1, vessel: [2, 2], patience: [2, 2] } },
      forms: {},
      brandMods: {},
      themes: {},
      archetypes: { z: { themeId: 'nope' } },
    };
    expect(validatePack(bad).length).toBeGreaterThan(0);
  });
});

describe('Vesselforge generation', () => {
  it('is reproducible for the same seed', () => {
    const f1 = createForge(pack, { seed: 777 });
    const f2 = createForge(pack, { seed: 777 });
    const a = f1.generateItem({ ilvl: 40 });
    const b = f2.generateItem({ ilvl: 40 });
    expect(a.formId).toBe(b.formId);
    expect(a.materialId).toBe(b.materialId);
    expect(a.brands.length).toBe(b.brands.length);
  });

  it('respects vessel and material invariants', () => {
    for (let i = 0; i < 200; i += 1) {
      const item = forge.generateItem({ ilvl: 1 + (i % 80) });
      const mat = pack.materials[item.materialId];
      const form = pack.forms[item.formId];
      expect(form.materials).toContain(item.materialId);
      expect(mat.tier).toBeLessThanOrEqual(1 + Math.floor(item.ilvl / 15));
      if (item.vessel) {
        expect(item.brands.length).toBeLessThanOrEqual(item.vessel);
        expect(item.patience).toBeGreaterThanOrEqual(0);
        expect(item.patience).toBeLessThanOrEqual(item.patienceMax);
      }
    }
  });

  it('never drops top-tier materials at low ilvl', () => {
    for (let i = 0; i < 100; i += 1) {
      const item = forge.generateItem({ ilvl: 10 });
      expect(['skymetal', 'rivetmail']).not.toContain(item.materialId);
    }
  });
});

describe('Vesselforge crafting', () => {
  it('sear adds a brand and spends patience', () => {
    const item = forge.generateItem({
      ilvl: 40, formId: 'khopesh', materialId: 'bronze', brands: 0,
    });
    const result = forge.sear(item);
    expect(result.error).toBeUndefined();
    expect(result.item.brands).toHaveLength(1);
    expect(result.item.patience).toBe(item.patience - 1);
  });

  it('refuses crafting when patience is exhausted', () => {
    let item = forge.generateItem({
      ilvl: 40, formId: 'khopesh', materialId: 'bronze', brands: 0,
    });
    let guard = 0;
    while (item.patience > 0 && guard < 30) {
      guard += 1;
      const result = item.brands.length ? forge.efface(item) : forge.sear(item);
      if (result.error) break;
      item = result.item;
    }
    const refused = forge.sear(item);
    expect(refused.error).toMatch(/patience/i);
  });

  it('omens guarantee their tag', () => {
    for (let i = 0; i < 30; i += 1) {
      const item = forge.generateItem({
        ilvl: 40, formId: 'wrap', materialId: 'quilted', brands: 0,
      });
      const result = forge.sear(item, { omenId: 'entrail_omen' });
      if (result.error) continue;
      const mod = pack.brandMods[result.item.brands[0].modId];
      expect(mod.tags).toContain('ward');
    }
  });

  it('pigments skew odds and explainOdds sums to 1', () => {
    const item = forge.generateItem({
      ilvl: 40, formId: 'handaxe', materialId: 'bronze', brands: 0,
    });
    const plain = forge.explainOdds(item);
    const skewed = forge.explainOdds(item, { pigmentId: 'red_ochre' });
    const sum = skewed.reduce((total, entry) => total + entry.p, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    const probabilityOf = (list, id) => (list.find(entry => entry.modId === id) || { p: 0 }).p;
    expect(probabilityOf(skewed, 'keen')).toBeGreaterThan(probabilityOf(plain, 'keen'));
  });

  it('gates brand tiers by ilvl', () => {
    for (let i = 0; i < 60; i += 1) {
      const item = forge.generateItem({
        ilvl: 5, formId: 'handaxe', materialId: 'flint', brands: 0,
      });
      const result = forge.sear(item);
      if (result.error) continue;
      expect(result.item.brands[0].tier).toBe(1);
    }
  });

  it('firing ascends, scars, silences, or shatters', () => {
    const seen = {};
    for (let i = 0; i < 150; i += 1) {
      const item = forge.generateItem({
        ilvl: 30, formId: 'wrap', materialId: 'hide', brands: 0,
      });
      const result = forge.fire(item);
      if (result.destroyed) { seen.shatter = true; continue; }
      expect(result.error).toBeUndefined();
      if (result.item.materialId !== 'hide') {
        seen.ascend = true;
        expect(result.item.materialId).toBe('quilted');
      } else if (result.item.scars > item.scars) {
        seen.scar = true;
      } else {
        seen.silent = true;
      }
    }
    expect(seen).toEqual({
      ascend: true, scar: true, silent: true, shatter: true,
    });
  });

  it('refuses to fire top materials', () => {
    const item = forge.generateItem({
      ilvl: 79, formId: 'wrap', materialId: 'rivetmail', brands: 0,
    });
    expect(forge.fire(item).error).toBeTruthy();
  });
});

describe('Vesselforge bonds and kinship', () => {
  it('attunement forms themed kinship bonds that estrange for other archetypes', () => {
    let item = forge.generateItem({
      ilvl: 30, formId: 'hideshield', materialId: 'bronze', brands: 0,
    });
    const ctx = { charName: 'Orun', archetype: 'shieldbearer' };
    for (let i = 0; i < 12 && !item.bonds.length; i += 1) {
      const result = forge.attune(item, 60, { warding: 3 }, ctx);
      item = result.item;
    }
    expect(item.bonds.length).toBeGreaterThanOrEqual(1);
    expect(item.bonds[0].themeId).toBe('warding');
    expect(item.bonds[0].kinship).toBe('shieldbearer');

    const full = forge.bondValue(item.bonds[0], false);
    const estranged = forge.bondValue(item.bonds[0], true);
    expect(Math.abs(estranged - full / 2)).toBeLessThanOrEqual(0.55);
    expect(forge.isEstranged(item.bonds[0], 'redhand')).toBe(true);
    expect(forge.isEstranged(item.bonds[0], 'shieldbearer')).toBe(false);
  });

  it('lives the full item life: bonds to tier III, then awakening', () => {
    let item = forge.generateItem({
      ilvl: 40, formId: 'hideshield', materialId: 'bronze', brands: 0,
    });
    item.vessel = 3;
    const ctx = { charName: 'Orun', archetype: 'shieldbearer' };
    let awakeEvent = null;
    for (let i = 0; i < 60 && !item.awakened; i += 1) {
      const result = forge.attune(item, 200, { warding: 2 }, ctx);
      item = result.item;
      const awake = result.events.find(event => event.kind === 'awake');
      if (awake) awakeEvent = awake;
    }
    expect(item.awakened).toBeTruthy();
    expect(awakeEvent.text).toMatch(/AWAKENED/);
    expect(item.awakened.name.startsWith("Orun's")).toBe(true);
    expect(forge.isSated(item)).toBe(true);
  });
});

describe('Vesselforge trophies and aggregation', () => {
  it('completes trophy fragments and sockets them once', () => {
    let stash = {};
    let completed = false;
    for (let i = 0; i < 5; i += 1) {
      const result = forge.addFragment(stash, 'boar_tusk');
      stash = result.stash;
      completed = result.completed;
    }
    expect(completed).toBe(true);

    const item = forge.generateItem({
      ilvl: 30, formId: 'spear', materialId: 'bronze', brands: 0,
    });
    const socketed = forge.socketTrophy(item, 'boar_tusk', stash);
    expect(socketed.error).toBeUndefined();
    expect(socketed.item.trophies).toHaveLength(1);
    expect(socketed.stash.boar_tusk).toBe(0);
    expect(forge.socketTrophy(socketed.item, 'boar_tusk', { boar_tusk: 5 }).error).toBeTruthy();
  });

  it('aggregate splits the flat sheet from conditionals', () => {
    const item = forge.generateItem({
      ilvl: 40, formId: 'wrap', materialId: 'quilted', brands: 0,
    });
    item.brands.push({
      id: 'b1', modId: 'hale', tier: 1, value: 20,
    });
    item.bonds.push({
      id: 'd1', modId: 'shieldwall', themeId: 'warding', base: 10, tier: 1, kinship: 'shieldbearer',
    });
    const agg = forge.aggregate([item], { archetype: 'shieldbearer', level: 1 });
    expect(agg.sums.hale).toBe(20);
    expect(agg.conditionals).toHaveLength(1);
    expect(agg.sheet.life).toBeGreaterThanOrEqual(110);
    expect('shieldwall' in agg.sums).toBe(false);
  });

  it('tooltip returns structured UI-agnostic lines', () => {
    const item = forge.generateItem({
      ilvl: 40, formId: 'khopesh', materialId: 'bronze', brands: 2,
    });
    const lines = forge.tooltip(item, { archetype: 'redhand' });
    expect(lines.every(line => line.section && typeof line.text === 'string')).toBe(true);
    expect(lines.some(line => line.section === 'name')).toBe(true);
    expect(lines.some(line => line.section === 'vessel' && /Patience/.test(line.text))).toBe(true);
  });

  it('serialize/deserialize round-trips and rejects foreign packs', () => {
    const item = forge.generateItem({ ilvl: 33 });
    const raw = forge.serialize({ items: [item] });
    const back = forge.deserialize(raw);
    expect(back.items[0].id).toBe(item.id);
    expect(() => forge.deserialize(JSON.stringify({ packId: 'other', state: {} }))).toThrow();
  });
});

describe('Vesselforge game integration', () => {
  it('marks catalogue gear as vessel-eligible and stackables not', () => {
    expect(vesselEligible({ type: 'weapon', slot: 'right_hand' })).toBe(true);
    expect(vesselEligible({ type: 'armor', slot: 'head' })).toBe(true);
    expect(vesselEligible({ type: 'weapon', slot: 'right_hand', stackable: true })).toBe(false);
    expect(vesselEligible({ type: 'general', slot: 'right_hand' })).toBe(false);
  });

  it('attaches a vessel block to factory-created gear', () => {
    const rng = (() => {
      let state = 42;
      return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
      };
    })();
    const instance = ItemFactory.createById('bronze-sword', { rng, itemLevel: 24 });

    expect(instance.vessel).toBeTruthy();
    expect(instance.vessel.packId).toBe('verdigris-1');
    expect(instance.vessel.item.kind).toBe('weapon');
    expect(instance.vessel.item.ilvl).toBe(24);
    expect(Array.isArray(instance.vessel.lines)).toBe(true);
    expect(instance.vessel.lines.some(line => line.section === 'kind')).toBe(true);
    expect(JSON.parse(JSON.stringify(instance.vessel))).toEqual(instance.vessel);
  });

  it('keeps curated Verdigris bases aligned with their art and vessel identity', () => {
    const pike = ItemFactory.createById('bronze-pike', {
      rng: () => 0.5,
      itemLevel: 18,
    });

    expect(pike.artId).toBe('boar_pike');
    expect(pike.size).toEqual({ width: 1, height: 4 });
    expect(pike.equipSlot).toBe('right_hand');
    expect(pike.vessel.item.formId).toBe('spear');
    expect(pike.vessel.item.materialId).toBe('bronze');
    expect(pike.vessel.item.ilvl).toBe(18);
  });

  it('skips vessel blocks for stackables and plain items', () => {
    const coins = ItemFactory.createById('coins', { quantity: 5 });
    expect(coins.vessel).toBeUndefined();
  });
});
