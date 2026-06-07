<template>
  <div class="container-stack">
    <header>
      <h3>Containers</h3>
      <p v-if="!containers.length">Empty</p>
    </header>

    <ul v-if="containers.length" class="container-stack__list">
      <li
        v-for="entry in containers"
        :key="entry.item.uuid"
        class="container-stack__entry"
      >
        <div class="container-stack__meta">
          <strong>{{ entry.item.name || 'Unknown Container' }}</strong>
          <span class="container-stack__timestamp">Opened {{ formatTime(entry.openedAt) }}</span>
        </div>
        <span class="container-stack__status">Coming soon</span>
      </li>
    </ul>
  </div>
</template>

<script>
import { inject, computed } from 'vue';

export default {
  name: 'ContainerStack',
  setup() {
    const inventoryStore = inject('inventoryDragStore', null);

    const formatTime = (timestamp) => {
      const delta = Date.now() - timestamp;
      const seconds = Math.max(1, Math.round(delta / 1000));
      if (seconds < 60) {
        return `${seconds}s ago`;
      }

      const minutes = Math.round(seconds / 60);
      if (minutes < 60) {
        return `${minutes}m ago`;
      }

      const hours = Math.round(minutes / 60);
      return `${hours}h ago`;
    };

    const containers = computed(() => (
      inventoryStore && inventoryStore.containerStack
        ? (inventoryStore.containerStack.value || [])
        : []
    ));

    return {
      containers,
      formatTime,
    };
  },
};
</script>

<style lang="scss" scoped>
.container-stack {
  min-height: 54px;
  padding: 9px 12px;
  background:
    linear-gradient(180deg, rgba(34, 36, 40, 0.86), rgba(10, 11, 13, 0.88)),
    rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  border: 1px solid rgba(180, 145, 86, 0.28);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.62);
}

.container-stack header {
  margin-bottom: 8px;
}

.container-stack h3 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #f2d391;
}

.container-stack p {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: rgba(231, 218, 190, 0.58);
}

.container-stack__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.container-stack__entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(180, 145, 86, 0.24);
}

.container-stack__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.container-stack__timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.container-stack__status {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.45);
}
</style>
