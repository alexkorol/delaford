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
        :title="slotTitle(slot, index)"
        :disabled="!slot.skillId"
        @click="$emit('slot-activate', slot, index)"
      >
        <span class="quickbar__icon" aria-hidden="true">
          <span v-if="slot.icon">{{ slot.icon }}</span>
        </span>
        <span class="quickbar__label">{{ slot.label || `Slot ${index + 1}` }}</span>
        <span
          v-if="slot.skill && slot.skill.cooldown"
          class="quickbar__cooldown"
        >{{ slot.skill.cooldown }}s</span>
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
  methods: {
    slotTitle(slot, index) {
      const label = slot.label || `Slot ${index + 1}`;
      const hotkey = slot.hotkey ? ` [${slot.hotkey}]` : '';
      const description = slot.skill && slot.skill.description ? ` — ${slot.skill.description}` : '';
      return `${label}${hotkey}${description}`;
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;
@use '@/assets/scss/abstracts/mixins' as *;

.quickbar {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  background: rgba(12, 16, 28, 0.82);
  border: 1px solid var(--color-border-subtle);
  box-shadow: var(--shadow-soft);
  min-width: clamp(320px, 40vw, 640px);
}

.quickbar__slot {
  display: grid;
  grid-template-columns: auto;
  grid-template-rows: auto auto;
  align-items: stretch;
  justify-items: stretch;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: linear-gradient(180deg, rgba(36, 42, 64, 0.95), rgba(18, 22, 34, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 140ms ease-out, box-shadow 140ms ease-out, border-color 140ms ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.45);
  }
}

.quickbar__slot--active {
  border-color: rgba(255, 214, 102, 0.8);
  box-shadow: 0 0 0 2px rgba(255, 214, 102, 0.45), 0 12px 24px rgba(0, 0, 0, 0.55);
}

.quickbar__activate {
  appearance: none;
  background: transparent;
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--space-sm);
  color: var(--color-text-primary);
  font-family: 'GameFont', sans-serif;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }
}

.quickbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(28px, 3vw, 36px);
  height: clamp(28px, 3vw, 36px);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  font-size: clamp(12px, 2vw, 18px);
}

.quickbar__label {
  font-size: var(--font-size-sm);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.quickbar__cooldown {
  font-size: 0.7rem;
  color: var(--color-accent-strong);
  letter-spacing: 0.08em;
}

.quickbar__remap {
  appearance: none;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 16, 28, 0.72);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;

  &:hover {
    color: var(--color-accent-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
}

.quickbar__hotkey {
  font-family: 'GameFont', sans-serif;
  font-size: var(--font-size-sm);
  letter-spacing: 0.08em;
}

.quickbar__remap-text {
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

@media (width <= 768px) {
  .quickbar {
    min-width: min(90vw, 520px);
    padding: var(--space-xs) var(--space-sm);
  }

  .quickbar__label {
    font-size: 0.7rem;
  }
}
</style>
