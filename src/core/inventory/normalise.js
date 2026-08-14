import { coordsFromIndex, indexFromCoords, normaliseSize } from './grid-math.js';
import { ORIENTATION_DEFAULT } from './constants.js';
import { isStackableItem } from './stacking.js';
import { resolveItemSize } from '@shared/inventory-footprints.js';
import { general, wearableItems } from '@server/core/data/items/index.js';

const FALLBACK_ITEM_CATALOGUE = [...wearableItems, ...general];

const deriveUuid = (item) => {
  if (item.uuid) {
    return item.uuid;
  }

  if (item.instanceId) {
    return item.instanceId;
  }

  const slotId = typeof item.slot === 'number' ? item.slot : 'floating';
  return `${item.id || 'item'}-${slotId}-${Math.random().toString(16).slice(2, 8)}`;
};

const derivePosition = (item, grid) => {
  if (item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number') {
    return { x: item.position.x, y: item.position.y };
  }

  if (typeof item.slot === 'number') {
    return coordsFromIndex(item.slot, grid.columns);
  }

  return { x: 0, y: 0 };
};

const deriveSlot = (item, grid) => {
  if (typeof item.slot === 'number') {
    return item.slot;
  }

  if (item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number') {
    return indexFromCoords(item.position.x, item.position.y, grid.columns);
  }

  return 0;
};

const resolveCatalogueItem = (item) => {
  if (!item || !item.id) {
    return null;
  }

  const runtimeCatalogue = typeof window !== 'undefined' && Array.isArray(window.allItems)
    ? window.allItems
    : [];

  return runtimeCatalogue.find(entry => entry && entry.id === item.id)
    || FALLBACK_ITEM_CATALOGUE.find(entry => entry && entry.id === item.id)
    || null;
};

const enrichFromCatalogue = (item = {}) => {
  const baseItem = resolveCatalogueItem(item);
  if (!baseItem) {
    return item;
  }

  const equipSlot = item.equipSlot
    || item.slotType
    || item.wearSlot
    || item.equipmentSlot
    || (typeof baseItem.slot === 'string' ? baseItem.slot : null);

  return {
    ...baseItem,
    ...item,
    name: item.name || item.displayName || baseItem.name,
    displayName: item.displayName || item.name || baseItem.name,
    graphics: item.graphics || baseItem.graphics,
    stats: item.stats || baseItem.stats,
    type: item.type || baseItem.type,
    wearable: item.wearable || baseItem.wearable,
    stackable: item.stackable ?? baseItem.stackable,
    maxStack: item.maxStack ?? baseItem.maxStack,
    equipSlot,
    slotType: item.slotType || equipSlot,
  };
};

export const normaliseInventoryItem = (item, grid, orientationMap = new Map()) => {
  const enrichedItem = enrichFromCatalogue(item);
  const uuid = deriveUuid(enrichedItem);
  const baseSize = normaliseSize(resolveItemSize(enrichedItem));
  const orientation = orientationMap.get(uuid) || enrichedItem.orientation || ORIENTATION_DEFAULT;
  const position = derivePosition(enrichedItem, grid);
  const slot = deriveSlot(enrichedItem, grid);
  const stackable = isStackableItem(enrichedItem);

  return {
    ...enrichedItem,
    uuid,
    slot,
    position,
    baseSize,
    orientation,
    stackable,
    qty: typeof item.qty === 'number' ? item.qty : 1,
  };
};
