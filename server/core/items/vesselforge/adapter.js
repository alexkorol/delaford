import { createForge } from './engine.js';
import verdigrisPack from './verdigris-pack.js';

// Bridges the legacy item catalogue to Vesselforge: every eligible piece of
// gear carries a vessel block (material, slots, patience, drop brands) that
// the crafting loop can grow into bonds, trophies and an awakening.

const SLOT_FORMS = {
  right_hand: ['handaxe', 'spear', 'khopesh', 'macuahuitl', 'atlatl', 'sling'],
  left_hand: ['hideshield'],
  armor: ['wrap'],
  back: ['wrap'],
  head: ['crest'],
  gloves: ['grips'],
  feet: ['sandals'],
  necklace: ['gorget'],
  ring: ['ring'],
};

const DEFAULT_ITEM_LEVEL = 10;

const forge = createForge(verdigrisPack);

export const vesselEligible = item => Boolean(
  item
  && !item.stackable
  && ['weapon', 'armor', 'jewelry'].includes(item.type)
  && SLOT_FORMS[item.slot],
);

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

  const forms = SLOT_FORMS[baseItem.slot];
  const requestedForm = typeof baseItem.vesselForm === 'string' ? baseItem.vesselForm : null;
  const formId = requestedForm && verdigrisPack.forms[requestedForm]
    ? requestedForm
    : forms[Math.floor(rng() * forms.length) % forms.length];
  const form = verdigrisPack.forms[formId];
  const requestedMaterial = typeof baseItem.vesselMaterial === 'string'
    ? baseItem.vesselMaterial
    : null;
  const materialId = requestedMaterial && form.materials.includes(requestedMaterial)
    ? requestedMaterial
    : undefined;
  const ilvl = Number.isFinite(options.ilvl) && options.ilvl > 0
    ? Math.min(80, Math.floor(options.ilvl))
    : DEFAULT_ITEM_LEVEL;

  const vesselItem = forge.generateItem({ ilvl, formId, materialId });
  return {
    packId: verdigrisPack.id,
    item: vesselItem,
    material: verdigrisPack.materials[vesselItem.materialId].name,
    materialTier: verdigrisPack.materials[vesselItem.materialId].tier,
    form: verdigrisPack.forms[vesselItem.formId].name,
    lines: forge.tooltip(vesselItem),
  };
};

export const vesselTooltip = (vesselItem, ctx = {}) => forge.tooltip(vesselItem, ctx);

/**
 * Bridge Vesselforge's DPS-oriented weapon sheet into the legacy per-hit
 * combat styles. The catalogue remains the base; material and brand power add
 * a bounded bonus to its dominant physical style.
 */
export const applyVesselCombatStats = (stats = {}, vesselBlock = null) => {
  const vesselItem = vesselBlock?.item;
  const form = vesselItem ? verdigrisPack.forms[vesselItem.formId] : null;
  if (!vesselItem || !form?.weapon) return stats;

  const attack = stats.attack || {};
  const dominantStyle = ['stab', 'slash', 'crush', 'range']
    .sort((a, b) => (attack[b] || 0) - (attack[a] || 0))[0];
  if (!dominantStyle || (attack[dominantStyle] || 0) <= 0) return stats;

  const sheet = forge.aggregate([vesselItem]).sheet;
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

export const getForge = () => forge;

export default {
  createVesselBlock,
  applyVesselCombatStats,
  vesselEligible,
  vesselTooltip,
  getForge,
};
