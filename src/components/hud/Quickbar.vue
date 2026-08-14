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
          v-if="!slotCooldown(entry.slot).active && entry.slot.skill && entry.slot.skill.cooldown"
          class="quickbar__cd"
        >{{ entry.slot.skill.cooldown }}s</span>
        <template v-if="slotCooldown(entry.slot).active">
          <span
            class="quickbar__sweep"
            :style="{ background: sweepBackground(slotCooldown(entry.slot).fraction) }"
          />
          <span class="quickbar__cd-timer">{{ slotCooldown(entry.slot).remaining }}</span>
        </template>
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
    // skillId -> ready-at timestamp (ms), server-authoritative.
    cooldowns: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['slot-activate'],
  data() {
    return {
      now: Date.now(),
      timerId: null,
    };
  },
  computed: {
    // PoE-style: always show the full bar of fixed slots, empty ones dimmed.
    slotEntries() {
      return this.slots.map((slot, index) => ({ slot, index }));
    },
    anyCooldownActive() {
      return this.slots.some((slot) => {
        const readyAt = slot && slot.skillId ? this.cooldowns[slot.skillId] : 0;
        return readyAt && readyAt > this.now;
      });
    },
  },
  watch: {
    // Whenever the cooldown map changes (a skill was cast), make sure the
    // per-frame clock is running so the sweep animates down to ready.
    cooldowns: {
      deep: true,
      handler() {
        this.ensureTicking();
      },
    },
  },
  beforeUnmount() {
    this.stopTicking();
  },
  methods: {
    cooldownSeconds(slot) {
      return slot && slot.skill && Number.isFinite(slot.skill.cooldown) ? slot.skill.cooldown : 0;
    },
    // Live cooldown state for a slot: whether it is cooling down, the fraction
    // remaining (1 -> 0), and the ceil'd seconds left for the readout.
    slotCooldown(slot) {
      const duration = this.cooldownSeconds(slot) * 1000;
      const readyAt = slot && slot.skillId ? this.cooldowns[slot.skillId] : 0;
      if (!duration || !readyAt) {
        return { active: false, fraction: 0, remaining: 0 };
      }
      const remainingMs = readyAt - this.now;
      if (remainingMs <= 0) {
        return { active: false, fraction: 0, remaining: 0 };
      }
      return {
        active: true,
        fraction: Math.min(1, remainingMs / duration),
        remaining: Math.ceil(remainingMs / 1000),
      };
    },
    // Dark wedge covering the remaining-cooldown portion, sweeping clockwise
    // from the top as the skill recovers (PoE-style clock hand).
    sweepBackground(fraction) {
      const angle = Math.max(0, Math.min(1, fraction)) * 360;
      return `conic-gradient(rgba(0, 0, 0, 0.66) 0deg ${angle}deg, transparent ${angle}deg 360deg)`;
    },
    ensureTicking() {
      // A short interval (not rAF, which is throttled in background tabs)
      // advances the clock so the sweep and countdown update smoothly while
      // any skill is cooling down, and stops itself once all are ready.
      if (this.timerId != null || typeof window === 'undefined') {
        return;
      }
      this.now = Date.now();
      this.timerId = window.setInterval(() => {
        this.now = Date.now();
        if (!this.anyCooldownActive) {
          this.stopTicking();
        }
      }, 60);
    },
    stopTicking() {
      if (this.timerId != null && typeof window !== 'undefined') {
        window.clearInterval(this.timerId);
      }
      this.timerId = null;
    },
    slotTitle(slot, index) {
      const label = slot.label || `Slot ${index + 1}`;
      const hotkey = slot.hotkey ? ` [${slot.hotkey}]` : '';
      const cooldown = this.cooldownSeconds(slot) ? ` · ${slot.skill.cooldown}s cooldown` : '';
      const description = slot.skill && slot.skill.description ? `\n${slot.skill.description}` : '';
      return `${label}${hotkey}${cooldown}${description}`;
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

/* Radial cooldown sweep: a dark wedge covering the remaining cooldown that
 * unwinds clockwise as the skill recovers (PoE-style clock hand). The wedge
 * angle is set inline each frame from the live remaining fraction. */
.quickbar__sweep {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.quickbar__cd-timer {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'GameFont', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: #f7eeda;
  text-shadow: 0 1px 2px #000, 0 0 4px #000;
  pointer-events: none;
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
