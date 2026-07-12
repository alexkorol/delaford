<template>
  <div
    :class="rootClasses"
    :data-equipment-slot="slotId"
    :aria-label="tooltip || label"
    :tabindex="isFilled ? 0 : -1"
    @click.left="handleSelect"
    @contextmenu.prevent="emitContext($event, false)"
    @mouseover="emitContext($event, true)"
    @pointerdown.left="handlePointerDown"
    @pointerup.left.stop.prevent="handlePointerUp"
    @pointerenter="handlePointerEnter($event)"
    @pointermove="handlePointerMove($event)"
    @pointerleave="handlePointerLeave"
    @focus="handleFocus($event)"
    @blur="hideTooltip"
  >
    <img
      v-if="isFilled && itemArt"
      class="wearSlot equipment-slot__art"
      :src="itemArt"
      alt=""
      draggable="false"
    >
    <div
      v-else-if="isFilled"
      :class="['wearSlot', backgroundClass]"
      :style="backgroundStyle"
    />
    <span
      v-else
      class="equipment-slot__label"
    >{{ label }}</span>
    <div
      v-if="itemPips.length"
      class="equipment-slot__pips"
      aria-hidden="true"
    >
      <span
        v-for="(pip, index) in itemPips"
        :key="`${pip.kind}-${index}`"
        :class="`equipment-slot__pip--${pip.kind}`"
      >{{ pip.symbol }}</span>
    </div>

    <Teleport to="body">
      <InventoryItemTooltip
        v-if="showTooltip && item"
        :item="item"
        :position="tooltipPosition"
      />
    </Teleport>
  </div>
</template>

<script>
import { mapStores } from 'pinia';
import { unref } from 'vue';

import { resolveInventoryItemArt } from '@/core/inventory/item-art.js';
import {
  getInventoryItemRarity,
  getInventoryVesselPips,
} from '@/core/inventory/item-presentation.js';
import { canEquipInventoryItemToSlot } from '@/stores/inventory.js';
import { useUiStore } from '@/stores/ui.js';
import bus from '../../core/utilities/bus.js';
import InventoryItemTooltip from '../inventory/InventoryItemTooltip.vue';

const storeValue = value => unref(value);
const isStoreDragging = store => Boolean(store && storeValue(store.isDragging));

export default {
  name: 'EquipmentSlot',
  components: {
    InventoryItemTooltip,
  },
  emits: ['open-context-menu', 'commit'],
  props: {
    slotId: {
      type: String,
      required: true,
    },
    wear: {
      type: Object,
      default: () => ({}),
    },
    images: {
      type: Object,
      default: () => ({}),
    },
    label: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      showTooltip: false,
      tooltipPosition: { x: 0, y: 0 },
    };
  },
  beforeUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.handlePointerUp);
    }
  },
  inject: {
    inventoryDragStore: {
      from: 'inventoryDragStore',
      default: null,
    },
  },
  methods: {
    handleSelect(event) {
      bus.$emit('canvas:select-action', {
        event,
        item: this.uiStore.action.object,
      });
    },
    handlePointerDown(event) {
      if (!this.item || !this.inventoryDragStore) {
        return;
      }

      event.preventDefault();
      this.hideTooltip();
      this.inventoryDragStore.beginDrag(this.item.uuid, 'equipment', {
        sourceSlotId: this.slotId,
      });

      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointerup', this.handlePointerUp);
      }
    },
    handlePointerUp() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', this.handlePointerUp);
      }

      if (!isStoreDragging(this.inventoryDragStore)) {
        return;
      }

      const result = this.inventoryDragStore.commitDrop();
      this.$emit('commit', result);
    },
    handlePointerEnter(event) {
      if (!isStoreDragging(this.inventoryDragStore)) {
        if (this.item) {
          this.showTooltip = true;
          this.updateTooltipPosition(event);
        }
        return;
      }

      const item = storeValue(this.inventoryDragStore.activeItem);
      this.inventoryDragStore.setHoverTarget({
        type: 'equipment',
        slotId: this.slotId,
        valid: canEquipInventoryItemToSlot(item, this.slotId),
      });
    },
    handlePointerLeave() {
      this.hideTooltip();
      if (!isStoreDragging(this.inventoryDragStore)) {
        return;
      }

      if (storeValue(this.inventoryDragStore.dragState)?.hoverTarget?.slotId === this.slotId) {
        this.inventoryDragStore.clearHoverTarget();
      }
    },
    handlePointerMove(event) {
      if (!this.showTooltip || isStoreDragging(this.inventoryDragStore)) {
        return;
      }
      this.updateTooltipPosition(event);
    },
    handleFocus(event) {
      if (!this.item || isStoreDragging(this.inventoryDragStore)) {
        return;
      }
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      this.showTooltip = true;
      this.tooltipPosition = rect
        ? { x: rect.right, y: rect.top }
        : { x: 0, y: 0 };
    },
    updateTooltipPosition(event) {
      this.tooltipPosition = {
        x: Number.isFinite(event?.clientX) ? event.clientX : 0,
        y: Number.isFinite(event?.clientY) ? event.clientY : 0,
      };
    },
    hideTooltip() {
      this.showTooltip = false;
    },
    emitContext(event, firstOnly) {
      if (!this.item) {
        return;
      }

      this.$emit('open-context-menu', event, this.slotId, firstOnly);
    },
    getTilesetSrc(tileset) {
      if (!this.images) {
        return '';
      }

      switch (tileset) {
      case 'general':
        return this.images.generalImage ? this.images.generalImage.src : '';
      case 'jewelry':
        return this.images.jewelryImage ? this.images.jewelryImage.src : '';
      case 'armor':
        return this.images.armorImage ? this.images.armorImage.src : '';
      default:
        return this.images.weaponsImage ? this.images.weaponsImage.src : '';
      }
    },
  },
  computed: {
    ...mapStores(useUiStore),
    isFilled() {
      return this.wear && this.wear[this.slotId];
    },
    item() {
      return this.isFilled ? this.wear[this.slotId] : null;
    },
    tooltip() {
      if (this.item) {
        return this.item.displayName || this.item.name || this.item.id || this.label;
      }

      return '';
    },
    itemArt() {
      return this.item ? resolveInventoryItemArt(this.item) : null;
    },
    itemPips() {
      return this.item
        ? getInventoryVesselPips(this.item).filter(pip => pip.kind !== 'empty')
        : [];
    },
    rootClasses() {
      return [
        'slot',
        this.slotId,
        { wearSlot: this.isFilled },
        { [`slot--rarity-${getInventoryItemRarity(this.item)}`]: this.isFilled },
        { 'slot--drop-target': this.isDropTarget },
        { 'slot--invalid-drop-target': this.isInvalidDropTarget },
      ];
    },
    backgroundClass() {
      if (!this.item) {
        return '';
      }

      switch (this.slotId) {
      case 'necklace':
      case 'ring':
        return 'jewelryEquipped';
      case 'armor':
      case 'feet':
      case 'left_hand':
      case 'back':
      case 'gloves':
      case 'head':
        return 'armorEquipped';
      default:
        return 'swordEquipped';
      }
    },
    backgroundStyle() {
      if (!this.item) {
        return {};
      }

      const TILE_SIZE = 32;
      const { column = 0, row = 0, tileset = 'weapons' } = this.item.graphics || {};
      return {
        backgroundImage: `url(${this.getTilesetSrc(tileset)})`,
        backgroundPosition: `left -${column * TILE_SIZE}px top -${row * TILE_SIZE}px`,
      };
    },
    isDropTarget() {
      if (!this.inventoryDragStore) {
        return false;
      }

      const target = storeValue(this.inventoryDragStore.dragState)?.hoverTarget;
      return target && target.type === 'equipment' && target.slotId === this.slotId;
    },
    isInvalidDropTarget() {
      if (!this.inventoryDragStore) {
        return false;
      }

      const target = storeValue(this.inventoryDragStore.dragState)?.hoverTarget;
      return target
        && target.type === 'equipment'
        && target.slotId === this.slotId
        && target.valid === false;
    },
  },
};
</script>

<style lang="scss" scoped>
.slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--eq-slot-size, 100%);
  height: var(--eq-slot-size, 100%);
  min-width: 36px;
  min-height: 36px;
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 32px;
  border-radius: 0;
  cursor: pointer;
  border: 1px solid rgba(180, 145, 86, 0.32);
  background-color: rgba(5, 6, 8, 0.72);
  box-shadow:
    inset 0 0 7px rgba(0, 0, 0, 0.78),
    inset 0 1px 0 rgba(255, 242, 202, 0.05);
  overflow: hidden;

  &.wearSlot {
    background-color: rgba(7, 8, 10, 0.8);
    background-image: none !important;
    border-color: rgba(231, 199, 124, 0.62);
  }

  .wearSlot {
    width: 32px;
    height: 32px;
    transform: scale(var(--eq-sprite-scale, 1.25));
    transform-origin: center;
    background-repeat: no-repeat;
    background-position: center;
    image-rendering: pixelated;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.8));
  }
}

.equipment-slot__art {
  z-index: 1;
  width: 92% !important;
  height: 90% !important;
  object-fit: contain;
  transform: none !important;
  image-rendering: auto !important;
  filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.76)) !important;
  pointer-events: none;
  user-select: none;
}

.equipment-slot__label {
  z-index: 1;
  padding: 0 4px;
  color: rgba(174, 159, 130, 0.42);
  font-size: 9px;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-align: center;
  text-transform: uppercase;
  pointer-events: none;
}

.equipment-slot__pips {
  position: absolute;
  right: 3px;
  bottom: 3px;
  left: 3px;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
  font-size: 9px;
  line-height: 1;
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
}

.equipment-slot__pip--brand {
  color: #dfb84e;
}

.equipment-slot__pip--bond {
  color: #65b8a7;
}

.equipment-slot__pip--trophy {
  color: #b88bea;
}

.equipment-slot__pip--scar {
  color: #a75d5d;
}

.slot--rarity-magic {
  border-color: rgba(105, 155, 233, 0.72);
}

.slot--rarity-rare {
  border-color: rgba(238, 202, 94, 0.8);
}

.slot--rarity-unique {
  border-color: rgba(239, 141, 67, 0.9);
  box-shadow: inset 0 0 9px rgba(0, 0, 0, 0.78), 0 0 12px rgba(239, 112, 45, 0.28);
}

.slot--drop-target {
  border-color: rgba(105, 170, 235, 0.82);
  box-shadow:
    inset 0 0 8px rgba(0, 0, 0, 0.78),
    0 0 12px rgba(75, 135, 210, 0.4);
}

.slot--invalid-drop-target {
  border-color: rgba(210, 75, 75, 0.86);
  box-shadow:
    inset 0 0 8px rgba(0, 0, 0, 0.78),
    0 0 12px rgba(185, 55, 55, 0.4);
}

.slot.head {
  background-image: url(../../assets/graphics/ui/client/slots/wear/head.png);
}

.slot.back {
  background-image: url(../../assets/graphics/ui/client/slots/wear/back.png);
}

.slot.necklace {
  background-image: url(../../assets/graphics/ui/client/slots/wear/necklace.png);
}

.slot.right_hand {
  background-image: url(../../assets/graphics/ui/client/slots/wear/right_hand.png);
}

.slot.left_hand {
  background-image: url(../../assets/graphics/ui/client/slots/wear/left_hand.png);
}

.slot.armor {
  background-image: url(../../assets/graphics/ui/client/slots/wear/torso.png);
}

.slot.gloves {
  background-image: url(../../assets/graphics/ui/client/slots/wear/gloves.png);
}

.slot.feet {
  background-image: url(../../assets/graphics/ui/client/slots/wear/feet.png);
}

.slot.ring {
  background-image: url(../../assets/graphics/ui/client/slots/wear/ring.png);
}

.wearSlot.jewelryEquipped {
  background-image: url(../../assets/graphics/items/jewelry.png);
}

.wearSlot.swordEquipped {
  background-image: url(../../assets/graphics/items/weapons.png);
}

.wearSlot.armorEquipped {
  background-image: url(../../assets/graphics/items/armor.png);
}
</style>
