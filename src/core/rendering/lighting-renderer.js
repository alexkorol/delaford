const DAY_LENGTH_SECONDS = 90;
const LIGHTMAP_SCALE = 0.25;

const AMBIENT_KEYFRAMES = [
  [0, [255, 244, 224]],
  [0.30, [255, 240, 214]],
  [0.45, [255, 205, 150]],
  [0.58, [150, 140, 205]],
  [0.80, [110, 120, 190]],
  [0.90, [210, 180, 175]],
  [1, [255, 244, 224]],
];

const CLOUDS = [
  { x: 0.08, y: 0.26, radius: 0.38, speed: 0.0017, phase: 0.4 },
  { x: 0.37, y: 0.54, radius: 0.46, speed: 0.0011, phase: 2.1 },
  { x: 0.69, y: 0.34, radius: 0.34, speed: 0.0015, phase: 4.3 },
  { x: 0.91, y: 0.67, radius: 0.42, speed: 0.0009, phase: 5.6 },
];

const interpolate = (start, end, amount) => start + ((end - start) * amount);

const sampleAmbient = (elapsedSeconds) => {
  const wrapped = ((elapsedSeconds % DAY_LENGTH_SECONDS) + DAY_LENGTH_SECONDS)
    % DAY_LENGTH_SECONDS;
  const time = wrapped / DAY_LENGTH_SECONDS;

  for (let index = 0; index < AMBIENT_KEYFRAMES.length - 1; index += 1) {
    const current = AMBIENT_KEYFRAMES[index];
    const next = AMBIENT_KEYFRAMES[index + 1];
    if (time >= current[0] && time <= next[0]) {
      const progress = (time - current[0]) / (next[0] - current[0]);
      return current[1].map((channel, channelIndex) => Math.round(
        interpolate(channel, next[1][channelIndex], progress),
      ));
    }
  }

  return [...AMBIENT_KEYFRAMES[0][1]];
};

const getNightFactor = (ambient) => {
  const brightest = Math.max(...ambient);
  const darkest = Math.min(...ambient);
  return Math.min(1, (1 - (brightest / 255)) + (((255 - darkest) / 255) * 0.5));
};

class LightingRenderer {
  constructor() {
    this.lightmap = document.createElement('canvas');
    this.lightContext = this.lightmap.getContext('2d');
    this.vignette = document.createElement('canvas');
    this.vignetteContext = this.vignette.getContext('2d');
  }

  ensureSize(width, height) {
    const lightWidth = Math.max(2, Math.floor(width * LIGHTMAP_SCALE));
    const lightHeight = Math.max(2, Math.floor(height * LIGHTMAP_SCALE));
    if (this.lightmap.width !== lightWidth || this.lightmap.height !== lightHeight) {
      this.lightmap.width = lightWidth;
      this.lightmap.height = lightHeight;
    }

    if (this.vignette.width !== lightWidth || this.vignette.height !== lightHeight) {
      this.vignette.width = lightWidth;
      this.vignette.height = lightHeight;
      this.buildVignette();
    }
  }

  buildVignette() {
    const ctx = this.vignetteContext;
    const width = this.vignette.width;
    const height = this.vignette.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.42,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(10, 4, 16, 0.48)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  drawClouds(elapsedSeconds) {
    const ctx = this.lightContext;
    const width = this.lightmap.width;
    const height = this.lightmap.height;
    ctx.globalCompositeOperation = 'multiply';

    CLOUDS.forEach((cloud) => {
      const radius = cloud.radius * width;
      const span = width + (radius * 2);
      const rawX = (cloud.x * width) + (elapsedSeconds * cloud.speed * width);
      const screenX = (((rawX + radius) % span) + span) % span - radius;
      const screenY = (cloud.y * height)
        + (Math.sin((elapsedSeconds * 0.05) + cloud.phase) * height * 0.06);
      const gradient = ctx.createRadialGradient(
        screenX,
        screenY,
        radius * 0.45,
        screenX,
        screenY,
        radius,
      );
      gradient.addColorStop(0, 'rgba(196, 198, 208, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawLights(lights, nightFactor) {
    const ctx = this.lightContext;
    const scaleX = this.lightmap.width;
    const sourceWidth = Math.max(1, this.sourceWidth);
    const scale = scaleX / sourceWidth;
    ctx.globalCompositeOperation = 'lighter';

    lights.forEach((light) => {
      if (!light || !Number.isFinite(light.x) || !Number.isFinite(light.y)) {
        return;
      }
      const x = light.x * scale;
      const y = light.y * scale;
      const radius = Math.max(2, light.radius * scale);
      const intensity = Math.min(1, (light.intensity || 1) * (0.18 + (nightFactor * 1.2)));
      const colour = light.colour || [255, 205, 120];
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(
        0,
        `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${intensity})`,
      );
      gradient.addColorStop(0.45, `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${intensity * 0.36})`);
      gradient.addColorStop(1, `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  apply(ctx, {
    width,
    height,
    elapsedSeconds,
    ambient,
    lights = [],
  }) {
    this.ensureSize(width, height);
    this.sourceWidth = width;
    const lightContext = this.lightContext;
    lightContext.setTransform(1, 0, 0, 1, 0, 0);
    lightContext.globalCompositeOperation = 'source-over';
    lightContext.fillStyle = `rgb(${ambient.join(', ')})`;
    lightContext.fillRect(0, 0, this.lightmap.width, this.lightmap.height);
    this.drawClouds(elapsedSeconds);
    this.drawLights(lights, getNightFactor(ambient));

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lightmap, 0, 0, width, height);
    ctx.restore();
  }

  drawVignette(ctx, width, height) {
    this.ensureSize(width, height);
    ctx.drawImage(this.vignette, 0, 0, width, height);
  }

  destroy() {
    this.lightmap.width = 1;
    this.lightmap.height = 1;
    this.vignette.width = 1;
    this.vignette.height = 1;
  }
}

export {
  AMBIENT_KEYFRAMES,
  DAY_LENGTH_SECONDS,
  LIGHTMAP_SCALE,
  getNightFactor,
  sampleAmbient,
};
export default LightingRenderer;
