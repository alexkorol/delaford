<template>
  <div
    class="world-drop-zone"
    :class="{ 'world-drop-zone--active': isActive }"
    data-world-drop-zone="true"
    title="Ground"
    aria-label="Ground drop target"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <span class="world-drop-zone__mark" aria-hidden="true">v</span>
    <span>Ground</span>
  </div>
</template>

<script>
import { inject, computed, unref } from 'vue';

const storeValue = value => unref(value);
const isStoreDragging = store => Boolean(store && storeValue(store.isDragging));

export default {
  name: 'WorldDropZone',
  setup() {
    const inventoryStore = inject('inventoryDragStore', null);

    const isActive = computed(() => (
      inventoryStore
      && storeValue(inventoryStore.dragState)?.hoverTarget?.type === 'world-drop'
    ));

    const handlePointerEnter = () => {
      if (!isStoreDragging(inventoryStore)) {
        return;
      }

      inventoryStore.setHoverTarget({ type: 'world-drop' });
    };

    const handlePointerLeave = () => {
      if (!isStoreDragging(inventoryStore)) {
        return;
      }

      inventoryStore.clearHoverTarget();
    };

    return {
      isActive,
      handlePointerEnter,
      handlePointerLeave,
    };
  },
};
</script>

<style lang="scss" scoped>
.world-drop-zone {
  min-height: 54px;
  padding: 9px 12px;
  border-radius: 0;
  background: var(--color-bg-inset);
  border: 1px dashed rgba(180, 145, 86, 0.36);
  text-align: center;
  font-size: 12px;
  color: rgba(231, 218, 190, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s ease, border-color 0.2s ease;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.62);
}

.world-drop-zone__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 0;
  border: 1px solid rgba(215, 180, 103, 0.38);
  color: #f2d391;
  background: rgba(0, 0, 0, 0.34);
}

.world-drop-zone--active {
  background:
    linear-gradient(180deg, rgba(58, 39, 30, 0.88), rgba(18, 11, 10, 0.9)),
    rgba(0, 0, 0, 0.35);
  border-color: rgba(222, 115, 82, 0.74);
  color: #ffd1b8;
}
</style>
