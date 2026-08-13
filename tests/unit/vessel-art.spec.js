/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import vessels from '#server/core/data/items/vessels.js';
import ItemFactory from '#server/core/items/factory.js';

const atlasPath = fileURLToPath(new URL(
  '../../src/assets/graphics/items/vessels.png',
  import.meta.url,
));

describe('native Vessel item art', () => {
  it('assigns every native form a unique frame in catalogue order', () => {
    expect(vessels).toHaveLength(13);
    expect(vessels.map(item => item.graphics)).toEqual(
      vessels.map((item, column) => ({ tileset: 'vessels', row: 0, column })),
    );
  });

  it('ships the deterministic 13-by-1 transparent PNG atlas', () => {
    const png = readFileSync(atlasPath);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(13 * 32);
    expect(png.readUInt32BE(20)).toBe(32);
    expect(png[25]).toBe(6); // RGBA colour type
  });

  it('migrates saved native items onto the new art without rerolling identity', () => {
    const baseItem = vessels[0];
    const saved = {
      ...baseItem,
      uuid: 'persisted-vessel',
      graphics: { tileset: 'weapons', row: 0, column: 1 },
      vessel: { item: { formId: 'handaxe', seed: 42 } },
    };

    const hydrated = ItemFactory.adoptExisting(saved, { baseItem });

    expect(hydrated.graphics).toEqual(baseItem.graphics);
    expect(hydrated.uuid).toBe(saved.uuid);
    expect(hydrated.vessel).toEqual(saved.vessel);
  });

  it('loads the Vessel sheet in world, inventory, and equipment renderers', () => {
    const client = readFileSync(
      fileURLToPath(new URL('../../src/core/client.js', import.meta.url)),
      'utf8',
    );
    const map = readFileSync(
      fileURLToPath(new URL('../../src/core/map.js', import.meta.url)),
      'utf8',
    );
    const inventory = readFileSync(
      fileURLToPath(new URL('../../src/components/inventory/InventoryGrid.vue', import.meta.url)),
      'utf8',
    );
    const equipment = readFileSync(
      fileURLToPath(new URL('../../src/components/sub/EquipmentSlot.vue', import.meta.url)),
      'utf8',
    );

    expect(client).toContain('items/vessels.png');
    expect(map).toContain('vesselsImage');
    expect(inventory).toContain("case 'vessels':");
    expect(equipment).toContain("case 'vessels':");
  });
});
