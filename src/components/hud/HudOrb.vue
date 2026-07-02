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
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.55));
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
</style>
