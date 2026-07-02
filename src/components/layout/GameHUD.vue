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
      <div
        class="hud-shell__level"
        :title="`Level ${playerProgress.level} - ${Math.floor(playerProgress.fraction * 100)}% to next level`"
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
  min-height: clamp(58px, calc(var(--hud-orb-size, 152px) * 0.48), 76px);
  padding: 0 calc(var(--hud-orb-size, 152px) * 0.74) 6px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  pointer-events: none;
  overflow: visible;
}

.hud-shell__orb {
  position: absolute;
  bottom: -8px;
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

.hud-shell__level {
  position: absolute;
  left: calc((var(--hud-orb-size, 152px) * 0.86) + 12px);
  bottom: 14px;
  z-index: 3;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 52px;
  pointer-events: none;
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
  position: relative;
  z-index: 3;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(100%, 460px);
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

  .hud-shell__level {
    min-width: 44px;
  }

  .hud-shell__level-value {
    font-size: 0.68rem;
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
