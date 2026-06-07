<template>
  <div class="inventory-pane">
    <header class="inventory-pane__summary">
      <div>
        <span class="inventory-pane__eyebrow">Backpack</span>
        <strong>{{ occupiedCells }} / {{ totalCells }}</strong>
      </div>
      <span class="inventory-pane__grid-size">{{ grid.columns }} x {{ grid.rows }}</span>
    </header>

    <div class="inventory-pane__body">
      <EquipmentRagdoll
        :game="game"
        :images="resolvedImages"
        class="inventory-pane__ragdoll"
      />

      <div class="inventory-pane__grid">
        <InventoryGrid
          :images="resolvedImages"
          :columns="grid.columns"
          :rows="grid.rows"
          @commit="handleInventoryCommit"
        />

        <div class="inventory-pane__utility-row">
          <WorldDropZone />
          <ContainerStack />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { watch } from 'vue';

import { useInventoryStore } from '@/stores/inventory.js';
import { getItemDimensions } from '@/core/inventory/footprint.js';
import { indexFromCoords } from '@/core/inventory/grid-math.js';
import bus from '@/core/utilities/bus.js';
import Socket from '@/core/utilities/socket.js';
import EquipmentRagdoll from '../inventory/EquipmentRagdoll.vue';
import InventoryGrid from '../inventory/InventoryGrid.vue';
import WorldDropZone from '../inventory/WorldDropZone.vue';
import ContainerStack from '../inventory/ContainerStack.vue';

const INVENTORY_COLUMNS = 12;
const INVENTORY_ROWS = 7;

export default {
  name: 'InventoryPane',
  components: {
    EquipmentRagdoll,
    InventoryGrid,
    WorldDropZone,
    ContainerStack,
  },
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const inventoryStore = useInventoryStore();

    watch(() => props.game?.player?.inventory, (items) => {
      inventoryStore.setInventoryItems(items || []);
    }, { immediate: true, deep: true });

    watch(() => props.game?.player?.wear, (wear) => {
      inventoryStore.setEquipment(wear || {});
    }, { immediate: true, deep: true });

    return {
      inventoryStore,
    };
  },
  provide() {
    return {
      inventoryDragStore: this.inventoryStore,
    };
  },
  data() {
    return {
      grid: {
        columns: INVENTORY_COLUMNS,
        rows: INVENTORY_ROWS,
      },
    };
  },
  computed: {
    resolvedImages() {
      return (this.game && this.game.map && this.game.map.images) ? this.game.map.images : {};
    },
    inventoryItems() {
      return Array.isArray(this.inventoryStore.items) ? this.inventoryStore.items : [];
    },
    occupiedCells() {
      return this.inventoryItems.reduce((total, item) => {
        const dimensions = getItemDimensions(item, item.orientation);
        return total + (dimensions.width * dimensions.height);
      }, 0);
    },
    totalCells() {
      return this.grid.columns * this.grid.rows;
    },
  },
  methods: {
    emitInventoryCommit(result) {
      const player = this.game?.player;
      const item = result?.item;

      if (!player || !item) {
        return;
      }

      const target = result.target || {};
      const position = target.position && Number.isFinite(target.position.x) && Number.isFinite(target.position.y)
        ? {
          x: Math.floor(target.position.x),
          y: Math.floor(target.position.y),
        }
        : null;
      const updatedItem = item.uuid
        ? this.inventoryItems.find(entry => entry.uuid === item.uuid)
        : null;
      const stackTarget = target.stackTarget
        ? this.inventoryItems.find(entry => entry.uuid === target.stackTarget)
        : null;

      Socket.emit('player:inventory:commit', {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        action: result.type,
        item: {
          uuid: item.uuid,
          id: item.id,
          slot: item.slot,
        },
        target: {
          position,
          slot: position ? indexFromCoords(position.x, position.y, this.grid.columns) : target.slot,
          orientation: updatedItem?.orientation || item.orientation || 'default',
          stackTargetUuid: target.stackTarget,
          stackTargetSlot: stackTarget?.slot,
          stackTargetId: stackTarget?.id,
        },
      });
    },
    emitEquipCommit(result) {
      const player = this.game?.player;
      const item = result?.item;

      if (!player || !item) {
        return;
      }

      Socket.emit('item:equip', {
        id: player.uuid,
        player: { socket_id: player.socket_id },
        item: {
          uuid: item.uuid,
          id: item.id,
          miscData: {
            slot: item.slot,
          },
        },
      });
    },
    handleInventoryCommit(result) {
      if (!result || result.cancelled) {
        return;
      }

      if (result.type === 'equip') {
        this.emitEquipCommit(result);
      } else {
        this.emitInventoryCommit(result);
      }

      bus.$emit('inventory:interaction', {
        source: 'inventory-pane',
        result,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.inventory-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  color: var(--color-text-primary);

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid rgba(215, 180, 103, 0.24);
    border-radius: var(--radius-sm);
    background:
      linear-gradient(90deg, rgba(82, 18, 24, 0.22), rgba(20, 25, 31, 0.72), rgba(18, 45, 70, 0.18)),
      rgba(0, 0, 0, 0.24);
    box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.55);
  }

  &__summary strong {
    display: block;
    margin-top: 2px;
    font-size: 15px;
    color: #f4d28a;
  }

  &__eyebrow,
  &__grid-size {
    font-size: 11px;
    color: rgba(231, 218, 190, 0.78);
    text-transform: uppercase;
    letter-spacing: 0;
  }

  &__grid-size {
    color: rgba(148, 180, 214, 0.86);
  }

  &__body {
    display: grid;
    grid-template-columns: minmax(148px, 170px) max-content;
    gap: 8px;
    align-items: start;
    width: 100%;
    min-width: 0;
  }

  &__ragdoll {
    min-width: 0;
  }

  &__grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  &__utility-row {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 10px;
  }
}

@media (width <= 700px) {
  .inventory-pane__body {
    grid-template-columns: 1fr;
  }

  .inventory-pane__utility-row {
    grid-template-columns: 1fr;
  }
}
</style>
