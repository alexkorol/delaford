<template>
  <div class="equipment-ragdoll">
    <header class="equipment-ragdoll__header">
      <span>Equipment</span>
    </header>
    <div class="equipment-ragdoll__slots">
      <equipment-slot
        v-for="descriptor in slotLayout"
        :key="descriptor.id"
        :slot-id="descriptor.id"
        :label="descriptor.label"
        :wear="wear"
        :images="resolvedImages"
        :style="slotStyle(descriptor)"
        class="equipment-ragdoll__slot"
        @open-context-menu="showContextMenu"
        @commit="$emit('commit', $event)"
      />
    </div>
  </div>
</template>

<script>
import UI from '@shared/ui.js';
import bus from '../../core/utilities/bus.js';
import ClientUI from '../../core/utilities/client-ui.js';
import EquipmentSlot from '../sub/EquipmentSlot.vue';

// Diablo/PoE-style footprints on an 8x6 cell grid.
// column/row are 1-based CSS grid lines; width/height are cell spans.
const SLOT_LAYOUT = [
  { id: 'right_hand', label: 'Main hand', column: 1, row: 1, width: 2, height: 4 }, // weapon, up to 2x4 two-hander
  { id: 'back', label: 'Back', column: 3, row: 1, width: 1, height: 2 }, // cape
  { id: 'head', label: 'Head', column: 4, row: 1, width: 2, height: 2 },
  { id: 'necklace', label: 'Neck', column: 6, row: 2, width: 1, height: 1 },
  { id: 'left_hand', label: 'Off hand', column: 7, row: 1, width: 2, height: 4 }, // offhand/shield
  { id: 'armor', label: 'Body', column: 4, row: 3, width: 2, height: 3 }, // body armour 2x3
  { id: 'ring', label: 'Ring', column: 3, row: 4, width: 1, height: 1 },
  { id: 'gloves', label: 'Hands', column: 1, row: 5, width: 2, height: 2 },
  { id: 'feet', label: 'Feet', column: 7, row: 5, width: 2, height: 2 },
];

export default {
  name: 'EquipmentRagdoll',
  components: {
    EquipmentSlot,
  },
  emits: ['commit'],
  props: {
    game: {
      type: Object,
      required: true,
    },
    images: {
      type: Object,
      default: () => ({}),
    },
  },
  computed: {
    wear() {
      return (this.game && this.game.player && this.game.player.wear) ? this.game.player.wear : {};
    },
    resolvedImages() {
      if (this.images && Object.keys(this.images).length) {
        return this.images;
      }
      return (this.game && this.game.map && this.game.map.images) ? this.game.map.images : {};
    },
    slotLayout() {
      return SLOT_LAYOUT;
    },
  },
  created() {
    bus.$on('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  beforeUnmount() {
    bus.$off('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  methods: {
    slotStyle(descriptor) {
      return {
        gridColumn: `${descriptor.column} / span ${descriptor.width}`,
        gridRow: `${descriptor.row} / span ${descriptor.height}`,
      };
    },
    showContextMenu(event, slot, firstOnly = false) {
      const coordinates = UI.getViewportCoordinates(event);

      const data = {
        event,
        coordinates,
        slot,
        target: event.target,
      };

      if (!firstOnly) {
        event.preventDefault();
        bus.$emit('PLAYER:MENU', data);
      }

      if (firstOnly && event && event.target) {
        bus.$emit('PLAYER:MENU', {
          coordinates,
          event,
          slot,
          target: event.target,
          firstOnly: true,
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.equipment-ragdoll {
  --eq-cell: clamp(38px, 2.8vw, 54px);
  --eq-gap: 6px;

  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(12px, 1.4vw, 22px);
  background:
    radial-gradient(circle at 50% 42%, rgba(96, 71, 28, 0.12), transparent 45%),
    linear-gradient(180deg, rgba(25, 23, 19, 0.95), rgba(8, 8, 8, 0.94));
  border: 1px solid rgba(180, 145, 86, 0.34);
  border-radius: 6px;
  font-family: 'GameFont', sans-serif;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 190, 0.04),
    inset 0 0 24px rgba(0, 0, 0, 0.72);

  &__header {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    margin: -4px 0 10px;
    color: #e8c76a;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  }

  &__header::before,
  &__header::after {
    flex: 1;
    height: 12px;
    content: '';
    opacity: 0.5;
    background: url('@/assets/inventory/divider.png') center / contain no-repeat;
  }

  &__slots {
    position: relative;
    display: grid;
    grid-template-columns: repeat(8, var(--eq-cell));
    grid-template-rows: repeat(6, var(--eq-cell));
    gap: var(--eq-gap);
    z-index: 1;
  }

  &__slot {
    width: 100%;
    height: 100%;
  }
}

</style>
