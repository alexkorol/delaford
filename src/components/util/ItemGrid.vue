<template>
  <div
    :style="slotColumnRows"
    class="main grid_container"
  >
    <div
      v-for="(n, i) in (0, slots)"
      :key="i"
      class="grid_cell"
    >
      <div
        v-if="slotHasItem(i)"
        :style="{
          backgroundImage: `url(${getBgUrl(i)})`,
          backgroundPosition: `left -${(getItem(i).column * 32)}px top -${(getItem(i).row * 32)}px`
        }"
        :class="`slot ${getItemFromSlot(i).isLocked} ${getItemFromSlot(i).id} ${gridData(screen).classId} ${isItemSelected(i)}`"
        :aria-label="itemAriaLabel(i)"
        :role="primaryAction ? 'button' : undefined"
        :tabindex="primaryAction ? 0 : undefined"
        @click.left="selectItem($event, i)"
        @keydown.enter.prevent="selectItem($event, i)"
        @mouseover="showContextMenu($event, i, true)"
        @contextmenu.prevent="showContextMenu($event, i)"
      >
        <span
          v-if="hasQuantity(i)"
          :class="`qty ${gridData(screen).classId}`"
          v-text="getItemFromSlot(i).qty"
        />
        <span v-if="screen === 'shop'" class="price">{{ itemPrice(i) }}</span>
      </div>
      <div
        v-else
        :class="`slot empty ${gridData(screen).classId}`"
      />
    </div>
  </div>
</template>

<script>
import { mapStores } from 'pinia';

import UI from '@shared/ui.js';
import { useUiStore } from '@/stores/ui.js';
import bus from '../../core/utilities/bus.js';
import ClientUI from '../../core/utilities/client-ui.js';

export default {
  props: {
    slots: {
      type: Number,
      required: true,
    },
    images: {
      type: Object,
      required: true,
    },
    items: {
      type: Array,
      required: true,
    },
    screen: {
      type: String,
      required: true,
    },
    primaryAction: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      action: '',
    };
  },
  computed: {
    ...mapStores(useUiStore),
    isBankOpen() {
      return document.querySelector('.bankSlot');
    },
    slotColumnRows() {
      const grid = this.gridData(this.screen);
      return {
        'grid-template-columns': `repeat(${grid.columns}, 35px)`,
        'grid-template-rows': `repeat(${grid.rows}, 35px)`,
      };
    },
  },
  created() {
    bus.$on('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  beforeUnmount() {
    bus.$off('game:context-menu:first-only', ClientUI.displayFirstAction);
  },
  methods: {
    /**
     * Get the item's column of a certain slot in the inventory
     *
     * @param {integer} slotNumber The slot index in the inventory
     * @return {integer|boolean}
     */
    getItem(slotNumber) {
      const getItem = this.getItemFromSlot(slotNumber);

      const getGraphic = UI.getItemData(getItem.id);

      if (getItem) {
        let { column } = getGraphic.graphics;
        if (getGraphic.graphics.quantityLevel) {
          const qtyColumn = this.getQuantityColumn(slotNumber, getGraphic.graphics);
          column = qtyColumn;
        }

        return {
          column,
          row: getGraphic.graphics.row,
        };
      }

      return false;
    },

    /**
     * Get the correct graphic depending on quantity on item
     *
     * @param {integer} slotNumber The slot index in the inventory
     * @return {integer}
     */
    getQuantityColumn(slotNumber, graphics) {
      const findCorrectItem = this.items.find((e) => e.slot === slotNumber);

      if (findCorrectItem.qty && graphics.quantityLevel) {
        findCorrectItem.graphics = graphics;
        findCorrectItem.column = graphics.quantityLevel.findIndex((x) => x > findCorrectItem.qty);
        findCorrectItem.column = (findCorrectItem.column === -1 ? graphics.quantityLevel.length : findCorrectItem.column) - 1;
      }

      return findCorrectItem.column;
    },
    /**
     * Does this item quantity, and thus is stackable?
     *
     * @param {integer} item The item of the shouldComponentUpdate = (nextProps, nextState) => {
     * @return {boolean}
     */
    hasQuantity(item) {
      if (this.screen === 'shop' && this.getItemFromSlot(item).qty !== 1) return true;
      if (this.getItemFromSlot(item).graphics) {
        return this.getItemFromSlot(item).graphics.quantityLevel;
      }

      return (this.getItemFromSlot(item).qty && this.getItemFromSlot(item).qty > 1);
    },
    /**
     * Is the item selected?
     *
     * @param {integer} slot The slot we are examining
     * @return {boolean}
     */
    isItemSelected(slot) {
      return this.itemSelected === slot ? 'selected' : '';
    },
    /**
     * Select the item to let player know its in use
     *
     * @param {integer} slot The item in the slot we are selecting
     */
    selectItem(event, slot) {
      // Allow 'selecting' an item only on the Inventory or if its not already selected

      if (this.primaryAction) {
        this.$emit('item-primary', {
          action: this.primaryAction,
          item: this.getItemFromSlot(slot),
        });
        return;
      }

      bus.$emit('canvas:select-action', {
        event,
        item: this.uiStore.action.object,
      });

      // this.itemSelected = this.itemSelected === slot || this.screen !== 'inventory' ? false : slot;
    },
    gridData(section) {
      const modifier = {
        furnace: {
          columns: 6,
          rows: 1,
          classId: 'furnaceSlot',
        },
        anvil: {
          columns: 5,
          rows: 3,
          classId: 'anvilSlot',
        },
        inventory: {
          columns: 12,
          rows: 7,
          classId: 'inventorySlot',
        },
        bank: {
          columns: 8,
          rows: 6,
          classId: 'bankSlot',
        },
        shop: {
          columns: 11,
          rows: 4,
          classId: 'shopSlot',
        },
      };

      return modifier[section];
    },
    /**
     * Right-click brings up context-menu
     *
     * @param {event} event The mouse-click event
     */
    showContextMenu(event, index, firstOnly = false) {
      this.$forceUpdate();

      const coordinates = UI.getViewportCoordinates(event);

      const data = {
        event,
        coordinates,
        slot: index,
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
          slot: index,
          target: event.target,
          firstOnly: true,
        });
      }
    },
    /**
     * Check to see if this slot is available
     *
     * @param {integer} slotNumber The index of the slot in inventory
     * @return {boolean}
     */
    slotHasItem(slotNumber) {
      const itemFound = this.items.find((s) => s.slot === slotNumber);
      if (!itemFound) {
        return false;
      }

      if (itemFound) {
        return true;
      }

      return false;
    },
    /**
     * Gets the item from current slot
     *
     * @param {integer} slotNumber The current slot number
     * @returns {object}
     */
    getItemFromSlot(slotNumber) {
      return this.items.find((s) => s.slot === slotNumber);
    },
    itemPrice(slotNumber) {
      return Math.max(0, Number(UI.getItemData(this.getItemFromSlot(slotNumber).id)?.price) || 0);
    },
    itemAriaLabel(slotNumber) {
      const item = this.getItemFromSlot(slotNumber);
      const definition = UI.getItemData(item.id);
      if (this.screen === 'shop') {
        return `Buy ${definition?.name || item.id} for ${this.itemPrice(slotNumber)} coins`;
      }
      return definition?.name || item.id;
    },
    /**
     * Get the correct background URL to show in inventory
     *
     * @param {string} item The item type in slot
     * @returns {string}
     */
    getBgUrl(slotNumber) {
      const getItem = UI.getItemData(this.getItemFromSlot(slotNumber).id);

      if (!this.images) {
        return false;
      }

      switch (getItem.graphics.tileset) {
      case 'general':
        return this.images.generalImage.src;
      case 'jewelry':
        return this.images.jewelryImage.src;
      case 'armor':
        return this.images.armorImage.src;
      case 'vessels':
        return this.images.vesselsImage.src;
      default:
      case 'weapons':
        return this.images.weaponsImage.src;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
div.grid_container {
  display: grid;
  height: auto;
  max-height: 320px;
  padding: 8px;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: "GameFont", sans-serif;
  grid-gap: 3px;
  overflow-x: hidden;
  background:
    linear-gradient(135deg, rgba(183, 146, 79, 0.025) 25%, transparent 25%) 0 0 / 8px 8px,
    var(--color-bg-inset);
  border: 1px solid var(--color-border-subtle);
  box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.72);

  .grid_cell {
    width: 35px;
    height: 35px;
  }

  &::-webkit-scrollbar-track {
    background-color: transparent;
  }

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(183, 146, 79, 0.46);
  }

  .locked-item {
    filter: contrast(0.35);
  }

  div.slot {
    cursor: pointer;
    width: 32px;
    height: 32px;
    margin: 1px 0 0 1px;
    text-align: center;
    background-color: transparent;
    border: 1px solid transparent;
    box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.7);

    &.empty {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.018), rgba(0, 0, 0, 0.24));
      border: 1px solid rgba(130, 105, 62, 0.18);
    }

    .qty {
      font-size: 10px;
      color: var(--color-accent-strong);
      text-shadow: 1px 1px 0 black;
      float: left;
    }

    .price {
      display: block;
      float: right;
      margin-top: 20px;
      padding: 0 2px;
      background: rgba(20, 15, 8, .9);
      color: var(--color-accent-strong);
      font-size: 8px;
      line-height: 11px;
    }

    &.selected {
      filter: drop-shadow(1px 0 0 var(--color-accent-strong)) drop-shadow(-1px 0 0 var(--color-accent-strong)) drop-shadow(0 1px 0 var(--color-accent-strong)) drop-shadow(0 -1px 0 var(--color-accent-strong));
    }
  }
}
</style>
