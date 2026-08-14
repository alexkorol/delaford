export const INVENTORY_COLUMNS = 12;
export const INVENTORY_ROWS = 7;
// The kept (2.5D-overhaul) pane layout is metered for 32px cells: a 7-row
// backpack plus the equipment ragdoll must fit a 1000px-tall viewport with
// every cell reachable by pointer drag. The login-restyle 54px "art fills
// the pane" scale returns together with that branch's pane layout port
// (see tests/pending-port/).
export const CELL_SIZE_PX = 32;
export const CELL_GAP_PX = 3;
export const LEGACY_ITEM_TILE_SIZE_PX = 32;

export const DEFAULT_GRID = Object.freeze({
  columns: INVENTORY_COLUMNS,
  rows: INVENTORY_ROWS,
});

export const ORIENTATION_DEFAULT = 'default';
export const ORIENTATION_ROTATED = 'rotated';
