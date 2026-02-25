<template>
  <div
    class="hud-orb"
    :class="variant"
    :aria-label="`${label}: ${displayValue}`"
  >
    <canvas
      ref="canvas"
      class="hud-orb__canvas"
      :width="canvasSize"
      :height="canvasSize"
    />
    <div class="hud-orb__overlay">
      <span class="hud-orb__label">{{ label }}</span>
      <span v-if="showMeter" class="hud-orb__value">{{ displayValue }}</span>
    </div>
  </div>
</template>

<script>
class GlobeRenderer {
  constructor(canvas, colors, initialFill = 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.colors = colors;
    this.currentFill = initialFill;
    this.targetFill = initialFill;
    this.time = 0;
    this.waveSpeed = 0.03;
    this.waveAmplitude = 1.5;
    this.particles = [];
    this.radius = 0;
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.animFrame = null;

    this.textureCanvas = document.createElement('canvas');
    this.textureCtx = this.textureCanvas.getContext('2d');
    this.generateTexture();
    this.handleResize();

    for (let i = 0; i < 20; i++) {
      this.particles.push(this.createParticle());
    }

    this.animate = this.animate.bind(this);
    this.animFrame = requestAnimationFrame(this.animate);
  }

  destroy() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || this.canvas.width || 80;
    const h = this.canvas.clientHeight || this.canvas.height || 80;
    this.width = w;
    this.height = h;
    this.centerX = w / 2;
    this.centerY = h / 2;
    this.radius = Math.max(8, (Math.min(w, h) / 2) - 12);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  generateTexture() {
    const size = 256;
    this.textureCanvas.width = size;
    this.textureCanvas.height = size;
    const ctx = this.textureCtx;
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    const TWO_PI = Math.PI * 2;

    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      let x = (px / size) * TWO_PI;
      let y = (py / size) * TWO_PI;
      let qx = Math.sin(x + 2.4) + Math.cos(y + 1.2);
      let qy = Math.cos(x + 8.1) + Math.sin(y + 4.5);
      let rx = Math.sin(x + qx * 1.5 + 4.2);
      let ry = Math.cos(y + qy * 1.5 + 1.8);
      let n = Math.sin(x + rx * 2.0) + Math.cos(y + ry * 2.0);
      let noise = (n + 2) / 4.0;
      noise = Math.pow(noise, 3.5);
      noise = Math.max(0, Math.min(1, noise));
      const intensity = Math.floor(noise * 255);
      data[i] = intensity;
      data[i + 1] = intensity;
      data[i + 2] = intensity;
      data[i + 3] = Math.floor(noise * 200);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  createParticle() {
    const r = this.radius || 30;
    return {
      x: (Math.random() - 0.5) * (r * 1.4),
      y: r + Math.random() * r,
      radius: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.15,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.04,
    };
  }

  setFill(percent) {
    this.targetFill = Math.max(0, Math.min(1, percent));
  }

  update() {
    this.time += 1;
    const diff = this.targetFill - this.currentFill;
    if (Math.abs(diff) > 0.001) {
      this.currentFill += diff * 0.08;
    } else {
      this.currentFill = this.targetFill;
    }

    const r = this.radius || 30;
    this.particles.forEach((p) => {
      p.y -= p.speed;
      p.wobble += p.wobbleSpeed;
      p.x += Math.sin(p.wobble) * 0.15;
      if (p.y < -r) {
        p.y = r + Math.random() * 20;
        p.x = (Math.random() - 0.5) * (r * 1.4);
      }
    });
  }

  draw() {
    if (!this.radius || this.radius <= 0) return;
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;

    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bgGrad.addColorStop(0, this.colors.bgCenter);
    bgGrad.addColorStop(0.8, this.colors.bgEdge);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Liquid fill
    const range = r * 2;
    const fillHeight = range * this.currentFill;
    const baseLiquidY = (cy + r) - fillHeight;
    const firstX = cx - r;

    ctx.beginPath();
    for (let x = cx - r; x <= cx + r; x += 2) {
      const waveY = baseLiquidY
        + Math.sin((x / 30) + (this.time * this.waveSpeed)) * this.waveAmplitude
        + Math.cos((x / 20) + (this.time * this.waveSpeed * 1.5)) * (this.waveAmplitude * 0.4);
      if (x === firstX) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.lineTo(cx + r, cy + r);
    ctx.lineTo(cx - r, cy + r);
    ctx.closePath();

    const liquidGrad = ctx.createRadialGradient(cx, cy + 10, 0, cx, cy, r);
    liquidGrad.addColorStop(0, this.colors.liquidCore);
    liquidGrad.addColorStop(0.5, this.colors.liquidMid);
    liquidGrad.addColorStop(1, this.colors.liquidDeep);
    ctx.fillStyle = liquidGrad;
    ctx.fill();

    // Texture overlay
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const pattern = ctx.createPattern(this.textureCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.globalAlpha = 0.3;
    const scrollX = this.time * 0.15;
    const scrollY = this.time * 0.08;
    ctx.save();
    ctx.translate(scrollX, scrollY);
    ctx.fillRect(cx - r - scrollX, baseLiquidY - scrollY, r * 2, fillHeight);
    ctx.restore();
    ctx.restore();

    // Surface glow
    if (this.currentFill > 0.05) {
      ctx.save();
      ctx.beginPath();
      for (let x = cx - r; x <= cx + r; x += 2) {
        const waveY = baseLiquidY
          + Math.sin((x / 30) + (this.time * this.waveSpeed)) * this.waveAmplitude
          + Math.cos((x / 20) + (this.time * this.waveSpeed * 1.5)) * (this.waveAmplitude * 0.4);
        if (x === firstX) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.colors.surfaceGlow;
      ctx.shadowColor = this.colors.liquidCore;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    ctx.fillStyle = this.colors.particleColor;
    this.particles.forEach((p) => {
      if (cy + p.y > baseLiquidY + 3) {
        ctx.beginPath();
        ctx.arc(cx + p.x, cy + p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Inner shadow
    const innerShadow = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
    innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    innerShadow.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = innerShadow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Gloss highlight
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.72, r * 0.22, r * 0.08, 0, 0, Math.PI * 2);
    const glossGrad = ctx.createLinearGradient(0, -r * 0.8, 0, -r * 0.64);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = glossGrad;
    ctx.fill();
    ctx.restore();

    // Frame ring
    this.drawFrame(ctx, cx, cy, r);
  }

  drawFrame(ctx, cx, cy, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ringGrad.addColorStop(0.0, '#2a1f0d');
    ringGrad.addColorStop(0.15, '#c5a059');
    ringGrad.addColorStop(0.3, '#5c4520');
    ringGrad.addColorStop(0.5, '#2a1f0d');
    ringGrad.addColorStop(0.7, '#c5a059');
    ringGrad.addColorStop(0.85, '#5c4520');
    ringGrad.addColorStop(1.0, '#1a1105');

    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = ringGrad;
    ctx.stroke();
    ctx.restore();

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1a0a00';
    ctx.stroke();

    // Etch marks
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const angle = (i * (360 / 8)) * (Math.PI / 180);
      const x1 = cx + Math.cos(angle) * (r + 7);
      const y1 = cy + Math.sin(angle) * (r + 7);
      const x2 = cx + Math.cos(angle + 0.08) * (r - 1);
      const y2 = cy + Math.sin(angle + 0.08) * (r - 1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(92, 69, 32, 0.5)';
      ctx.stroke();
    }
    ctx.restore();
  }

  animate() {
    this.update();
    this.draw();
    this.animFrame = requestAnimationFrame(this.animate);
  }
}

const HP_COLORS = {
  liquidCore: '#ff3333',
  liquidMid: '#b30000',
  liquidDeep: '#4a0000',
  bgCenter: '#1a0505',
  bgEdge: '#000000',
  surfaceGlow: 'rgba(255, 200, 200, 0.6)',
  particleColor: 'rgba(255, 200, 200, 0.25)',
};

const MP_COLORS = {
  liquidCore: '#4488ff',
  liquidMid: '#1a44aa',
  liquidDeep: '#0a1a55',
  bgCenter: '#050510',
  bgEdge: '#000000',
  surfaceGlow: 'rgba(150, 200, 255, 0.6)',
  particleColor: 'rgba(150, 200, 255, 0.25)',
};

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
      canvasSize: 88,
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
    fillPercent(val) {
      if (this.renderer) {
        this.renderer.setFill(val);
      }
    },
  },
  mounted() {
    const colors = this.variant === 'hp' ? HP_COLORS : MP_COLORS;
    // Start at current fill level immediately (no animation from wrong state)
    const initialFill = this.fillPercent > 0 ? this.fillPercent : 1;
    this.renderer = new GlobeRenderer(this.$refs.canvas, colors, initialFill);
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
  --orb-size: clamp(64px, 7vw, 88px);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--orb-size);
  height: var(--orb-size);
}

.hud-orb__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.hud-orb__overlay {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-shadow: 1px 1px 2px #000, 0 0 6px rgba(0, 0, 0, 0.8);
}

.hud-orb__label {
  font-family: 'GameFont', sans-serif;
  font-size: clamp(10px, 1.2vw, 14px);
  letter-spacing: 0.08em;
  color: var(--color-text-primary);
}

.hud-orb__value {
  font-family: 'GameFont', sans-serif;
  font-size: clamp(9px, 1vw, 12px);
  color: var(--color-text-primary);
  margin-top: 1px;
}
</style>
