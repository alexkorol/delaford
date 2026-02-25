<template>
  <nav class="quickbar" aria-label="Quick actions">
    <div
      v-for="(slot, index) in slots"
      :key="slot.id || index"
      :class="['quickbar__slot', { 'quickbar__slot--active': index === activeIndex }]"
    >
      <button
        class="quickbar__activate"
        type="button"
        :title="slot.label"
        @click="$emit('slot-activate', slot, index)"
      >
        <span class="quickbar__icon" aria-hidden="true">
          <span v-if="slot.icon">{{ slot.icon }}</span>
        </span>
        <span class="quickbar__label">{{ slot.label || `Slot ${index + 1}` }}</span>
      </button>
      <button
        class="quickbar__remap"
        type="button"
        :aria-label="`Remap ${slot.label || `slot ${index + 1}`}`"
        @click="$emit('request-remap', slot, index)"
      >
        <span class="quickbar__hotkey">{{ slot.hotkey }}</span>
        <span class="quickbar__remap-text">Remap</span>
      </button>
    </div>
  </nav>
</template>

<script>
export default {
  name: 'Quickbar',
  props: {
    slots: {
      type: Array,
      default: () => [],
    },
    activeIndex: {
      type: Number,
      default: -1,
    },
  },
  emits: ['slot-activate', 'request-remap'],
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;
@use '@/assets/scss/abstracts/mixins' as *;

.quickbar {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 3px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: transparent;
}

.quickbar__slot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(180deg, #3a3226 0%, #28221a 100%);
  border: 1px solid var(--color-frame-dark);
  border-top-color: rgba(200, 180, 140, 0.25);
  border-left-color: rgba(200, 180, 140, 0.25);
  min-width: 56px;
}

.quickbar__slot--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 6px rgba(197, 160, 89, 0.4);
}

.quickbar__activate {
  appearance: none;
  background: transparent;
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  color: var(--color-text-primary);
  font-family: 'GameFont', sans-serif;
  cursor: pointer;

  &:hover {
    background: rgba(197, 160, 89, 0.1);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
}

.quickbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(139, 115, 85, 0.2);
  font-size: 14px;
}

.quickbar__label {
  font-size: clamp(8px, 0.7vw, 10px);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
}

.quickbar__remap {
  appearance: none;
  border: 0;
  border-top: 1px solid var(--color-frame-dark);
  background: rgba(0, 0, 0, 0.3);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 4px;
  font-size: clamp(9px, 0.7vw, 11px);
  font-family: 'GameFont', sans-serif;
  cursor: pointer;

  &:hover {
    background: rgba(197, 160, 89, 0.15);
    color: var(--color-accent-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
}

.quickbar__hotkey {
  font-family: 'GameFont', sans-serif;
  font-size: clamp(9px, 0.7vw, 11px);
}

.quickbar__remap-text {
  display: none;
}

@media (width <= 768px) {
  .quickbar {
    gap: 2px;
  }

  .quickbar__slot {
    min-width: 44px;
  }

  .quickbar__label {
    font-size: 8px;
    max-width: 44px;
  }
}
</style>
