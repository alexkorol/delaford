<template>
  <div
    v-tippy
    :title="tooltip"
    :class="rootClasses"
    :data-equipment-slot="slotId"
    @click.left="handleSelect"
    @contextmenu.prevent="emitContext($event, false)"
    @mouseover="emitContext($event, true)"
    @pointerdown.left="handlePointerDown"
    @pointerup.left.stop.prevent="handlePointerUp"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <div
      v-if="isFilled"
      :class="['wearSlot', backgroundClass]"
      :style="backgroundStyle"
    />
  </div>
</template>

<script>
import { mapStores } from 'pinia';
import { unref } from 'vue';

import { canEquipInventoryItemToSlot } from '@/stores/inventory.js';
import { useUiStore } from '@/stores/ui.js';
import bus from '../../core/utilities/bus.js';

const storeValue = value => unref(value);
const isStoreDragging = store => Boolean(store && storeValue(store.isDragging));

export default {
  name: 'EquipmentSlot',
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
    handlePointerEnter() {
      if (!isStoreDragging(this.inventoryDragStore)) {
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
      if (!isStoreDragging(this.inventoryDragStore)) {
        return;
      }

      if (storeValue(this.inventoryDragStore.dragState)?.hoverTarget?.slotId === this.slotId) {
        this.inventoryDragStore.clearHoverTarget();
      }
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
      if (this.item && Object.hasOwnProperty.call(this.item, 'name')) {
        return this.item.name;
      }

      return '';
    },
    rootClasses() {
      return [
        'slot',
        this.slotId,
        { wearSlot: this.isFilled },
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
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid rgba(180, 145, 86, 0.32);
  background-color: rgba(5, 6, 8, 0.72);
  box-shadow:
    inset 0 0 7px rgba(0, 0, 0, 0.78),
    inset 0 1px 0 rgba(255, 242, 202, 0.05);

  &.wearSlot {
    background-color: rgba(7, 8, 10, 0.8);
    border-color: rgba(231, 199, 124, 0.62);
  }

  .wearSlot {
    width: 32px;
    height: 32px;
    transform: scale(var(--eq-sprite-scale, 1.25));
    transform-origin: center;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.8));
  }
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

.slot.arrows {
  background-image: url(../../assets/graphics/ui/client/slots/wear/arrows.png);
  border-style: dashed;
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
