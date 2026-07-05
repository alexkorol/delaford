<template>
  <nav
    class="quickbar"
    aria-label="Skill bar"
  >
    <div
      v-for="entry in slotEntries"
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
        @contextmenu.prevent="$emit('request-remap', entry.slot, entry.index)"
      >
        <span
          class="quickbar__hotkey"
          aria-hidden="true"
        >{{ entry.slot.hotkey }}</span>
        <span
          class="quickbar__icon"
          aria-hidden="true"
        >{{ entry.slot.icon || '·' }}</span>
        <span class="quickbar__label">{{ entry.slot.label || `Slot ${entry.index + 1}` }}</span>
        <span
          v-if="entry.slot.skill && entry.slot.skill.cooldown"
          class="quickbar__cd"
        >{{ entry.slot.skill.cooldown }}s</span>
        <span
          v-if="entry.index === activeIndex && cooldownSeconds(entry.slot) > 0"
          class="quickbar__sweep"
          :style="{ animationDuration: `${cooldownSeconds(entry.slot)}s` }"
        />
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
    // PoE-style: always show the full bar of fixed slots, empty ones dimmed.
    slotEntries() {
      return this.slots.map((slot, index) => ({ slot, index }));
    },
  },
  methods: {
    cooldownSeconds(slot) {
      return slot && slot.skill && Number.isFinite(slot.skill.cooldown) ? slot.skill.cooldown : 0;
    },
    slotTitle(slot, index) {
      const label = slot.label || `Slot ${index + 1}`;
      const hotkey = slot.hotkey ? ` [${slot.hotkey}]` : '';
      const cooldown = this.cooldownSeconds(slot) ? ` · ${slot.skill.cooldown}s cooldown` : '';
      const description = slot.skill && slot.skill.description ? `\n${slot.skill.description}` : '';
      return `${label}${hotkey}${cooldown}${description}\nRight-click to remap`;
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;

.quickbar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  width: max-content;
  max-width: 100%;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(180deg, rgba(58, 50, 38, 0.55), rgba(12, 10, 8, 0.62)),
    rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(180, 145, 86, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 232, 170, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.46);
}

.quickbar__slot {
  position: relative;
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(180deg, #34120f 0%, #1c0d0b 100%);
  border: 1px solid #120b07;
  border-top-color: rgba(210, 180, 130, 0.28);
  border-left-color: rgba(210, 180, 130, 0.22);
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.55);
}

.quickbar__slot--active {
  border-color: var(--color-accent-strong, #e0b45c);
  box-shadow:
    0 0 8px rgba(224, 180, 92, 0.55),
    inset 0 0 8px rgba(0, 0, 0, 0.5);
}

.quickbar__slot--empty {
  background: linear-gradient(180deg, #26221a 0%, #141109 100%);
  opacity: 0.5;
}

.quickbar__activate {
  position: relative;
  appearance: none;
  background: transparent;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    background: rgba(224, 180, 92, 0.12);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  &:disabled {
    cursor: default;
  }
}

.quickbar__hotkey {
  position: absolute;
  top: 2px;
  left: 3px;
  z-index: 2;
  font-family: 'GameFont', sans-serif;
  font-size: 0.6rem;
  line-height: 1;
  color: #f2d391;
  text-shadow: 1px 1px 0 #000;
}

.quickbar__icon {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.8));
}

.quickbar__cd {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 2;
  padding: 0 2px;
  border-radius: 2px;
  background: rgba(5, 5, 6, 0.68);
  font-size: 0.56rem;
  line-height: 1.25;
  color: var(--color-accent-strong, #e0b45c);
}

/* Radial cooldown sweep: a dark wedge that unwinds over the skill's cooldown
 * when the slot is triggered. */
.quickbar__sweep {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: conic-gradient(rgba(0, 0, 0, 0.62) 0deg, rgba(0, 0, 0, 0.62) 360deg);
  animation-name: quickbar-sweep;
  animation-timing-function: linear;
  animation-iteration-count: 1;
}

@keyframes quickbar-sweep {
  from {
    clip-path: polygon(50% 50%, 50% 0, 50% 0, 50% 0, 50% 0, 50% 0);
  }

  to {
    clip-path: polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 0);
  }
}

.quickbar__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (width <= 1100px) {
  .quickbar__slot {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }

  .quickbar__icon {
    font-size: 19px;
  }
}

@media (width <= 768px) {
  .quickbar {
    gap: 3px;
    padding: 3px 4px;
  }

  .quickbar__slot {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
}
</style>
