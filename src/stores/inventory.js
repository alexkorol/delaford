import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';

import { DEFAULT_GRID, ORIENTATION_DEFAULT } from '@/core/inventory/constants.js';
import { normaliseInventoryItem } from '@/core/inventory/normalise.js';
import { rotateOrientation, canRotateItem } from '@/core/inventory/footprint.js';
import { buildOccupancyMap, canPlaceItem, clampFootprintWithinGrid, getItemAtCell } from '@/core/inventory/collision.js';
import { canStackWith, applyStacking } from '@/core/inventory/stacking.js';
import { indexFromCoords } from '@/core/inventory/grid-math.js';
import { packInventoryItems } from '@shared/inventory-footprints.js';

const cloneItems = (items) => items.map((item) => ({ ...item, position: { ...item.position } }));

export const getItemEquipSlot = item => (
  item?.equipSlot
  || item?.slotType
  || item?.wearSlot
  || item?.equipmentSlot
  || null
);

export const canEquipInventoryItemToSlot = (item, slotId) => {
  const equipSlot = getItemEquipSlot(item);
  return Boolean(equipSlot && slotId && equipSlot === slotId);
};

export const useInventoryStore = defineStore('inventoryGrid', () => {
  const grid = reactive({ ...DEFAULT_GRID });
  const orientationMap = reactive(new Map());
  const state = reactive({
    items: [],
    equipment: {},
    dragState: {
      activeItemId: null,
      source: null,
      sourceSlotId: null,
      pointerOffset: { x: 0, y: 0 },
      ghostPosition: null,
      orientation: ORIENTATION_DEFAULT,
      hoverTarget: null,
    },
    containerStack: [],
  });

  const setInventoryItems = (rawItems = []) => {
    const snapshot = new Map(orientationMap);
    orientationMap.clear();
    const packedItems = packInventoryItems(rawItems, grid);
    state.items = cloneItems(packedItems.map((item) => {
      const mapped = normaliseInventoryItem(item, grid, snapshot);
      orientationMap.set(mapped.uuid, mapped.orientation);
      return mapped;
    }));
  };

  const normaliseEquipmentItem = (item, slotId) => {
    if (!item || !slotId) {
      return null;
    }

    return normaliseInventoryItem({
      ...item,
      equipSlot: item.equipSlot || item.slotType || slotId,
      slotType: item.slotType || item.equipSlot || slotId,
      slot: Number.isInteger(item.slot) ? item.slot : 0,
    }, grid, orientationMap);
  };

  const activeItem = computed(() => {
    if (!state.dragState.activeItemId) {
      return null;
    }

    if (state.dragState.source === 'equipment') {
      const slotId = state.dragState.sourceSlotId;
      const item = slotId ? state.equipment[slotId] : null;
      return normaliseEquipmentItem(item, slotId);
    }

    return state.items.find((item) => item.uuid === state.dragState.activeItemId) || null;
  });

  const isDragging = computed(() => !!state.dragState.activeItemId);

  const occupancy = computed(() => buildOccupancyMap(state.items));

  const findItemByUuid = (uuid) => state.items.find((item) => item.uuid === uuid) || null;

  const setEquipment = (wear = {}) => {
    state.equipment = { ...wear };
  };

  const beginDrag = (uuid, source, { pointerOffset = { x: 0, y: 0 }, sourceSlotId = null } = {}) => {
    const item = source === 'equipment'
      ? normaliseEquipmentItem(state.equipment[sourceSlotId], sourceSlotId)
      : findItemByUuid(uuid);
    if (!item) {
      return;
    }

    state.dragState.activeItemId = item.uuid || uuid;
    state.dragState.source = source;
    state.dragState.sourceSlotId = sourceSlotId;
    state.dragState.pointerOffset = { ...pointerOffset };
    state.dragState.ghostPosition = source === 'equipment' ? null : { ...item.position };
    state.dragState.orientation = orientationMap.get(uuid) || item.orientation || ORIENTATION_DEFAULT;
    state.dragState.hoverTarget = source === 'equipment'
      ? null
      : {
        type: 'inventory',
        position: { ...item.position },
        valid: true,
        blockers: [],
      };
  };

  const updateGhostPosition = (position) => {
    if (!isDragging.value) {
      return;
    }

    const item = activeItem.value;
    if (!item) {
      return;
    }

    const clamped = clampFootprintWithinGrid(position, item, grid, state.dragState.orientation);
    state.dragState.ghostPosition = clamped;

    const blockers = canPlaceItem(
      state.items,
      clamped,
      item,
      grid,
      state.dragState.orientation,
    );

    const occupant = getItemAtCell(
      state.items.filter((i) => i.uuid !== item.uuid),
      clamped,
    );

    let stackTarget = null;
    if (occupant && canStackWith(item, occupant)) {
      stackTarget = occupant.uuid;
    }

    state.dragState.hoverTarget = {
      type: 'inventory',
      position: clamped,
      valid: blockers.valid || !!stackTarget,
      blockers: blockers.blockers,
      isOutOfBounds: blockers.isOutOfBounds,
      stackTarget,
    };
  };

  const updatePointerCell = (cell) => {
    if (!isDragging.value || !cell) {
      return;
    }

    const { pointerOffset } = state.dragState;
    const nextPosition = {
      x: cell.x - pointerOffset.x,
      y: cell.y - pointerOffset.y,
    };

    updateGhostPosition(nextPosition);
  };

  const setHoverTarget = (target) => {
    if (!isDragging.value) {
      return;
    }

    state.dragState.hoverTarget = target;
  };

  const clearHoverTarget = () => {
    if (!isDragging.value) {
      return;
    }

    state.dragState.hoverTarget = null;
  };

  const rotateActiveItem = () => {
    const item = activeItem.value;
    if (!item || !canRotateItem(item)) {
      return;
    }

    const nextOrientation = rotateOrientation(state.dragState.orientation);
    state.dragState.orientation = nextOrientation;
    orientationMap.set(item.uuid, nextOrientation);
    updateGhostPosition(state.dragState.ghostPosition || item.position);
  };

  const cancelDrag = () => {
    state.dragState.activeItemId = null;
    state.dragState.source = null;
    state.dragState.sourceSlotId = null;
    state.dragState.pointerOffset = { x: 0, y: 0 };
    state.dragState.ghostPosition = null;
    state.dragState.orientation = ORIENTATION_DEFAULT;
    state.dragState.hoverTarget = null;
  };

  const commitDrop = () => {
    const item = activeItem.value;
    const { hoverTarget, orientation, source, sourceSlotId } = state.dragState;

    if (!item || !hoverTarget) {
      cancelDrag();
      return { cancelled: true };
    }

    if (hoverTarget.type === 'inventory') {
      if (!hoverTarget.valid) {
        cancelDrag();
        return { cancelled: true, reason: 'invalid-placement' };
      }

      if (source === 'equipment') {
        cancelDrag();
        return {
          cancelled: false,
          type: 'unequip',
          slotId: sourceSlotId,
          target: hoverTarget,
          item,
        };
      }

      if (hoverTarget.stackTarget) {
        const stackTarget = findItemByUuid(hoverTarget.stackTarget);
        const stacking = applyStacking(item, stackTarget);
        if (!stacking) {
          cancelDrag();
          return { cancelled: true, reason: 'invalid-stack' };
        }

        stackTarget.qty = stacking.targetQty;
        item.qty = stacking.sourceRemainder;
        if (item.qty === 0) {
          state.items = state.items.filter((entry) => entry.uuid !== item.uuid);
          orientationMap.delete(item.uuid);
        }
      } else {
        const nextItems = state.items.map((entry) => {
          if (entry.uuid === item.uuid) {
            const nextSlot = indexFromCoords(hoverTarget.position.x, hoverTarget.position.y, grid.columns);
            orientationMap.set(item.uuid, orientation);
            return {
              ...entry,
              slot: nextSlot,
              position: { ...hoverTarget.position },
              orientation,
            };
          }
          return entry;
        });
        state.items = nextItems;
      }

      cancelDrag();
      return {
        cancelled: false,
        type: hoverTarget.stackTarget ? 'stack' : 'move',
        target: hoverTarget,
        item,
      };
    }

    if (hoverTarget.type === 'equipment') {
      if (hoverTarget.valid === false || !canEquipInventoryItemToSlot(item, hoverTarget.slotId)) {
        cancelDrag();
        return { cancelled: true, reason: 'invalid-equipment-slot' };
      }

      cancelDrag();
      return {
        cancelled: false,
        type: 'equip',
        slotId: hoverTarget.slotId,
        item,
      };
    }

    if (hoverTarget.type === 'world-drop') {
      if (source === 'equipment') {
        cancelDrag();
        return {
          cancelled: false,
          type: 'unequip-world-drop',
          slotId: sourceSlotId,
          item,
        };
      }

      state.items = state.items.filter((entry) => entry.uuid !== item.uuid);
      orientationMap.delete(item.uuid);
      cancelDrag();
      return {
        cancelled: false,
        type: 'world-drop',
        item,
      };
    }

    cancelDrag();
    return { cancelled: true };
  };

  const isHoveringSlot = (slotId) => (
    state.dragState.hoverTarget
    && state.dragState.hoverTarget.type === 'equipment'
    && state.dragState.hoverTarget.slotId === slotId
  );

  const openContainer = (containerItem) => {
    if (!containerItem) {
      return;
    }

    state.containerStack.push({
      item: containerItem,
      openedAt: Date.now(),
    });
  };

  const closeContainer = (uuid) => {
    state.containerStack = state.containerStack.filter((entry) => entry.item.uuid !== uuid);
  };

  return {
    grid,
    state,
    items: computed(() => state.items),
    equipment: computed(() => state.equipment),
    isDragging,
    activeItem,
    occupancy,
    dragState: computed(() => state.dragState),
    containerStack: computed(() => state.containerStack),
    setInventoryItems,
    setEquipment,
    beginDrag,
    updatePointerCell,
    updateGhostPosition,
    setHoverTarget,
    clearHoverTarget,
    rotateActiveItem,
    commitDrop,
    cancelDrag,
    isHoveringSlot,
    openContainer,
    closeContainer,
  };
});
