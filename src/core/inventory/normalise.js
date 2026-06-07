import { coordsFromIndex, indexFromCoords, normaliseSize } from './grid-math.js';
import { ORIENTATION_DEFAULT } from './constants.js';
import { isStackableItem } from './stacking.js';
import { resolveItemSize } from '@shared/inventory-footprints.js';

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

export const normaliseInventoryItem = (item, grid, orientationMap = new Map()) => {
  const uuid = deriveUuid(item);
  const baseSize = normaliseSize(item.size || item.baseSize || resolveItemSize(item));
  const orientation = orientationMap.get(uuid) || item.orientation || ORIENTATION_DEFAULT;
  const position = derivePosition(item, grid);
  const slot = deriveSlot(item, grid);
  const stackable = isStackableItem(item);

  return {
    ...item,
    uuid,
    slot,
    position,
    baseSize,
    orientation,
    stackable,
    qty: typeof item.qty === 'number' ? item.qty : (stackable ? 0 : 1),
  };
};
