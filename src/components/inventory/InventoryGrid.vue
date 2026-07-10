<template>
  <div
    ref="gridRef"
    class="inventory-grid"
    :style="gridStyle"
    @pointermove.prevent="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <div
      v-for="slotIndex in totalSlots"
      :key="slotIndex"
      class="inventory-grid__cell"
    />

    <transition-group name="inventory-item">
      <div
        v-for="item in items"
        :key="item.uuid"
        :class="itemClasses(item)"
        :style="itemStyle(item)"
        :aria-label="itemTooltip(item)"
        tabindex="0"
        @pointerdown.prevent="beginPointerDrag($event, item)"
        @pointerenter="showItemTooltip(item, $event)"
        @pointermove="moveItemTooltip($event)"
        @pointerleave="hideItemTooltip"
        @focus="showFocusedItemTooltip(item, $event)"
        @blur="hideItemTooltip"
        @dblclick.prevent="handleDoubleClick(item)"
      >
        <img
          v-if="itemArt(item)"
          class="inventory-item__art"
          :src="itemArt(item)"
          alt=""
          draggable="false"
        >
        <div
          v-else
          class="inventory-item__sprite"
          :style="itemSpriteStyle(item)"
        />
        <div
          v-if="itemPips(item).length"
          class="inventory-item__pips"
          aria-hidden="true"
        >
          <span
            v-for="(pip, pipIndex) in itemPips(item)"
            :key="`${pip.kind}-${pipIndex}`"
            :class="`inventory-item__pip--${pip.kind}`"
          >{{ pip.symbol }}</span>
        </div>
        <span
          v-if="item.stackable && item.qty > 1"
          class="inventory-item__quantity"
        >{{ item.qty }}</span>
      </div>
    </transition-group>

    <div
      v-if="ghostPlacement"
      class="inventory-grid__ghost"
      :class="ghostClasses"
      :style="ghostStyle"
    />

    <Teleport to="body">
      <InventoryItemTooltip
        v-if="hoveredItem && !isDragging"
        :item="hoveredItem"
        :position="tooltipPosition"
      />
    </Teleport>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';

import { CELL_GAP_PX, CELL_SIZE_PX } from '@/core/inventory/constants.js';
import { coordsFromIndex } from '@/core/inventory/grid-math.js';
import { getItemDimensions } from '@/core/inventory/footprint.js';
import { resolveInventoryItemArt } from '@/core/inventory/item-art.js';
import {
  getInventoryItemRarity,
  getInventoryVesselPips,
} from '@/core/inventory/item-presentation.js';
import { canEquipInventoryItemToSlot, useInventoryStore } from '@/stores/inventory.js';
import InventoryItemTooltip from './InventoryItemTooltip.vue';

export default {
  name: 'InventoryGrid',
  components: {
    InventoryItemTooltip,
  },
  emits: ['commit'],
  props: {
    images: {
      type: Object,
      default: () => ({}),
    },
    columns: {
      type: Number,
      required: true,
    },
    rows: {
      type: Number,
      required: true,
    },
  },
  setup(props, { emit }) {
    const gridRef = ref(null);
    const hoveredItem = ref(null);
    const tooltipPosition = ref({ x: 0, y: 0 });
    const inventoryStore = useInventoryStore();
    const {
      items,
      dragState,
      isDragging,
      activeItem,
    } = storeToRefs(inventoryStore);

    const gridStyle = computed(() => ({
      '--cell-size': `${CELL_SIZE_PX}px`,
      '--cell-gap': `${CELL_GAP_PX}px`,
      gridTemplateColumns: `repeat(${props.columns}, var(--cell-size))`,
      gridAutoRows: 'var(--cell-size)',
    }));

    const totalSlots = computed(() => props.columns * props.rows);

    const pointerCellFromEvent = (event) => {
      const element = gridRef.value;
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const cellSize = CELL_SIZE_PX + CELL_GAP_PX;
      const x = Math.floor(offsetX / cellSize);
      const y = Math.floor(offsetY / cellSize);

      if (x < 0 || y < 0 || x >= props.columns || y >= props.rows) {
        return null;
      }

      return { x, y };
    };

    const handlePointerMove = (event) => {
      if (!isDragging.value) {
        return;
      }

      const pointerCell = pointerCellFromEvent(event);
      if (!pointerCell) {
        return;
      }

      inventoryStore.updatePointerCell(pointerCell);
    };

    const handlePointerLeave = () => {
      hoveredItem.value = null;
      if (!isDragging.value) {
        return;
      }

      inventoryStore.clearHoverTarget();
    };

    const externalDropTargetFromEvent = (event) => {
      const targets = [];
      if (event?.target) {
        targets.push(event.target);
      }
      if (
        typeof document !== 'undefined'
        && Number.isFinite(event?.clientX)
        && Number.isFinite(event?.clientY)
      ) {
        const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (pointTarget && pointTarget !== event.target) {
          targets.push(pointTarget);
        }
      }

      const closest = selector => targets
        .map(target => (target && typeof target.closest === 'function' ? target.closest(selector) : null))
        .find(Boolean);

      const equipmentSlot = closest('[data-equipment-slot]');
      if (equipmentSlot) {
        const slotId = equipmentSlot.getAttribute('data-equipment-slot');
        return {
          type: 'equipment',
          slotId,
          valid: canEquipInventoryItemToSlot(activeItem.value, slotId),
        };
      }

      if (closest('[data-world-drop-zone]')) {
        return { type: 'world-drop' };
      }

      return null;
    };

    const handlePointerUp = (event) => {
      if (!isDragging.value) {
        return;
      }

      const pointerCell = pointerCellFromEvent(event);
      if (pointerCell) {
        inventoryStore.updatePointerCell(pointerCell);
      }

      const externalTarget = externalDropTargetFromEvent(event);
      if (externalTarget) {
        inventoryStore.setHoverTarget(externalTarget);
      }

      const result = inventoryStore.commitDrop();
      emit('commit', result);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    const beginPointerDrag = (event, item) => {
      hoveredItem.value = null;
      const cell = pointerCellFromEvent(event) || coordsFromIndex(item.slot, props.columns);
      const offset = {
        x: cell.x - item.position.x,
        y: cell.y - item.position.y,
      };

      inventoryStore.beginDrag(item.uuid, 'inventory', { pointerOffset: offset });
      window.addEventListener('pointerup', handlePointerUp);
    };

    // Deterministic equip: double-clicking an equippable item sends it to its
    // ragdoll slot without relying on drag hit-testing. Reuses the same
    // 'equip' commit the drag path emits.
    const handleDoubleClick = (item) => {
      if (!item || item.stackable) {
        return;
      }
      const slotId = item.equipSlot || item.slotType;
      if (!slotId) {
        return;
      }
      inventoryStore.cancelDrag();
      emit('commit', {
        cancelled: false,
        type: 'equip',
        slotId,
        item,
      });
    };

    const handleKeyUp = (event) => {
      if (!isDragging.value) {
        return;
      }

      if (event.key?.toLowerCase() === 'r') {
        inventoryStore.rotateActiveItem();
      }
    };

    onMounted(() => {
      window.addEventListener('keyup', handleKeyUp);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keyup', handleKeyUp);
    });

    const itemStyle = (item) => {
      const { width, height } = getItemDimensions(item, item.orientation);
      return {
        gridColumnStart: item.position.x + 1,
        gridColumnEnd: `span ${width}`,
        gridRowStart: item.position.y + 1,
        gridRowEnd: `span ${height}`,
      };
    };

    const backgroundSrc = (tileset) => {
      if (!props.images) {
        return '';
      }

      switch (tileset) {
      case 'general':
        return props.images.generalImage ? props.images.generalImage.src : '';
      case 'jewelry':
        return props.images.jewelryImage ? props.images.jewelryImage.src : '';
      case 'armor':
        return props.images.armorImage ? props.images.armorImage.src : '';
      default:
        return props.images.weaponsImage ? props.images.weaponsImage.src : '';
      }
    };

    const itemSpriteStyle = (item) => {
      const { graphics = {} } = item;
      const { tileset = 'weapons', column = 0, row = 0 } = graphics;

      return {
        backgroundImage: `url(${backgroundSrc(tileset)})`,
        backgroundPosition: `left -${column * CELL_SIZE_PX}px top -${row * CELL_SIZE_PX}px`,
      };
    };

    const itemArt = item => resolveInventoryItemArt(item);
    const itemPips = item => getInventoryVesselPips(item).filter(pip => pip.kind !== 'empty');

    const setTooltipPosition = (event) => {
      if (!event) {
        return;
      }
      tooltipPosition.value = {
        x: Number.isFinite(event.clientX) ? event.clientX : 0,
        y: Number.isFinite(event.clientY) ? event.clientY : 0,
      };
    };

    const showItemTooltip = (item, event) => {
      if (isDragging.value) {
        return;
      }
      hoveredItem.value = item;
      setTooltipPosition(event);
    };

    const moveItemTooltip = (event) => {
      if (!hoveredItem.value || isDragging.value) {
        return;
      }
      setTooltipPosition(event);
    };

    const showFocusedItemTooltip = (item, event) => {
      if (isDragging.value) {
        return;
      }
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      hoveredItem.value = item;
      tooltipPosition.value = rect
        ? { x: rect.right, y: rect.top }
        : { x: 0, y: 0 };
    };

    const hideItemTooltip = () => {
      hoveredItem.value = null;
    };

    const isItemDragging = (uuid) => dragState.value?.activeItemId === uuid;

    const itemClasses = (item) => ([
      'inventory-item',
      `inventory-item--rarity-${getInventoryItemRarity(item)}`,
      { 'inventory-item--dragging': isItemDragging(item.uuid) },
    ]);

    const itemTooltip = (item) => {
      const { width, height } = getItemDimensions(item, item.orientation);
      const name = item.displayName || item.name || item.id || 'Item';
      const header = `${name} (${width} x ${height})`;
      const vesselLines = Array.isArray(item.vessel?.lines)
        ? item.vessel.lines.filter(line => line.section !== 'name').map(line => line.text)
        : [];
      return vesselLines.length ? [header, ...vesselLines].join('\n') : header;
    };

    const ghostPlacement = computed(() => {
      if (!dragState.value.ghostPosition) {
        return null;
      }

      const item = activeItem.value;
      if (!item) {
        return null;
      }

      return {
        position: dragState.value.ghostPosition,
        orientation: dragState.value.orientation,
        valid: dragState.value.hoverTarget?.valid,
      };
    });

    const ghostClasses = computed(() => ({
      'inventory-grid__ghost--invalid': ghostPlacement.value && ghostPlacement.value.valid === false,
    }));

    const ghostStyle = computed(() => {
      if (!ghostPlacement.value) {
        return {};
      }

      const item = activeItem.value;
      if (!item) {
        return {};
      }

      const { width, height } = getItemDimensions(item, ghostPlacement.value.orientation);

      return {
        gridColumnStart: ghostPlacement.value.position.x + 1,
        gridColumnEnd: `span ${width}`,
        gridRowStart: ghostPlacement.value.position.y + 1,
        gridRowEnd: `span ${height}`,
      };
    });

    return {
      gridRef,
      items,
      dragState,
      gridStyle,
      totalSlots,
      hoveredItem,
      tooltipPosition,
      isDragging,
      handlePointerMove,
      handlePointerLeave,
      beginPointerDrag,
      handleDoubleClick,
      showItemTooltip,
      moveItemTooltip,
      showFocusedItemTooltip,
      hideItemTooltip,
      itemStyle,
      itemSpriteStyle,
      itemArt,
      itemPips,
      itemClasses,
      itemTooltip,
      isItemDragging,
      ghostPlacement,
      ghostClasses,
      ghostStyle,
    };
  },
};
</script>

<style lang="scss" scoped>
.inventory-grid {
  position: relative;
  display: grid;
  gap: var(--cell-gap);
  padding: var(--cell-gap);
  width: max-content;
  background:
    linear-gradient(180deg, rgba(23, 25, 29, 0.92), rgba(9, 10, 12, 0.96)),
    rgba(0, 0, 0, 0.76);
  border-radius: 6px;
  border: 2px solid #17100b;
  border-top-color: rgba(167, 132, 74, 0.55);
  border-left-color: rgba(126, 104, 69, 0.48);
  box-shadow:
    inset 0 0 0 1px rgba(204, 171, 101, 0.12),
    inset 0 0 24px rgba(0, 0, 0, 0.82),
    0 10px 24px rgba(0, 0, 0, 0.42);
  user-select: none;
}

.inventory-grid__cell {
  width: var(--cell-size);
  height: var(--cell-size);

  /* Navy slot-well texture (WIZARD PoE-style chrome) under a darkening wash. */
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    linear-gradient(180deg, rgba(10, 16, 30, 0.62), rgba(6, 9, 18, 0.72)),
    url('@/assets/inventory/slot_texture.png');
  background-size: cover, cover, var(--cell-size) var(--cell-size);
  border: 1px solid rgba(117, 101, 78, 0.22);
  box-sizing: border-box;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.72);
}

.inventory-item {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
  cursor: grab;
  border: 1px solid rgba(156, 137, 100, 0.52);
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.055), transparent 52%),
    rgba(8, 9, 11, 0.18);
  border-radius: 4px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 -8px 14px rgba(0, 0, 0, 0.48),
    0 3px 8px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s ease;
}

.inventory-item::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 3px;
  border: 1px solid rgba(255, 235, 180, 0.08);
  pointer-events: none;
}

.inventory-item:hover {
  transform: translateY(-1px);
  border-color: rgba(236, 202, 122, 0.86);
  filter: brightness(1.08);
}

.inventory-item:focus-visible {
  outline: 1px solid rgba(236, 202, 122, 0.92);
  outline-offset: 2px;
}

.inventory-item--rarity-magic {
  border-color: rgba(105, 155, 233, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(122, 175, 255, 0.12),
    inset 0 -8px 14px rgba(0, 0, 0, 0.48),
    0 0 12px rgba(62, 115, 202, 0.2);
}

.inventory-item--rarity-rare {
  border-color: rgba(238, 202, 94, 0.92);
  box-shadow:
    inset 0 0 0 1px rgba(255, 224, 121, 0.16),
    inset 0 -8px 14px rgba(0, 0, 0, 0.48),
    0 0 14px rgba(220, 163, 54, 0.24);
}

.inventory-item--dragging {
  opacity: 0.45;
  cursor: grabbing;
}

.inventory-item__sprite {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--cell-size);
  height: var(--cell-size);
  transform: translate(-50%, -50%);
  background-repeat: no-repeat;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.85));
  image-rendering: pixelated;
}

.inventory-item__art {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: 92%;
  height: 90%;
  object-fit: contain;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.72));
  pointer-events: none;
  user-select: none;
}

.inventory-item__pips {
  position: absolute;
  right: 3px;
  bottom: 2px;
  left: 3px;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1;
  text-shadow: 0 1px 2px #000;
}

.inventory-item__pip--brand {
  color: #dfb84e;
}

.inventory-item__pip--bond {
  color: #65b8a7;
}

.inventory-item__pip--trophy {
  color: #b88bea;
}

.inventory-item__pip--scar {
  color: #a75d5d;
}

.inventory-item__quantity {
  position: relative;
  z-index: 3;
  margin: 4px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  font-size: 12px;
  color: #ffe28a;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
}

.inventory-grid__ghost {
  pointer-events: none;
  border: 2px solid rgba(106, 210, 150, 0.72);
  background: rgba(72, 180, 120, 0.16);
  box-shadow: inset 0 0 14px rgba(72, 180, 120, 0.22);
}

.inventory-grid__ghost--invalid {
  border-color: rgba(220, 70, 75, 0.82);
  background: rgba(180, 40, 48, 0.18);
  box-shadow: inset 0 0 14px rgba(180, 40, 48, 0.26);
}

.inventory-item-enter-active,
.inventory-item-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.inventory-item-enter-from,
.inventory-item-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
