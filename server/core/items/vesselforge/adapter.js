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

  return combat;
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
  const lines = forge.tooltip(vesselItem);
  const combat = deriveVesselCombat(vesselItem);
  return {
    packId: verdigrisPack.id,
    item: vesselItem,
    material: verdigrisPack.materials[vesselItem.materialId].name,
    materialTier: verdigrisPack.materials[vesselItem.materialId].tier,
    form: verdigrisPack.forms[vesselItem.formId].name,
    displayName: lines.find(line => line.section === 'name')?.text || baseItem.name,
    lines,
    combat,
  };
};

export const vesselTooltip = (vesselItem, ctx = {}) => forge.tooltip(vesselItem, ctx);

export const getForge = () => forge;

export default {
  createVesselBlock,
  deriveVesselCombat,
  vesselEligible,
  vesselTooltip,
  getForge,
};
