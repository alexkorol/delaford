<template>
  <div class="equipment-ragdoll">
    <div
      v-if="unlockedAuxiliaryWindows.length"
      class="equipment-ragdoll__aux-tabs"
      aria-label="Unlocked auxiliary windows"
    >
      <button
        v-for="panel in unlockedAuxiliaryWindows"
        :key="panel.id"
        type="button"
        class="equipment-ragdoll__aux-toggle"
        :data-axis="panel.axis"
        :aria-expanded="openAuxiliaryId === panel.id"
        :aria-label="`${openAuxiliaryId === panel.id ? 'Close' : 'Open'} ${panel.label}`"
        :aria-controls="panel.id"
        :title="panel.label"
        @click="toggleAuxiliary(panel.id)"
      >{{ openAuxiliaryId === panel.id ? '>>' : '<<' }}</button>
    </div>

    <aside
      v-if="openAuxiliaryWindow"
      :id="openAuxiliaryWindow.id"
      class="equipment-ragdoll__aux-drawer"
      :aria-label="openAuxiliaryWindow.label"
    >
      <header class="equipment-ragdoll__aux-head">
        <span>{{ openAuxiliaryWindow.label }}</span>
        <small>{{ openAuxiliaryWindow.axisLabel }}</small>
      </header>
      <div
        v-if="openAuxiliaryWindow.kind === 'pack'"
        class="equipment-ragdoll__aux-pack"
        aria-label="Empty specialty pack"
      >
        <span v-for="cell in 16" :key="cell" />
      </div>
      <div v-else class="equipment-ragdoll__aux-seat">
        {{ openAuxiliaryWindow.seatLabel }}
      </div>
    </aside>

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
  { id: 'back', label: 'Cloak', column: 3, row: 1, width: 2, height: 3 },
  { id: 'necklace', label: 'Neck', column: 3, row: 4, width: 2, height: 2 },
  { id: 'ring2', label: 'Ring', column: 3, row: 6, width: 1, height: 1 },
  { id: 'ring', label: 'Ring', column: 4, row: 6, width: 1, height: 1 },
  { id: 'head', label: 'Head', column: 5, row: 1, width: 2, height: 2 },
  { id: 'armor', label: 'Body', column: 5, row: 3, width: 2, height: 3 },
  { id: 'belt', label: 'Belt', column: 5, row: 6, width: 2, height: 1 }, // waist, below the body
  { id: 'left_hand', label: 'Off hand', column: 7, row: 1, width: 2, height: 4 }, // offhand/shield
  { id: 'gloves', label: 'Hands', column: 1, row: 5, width: 2, height: 2 },
  { id: 'feet', label: 'Feet', column: 7, row: 5, width: 2, height: 2 },
];

const AUXILIARY_WINDOWS = [
  { id: 'war-call-window', label: 'War-call', axis: 'str', axisLabel: 'Strength', unlock: 'war_call_slot', kind: 'seat', seatLabel: 'War-call seat' },
  { id: 'quick-rig-window', label: 'Quick Rig', axis: 'dex', axisLabel: 'Dexterity', unlock: 'quick_rig_slot', kind: 'seat', seatLabel: 'Quick Rig seat' },
  { id: 'attendant-window', label: 'Attendant', axis: 'int', axisLabel: 'Intellect', unlock: 'attendant_focus_slot', kind: 'seat', seatLabel: 'Attendant focus' },
  { id: 'spoils-roll-window', label: 'Spoils Roll', axis: 'str-dex', axisLabel: 'Strength / Dexterity', unlock: 'spoils_pack', kind: 'pack' },
  { id: 'preparation-case-window', label: 'Preparation Case', axis: 'dex-int', axisLabel: 'Dexterity / Intellect', unlock: 'preparations_pack', kind: 'pack' },
  { id: 'reliquary-window', label: 'Reliquary', axis: 'int-str', axisLabel: 'Intellect / Strength', unlock: 'reliquary_pack', kind: 'pack' },
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
  data() {
    return {
      openAuxiliaryId: null,
    };
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
    passiveUnlocks() {
      return Array.isArray(this.game?.player?.passiveTreeStats?.unlocks)
        ? this.game.player.passiveTreeStats.unlocks
        : [];
    },
    unlockedAuxiliaryWindows() {
      return AUXILIARY_WINDOWS.filter(panel => this.passiveUnlocks.includes(panel.unlock));
    },
    openAuxiliaryWindow() {
      return this.unlockedAuxiliaryWindows.find(panel => panel.id === this.openAuxiliaryId) || null;
    },
  },
  created() {
    bus.$on('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  beforeUnmount() {
    bus.$off('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  methods: {
    toggleAuxiliary(panelId) {
      this.openAuxiliaryId = this.openAuxiliaryId === panelId ? null : panelId;
    },
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
  // WIZARD's paper-doll is authored around a 78px unit. Retain that full
  // scale on the wide game layout while keeping the pane usable on narrower
  // viewports; even the minimum is larger than Delaford's old 38-50px cells.
  --eq-cell: clamp(54px, 4.45vw, 78px);
  --eq-gap: 6px;
  --eq-sprite-scale: 2;

  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background:
    radial-gradient(circle at 50% 42%, rgba(96, 71, 28, 0.12), transparent 45%),
    linear-gradient(180deg, rgba(25, 23, 19, 0.95), rgba(8, 8, 8, 0.94));
  border: 1px solid rgba(180, 145, 86, 0.34);
  border-radius: 0;
  font-family: 'GameFont', sans-serif;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 190, 0.04),
    inset 0 0 24px rgba(0, 0, 0, 0.72);

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

  &__aux-tabs {
    position: absolute;
    top: 10px;
    left: calc(50% - (var(--eq-cell) * 4) - (var(--eq-gap) * 3.5) - 25px);
    z-index: 5;
    display: grid;
    gap: 3px;
  }

  &__aux-toggle {
    width: 22px;
    height: 28px;
    padding: 0;
    border: 1px solid rgba(184, 147, 80, 0.46);
    border-right-color: rgba(226, 192, 119, 0.7);
    color: rgba(226, 205, 159, 0.84);
    background: linear-gradient(180deg, rgba(34, 29, 21, 0.98), rgba(8, 8, 8, 0.98));
    box-shadow: inset 0 0 7px rgba(0, 0, 0, 0.75), 0 3px 8px rgba(0, 0, 0, 0.55);
    cursor: pointer;
    font-family: 'GameFont', sans-serif;
    font-size: 9px;
    line-height: 1;
  }

  &__aux-toggle[data-axis='str'] { border-color: rgba(232, 101, 86, 0.66); }
  &__aux-toggle[data-axis='dex'] { border-color: rgba(86, 200, 139, 0.66); }
  &__aux-toggle[data-axis='int'] { border-color: rgba(110, 156, 255, 0.66); }
  &__aux-toggle[data-axis='str-dex'] { border-color: rgba(224, 180, 75, 0.66); }
  &__aux-toggle[data-axis='dex-int'] { border-color: rgba(77, 201, 188, 0.66); }
  &__aux-toggle[data-axis='int-str'] { border-color: rgba(185, 123, 235, 0.66); }

  &__aux-toggle:hover,
  &__aux-toggle:focus-visible {
    border-color: rgba(235, 199, 116, 0.9);
    color: #f2d886;
    outline: none;
  }

  &__aux-drawer {
    position: absolute;
    top: 8px;
    right: calc(50% + (var(--eq-cell) * 4) + (var(--eq-gap) * 3.5) + 6px);
    z-index: 4;
    display: grid;
    gap: 5px;
    width: 202px;
    padding: 9px;
    box-sizing: border-box;
    border: 1px solid rgba(184, 147, 80, 0.4);
    background:
      radial-gradient(circle at 100% 0, rgba(104, 73, 26, 0.16), transparent 42%),
      linear-gradient(180deg, rgba(20, 18, 15, 0.98), rgba(7, 7, 7, 0.98));
    box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.72), 0 12px 26px rgba(0, 0, 0, 0.58);
  }

  &__aux-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 1px 7px;
    color: rgba(224, 205, 163, 0.82);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__aux-head small {
    color: rgba(164, 150, 123, 0.62);
    font-size: 8px;
    letter-spacing: 0.05em;
  }

  &__aux-pack {
    display: grid;
    grid-template-columns: repeat(4, 38px);
    grid-template-rows: repeat(4, 38px);
    gap: 3px;
    justify-content: center;
    padding: 5px;
    border: 1px solid rgba(161, 135, 91, 0.24);
    background: rgba(5, 6, 8, 0.68);
    box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.72);
  }

  &__aux-pack span,
  &__aux-seat {
    border: 1px solid rgba(117, 101, 78, 0.26);
    background:
      linear-gradient(180deg, rgba(10, 16, 30, 0.62), rgba(6, 9, 18, 0.72)),
      url('@/assets/inventory/slot_texture.png') center / cover;
    box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.72);
  }

  &__aux-seat {
    display: grid;
    place-items: center;
    width: 92px;
    height: 92px;
    margin: 4px auto 7px;
    color: rgba(174, 159, 130, 0.48);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
  }
}

@media (width <= 700px) {
  .equipment-ragdoll__aux-drawer {
    right: 8px;
    left: 8px;
    width: auto;
  }
}

</style>
