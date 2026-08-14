<template>
  <div class="hud-shell">
    <div class="hud-shell__row">
      <HudOrb
        class="hud-shell__orb hud-shell__orb--left"
        variant="hp"
        label="HP"
        :current="playerVitals.hp.current"
        :max="playerVitals.hp.max"
      />
      <Quickbar
        class="hud-shell__quickbar"
        :slots="quickSlots"
        :active-index="quickbarActiveIndex"
        :cooldowns="quickbarCooldowns"
        @slot-activate="handleSlotActivate"
      />
      <HudOrb
        class="hud-shell__orb hud-shell__orb--right"
        variant="mp"
        label="MP"
        :current="playerVitals.mp.current"
        :max="playerVitals.mp.max"
      />
    </div>
    <div
      class="hud-shell__xp"
      :title="`Level ${playerProgress.level} — ${Math.floor(playerProgress.fraction * 100)}% to next level`"
    >
      <span
        class="hud-shell__xp-fill"
        :style="{ width: `${Math.min(100, Math.max(0, playerProgress.fraction * 100))}%` }"
      />
      <span class="hud-shell__xp-label">
        Lv {{ playerProgress.level }} · {{ Math.floor(playerProgress.fraction * 100) }}%
      </span>
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
    quickbarCooldowns: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: [
    'quick-slot',
  ],
  methods: {
    handleSlotActivate(slot, index) {
      this.$emit('quick-slot', slot, index);
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
  align-items: center;
  pointer-events: none;
}

.hud-shell__row {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(6px, 1vw, 14px);
  min-height: clamp(64px, calc(var(--hud-orb-size, 152px) * 0.52), 84px);
  padding: 0 calc(var(--hud-orb-size, 152px) * 0.74) 5px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  pointer-events: none;
  overflow: visible;
}

.hud-shell__orb {
  position: absolute;
  bottom: -3px;
  z-index: 2;
  flex: 0 0 auto;
  margin-bottom: 0;
  pointer-events: none;
}

.hud-shell__orb--left {
  left: clamp(4px, 1.2vw, 18px);
}

.hud-shell__orb--right {
  right: clamp(4px, 1.2vw, 18px);
}

/* PoE-style experience bar: a thin strip spanning the full width at the very
 * bottom of the screen, beneath the orbs and quickbar so it can never occlude
 * them. */
.hud-shell__xp {
  position: relative;
  width: 100%;
  height: 13px;
  margin-top: 0;
  background: rgba(0, 0, 0, 0.72);
  border-top: 1px solid rgba(212, 173, 90, 0.35);
  overflow: hidden;
  pointer-events: auto;
}

.hud-shell__xp-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #7a5cff 0%, #b39bff 100%);
  box-shadow: 0 0 6px rgba(140, 110, 255, 0.55);
  transition: width 300ms ease-out;
}

.hud-shell__xp-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.56rem;
  line-height: 1;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #efe6cf;
  text-shadow: 1px 1px 0 black, 0 0 4px black;
  pointer-events: none;
}

.hud-shell__quickbar {
  position: relative;
  z-index: 3;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(100%, 510px);
  align-self: center;
  margin: 0;
  pointer-events: auto;
}

@media (width <= 1100px) {
  .hud-shell__row {
    gap: 4px;
    min-height: clamp(52px, calc(var(--hud-orb-size, 136px) * 0.46), 64px);
    padding: 0 calc(var(--hud-orb-size, 136px) * 0.68) 5px;
  }

  .hud-shell__quickbar {
    max-width: min(100%, 380px);
    margin: 0;
  }
}

@media (width <= 767px) {
  .hud-shell__row {
    flex-direction: row;
    align-items: center;
    min-height: 0;
    padding: 0 calc(var(--hud-orb-size, 118px) * 0.64) 5px;
  }

  .hud-shell__orb {
    bottom: -4px;
  }

  .hud-shell__quickbar {
    max-width: min(100%, 320px);
    margin: 0;
  }
}
</style>
