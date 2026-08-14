const MIST_OFFSETS = [
  [-520, -360, 150, 0.2],
  [-260, -470, 115, 1.3],
  [40, -390, 165, 2.4],
  [360, -310, 130, 3.1],
  [520, -80, 170, 4.2],
  [-470, 40, 145, 5.4],
  [-210, 180, 120, 0.8],
  [170, 150, 155, 2.9],
  [430, 210, 110, 4.8],
];

const FIREFLY_OFFSETS = [
  [-340, -190, 0.2],
  [-210, -80, 1.2],
  [-90, -260, 2.8],
  [70, -150, 4.1],
  [190, -300, 5.2],
  [310, -60, 0.9],
  [-290, 120, 3.7],
  [-120, 230, 5.8],
  [120, 190, 2.1],
  [330, 130, 4.9],
];

class AtmosphereRenderer {
  constructor() {
    this.rays = document.createElement('canvas');
    this.rayContext = this.rays.getContext('2d');
  }

  drawMist(ctx, camera, elapsedSeconds) {
    ctx.save();
    MIST_OFFSETS.forEach(([offsetX, offsetY, worldRadius, phase]) => {
      const worldX = camera.x + offsetX + (Math.sin((elapsedSeconds * 0.14) + phase) * 36);
      const worldY = camera.y + offsetY;
      const point = camera.projectTerrain(worldX, worldY);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.scale)) {
        return;
      }
      const radius = worldRadius * point.scale;
      if (radius < 2) {
        return;
      }
      const alpha = 0.026 + (Math.sin((elapsedSeconds * 0.38) + phase) * 0.009);
      const y = point.y - (18 * point.scale);
      const gradient = ctx.createRadialGradient(point.x, y, 2, point.x, y, radius);
      gradient.addColorStop(0, `rgba(184, 207, 190, ${alpha})`);
      gradient.addColorStop(1, 'rgba(184, 207, 190, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  ensureRays(width, height) {
    if (this.rays.width === width && this.rays.height === height) {
      return;
    }
    this.rays.width = Math.max(2, width);
    this.rays.height = Math.max(2, height);
    const ctx = this.rayContext;
    ctx.clearRect(0, 0, width, height);

    [0.16, 0.44, 0.71].forEach((fraction) => {
      const startX = fraction * width;
      const beamWidth = width * 0.055;
      const gradient = ctx.createLinearGradient(startX, 0, startX + beamWidth, 0);
      gradient.addColorStop(0, 'rgba(255, 236, 180, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 236, 180, 0.10)');
      gradient.addColorStop(1, 'rgba(255, 236, 180, 0)');
      ctx.fillStyle = gradient;
      ctx.save();
      ctx.translate(startX, 0);
      ctx.transform(1, 0, -0.30, 1, 0, 0);
      ctx.translate(-startX, 0);
      ctx.fillRect(startX - (height * 0.35), 0, beamWidth + (height * 0.35), height);
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'destination-in';
    const verticalFade = ctx.createLinearGradient(0, 0, 0, height);
    verticalFade.addColorStop(0, 'rgba(0, 0, 0, 1)');
    verticalFade.addColorStop(0.62, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = verticalFade;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawFireflies(ctx, camera, elapsedSeconds, nightFactor) {
    if (nightFactor < 0.12) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FIREFLY_OFFSETS.forEach(([offsetX, offsetY, phase]) => {
      const worldX = camera.x + offsetX + (Math.sin((elapsedSeconds * 0.46) + phase) * 18);
      const worldY = camera.y + offsetY + (Math.cos((elapsedSeconds * 0.31) + phase) * 12);
      const point = camera.projectTerrain(worldX, worldY);
      if (!point) {
        return;
      }
      const pulse = 0.45 + (Math.sin((elapsedSeconds * 2.2) + phase) * 0.35);
      const alpha = nightFactor * pulse;
      const radius = Math.max(1.4, 2.8 * point.scale);
      const y = point.y - ((20 + (Math.sin(phase) * 12)) * point.scale);
      const gradient = ctx.createRadialGradient(point.x, y, 0, point.x, y, radius * 3);
      gradient.addColorStop(0, `rgba(236, 255, 152, ${alpha})`);
      gradient.addColorStop(1, 'rgba(180, 255, 116, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawForeground(ctx, camera, elapsedSeconds, nightFactor) {
    this.ensureRays(camera.width, camera.height);
    const daylight = Math.max(0, 1 - (nightFactor * 1.25));
    if (daylight > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = daylight * (0.38 + (Math.sin(elapsedSeconds * 0.18) * 0.05));
      ctx.drawImage(this.rays, Math.sin(elapsedSeconds * 0.035) * 3, 0);
      ctx.restore();
    }
    this.drawFireflies(ctx, camera, elapsedSeconds, nightFactor);
  }

  destroy() {
    this.rays.width = 1;
    this.rays.height = 1;
  }
}

export default AtmosphereRenderer;
