import { v4 as uuid } from 'uuid';
import Query from '#server/core/data/query.js';
import { rollAffixes, cloneAndMergeStats, structuredCloneSafe } from './affix-engine.js';
import { createVesselBlock } from './vesselforge/adapter.js';
import { resolveItemSize } from '#shared/inventory-footprints.js';

const composeAffixedName = (baseName, brand, bond) => {
  const prefix = brand ? `${brand.name} ` : '';
  const suffix = bond ? ` ${bond.name}` : '';
  return `${prefix}${baseName}${suffix}`.replace(/\s+/g, ' ').trim();
};

const eligibleForAffixes = (baseItem) => {
  if (!baseItem || typeof baseItem !== 'object') {
    return false;
  }

  if (baseItem.disableAffixes) {
    return false;
  }

  if (baseItem.stackable) {
    return false;
  }

  if (!baseItem.stats) {
    return false;
  }

  if (!baseItem.type) {
    return false;
  }

  return ['weapon', 'armor', 'jewelry'].includes(baseItem.type);
};

const shouldBindOnPickup = (baseItem) => {
  if (!baseItem || typeof baseItem !== 'object') {
    return false;
  }

  if (typeof baseItem.bindOnPickup === 'boolean') {
    return baseItem.bindOnPickup;
  }

  if (baseItem.stackable) {
    return false;
  }

  if (baseItem.type && ['weapon', 'armor', 'jewelry'].includes(baseItem.type)) {
    return true;
  }

  return false;
};

const sanitizeInventoryInstance = (item) => {
  const clone = structuredCloneSafe(item);
  delete clone.x;
  delete clone.y;
  delete clone.timestamp;
  delete clone.context;
  delete clone.respawn;
  delete clone.willRespawnIn;
  delete clone.respawnIn;
  return clone;
};

const createFromBase = (baseItem, options = {}) => {
  if (!baseItem) {
    return null;
  }

  const {
    bindTo = null,
    quantity = baseItem.stackable ? 1 : undefined,
    includeAffixes = true,
    itemLevel,
    rng,
    uuid: providedUuid,
  } = options;

  const instance = structuredCloneSafe(baseItem);
  instance.baseId = baseItem.id;
  instance.baseName = baseItem.name;
  instance.uuid = providedUuid || uuid();
  instance.context = 'item';

  if (includeAffixes && eligibleForAffixes(baseItem)) {
    const { affixes, totals } = rollAffixes(baseItem, { rng });
    instance.affixes = affixes;
    instance.stats = cloneAndMergeStats(baseItem.stats, totals);
    instance.name = composeAffixedName(baseItem.name, affixes.brand, affixes.bond);
  } else {
    instance.affixes = { brand: null, bond: null };
    instance.stats = structuredCloneSafe(baseItem.stats || {});
    instance.name = baseItem.name;
  }

  if (includeAffixes) {
    const vessel = createVesselBlock(baseItem, { rng, ilvl: itemLevel });
    if (vessel) {
      instance.vessel = vessel;
      instance.name = vessel.displayName || instance.name;
      instance.displayName = instance.name;
      instance.stats = structuredCloneSafe(vessel.combat?.ratings || instance.stats);
      if (vessel.combat?.attributes) {
        instance.attributes = structuredCloneSafe(vessel.combat.attributes);
      }
      if (vessel.combat?.resources) {
        instance.resourceBonuses = structuredCloneSafe(vessel.combat.resources);
      }
      if (Number.isFinite(vessel.item?.w) && Number.isFinite(vessel.item?.h)) {
        instance.size = { width: vessel.item.w, height: vessel.item.h };
      }
    }
  }

  instance.displayName = instance.displayName || instance.name;
  instance.size = resolveItemSize(instance);

  if (typeof baseItem.slot === 'string') {
    instance.equipSlot = baseItem.slot;
    instance.slotType = baseItem.slot;
  }

  if (typeof quantity !== 'undefined') {
    instance.qty = quantity;
  }

  if (bindTo && shouldBindOnPickup(baseItem)) {
    instance.boundTo = bindTo;
  }

  return instance;
};

const createById = (itemId, options = {}) => {
  const base = Query.getItemData(itemId);
  if (!base) {
    return null;
  }

  return createFromBase(base, options);
};

const adoptExisting = (existingItem, options = {}) => {
  if (!existingItem) {
    return null;
  }

  const clone = sanitizeInventoryInstance(existingItem);
  const {
    uuid: providedUuid,
    bindTo,
    quantity,
    baseItem = null,
  } = options;

  clone.uuid = providedUuid || clone.uuid || uuid();
  if (typeof quantity !== 'undefined') {
    clone.qty = quantity;
  }

  const bindingReference = baseItem || clone;
  if (bindTo && shouldBindOnPickup(bindingReference)) {
    clone.boundTo = clone.boundTo || bindTo;
  }

  clone.name = clone.name || clone.displayName || clone.baseName || existingItem.name;
  clone.displayName = clone.displayName || clone.name;
  clone.size = resolveItemSize(baseItem || clone);

  const equipSlot = clone.equipSlot || clone.slotType || (typeof baseItem?.slot === 'string' ? baseItem.slot : null);
  if (equipSlot) {
    clone.equipSlot = equipSlot;
    clone.slotType = equipSlot;
  }

  // Art is presentation, not rolled identity. Native Vessels should adopt the
  // current dedicated frame when an older save still carries its legacy atlas
  // reference; the UUID, material, rolls, stats, and provenance stay exact.
  if (baseItem?.graphics?.tileset === 'vessels') {
    clone.graphics = structuredCloneSafe(baseItem.graphics);
  }

  if (!clone.affixes && eligibleForAffixes(bindingReference)) {
    clone.affixes = { brand: null, bond: null };
  }

  return clone;
};

const toWorldInstance = (item, location, options = {}) => {
  const clone = structuredCloneSafe(item);
  clone.uuid = options.uuid || clone.uuid || uuid();
  clone.x = location.x;
  clone.y = location.y;
  clone.timestamp = options.timestamp || Date.now();
  delete clone.slot;
  delete clone.isLocked;
  if (options.respawn) {
    clone.respawn = true;
  }
  return clone;
};

const bindInventoryItem = (item, playerUuid, baseItem) => {
  if (!playerUuid || !item) {
    return item;
  }

  if (item.boundTo) {
    return item;
  }

  if (shouldBindOnPickup(baseItem || item)) {
    const clone = sanitizeInventoryInstance(item);
    clone.boundTo = playerUuid;
    return clone;
  }

  return item;
};

export default {
  createById,
  createFromBase,
  adoptExisting,
  toWorldInstance,
  bindInventoryItem,
};
