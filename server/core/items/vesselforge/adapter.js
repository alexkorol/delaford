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
  const formId = forms[Math.floor(rng() * forms.length) % forms.length];
  const ilvl = Number.isFinite(options.ilvl) && options.ilvl > 0
    ? Math.min(80, Math.floor(options.ilvl))
    : DEFAULT_ITEM_LEVEL;

  const vesselItem = forge.generateItem({ ilvl, formId });
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

export const getForge = () => forge;

export default {
  createVesselBlock,
  vesselEligible,
  vesselTooltip,
  getForge,
};
