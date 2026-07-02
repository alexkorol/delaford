<template>
  <nav class="quickbar" aria-label="Quick actions">
    <div
      v-for="entry in visibleSlotEntries"
      :key="entry.slot.id || entry.index"
      :class="[
        'quickbar__slot',
        {
          'quickbar__slot--active': entry.index === activeIndex,
          'quickbar__slot--empty': !entry.slot.skillId,
        },
      ]"
    >
      <button
        class="quickbar__activate"
        type="button"
        :title="slotTitle(entry.slot, entry.index)"
        :disabled="!entry.slot.skillId"
        @click="$emit('slot-activate', entry.slot, entry.index)"
      >
        <span class="quickbar__icon" aria-hidden="true">
          <span v-if="entry.slot.icon">{{ entry.slot.icon }}</span>
        </span>
        <span class="quickbar__label">{{ entry.slot.label || `Slot ${entry.index + 1}` }}</span>
        <span
          v-if="entry.slot.skill && entry.slot.skill.cooldown"
          class="quickbar__cooldown"
        >{{ entry.slot.skill.cooldown }}s</span>
      </button>
      <button
        class="quickbar__remap"
        type="button"
        :aria-label="`Remap ${entry.slot.label || `slot ${entry.index + 1}`}`"
        @click="$emit('request-remap', entry.slot, entry.index)"
      >
        <span class="quickbar__hotkey">{{ entry.slot.hotkey }}</span>
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
  computed: {
    visibleSlotEntries() {
      const entries = this.slots.map((slot, index) => ({ slot, index }));
      const assigned = entries.filter(entry => entry.slot && entry.slot.skillId);
      return assigned.length ? assigned : entries.slice(0, 1);
    },
  },
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
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: max-content;
  max-width: 100%;
  padding: 3px;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(180deg, rgba(58, 50, 38, 0.58), rgba(12, 10, 8, 0.62)),
    rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(180, 145, 86, 0.2);
  box-shadow:
    inset 0 1px 0 rgba(255, 232, 170, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.46);
}

.quickbar__slot {
  position: relative;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  max-width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(180deg, #3a3226 0%, #28221a 100%);
  border: 1px solid var(--color-frame-dark);
  border-top-color: rgba(200, 180, 140, 0.25);
  border-left-color: rgba(200, 180, 140, 0.25);
}

.quickbar__slot--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 6px rgba(197, 160, 89, 0.4);
}

.quickbar__slot--empty {
  flex-basis: 30px;
  max-width: 30px;
  opacity: 0.5;
}

.quickbar__activate {
  appearance: none;
  background: transparent;
  border: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 5px;
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }
}

.quickbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(139, 115, 85, 0.2);
  font-size: 15px;
}

.quickbar__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.quickbar__cooldown {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 18px;
  padding: 1px 3px;
  border-radius: 2px;
  background: rgba(5, 5, 6, 0.72);
  font-size: 0.62rem;
  color: var(--color-accent-strong);
  letter-spacing: 0;
  line-height: 1.2;
}

.quickbar__remap {
  position: absolute;
  bottom: 3px;
  left: 3px;
  z-index: 2;
  appearance: none;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(180, 145, 86, 0.28);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.58);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 10px;
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
  font-size: 10px;
  line-height: 1;
}

.quickbar__remap-text {
  display: none;
}

@media (width <= 1100px) {
  .quickbar {
    gap: 3px;
    padding: 3px;
  }

  .quickbar__slot {
    flex-basis: 36px;
    max-width: 36px;
    width: auto;
    height: 36px;
  }

  .quickbar__slot--empty {
    flex-basis: 28px;
    max-width: 28px;
  }

  .quickbar__activate {
    padding: 4px;
  }

  .quickbar__icon {
    width: 20px;
    height: 20px;
    font-size: 12px;
  }

  .quickbar__cooldown,
  .quickbar__hotkey {
    font-size: 9px;
  }

  .quickbar__remap {
    width: 16px;
    height: 16px;
  }
}

@media (width <= 768px) {
  .quickbar {
    gap: 2px;
  }

  .quickbar__slot {
    flex-basis: 34px;
    max-width: 34px;
    height: 34px;
  }

  .quickbar__slot--empty {
    flex-basis: 26px;
    max-width: 26px;
  }
}
</style>
