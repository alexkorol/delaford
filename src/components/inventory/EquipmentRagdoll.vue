<template>
  <div class="equipment-ragdoll">
    <svg class="equipment-ragdoll__skeleton" viewBox="0 0 160 200" preserveAspectRatio="xMidYMid meet">
      <line x1="80" x2="80" y1="25" y2="185" />
      <line x1="28" x2="28" y1="130" y2="185" />
      <line x1="132" x2="132" y1="130" y2="185" />
      <line x1="132" x2="28" y1="145" y2="145" />
      <line x1="132" x2="28" y1="93" y2="93" />
    </svg>

    <div class="equipment-ragdoll__slots">
      <div class="row">
        <equipment-slot
          slot-id="head"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
      </div>

      <div class="row">
        <equipment-slot
          slot-id="back"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <equipment-slot
          slot-id="necklace"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <div class="slot arrows" />
      </div>

      <div class="row">
        <equipment-slot
          slot-id="right_hand"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <equipment-slot
          slot-id="armor"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <equipment-slot
          slot-id="left_hand"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
      </div>

      <div class="row">
        <equipment-slot
          slot-id="gloves"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <equipment-slot
          slot-id="feet"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
        <equipment-slot
          slot-id="ring"
          :wear="wear"
          :images="resolvedImages"
          @open-context-menu="showContextMenu"
        />
      </div>
    </div>
  </div>
</template>

<script>
import UI from '@shared/ui.js';
import bus from '../../core/utilities/bus.js';
import ClientUI from '../../core/utilities/client-ui.js';
import EquipmentSlot from '../sub/EquipmentSlot.vue';

export default {
  name: 'EquipmentRagdoll',
  components: {
    EquipmentSlot,
  },
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
  },
  created() {
    bus.$on('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  beforeUnmount() {
    bus.$off('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  methods: {
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
  --eq-slot-size: 40px;

  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto;
  justify-items: center;
  padding: 10px 12px 12px;
  background:
    radial-gradient(circle at 50% 42%, rgba(82, 18, 24, 0.2), transparent 48%),
    linear-gradient(180deg, rgba(26, 29, 33, 0.94), rgba(8, 9, 11, 0.92));
  border: 1px solid rgba(180, 145, 86, 0.34);
  border-radius: 6px;
  font-family: 'GameFont', sans-serif;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 190, 0.04),
    inset 0 0 24px rgba(0, 0, 0, 0.72);

  &__skeleton {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 146px;
    height: 200px;
    stroke: rgba(194, 165, 105, 0.22);
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.75));
  }

  &__slots {
    position: relative;
    display: grid;
    grid-auto-rows: minmax(40px, auto);
    gap: 7px;
    padding-top: 6px;
    z-index: 1;
  }
}

.row {
  display: grid;
  grid-auto-flow: column;
  justify-content: center;
  gap: 7px;
}

.slot {
  width: var(--eq-slot-size);
  height: var(--eq-slot-size);
  background-color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(180, 145, 86, 0.28);
  border-radius: 4px;
  box-shadow:
    inset 0 0 8px rgba(0, 0, 0, 0.82),
    0 1px 0 rgba(255, 235, 190, 0.05);
}

.slot.arrows {
  background: rgba(0, 0, 0, 0.25);
  border-style: dashed;
}
</style>
