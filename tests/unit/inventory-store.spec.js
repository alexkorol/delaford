import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canEquipInventoryItemToSlot, useInventoryStore } from '@/stores/inventory.js';
import { positionFromSlot } from '@shared/inventory-footprints.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

const makeStack = (uuid, slot, qty, maxStack = 99) => ({
  id: 'coins',
  uuid,
  slot,
  position: positionFromSlot(slot),
  stackable: true,
  maxStack,
  qty,
});

afterEach(() => {
  delete globalThis.window;
});

describe('inventory drag store stacking commits', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('cancels stack drops when the target disappeared before commit', () => {
    const store = useInventoryStore();
    store.setInventoryItems([
      makeStack('coins-a', 0, 5),
      makeStack('coins-b', 1, 2),
    ]);

    store.beginDrag('coins-b', 'inventory');
    store.setHoverTarget({
      type: 'inventory',
      position: { x: 0, y: 0 },
      valid: true,
      stackTarget: 'missing-target',
    });

    const result = store.commitDrop();

    expect(result).toEqual({ cancelled: true, reason: 'invalid-stack' });
    expect(store.items.find(item => item.uuid === 'coins-a').qty).toBe(5);
    expect(store.items.find(item => item.uuid === 'coins-b').qty).toBe(2);
  });

  it('cancels stack drops onto full stacks', () => {
    const store = useInventoryStore();
    store.setInventoryItems([
      makeStack('coins-a', 0, 10, 10),
      makeStack('coins-b', 1, 2, 10),
    ]);

    store.beginDrag('coins-b', 'inventory');
    store.setHoverTarget({
      type: 'inventory',
      position: { x: 0, y: 0 },
      valid: true,
      stackTarget: 'coins-a',
    });

    const result = store.commitDrop();

    expect(result).toEqual({ cancelled: true, reason: 'invalid-stack' });
    expect(store.items.find(item => item.uuid === 'coins-a').qty).toBe(10);
    expect(store.items.find(item => item.uuid === 'coins-b').qty).toBe(2);
  });
});

describe('inventory drag store equipment commits', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const makeWeapon = () => ({
    id: 'bronze-sword',
    uuid: 'weapon-a',
    slot: 0,
    equipSlot: 'right_hand',
    slotType: 'right_hand',
    position: positionFromSlot(0),
    size: { width: 1, height: 3 },
  });

  it('recognizes compatible equipment slots without treating backpack slot as wear slot', () => {
    const weapon = makeWeapon();

    expect(canEquipInventoryItemToSlot(weapon, 'right_hand')).toBe(true);
    expect(canEquipInventoryItemToSlot(weapon, 'head')).toBe(false);
  });

  it('cancels drops onto incompatible paperdoll slots', () => {
    const store = useInventoryStore();
    store.setInventoryItems([makeWeapon()]);

    store.beginDrag('weapon-a', 'inventory');
    store.setHoverTarget({
      type: 'equipment',
      slotId: 'head',
      valid: false,
    });

    const result = store.commitDrop();

    expect(result).toEqual({ cancelled: true, reason: 'invalid-equipment-slot' });
    expect(store.items.find(item => item.uuid === 'weapon-a')).toBeTruthy();
  });

  it('commits drops onto compatible paperdoll slots with the target slot', () => {
    const store = useInventoryStore();
    store.setInventoryItems([makeWeapon()]);

    store.beginDrag('weapon-a', 'inventory');
    store.setHoverTarget({
      type: 'equipment',
      slotId: 'right_hand',
      valid: true,
    });

    const result = store.commitDrop();

    expect(result).toEqual(expect.objectContaining({
      cancelled: false,
      type: 'equip',
      slotId: 'right_hand',
    }));
    expect(result.item.uuid).toBe('weapon-a');
  });

  it('commits bare starter equipment records after catalogue enrichment', () => {
    const store = useInventoryStore();
    store.setInventoryItems([{
      id: 'bronze-pickaxe',
      uuid: 'starter-pickaxe',
      slot: 0,
    }]);

    const item = store.items.find(entry => entry.uuid === 'starter-pickaxe');
    expect(item.equipSlot).toBe('right_hand');
    expect(canEquipInventoryItemToSlot(item, 'right_hand')).toBe(true);

    store.beginDrag('starter-pickaxe', 'inventory');
    store.setHoverTarget({
      type: 'equipment',
      slotId: 'right_hand',
      valid: true,
    });

    const result = store.commitDrop();

    expect(result).toEqual(expect.objectContaining({
      cancelled: false,
      type: 'equip',
      slotId: 'right_hand',
    }));
    expect(result.item.uuid).toBe('starter-pickaxe');
  });

  it('commits equipped paperdoll items back into the backpack grid', () => {
    const store = useInventoryStore();
    store.setInventoryItems([]);
    store.setEquipment({
      right_hand: {
        id: 'bronze-sword',
        uuid: 'equipped-sword',
        name: 'Bronze Sword',
        equipSlot: 'right_hand',
        slotType: 'right_hand',
        size: { width: 1, height: 3 },
      },
    });

    store.beginDrag('equipped-sword', 'equipment', { sourceSlotId: 'right_hand' });
    store.setHoverTarget({
      type: 'inventory',
      position: { x: 2, y: 0 },
      slot: 2,
      valid: true,
      blockers: [],
    });

    const result = store.commitDrop();

    expect(result).toEqual(expect.objectContaining({
      cancelled: false,
      type: 'unequip',
      slotId: 'right_hand',
    }));
    expect(result.target.position).toEqual({ x: 2, y: 0 });
    expect(result.item.uuid).toBe('equipped-sword');
  });

  it('commits equipped paperdoll items to the world drop target', () => {
    const store = useInventoryStore();
    store.setEquipment({
      right_hand: {
        id: 'bronze-sword',
        uuid: 'equipped-sword',
        name: 'Bronze Sword',
        equipSlot: 'right_hand',
        slotType: 'right_hand',
      },
    });

    store.beginDrag('equipped-sword', 'equipment', { sourceSlotId: 'right_hand' });
    store.setHoverTarget({ type: 'world-drop' });

    const result = store.commitDrop();

    expect(result).toEqual(expect.objectContaining({
      cancelled: false,
      type: 'unequip-world-drop',
      slotId: 'right_hand',
    }));
    expect(result.item.uuid).toBe('equipped-sword');
  });
});

describe('inventory drag target component wiring', () => {
  it('reads injected Pinia drag-store values after proxy unwrapping', () => {
    const equipmentSlot = readSource('src/components/sub/EquipmentSlot.vue');
    const inventoryGrid = readSource('src/components/inventory/InventoryGrid.vue');
    const worldDropZone = readSource('src/components/inventory/WorldDropZone.vue');
    const containerStack = readSource('src/components/inventory/ContainerStack.vue');

    expect(equipmentSlot).toContain(':data-equipment-slot="slotId"');
    expect(equipmentSlot).toContain('@pointerup.left.stop.prevent="handlePointerUp"');
    expect(equipmentSlot).toContain('const storeValue = value => unref(value);');
    expect(equipmentSlot).toContain('const isStoreDragging = store => Boolean(store && storeValue(store.isDragging));');
    expect(equipmentSlot).toContain('const item = storeValue(this.inventoryDragStore.activeItem);');
    expect(equipmentSlot).toContain('storeValue(this.inventoryDragStore.dragState)?.hoverTarget');
    expect(equipmentSlot).not.toContain('inventoryDragStore.isDragging.value');
    expect(equipmentSlot).not.toContain('inventoryDragStore.activeItem.value');
    expect(equipmentSlot).not.toContain('inventoryDragStore.dragState.value');

    expect(inventoryGrid).toContain('const externalDropTargetFromEvent = (event) => {');
    expect(inventoryGrid).toContain('document.elementFromPoint(event.clientX, event.clientY)');
    expect(inventoryGrid).toContain("const equipmentSlot = closest('[data-equipment-slot]');");
    expect(inventoryGrid).toContain('valid: canEquipInventoryItemToSlot(activeItem.value, slotId)');
    expect(inventoryGrid).toContain("if (closest('[data-world-drop-zone]')) {");

    expect(worldDropZone).toContain('data-world-drop-zone="true"');
    expect(worldDropZone).toContain('const storeValue = value => unref(value);');
    expect(worldDropZone).toContain('const isStoreDragging = store => Boolean(store && storeValue(store.isDragging));');
    expect(worldDropZone).toContain('storeValue(inventoryStore.dragState)?.hoverTarget?.type === \'world-drop\'');
    expect(worldDropZone).not.toContain('inventoryStore.isDragging.value');
    expect(worldDropZone).not.toContain('inventoryStore.dragState.value');

    expect(containerStack).toContain('storeValue(inventoryStore.containerStack) || []');
    expect(containerStack).not.toContain('inventoryStore.containerStack.value');
  });
});
