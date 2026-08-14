<template>
  <div
    class="hud-orb"
    :class="variant"
    :aria-label="`${label}: ${displayValue}`"
    :title="displayValue"
  >
    <canvas
      ref="canvas"
      class="hud-orb__canvas"
      :width="canvasSize"
      :height="canvasSize"
    />
    <div class="hud-orb__readout" aria-hidden="true">
      <span class="hud-orb__label">{{ label }}</span>
      <strong class="hud-orb__value">{{ displayValue }}</strong>
    </div>
  </div>
</template>

<script>
import WizardOrbRenderer from '@/core/hud/wizard-orb-renderer.js';

export default {
  name: 'HudOrb',
  props: {
    variant: {
      type: String,
      default: 'neutral',
    },
    label: {
      type: String,
      required: true,
    },
    current: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      canvasSize: 256,
      renderer: null,
    };
  },
  computed: {
    showMeter() {
      return Number.isFinite(this.max) && this.max > 0;
    },
    displayValue() {
      if (!this.showMeter) {
        return Math.round(this.current);
      }
      const current = Math.max(0, Math.round(this.current));
      const max = Math.max(0, Math.round(this.max));
      return `${current} / ${max}`;
    },
    fillPercent() {
      if (!this.max || this.max <= 0) return 1;
      return Math.max(0, Math.min(1, this.current / this.max));
    },
  },
  watch: {
    fillPercent(value) {
      if (this.renderer) {
        this.renderer.setFill(value);
      }
    },
    variant(value) {
      if (this.renderer) {
        this.renderer.setVariant(value);
      }
    },
  },
  mounted() {
    this.renderer = new WizardOrbRenderer(this.$refs.canvas, {
      variant: this.variant,
      fill: this.fillPercent,
    });
  },
  beforeUnmount() {
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  },
};
</script>

<style lang="scss" scoped>
.hud-orb {
  --orb-size: var(--hud-orb-size, clamp(176px, 16vw, 224px));
  --orb-accent: #d04545;
  --orb-accent-soft: rgba(208, 69, 69, 0.42);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--orb-size);
  height: var(--orb-size);

  /* Soft, centred contact shadow — the previous heavy offset shadow read as
   * an unsightly dark edge hugging the orb. */
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}

.hud-orb.mp {
  --orb-accent: #5b92ef;
  --orb-accent-soft: rgba(91, 146, 239, 0.42);
}

.hud-orb__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: none;
  filter: drop-shadow(0 0 16px var(--orb-accent-soft));
}

.hud-orb__readout {
  position: absolute;
  right: 21%;
  bottom: 11%;
  left: 21%;
  z-index: 2;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  min-height: 22px;
  padding: 3px 6px 2px;
  border: 1px solid color-mix(in srgb, var(--orb-accent) 48%, #d8c28e);
  background: linear-gradient(180deg, rgba(18, 15, 14, 0.9), rgba(3, 4, 6, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 244, 210, 0.12), 0 2px 8px rgba(0, 0, 0, 0.62);
  color: #fff4dc;
  font-family: 'GameFont', sans-serif;
  text-shadow: 1px 1px 0 #000, 0 0 4px #000;
  white-space: nowrap;
}

.hud-orb__label {
  color: var(--orb-accent);
  font-size: clamp(0.48rem, 0.7vw, 0.62rem);
  letter-spacing: 0.08em;
}

.hud-orb__value {
  font-size: clamp(0.56rem, 0.82vw, 0.72rem);
  font-weight: 400;
}
</style>
