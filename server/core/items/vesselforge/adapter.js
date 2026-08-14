import { createForge } from './engine.js';
import verdigrisPack from './verdigris-pack.js';

// Bridges catalogue entries that explicitly declare a Vesselforge form. The
// old catalogue remains valid legacy gear; assigning a random form merely from
// its equipment slot created impossible identities such as a Bronze Sword with
// a Flint Handaxe tooltip.

const COMBAT_CHANNEL_BY_FORM = Object.freeze({
  handaxe: 'slash',
  spear: 'stab',
  macuahuitl: 'crush',
  atlatl: 'range',
  khopesh: 'slash',
  sling: 'range',
});

const ACTIVE_BRAND_MODS = new Set([
  'keen',
  'heavy',
  'swift_haft',
  'warded',
  'hale',
  'spirited',
  'emberkiss',
  'strongback',
  'keen_eye',
  'wealthy',
  'beastbane',
]);

const DEFAULT_ITEM_LEVEL = 10;

const forge = createForge(verdigrisPack);

export const vesselEligible = item => Boolean(
  item
  && !item.stackable
  && item.vesselforge
  && typeof item.vesselforge.formId === 'string'
  && verdigrisPack.forms[item.vesselforge.formId],
);

const zeroCombatStats = () => ({
  attack: { stab: 0, slash: 0, crush: 0, range: 0 },
  defense: { stab: 0, slash: 0, crush: 0, range: 0 },
});

const implicitIsActive = (form) => {
  const statId = form?.implicit?.stat?.id;
  if (['life', 'spirit', 'attrs', 'block'].includes(statId)) {
    return true;
  }
  return Boolean(form?.weapon && (statId === 'phys_pct' || statId === 'atk_speed'));
};

const markDormantLine = line => ({
  ...line,
  section: 'dormant',
  text: `Dormant · ${line.text}`,
  tone: 'inactive',
});

const honestTooltipLines = (vesselItem, lines) => {
  const form = verdigrisPack.forms[vesselItem.formId];
  let brandIndex = 0;

  return lines.map((line) => {
    if (line.section === 'implicit') {
      return implicitIsActive(form) ? line : markDormantLine(line);
    }
    if (line.section === 'brand') {
      const brand = vesselItem.brands[brandIndex];
      brandIndex += 1;
      return brand && ACTIVE_BRAND_MODS.has(brand.modId) ? line : markDormantLine(line);
    }
    if (['bond', 'trophy', 'power'].includes(line.section)) {
      return markDormantLine(line);
    }
    return line;
  });
};

/**
 * Translate Vesselforge's damage/ward sheet into the legacy combat ratings the
 * live game consumes. The original values remain on `vessel.combat`, so UI and
 * future crafting can explain exactly how the equipped rating was produced.
 */
export const deriveVesselCombat = (vesselItem) => {
  if (!vesselItem || !verdigrisPack.forms[vesselItem.formId]
    || !verdigrisPack.materials[vesselItem.materialId]) {
    return null;
  }

  const form = verdigrisPack.forms[vesselItem.formId];
  const material = verdigrisPack.materials[vesselItem.materialId];
  const aggregate = forge.aggregate([vesselItem], { level: vesselItem.ilvl });
  const sums = aggregate.sums || {};
  const stats = zeroCombatStats();
  const combat = {
    damage: null,
    ward: Math.max(0, Math.round(aggregate.sheet?.ward || 0)),
    attributes: null,
    resources: null,
    modifiers: null,
    ratings: stats,
  };

  if (form.weapon) {
    const flatDamage = Number(sums.heavy || 0) + Number(sums.emberkiss || 0);
    const physicalMultiplier = 1 + (
      Number(sums.phys_pct || 0) + Number(sums.keen || 0)
    ) / 100;
    const speed = form.weapon.aps * (1 + Number(sums.atk_speed || 0) / 100);
    const minimum = Math.max(1, Math.round(
      ((form.weapon.dmg[0] * material.statMult) + flatDamage) * physicalMultiplier,
    ));
    const maximum = Math.max(minimum, Math.round(
      ((form.weapon.dmg[1] * material.statMult) + flatDamage) * physicalMultiplier,
    ));
    const dps = Math.max(1, Math.round(((minimum + maximum) / 2) * speed));
    const rating = Math.max(1, Math.round(dps / 2));
    const channel = COMBAT_CHANNEL_BY_FORM[vesselItem.formId] || 'crush';
    stats.attack[channel] = rating;
    combat.damage = {
      minimum,
      maximum,
      attacksPerSecond: Math.round(speed * 100) / 100,
      dps,
      channel,
      rating,
    };
  }

  if (combat.ward > 0) {
    const rating = Math.max(1, Math.round(combat.ward / 8));
    Object.keys(stats.defense).forEach((channel) => {
      stats.defense[channel] = rating;
    });
  }

  const allAttributes = Math.max(0, Math.round(
    Number(sums.attrs || 0) + Number(sums.strongback || 0),
  ));
  if (allAttributes > 0) {
    combat.attributes = {
      strength: allAttributes,
      dexterity: allAttributes,
      intelligence: allAttributes,
    };
  }

  const health = Math.max(0, Math.round(Number(sums.life || 0) + Number(sums.hale || 0)));
  const mana = Math.max(0, Math.round(Number(sums.spirit || 0) + Number(sums.spirited || 0)));
  if (health > 0 || mana > 0) {
    combat.resources = { health, mana };
  }

  const modifiers = {};
  const blockChance = Math.max(0, Math.min(75, Number(sums.block) || 0));
  const criticalChance = Math.max(0, Math.min(75, Number(sums.keen_eye) || 0));
  const goodsFound = Math.max(0, Math.min(100, Number(sums.wealthy) || 0));
  const damageAgainstBeasts = Math.max(0, Math.min(100, Number(sums.beastbane) || 0));
  if (blockChance > 0) {
    modifiers.blockChance = blockChance;
  }
  if (criticalChance > 0) {
    modifiers.criticalChance = criticalChance;
  }
  if (goodsFound > 0) {
    modifiers.goodsFound = goodsFound;
  }
  if (damageAgainstBeasts > 0) {
    modifiers.damageAgainstBeasts = damageAgainstBeasts;
  }
  if (Object.keys(modifiers).length) {
    combat.modifiers = modifiers;
  }

  return combat;
};

/**
 * Rebuild the derived and presentation layers of a persisted Vessel while
 * preserving the rolled item itself. This lets newly-live mechanics apply to
 * old saves without rerolling their identity, material, Brands, or patience.
 */
export const refreshVesselBlock = (savedVessel) => {
  const vesselItem = savedVessel?.item;
  const form = vesselItem && verdigrisPack.forms[vesselItem.formId];
  const material = vesselItem && verdigrisPack.materials[vesselItem.materialId];
  if (!vesselItem || !form || !material) {
    return null;
  }

  const lines = honestTooltipLines(vesselItem, forge.tooltip(vesselItem));
  return {
    ...savedVessel,
    packId: verdigrisPack.id,
    item: vesselItem,
    material: material.name,
    materialTier: material.tier,
    form: form.name,
    displayName: lines.find(line => line.section === 'name')?.text
      || savedVessel.displayName
      || form.name,
    lines,
    combat: deriveVesselCombat(vesselItem),
  };
};

/**
 * Generate the vessel block for a base item. Deterministic when an rng is
 * provided (the forge is reseeded from it).
 *
 * @param {object} baseItem The catalogue item definition
 * @param {object} options { ilvl, rng }
 * @returns {object|null} Serializable vessel block or null when ineligible
 */
export const createVesselBlock = (baseItem, options = {}) => {
  if (!vesselEligible(baseItem)) {
    return null;
  }

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  forge.reseed(Math.floor(rng() * 2 ** 32));

  const { formId, materialId } = baseItem.vesselforge;
  const ilvl = Number.isFinite(options.ilvl) && options.ilvl > 0
    ? Math.min(80, Math.floor(options.ilvl))
    : DEFAULT_ITEM_LEVEL;

  const vesselItem = forge.generateItem({ ilvl, formId, materialId });
  const vessel = refreshVesselBlock({ item: vesselItem });
  if (vessel && !vessel.displayName) {
    vessel.displayName = baseItem.name;
  }
  return vessel;
};

/**
 * Project a vessel's weapon contribution onto a legacy stats block: the
 * dominant attack style gains the vessel's per-hit power. Non-weapon vessels
 * and statless items pass through unchanged. (Used by the brand-searing pane
 * to preview before/after combat stats.)
 */
export const applyVesselCombatStats = (stats = {}, vesselBlock = null) => {
  const vesselItem = vesselBlock?.item;
  const form = vesselItem ? verdigrisPack.forms[vesselItem.formId] : null;
  if (!vesselItem || !form?.weapon) return stats;

  const attack = stats.attack || {};
  const dominantStyle = ['stab', 'slash', 'crush', 'range']
    .sort((a, b) => (attack[b] || 0) - (attack[a] || 0))[0];
  if (!dominantStyle || (attack[dominantStyle] || 0) <= 0) return stats;

  const { sheet } = forge.aggregate([vesselItem]);
  const perHitPower = sheet.damage / Math.max(0.1, form.weapon.aps || 1);
  const vesselBonus = Math.max(0, Math.round(perHitPower));
  return {
    ...stats,
    attack: {
      ...attack,
      [dominantStyle]: (attack[dominantStyle] || 0) + vesselBonus,
    },
  };
};

export const vesselTooltip = (vesselItem, ctx = {}) => forge.tooltip(vesselItem, ctx);

export const getForge = () => forge;

export default {
  createVesselBlock,
  deriveVesselCombat,
  refreshVesselBlock,
  vesselEligible,
  vesselTooltip,
  getForge,
};
