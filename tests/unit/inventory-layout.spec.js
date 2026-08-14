/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CELL_GAP_PX,
  CELL_SIZE_PX,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  LEGACY_ITEM_TILE_SIZE_PX,
} from '@/core/inventory/constants.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('inventory pane layout', () => {
  it('keeps the authored item scale and the fixed 7x12 backpack contract', () => {
    expect({
      columns: INVENTORY_COLUMNS,
      rows: INVENTORY_ROWS,
      cell: CELL_SIZE_PX,
      gap: CELL_GAP_PX,
      legacyTile: LEGACY_ITEM_TILE_SIZE_PX,
    }).toEqual({ columns: 12, rows: 7, cell: 54, gap: 2, legacyTile: 32 });
  });

  it('pins background cells to explicit rows and renders authored art when available', () => {
    const inventoryGrid = readSource('src/components/inventory/InventoryGrid.vue');

    expect(inventoryGrid).toContain(':style="cellStyle(slotIndex - 1)"');
    expect(inventoryGrid).toContain('gridTemplateRows: `repeat(${props.rows}, var(--cell-size))`');
    expect(inventoryGrid).not.toContain("gridAutoRows: 'var(--cell-size)'");
    expect(inventoryGrid).toContain('const itemArt = item => resolveInventoryItemArt(item);');
    expect(inventoryGrid).toContain('class="inventory-item__art"');
    expect(inventoryGrid).toContain('column * LEGACY_ITEM_TILE_SIZE_PX');
  });

  it('does not resize the world viewport around fixed overlay panes', () => {
    const delaford = readSource('src/Delaford.vue');
    const worldViewport = delaford.slice(
      delaford.indexOf('worldViewport() {'),
      delaford.indexOf('worldViewportKey() {'),
    );

    expect(worldViewport).toContain('const centerLeft = gutter;');
    expect(worldViewport).toContain('const centerRight = gutter;');
    expect(worldViewport).not.toContain('defaultLeftPane');
    expect(worldViewport).not.toContain('defaultRightPane');
  });
});
