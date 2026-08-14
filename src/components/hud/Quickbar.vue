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
      :style="{ '--skill-accent': skillAccent(entry.slot) }"
    >
      <button
        class="quickbar__activate"
        type="button"
        :aria-label="slotTitle(entry.slot, entry.index)"
        :disabled="!entry.slot.skillId"
        @click="$emit('slot-activate', entry.slot, entry.index)"
      >
        <span
          class="quickbar__hotkey"
          aria-hidden="true"
        >{{ displayHotkey(entry.slot) }}</span>
        <img
          v-if="skillIcon(entry.slot)"
          class="quickbar__icon"
          :src="skillIcon(entry.slot)"
          alt=""
          aria-hidden="true"
        >
        <span
          v-else
          class="quickbar__empty-mark"
          aria-hidden="true"
        >{{ entry.slot.skillId ? '?' : '·' }}</span>
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
      <span
        v-if="entry.slot.skillId"
        class="quickbar__tooltip"
        role="tooltip"
      >
        <strong>{{ entry.slot.label }}</strong>
        <span>{{ entry.slot.skill && entry.slot.skill.description }}</span>
        <small>{{ slotMeta(entry.slot) }}</small>
      </span>
    </div>
  </nav>
</template>

<script>
import bladeSweepIcon from '@/assets/skills/blade-sweep.webp';
import celestialMendIcon from '@/assets/skills/celestial-mend.webp';
import emberVolleyIcon from '@/assets/skills/ember-volley.webp';
import frostNovaIcon from '@/assets/skills/frost-nova.webp';
import phantomStepIcon from '@/assets/skills/phantom-step.webp';
import stoneguardIcon from '@/assets/skills/stoneguard.webp';

const SKILL_ICONS = {
  'blade-sweep': bladeSweepIcon,
  'celestial-mend': celestialMendIcon,
  'ember-volley': emberVolleyIcon,
  'frost-nova': frostNovaIcon,
  'phantom-step': phantomStepIcon,
  stoneguard: stoneguardIcon,
};

const DISPLAY_HOTKEYS = {
  'primary-attack': 'Space',
  dash: 'Shift',
  'ability-1': 'Q',
  'ability-2': 'E',
  'ability-3': 'R',
  'ability-4': 'F',
};

const SKILL_ACCENTS = {
  combat: '#e0a34e',
  mobility: '#55cbb0',
  control: '#75bdf2',
  defence: '#87b38c',
  support: '#f0c85e',
};

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
    skillIcon(slot) {
      return slot && slot.icon ? SKILL_ICONS[slot.icon] || null : null;
    },
    skillAccent(slot) {
      return SKILL_ACCENTS[slot?.skill?.category] || '#9a825b';
    },
    displayHotkey(slot) {
      return DISPLAY_HOTKEYS[slot?.skillId] || slot?.hotkey || '';
    },
    cooldownSeconds(slot) {
      return slot && slot.skill && Number.isFinite(slot.skill.cooldown) ? slot.skill.cooldown : 0;
    },
    slotCooldown(slot) {
      const duration = this.cooldownSeconds(slot) * 1000;
      const readyAt = slot && slot.skillId ? this.cooldowns[slot.skillId] : 0;
      if (!duration || !readyAt) return { active: false, fraction: 0, remaining: 0 };
      const remainingMs = readyAt - this.now;
      if (remainingMs <= 0) return { active: false, fraction: 0, remaining: 0 };
      return {
        active: true,
        fraction: Math.min(1, remainingMs / duration),
        remaining: Math.ceil(remainingMs / 1000),
      };
    },
    sweepBackground(fraction) {
      const angle = Math.max(0, Math.min(1, fraction)) * 360;
      return `conic-gradient(rgba(0, 0, 0, 0.72) 0deg ${angle}deg, transparent ${angle}deg 360deg)`;
    },
    ensureTicking() {
      if (this.timerId != null || typeof window === 'undefined') return;
      this.now = Date.now();
      this.timerId = window.setInterval(() => {
        this.now = Date.now();
        if (!this.anyCooldownActive) this.stopTicking();
      }, 60);
    },
    stopTicking() {
      if (this.timerId != null && typeof window !== 'undefined') window.clearInterval(this.timerId);
      this.timerId = null;
    },
    slotTitle(slot, index) {
      const label = slot.label || `Slot ${index + 1}`;
      const displayKey = this.displayHotkey(slot);
      const alias = slot.hotkey && slot.hotkey !== displayKey ? ` / ${slot.hotkey}` : '';
      const hotkey = displayKey ? ` [${displayKey}${alias}]` : '';
      const cooldown = this.cooldownSeconds(slot) ? ` · ${slot.skill.cooldown}s cooldown` : '';
      const description = slot.skill && slot.skill.description ? `. ${slot.skill.description}` : '';
      return `${label}${hotkey}${cooldown}${description}`;
    },
    slotMeta(slot) {
      const bits = [];
      const mana = Number(slot?.skill?.resourceCost?.mana) || 0;
      const cooldown = this.cooldownSeconds(slot);
      const displayKey = this.displayHotkey(slot);
      const alias = slot?.hotkey && slot.hotkey !== displayKey ? ` / ${slot.hotkey}` : '';
      if (displayKey) bits.push(`${displayKey}${alias}`);
      if (mana) bits.push(`${mana} mana`);
      if (cooldown) bits.push(`${cooldown}s recovery`);
      return bits.join(' · ');
    },
  },
};
</script>

<style lang="scss" scoped>
.quickbar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  width: max-content;
  max-width: 100%;
  padding: 6px 8px 7px;
  border-radius: 2px;
  background:
    linear-gradient(180deg, rgba(53, 43, 29, 0.82), rgba(8, 8, 7, 0.9)),
    rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(205, 163, 91, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 232, 170, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.68),
    0 4px 14px rgba(0, 0, 0, 0.36);
}

.quickbar__slot {
  position: relative;
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  overflow: visible;
  background: #100d0a;
  border: 1px solid color-mix(in srgb, var(--skill-accent) 56%, #21170d);
  box-shadow: 0 0 0 1px #070605, inset 0 0 9px rgba(0, 0, 0, 0.7);
}

.quickbar__slot--active {
  z-index: 3;
  border-color: var(--skill-accent);
  transform: translateY(-2px);
  box-shadow:
    0 0 13px color-mix(in srgb, var(--skill-accent) 72%, transparent),
    inset 0 0 8px rgba(0, 0, 0, 0.5);
}

.quickbar__slot--empty {
  background: linear-gradient(180deg, #242018, #100e0a);
  border-color: rgba(112, 92, 58, 0.32);
  opacity: 0.58;
}

.quickbar__activate {
  position: relative;
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  color: #f0e6d1;
  background: transparent;
  border: 0;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.11), transparent 32%),
      radial-gradient(circle at 50% 78%, transparent 28%, rgba(0, 0, 0, 0.34));
    box-shadow: inset 0 0 0 1px rgba(244, 221, 170, 0.09);
    pointer-events: none;
  }

  &:focus-visible {
    outline: 2px solid var(--skill-accent);
    outline-offset: -3px;
  }

  &:disabled {
    cursor: default;
  }
}

.quickbar__hotkey {
  position: absolute;
  top: 3px;
  left: 3px;
  z-index: 4;
  padding: 2px 3px 1px;
  color: #fff0c4;
  font: 0.52rem/1 'GameFont', sans-serif;
  text-shadow: 0 1px 1px #000;
  background: rgba(4, 4, 4, 0.76);
  border: 1px solid rgba(229, 194, 125, 0.26);
}

.quickbar__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 120ms ease, transform 120ms ease;
}

.quickbar__activate:hover .quickbar__icon {
  filter: brightness(1.18) saturate(1.12);
  transform: scale(1.04);
}

.quickbar__empty-mark {
  color: rgba(216, 194, 150, 0.28);
  font-size: 1rem;
}

.quickbar__cd {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 4;
  padding: 1px 3px;
  color: #f0d486;
  font: 0.54rem/1.2 'ChatFont', sans-serif;
  background: rgba(5, 5, 6, 0.78);
  border: 1px solid rgba(222, 186, 111, 0.18);
}

.quickbar__sweep {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.quickbar__cd-timer {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff1d2;
  font: 600 0.85rem 'GameFont', sans-serif;
  text-shadow: 0 1px 2px #000, 0 0 5px #000;
  pointer-events: none;
}

.quickbar__tooltip {
  position: absolute;
  bottom: calc(100% + 11px);
  left: 50%;
  z-index: 30;
  display: grid;
  gap: 5px;
  width: 218px;
  padding: 10px 11px;
  color: rgba(236, 225, 202, 0.82);
  font: 0.68rem/1.35 'ChatFont', sans-serif;
  text-align: left;
  background:
    radial-gradient(circle at 50% 0, color-mix(in srgb, var(--skill-accent) 13%, transparent), transparent 45%),
    rgba(8, 8, 7, 0.97);
  border: 1px solid color-mix(in srgb, var(--skill-accent) 55%, #5b4528);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.68);
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 100ms ease, transform 100ms ease;
  pointer-events: none;

  strong {
    color: var(--skill-accent);
    font: normal 0.78rem 'GameFont', sans-serif;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  small {
    color: rgba(231, 199, 132, 0.7);
    font: 0.6rem 'ChatFont', sans-serif;
    text-transform: uppercase;
  }
}

.quickbar__slot:hover .quickbar__tooltip,
.quickbar__slot:focus-within .quickbar__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
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
    flex-basis: 46px;
    width: 46px;
    height: 46px;
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

  .quickbar__tooltip {
    display: none;
  }

  .quickbar__hotkey {
    top: 2px;
    left: 2px;
    padding: 1px 2px;
    font-size: 0.43rem;
  }
}
</style>
