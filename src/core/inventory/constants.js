export const INVENTORY_COLUMNS = 12;
export const INVENTORY_ROWS = 7;
// Match the authored inventory-art scale. The old 32px Delaford icon-grid
// value made every footprint and its art needlessly tiny.
export const CELL_SIZE_PX = 54;
export const CELL_GAP_PX = 2;
export const LEGACY_ITEM_TILE_SIZE_PX = 32;

export const DEFAULT_GRID = Object.freeze({
  columns: INVENTORY_COLUMNS,
  rows: INVENTORY_ROWS,
});

export const ORIENTATION_DEFAULT = 'default';
export const ORIENTATION_ROTATED = 'rotated';
