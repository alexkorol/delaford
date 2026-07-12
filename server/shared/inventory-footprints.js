export const INVENTORY_COLUMNS = 12;
export const INVENTORY_ROWS = 7;
export const INVENTORY_SLOT_COUNT = INVENTORY_COLUMNS * INVENTORY_ROWS;
export const MAX_ITEM_CELLS = 8;

const SLOT_SIZE_BY_EQUIPMENT_SLOT = Object.freeze({
  ring: { width: 1, height: 1 },
  necklace: { width: 1, height: 1 },
  head: { width: 2, height: 2 },
  gloves: { width: 2, height: 2 },
  feet: { width: 2, height: 2 },
  back: { width: 2, height: 3 },
  armor: { width: 2, height: 3 },
  left_hand: { width: 2, height: 2 },
});

const FIXED_SQUARE_ARMOR_SLOTS = new Set(['head', 'gloves', 'feet']);

const resolveEquipmentSlot = (item = {}) => [
  item.equipSlot,
  item.slotType,
  item.wearSlot,
  item.equipmentSlot,
  typeof item.slot === 'string' ? item.slot : null,
].find(slot => typeof slot === 'string') || null;

const clampInteger = (value, min, max) => (
  Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min))
);

const normaliseDimensionPair = (width, height) => {
  const normalised = {
    width: clampInteger(width, 1, 4),
    height: clampInteger(height, 1, MAX_ITEM_CELLS),
  };

  while ((normalised.width * normalised.height) > MAX_ITEM_CELLS && normalised.height > 1) {
    normalised.height -= 1;
  }

  while ((normalised.width * normalised.height) > MAX_ITEM_CELLS && normalised.width > 1) {
    normalised.width -= 1;
  }

  return normalised;
};

export const normaliseItemSize = (size) => {
  if (typeof size === 'number') {
    return normaliseDimensionPair(size, 1);
  }

  if (Array.isArray(size)) {
    return normaliseDimensionPair(size[0], size[1]);
  }

  if (size && typeof size === 'object') {
    return normaliseDimensionPair(size.width ?? size.x ?? size.columns, size.height ?? size.y ?? size.rows);
  }

  return { width: 1, height: 1 };
};

const idContains = (item, values) => {
  const id = String(item?.id || item?.baseId || '').toLowerCase();
  const name = String(item?.name || item?.baseName || item?.displayName || '').toLowerCase();
  return values.some((value) => id.includes(value) || name.includes(value));
};

const resolveWeaponSize = (item) => {
  if (item?.twoHanded || idContains(item, ['halberd', 'spear'])) {
    return { width: 2, height: 4 };
  }

  if (idContains(item, ['longbow', 'shortbow', 'battleaxe', 'warhammer'])) {
    return { width: 2, height: 3 };
  }

  if (idContains(item, ['dagger', 'knife'])) {
    return { width: 1, height: 2 };
  }

  if (idContains(item, ['axe', 'pickaxe', 'mace', 'sword', 'hammer'])) {
    return { width: 1, height: 3 };
  }

  return { width: 1, height: 2 };
};

const resolveArmorSize = (item) => {
  const equipmentSlot = resolveEquipmentSlot(item);

  if (idContains(item, ['pavise'])) {
    return { width: 2, height: 3 };
  }

  if (idContains(item, ['shield'])) {
    return { width: 2, height: 2 };
  }

  if (idContains(item, ['chainmail', 'armor', 'body', 'robe'])) {
    return { width: 2, height: 3 };
  }

  if (idContains(item, ['cape'])) {
    return { width: 2, height: 3 };
  }

  if (idContains(item, ['helm', 'hat', 'cowl'])) {
    return { width: 2, height: 2 };
  }

  if (idContains(item, ['boots', 'gloves'])) {
    return { width: 2, height: 2 };
  }

  return SLOT_SIZE_BY_EQUIPMENT_SLOT[equipmentSlot] || { width: 1, height: 1 };
};

export const resolveItemSize = (item = {}) => {
  const equipmentSlot = resolveEquipmentSlot(item);
  if (FIXED_SQUARE_ARMOR_SLOTS.has(equipmentSlot)) {
    return { width: 2, height: 2 };
  }

  if (item.size || item.baseSize || item.dimensions || item.graphicSize) {
    return normaliseItemSize(item.size || item.baseSize || item.dimensions || item.graphicSize);
  }

  if (item.stackable || item.type === 'currency') {
    return { width: 1, height: 1 };
  }

  if (idContains(item, ['bar', 'ore', 'coins'])) {
    return { width: 1, height: 1 };
  }

  if (item.type === 'weapon' || item.slot === 'right_hand' || idContains(item, ['sword', 'axe', 'pickaxe', 'mace', 'dagger', 'bow', 'halberd', 'spear', 'warhammer'])) {
    return resolveWeaponSize(item);
  }

  if (item.type === 'armor' || SLOT_SIZE_BY_EQUIPMENT_SLOT[equipmentSlot]) {
    return resolveArmorSize(item);
  }

  if (item.type === 'jewelry' || item.slot === 'ring' || item.slot === 'necklace' || idContains(item, ['ring', 'amulet'])) {
    return { width: 1, height: 1 };
  }

  if (idContains(item, ['lantern', 'hammer', 'knife'])) {
    return { width: 1, height: 2 };
  }

  return { width: 1, height: 1 };
};

export const positionFromSlot = (slot, columns = INVENTORY_COLUMNS) => ({
  x: Number.isInteger(slot) ? slot % columns : 0,
  y: Number.isInteger(slot) ? Math.floor(slot / columns) : 0,
});

export const slotFromPosition = (position, columns = INVENTORY_COLUMNS) => (
  (position.y * columns) + position.x
);

export const createItemFootprint = (position, item, orientation = item?.orientation) => {
  const baseSize = resolveItemSize(item);
  const size = orientation === 'rotated'
    ? { width: baseSize.height, height: baseSize.width }
    : baseSize;
  const cells = [];

  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      cells.push({ x: position.x + x, y: position.y + y });
    }
  }

  return cells;
};

const cellKey = ({ x, y }) => `${x},${y}`;

const createGrid = (options = {}) => ({
  columns: options.columns || INVENTORY_COLUMNS,
  rows: options.rows || INVENTORY_ROWS,
});

const canPlace = (occupied, position, item, grid, orientation) => (
  createItemFootprint(position, item, orientation).every((cell) => (
    cell.x >= 0
    && cell.y >= 0
    && cell.x < grid.columns
    && cell.y < grid.rows
    && !occupied.has(cellKey(cell))
  ))
);

const occupy = (occupied, position, item, grid, orientation) => {
  createItemFootprint(position, item, orientation).forEach((cell) => {
    if (cell.x >= 0 && cell.y >= 0 && cell.x < grid.columns && cell.y < grid.rows) {
      occupied.add(cellKey(cell));
    }
  });
};

export const findOpenInventorySlot = (inventory = [], item = {}, options = {}) => {
  const grid = createGrid(options);
  const occupied = new Set();

  inventory.forEach((entry) => {
    if (!entry) {
      return;
    }
    const position = entry.position || positionFromSlot(entry.slot, grid.columns);
    occupy(occupied, position, entry, grid, entry.orientation);
  });

  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      const position = { x, y };
      if (canPlace(occupied, position, item, grid, options.orientation || item?.orientation)) {
        return slotFromPosition(position, grid.columns);
      }
    }
  }

  return false;
};

export const canPlaceInventoryItem = (inventory = [], item = {}, position = null, options = {}) => {
  const grid = createGrid(options);
  const ignoredUuid = options.ignoreUuid || item?.uuid || null;
  const ignoredSlot = Number.isInteger(options.ignoreSlot) ? options.ignoreSlot : null;
  const orientation = options.orientation || item?.orientation;
  const occupied = new Map();

  if (!position || !Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    return {
      valid: false,
      isOutOfBounds: true,
      blockers: [],
    };
  }

  inventory.forEach((entry) => {
    if (!entry) {
      return;
    }

    if (ignoredUuid && entry.uuid === ignoredUuid) {
      return;
    }

    if (!ignoredUuid && ignoredSlot !== null && entry.slot === ignoredSlot) {
      return;
    }

    const entryPosition = entry.position || positionFromSlot(entry.slot, grid.columns);
    createItemFootprint(entryPosition, entry, entry.orientation).forEach((cell) => {
      if (cell.x < 0 || cell.y < 0 || cell.x >= grid.columns || cell.y >= grid.rows) {
        return;
      }
      occupied.set(cellKey(cell), entry.uuid || entry.slot);
    });
  });

  const blockers = new Set();
  let isOutOfBounds = false;

  createItemFootprint(position, item, orientation).forEach((cell) => {
    if (cell.x < 0 || cell.y < 0 || cell.x >= grid.columns || cell.y >= grid.rows) {
      isOutOfBounds = true;
      return;
    }

    const blocker = occupied.get(cellKey(cell));
    if (blocker !== undefined) {
      blockers.add(blocker);
    }
  });

  return {
    valid: !isOutOfBounds && blockers.size === 0,
    isOutOfBounds,
    blockers: Array.from(blockers),
  };
};

export const packInventoryItems = (items = [], options = {}) => {
  const grid = createGrid(options);
  const occupied = new Set();
  const packed = [];

  items.forEach((item) => {
    if (!item) {
      return;
    }

    const candidate = {
      ...item,
      size: resolveItemSize(item),
    };
    const desiredPosition = item.position || positionFromSlot(item.slot, grid.columns);
    const openSlot = canPlace(occupied, desiredPosition, candidate, grid, candidate.orientation)
      ? slotFromPosition(desiredPosition, grid.columns)
      : findOpenInventorySlot(packed, candidate, grid);
    const position = openSlot === false
      ? desiredPosition
      : positionFromSlot(openSlot, grid.columns);

    const nextItem = {
      ...candidate,
      position,
      slot: slotFromPosition(position, grid.columns),
    };

    occupy(occupied, position, nextItem, grid, nextItem.orientation);
    packed.push(nextItem);
  });

  return packed;
};
