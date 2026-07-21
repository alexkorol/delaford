<template>
  <div class="inventory-pane">
    <div class="inventory-pane__body">
      <EquipmentRagdoll
        :game="game"
        :images="resolvedImages"
        class="inventory-pane__ragdoll"
        @commit="handleInventoryCommit"
      />

      <div class="inventory-pane__grid">
        <div class="inventory-pane__backpack-meta">
          <span class="inventory-pane__gold" :aria-label="`Gold: ${formattedGold}`">
            <span class="inventory-pane__gold-mark" aria-hidden="true">&#9670;</span>
            {{ formattedGold }} gold
          </span>
          <span aria-label="Backpack capacity">{{ occupiedCells }} / {{ totalCells }}</span>
        </div>
        <InventoryGrid
          :images="resolvedImages"
          :columns="grid.columns"
          :rows="grid.rows"
          @commit="handleInventoryCommit"
        />

        <div class="inventory-pane__utility-row">
          <WorldDropZone />
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
import Socket from '@/core/utilities/socket.js';
import EquipmentRagdoll from '../inventory/EquipmentRagdoll.vue';
import InventoryGrid from '../inventory/InventoryGrid.vue';
import WorldDropZone from '../inventory/WorldDropZone.vue';

const INVENTORY_COLUMNS = 12;
const INVENTORY_ROWS = 7;

export default {
  name: 'InventoryPane',
  components: {
    EquipmentRagdoll,
    InventoryGrid,
    WorldDropZone,
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
    formattedGold() {
      const amount = Number(this.inventoryStore.gold) || 0;
      return Math.max(0, amount).toLocaleString();
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
          targetSlot: result.slotId,
          miscData: {
            slot: item.slot,
            targetSlot: result.slotId,
          },
        },
      });
    },
    emitUnequipCommit(result) {
      const player = this.game?.player;
      const item = result?.item;
      const sourceSlot = result?.slotId;

      if (!player || !item || !sourceSlot) {
        return;
      }

      const target = result.target || {};
      const position = target.position && Number.isFinite(target.position.x) && Number.isFinite(target.position.y)
        ? {
          x: Math.floor(target.position.x),
          y: Math.floor(target.position.y),
        }
        : null;

      Socket.emit('item:unequip', {
        id: player.uuid,
        player: {
          socket_id: player.socket_id,
        },
        item: {
          uuid: item.uuid,
          id: item.id,
          slot: sourceSlot,
          miscData: {
            slot: sourceSlot,
            action: result.type === 'unequip-world-drop' ? 'world-drop' : 'inventory',
            targetInventorySlot: position
              ? indexFromCoords(position.x, position.y, this.grid.columns)
              : target.slot,
            targetPosition: position,
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
      } else if (result.type === 'unequip' || result.type === 'unequip-world-drop') {
        this.emitUnequipCommit(result);
      } else {
        this.emitInventoryCommit(result);
      }
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
  height: 100%;
  min-height: 0;
  padding: 10px 8px 8px;
  box-sizing: border-box;
  color: var(--color-text-primary);
  background:
    radial-gradient(circle at 50% 0, rgba(94, 66, 25, 0.1), transparent 36%),
    linear-gradient(180deg, rgba(20, 18, 15, 0.97), rgba(8, 8, 8, 0.96));
  border: 14px solid transparent;
  border-image: url('@/assets/inventory/frame_ornate.png') 118 / 14px stretch;
  box-shadow: 0 15px 38px rgba(0, 0, 0, 0.5);

  &__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__ragdoll {
    width: 100%;
    min-width: 0;
  }

  &__grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
  }

  &__backpack-meta {
    align-self: flex-end;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
    color: rgba(190, 172, 137, 0.7);
    font-size: 9px;
    letter-spacing: 0.14em;
    line-height: 1.4;
    text-align: right;
    text-transform: uppercase;
  }

  &__gold {
    color: #e4c36a;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-shadow: 0 1px 2px #000;
  }

  &__gold-mark {
    color: #f5d77b;
  }

  &__utility-row {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 10px;
    width: 100%;
  }
}

@media (width <= 700px) {
  .inventory-pane__utility-row {
    grid-template-columns: 1fr;
  }
}
</style>
