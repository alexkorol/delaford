<template>
  <div class="hud-shell">
    <div class="hud-shell__hint" aria-label="Controls hint">
      <span>WASD / Arrows move</span>
      <span>1–6 skills</span>
      <span>/ chat</span>
      <span>Esc close</span>
    </div>
    <div class="hud-shell__row">
      <HudOrb
        class="hud-shell__orb hud-shell__orb--left"
        variant="hp"
        label="HP"
        :current="playerVitals.hp.current"
        :max="playerVitals.hp.max"
      />
      <div
        class="hud-shell__level"
        :title="`Level ${playerProgress.level} — ${Math.floor(playerProgress.fraction * 100)}% to next level`"
      >
        <span class="hud-shell__level-value">Lv {{ playerProgress.level }}</span>
        <span class="hud-shell__level-bar">
          <span
            class="hud-shell__level-fill"
            :style="{ width: `${Math.min(100, Math.max(0, playerProgress.fraction * 100))}%` }"
          />
        </span>
      </div>
      <Quickbar
        class="hud-shell__quickbar"
        :slots="quickSlots"
        :active-index="quickbarActiveIndex"
        @slot-activate="handleSlotActivate"
        @request-remap="handleRequestRemap"
      />
      <HudOrb
        class="hud-shell__orb hud-shell__orb--right"
        variant="mp"
        label="MP"
        :current="playerVitals.mp.current"
        :max="playerVitals.mp.max"
      />
    </div>
  </div>
</template>

<script>
import Quickbar from '../hud/Quickbar.vue';
import HudOrb from '../hud/HudOrb.vue';

export default {
  name: 'GameHUD',
  components: {
    Quickbar,
    HudOrb,
  },
  props: {
    playerVitals: {
      type: Object,
      required: true,
    },
    playerProgress: {
      type: Object,
      default: () => ({ level: 1, fraction: 0 }),
    },
    quickSlots: {
      type: Array,
      default: () => [],
    },
    quickbarActiveIndex: {
      type: Number,
      default: null,
    },
  },
  emits: [
    'quick-slot',
    'request-remap',
  ],
  methods: {
    handleSlotActivate(slot, index) {
      this.$emit('quick-slot', slot, index);
    },
    handleRequestRemap(slot, index) {
      this.$emit('request-remap', slot, index);
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.hud-shell {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: center;
  pointer-events: none;
}

.hud-shell__hint {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  pointer-events: auto;
}

.hud-shell__hint span + span::before {
  content: '•';
  margin-right: var(--space-xs);
  opacity: 0.55;
}

.hud-shell__row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: linear-gradient(180deg, #342e24 0%, #221e18 100%);
  border: 2px solid var(--color-frame-dark);
  border-top-color: var(--color-bevel-light);
  border-left-color: var(--color-bevel-light);
  border-radius: var(--radius-md);
  box-shadow:
    inset 1px 1px 0 rgba(200, 180, 140, 0.1),
    inset -1px -1px 0 rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.hud-shell__orb {
  flex: 0 0 auto;
}

.hud-shell__level {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 52px;
}

.hud-shell__level-value {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #f5d68a;
  text-shadow: 1px 1px 0 black;
}

.hud-shell__level-bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.hud-shell__level-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #c9a227 0%, #ffd54f 100%);
  transition: width 250ms ease-out;
}

.hud-shell__quickbar {
  flex: 1 1 auto;
  margin: 0 var(--space-xs);
}

@media (width <= 767px) {
  .hud-shell__hint {
    display: none;
  }

  .hud-shell__row {
    flex-direction: column;
    align-items: stretch;
  }

  .hud-shell__orb {
    align-self: center;
  }

  .hud-shell__quickbar {
    margin: var(--space-xs) 0 0;
  }
}
</style>
