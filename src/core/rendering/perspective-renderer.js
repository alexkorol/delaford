import UI from '@shared/ui.js';
import { now } from '../config/movement.js';
import {
  actorIdentityFrame,
  MONSTER_SPRITE_CONFIG,
  NPC_SPRITE_CONFIG,
  PLAYER_SPRITE_CONFIG,
} from '../config/animation.js';
import { centerOfTile } from '../utilities/movement-controller.js';
import PerspectiveCamera from './perspective-camera.js';
import TerrainRenderer from './terrain-renderer.js';
import LightingRenderer, { getNightFactor, sampleAmbient } from './lighting-renderer.js';
import AtmosphereRenderer from './atmosphere-renderer.js';

const ACTOR_SCALE = 1.45;
const ITEM_SCALE = 0.92;

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

class PerspectiveRenderer {
  constructor(map) {
    this.map = map;
    this.camera = new PerspectiveCamera({
      heightAt: (worldX, worldY) => this.terrainHeight(worldX, worldY),
    });
    this.legacyGroundCanvas = document.createElement('canvas');
    this.legacyGroundContext = this.legacyGroundCanvas.getContext('2d');
    this.terrainRenderer = new TerrainRenderer(map, {
      heightAt: (worldX, worldY) => this.terrainHeight(worldX, worldY),
    });
    this.lightingRenderer = new LightingRenderer();
    this.atmosphereRenderer = new AtmosphereRenderer();
    this.userZoom = 1;
    this.pinchDistance = 0;
    this.pinchZoom = 1;
    this.handleWheel = this.handleWheel.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.map.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.map.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.map.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
  }

  terrainHeight() {
    return 0;
  }

  getPlayerFoot(tileSize) {
    const { player } = this.map;
    if (!player) {
      return { x: 0, y: 0 };
    }

    return player.movement
      ? player.movement.getPosition()
      : centerOfTile(player.x, player.y, tileSize);
  }

  updateCamera() {
    const canvas = this.map.bufferCanvas;
    const tileSize = this.map.config.map.tileset.tile.width;
    const foot = this.getPlayerFoot(tileSize);

    return this.camera.update({
      width: canvas ? canvas.width : 0,
      height: canvas ? canvas.height : 0,
      x: foot.x,
      y: foot.y,
      userZoom: this.userZoom,
    });
  }

  screenToWorld(screenX, screenY) {
    this.updateCamera();
    return this.camera.unproject(screenX, screenY);
  }

  render() {
    const ctx = this.map.bufferContext;
    const canvas = this.map.bufferCanvas;
    if (!ctx || !canvas || !this.updateCamera()) {
      return;
    }

    const timestamp = now();
    const elapsedSeconds = timestamp / 1000;
    const ambient = sampleAmbient(elapsedSeconds);
    const skyColour = ambient.map((channel, index) => (
      channel * [0.62, 0.60, 0.58][index]
    ));
    this.drawSky(ctx, canvas, skyColour);
    if (this.terrainRenderer.render(this.camera, skyColour)) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.terrainRenderer.canvas, 0, 0);
    } else {
      this.map.drawMap();
      this.alignLegacyGround(ctx, canvas);
    }

    const draws = this.collectBillboards();
    draws.sort((left, right) => left.depthY - right.depthY);
    draws.forEach(entry => entry.draw());

    this.drawProjectiles(ctx);
    this.drawCombatFeedback(ctx);
    this.drawMouse(ctx);
    this.atmosphereRenderer.drawMist(ctx, this.camera, elapsedSeconds);
    this.lightingRenderer.apply(ctx, {
      width: canvas.width,
      height: canvas.height,
      elapsedSeconds,
      ambient,
      lights: this.collectDynamicLights(timestamp),
    });
    const nightFactor = getNightFactor(ambient);
    this.atmosphereRenderer.drawForeground(
      ctx,
      this.camera,
      elapsedSeconds,
      nightFactor,
    );
    this.lightingRenderer.drawVignette(ctx, canvas.width, canvas.height);
  }

  alignLegacyGround(ctx, canvas) {
    if (
      this.legacyGroundCanvas.width !== canvas.width
      || this.legacyGroundCanvas.height !== canvas.height
    ) {
      this.legacyGroundCanvas.width = canvas.width;
      this.legacyGroundCanvas.height = canvas.height;
    }

    const groundContext = this.legacyGroundContext;
    const viewportCenter = this.map.getViewportCenter();
    const shiftX = (canvas.width / 2) - viewportCenter.x;
    const shiftY = this.camera.focus - viewportCenter.y;

    groundContext.clearRect(0, 0, canvas.width, canvas.height);
    groundContext.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111913';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.legacyGroundCanvas, Math.round(shiftX), Math.round(shiftY));
  }

  drawSky(ctx, canvas, skyColour) {
    const skyline = Math.max(
      canvas.height * 0.16,
      this.camera.horizon + ((this.camera.focus - this.camera.horizon) / 2.14),
    );
    const gradient = ctx.createLinearGradient(0, 0, 0, Math.max(2, skyline * 1.35));
    gradient.addColorStop(
      0,
      `rgb(${Math.round(skyColour[0] * 0.55)}, ${Math.round(skyColour[1] * 0.62)}, ${Math.round(skyColour[2] * 0.76)})`,
    );
    gradient.addColorStop(1, `rgb(${skyColour.join(', ')})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.filter = 'blur(2.5px)';
    ctx.fillStyle = `rgba(${Math.round(skyColour[0] * 0.24)}, ${Math.round(skyColour[1] * 0.28)}, ${Math.round(skyColour[2] * 0.26)}, 0.92)`;
    ctx.beginPath();
    ctx.moveTo(-20, skyline + 8);
    for (let x = 0; x <= canvas.width; x += canvas.width / 26) {
      const variation = (Math.sin((x * 0.013) + (this.camera.x * 0.002)) * 7)
        + (Math.sin((x * 0.031) + 7) * 4);
      ctx.lineTo(x, skyline - (10 + Math.abs(variation)));
    }
    ctx.lineTo(canvas.width + 20, skyline + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  collectBillboards() {
    const draws = [];
    const metrics = this.map.getViewportMetrics();
    const { tileSize } = metrics;
    const timestamp = now();

    (this.map.droppedItems || []).forEach((item) => {
      const foot = centerOfTile(item.x, item.y, tileSize);
      draws.push({
        depthY: foot.y,
        draw: () => this.drawItem(item, foot, tileSize),
      });
    });

    (this.map.npcs || []).forEach((npc) => {
      const foot = this.getActorFoot(npc, tileSize);
      draws.push({
        depthY: foot.y,
        draw: () => this.drawNPC(npc, foot),
      });
    });

    (this.map.monsters || []).forEach((monster) => {
      const health = monster.stats && monster.stats.resources
        ? monster.stats.resources.health
        : null;
      if (health && health.current <= 0) {
        return;
      }

      const foot = this.getActorFoot(monster, tileSize);
      draws.push({
        depthY: foot.y,
        draw: () => this.drawMonster(monster, foot, timestamp),
      });
    });

    (this.map.players || []).forEach((player) => {
      const foot = this.getActorFoot(player, tileSize);
      draws.push({
        depthY: foot.y,
        draw: () => this.drawPlayerActor(player, foot, timestamp),
      });
    });

    if (this.map.player) {
      const foot = this.getPlayerFoot(tileSize);
      draws.push({
        depthY: foot.y,
        draw: () => this.drawPlayerActor(this.map.player, foot, timestamp),
      });
    }

    return draws;
  }

  getActorFoot(actor, tileSize) {
    return actor && actor.movement
      ? actor.movement.getPosition()
      : centerOfTile(actor.x, actor.y, tileSize);
  }

  getProjectedFrame(foot, frameSize, scale = ACTOR_SCALE) {
    const point = this.camera.projectTerrain(foot.x, foot.y);
    if (!point) {
      return null;
    }

    const size = frameSize * point.scale * scale;
    if (
      point.x + size < 0
      || point.x - size > this.camera.width
      || point.y < -size
      || point.y - size > this.camera.height
    ) {
      return null;
    }

    return {
      ...point,
      drawX: point.x - (size / 2),
      drawY: point.y - size,
      size,
    };
  }

  drawShadow(ctx, projected, radiusScale = 0.36) {
    const radius = projected.size * radiusScale;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#07120c';
    ctx.beginPath();
    ctx.ellipse(projected.x, projected.y, radius, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFrame({
    image,
    sourceX,
    sourceY,
    sourceSize,
    foot,
    scale = ACTOR_SCALE,
    lastHitAt = 0,
    timestamp = 0,
    shadow = true,
  }) {
    if (!image || !image.width || !image.height) {
      return null;
    }

    const projected = this.getProjectedFrame(foot, sourceSize, scale);
    if (!projected) {
      return null;
    }

    const ctx = this.map.bufferContext;
    if (shadow) {
      this.drawShadow(ctx, projected);
    }

    ctx.save();
    const blur = this.camera.circleOfConfusion(projected.depth) * 3.6;
    if (blur > 0.3) {
      const quantizedBlur = Math.round(blur * 4) / 4;
      ctx.filter = `blur(${quantizedBlur}px)`;
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.imageSmoothingEnabled = false;
    }
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      projected.drawX,
      projected.drawY,
      projected.size,
      projected.size,
    );

    const hitElapsed = timestamp - lastHitAt;
    if (lastHitAt && hitElapsed >= 0 && hitElapsed < 180) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.34 * (1 - (hitElapsed / 180));
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        projected.drawX,
        projected.drawY,
        projected.size,
        projected.size,
      );
    }
    ctx.restore();
    return projected;
  }

  drawItem(item, foot, tileSize) {
    const info = UI.getItemData(item.id);
    if (!info || !info.graphics) {
      return;
    }

    let quantityIndex = 0;
    const levels = info.graphics.quantityLevel;
    if (item.qty > 1 && Array.isArray(levels)) {
      while (quantityIndex < levels.length - 1 && levels[quantityIndex] < item.qty) {
        quantityIndex += 1;
      }
    }

    const sheets = {
      armor: this.map.images.armorImage,
      general: this.map.images.generalImage,
      jewelry: this.map.images.jewelryImage,
      vessels: this.map.images.vesselsImage,
      weapons: this.map.images.weaponsImage,
    };
    const image = sheets[info.graphics.tileset] || sheets.weapons;
    this.drawFrame({
      image,
      sourceX: (info.graphics.column + quantityIndex) * tileSize,
      sourceY: info.graphics.row * tileSize,
      sourceSize: tileSize,
      foot,
      scale: ITEM_SCALE,
    });
  }

  drawPlayerActor(player, foot, timestamp) {
    const animator = this.map.ensureAnimation(player);
    const frame = animator ? animator.getCurrentFrame() : { column: 0, row: 0 };
    const sourceSize = PLAYER_SPRITE_CONFIG.tileSize;
    const { sourceX, sourceY } = this.map.clampSpriteSource(
      this.map.images.playerImage,
      frame,
      sourceSize,
    );

    this.drawFrame({
      image: this.map.images.playerImage,
      sourceX,
      sourceY,
      sourceSize,
      foot,
      scale: PLAYER_SPRITE_CONFIG.perspectiveScale,
      lastHitAt: player.lastHitAt,
      timestamp,
    });
  }

  drawNPC(npc, foot) {
    const sourceSize = NPC_SPRITE_CONFIG.tileSize;
    const { sourceX, sourceY } = this.map.clampSpriteSource(
      this.map.images.npcsImage,
      actorIdentityFrame(npc),
      sourceSize,
    );

    this.drawFrame({
      image: this.map.images.npcsImage,
      sourceX,
      sourceY,
      sourceSize,
      foot,
      scale: NPC_SPRITE_CONFIG.perspectiveScale,
    });
  }

  drawMonster(monster, foot, timestamp) {
    const image = this.map.images.monstersImage || this.map.images.npcsImage;
    const sourceSize = MONSTER_SPRITE_CONFIG.tileSize;
    const { sourceX, sourceY } = this.map.clampSpriteSource(
      image,
      actorIdentityFrame(monster),
      sourceSize,
    );
    const projected = this.drawFrame({
      image,
      sourceX,
      sourceY,
      sourceSize,
      foot,
      scale: MONSTER_SPRITE_CONFIG.perspectiveScale,
      lastHitAt: monster.lastHitAt,
      timestamp,
    });

    const health = monster.stats && monster.stats.resources
      ? monster.stats.resources.health
      : null;
    if (!projected || !health || !health.max || health.current >= health.max) {
      return;
    }

    const ctx = this.map.bufferContext;
    const width = projected.size * 0.78;
    const height = Math.max(2, projected.scale * 3);
    const x = projected.x - (width / 2);
    const y = projected.drawY - (height + 3);
    const fraction = clamp(health.current / health.max, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = fraction > 0.4 ? '#5fd35f' : '#e04f4f';
    ctx.fillRect(x, y, width * fraction, height);
    ctx.restore();
  }

  drawProjectiles(ctx) {
    if (!Array.isArray(this.map.projectiles) || !this.map.projectiles.length) {
      return;
    }

    const tileSize = this.map.config.map.tileset.tile.width;
    const timestamp = now();
    const colours = {
      player: '#ffd27a',
      monster: '#ff6a4d',
      support: '#7dedae',
    };

    this.map.projectiles = this.map.projectiles.filter((projectile) => {
      const progress = (timestamp - projectile.startedAt) / projectile.travelMs;
      if (progress >= 1) {
        return false;
      }

      const from = centerOfTile(projectile.fromX, projectile.fromY, tileSize);
      const to = centerOfTile(projectile.toX, projectile.toY, tileSize);
      const tailProgress = Math.max(0, progress - 0.18);
      const pointAt = amount => ({
        x: from.x + ((to.x - from.x) * amount),
        y: from.y + ((to.y - from.y) * amount),
      });
      const headWorld = pointAt(progress);
      const tailWorld = pointAt(tailProgress);
      const head = this.camera.projectTerrain(headWorld.x, headWorld.y);
      const tail = this.camera.projectTerrain(tailWorld.x, tailWorld.y);
      if (!head || !tail) {
        return true;
      }

      const colour = colours[projectile.kind] || colours.monster;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1.5, head.scale * 2.5);
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y - (tileSize * 0.45 * tail.scale));
      ctx.lineTo(head.x, head.y - (tileSize * 0.45 * head.scale));
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(
        head.x,
        head.y - (tileSize * 0.45 * head.scale),
        Math.max(2, head.scale * 3),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      return true;
    });
  }

  drawCombatFeedback(ctx) {
    if (!Array.isArray(this.map.combatFeedback) || !this.map.combatFeedback.length) {
      return;
    }

    const tileSize = this.map.config.map.tileset.tile.width;
    const timestamp = now();
    const duration = 900;
    this.map.combatFeedback = this.map.combatFeedback.filter(
      entry => timestamp - entry.startedAt < duration,
    );

    this.map.combatFeedback.forEach((entry) => {
      const actor = entry.targetType === 'player'
        ? [this.map.player, ...(this.map.players || [])]
          .find(player => player && player.uuid === entry.targetId)
        : (this.map.monsters || []).find(monster => monster.uuid === entry.targetId);
      if (!actor) {
        return;
      }

      const foot = this.getActorFoot(actor, tileSize);
      const point = this.camera.projectTerrain(foot.x, foot.y);
      if (!point) {
        return;
      }

      const progress = clamp((timestamp - entry.startedAt) / duration, 0, 1);
      const alpha = 1 - progress;
      const rise = ((tileSize * 0.9) + (progress * 18)) * point.scale;
      const fontSize = Math.max(9, 12 * point.scale * ACTOR_SCALE);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `600 ${fontSize}px "GameFont", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, point.scale * 3);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillStyle = entry.targetType === 'player' ? '#ff5252' : '#ffd54f';
      const label = entry.amount > 0 ? `-${entry.amount}` : '0';
      ctx.strokeText(label, point.x, point.y - rise);
      ctx.fillText(label, point.x, point.y - rise);
      ctx.restore();
    });
  }

  drawMouse(ctx) {
    const mouse = this.map.mouse;
    if (!mouse || mouse.x === null || mouse.y === null) {
      return;
    }

    const { tileSize, tileCrop } = this.map.getViewportMetrics();
    const foot = centerOfTile(mouse.x + tileCrop.x, mouse.y + tileCrop.y, tileSize);
    const point = this.camera.projectTerrain(foot.x, foot.y);
    if (!point) {
      return;
    }

    const radius = tileSize * 0.46 * point.scale;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = mouse.type === 1 ? '#ff665f' : '#55f0b5';
    ctx.lineWidth = Math.max(1.5, point.scale * 2);
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  collectDynamicLights(timestamp) {
    const tileSize = this.map.config.map.tileset.tile.width;
    const lights = [];
    const colours = {
      player: [255, 208, 118],
      monster: [255, 92, 66],
      support: [122, 255, 176],
    };

    (this.map.projectiles || []).forEach((projectile) => {
      const progress = (timestamp - projectile.startedAt) / projectile.travelMs;
      if (progress < 0 || progress >= 1) {
        return;
      }
      const from = centerOfTile(projectile.fromX, projectile.fromY, tileSize);
      const to = centerOfTile(projectile.toX, projectile.toY, tileSize);
      const worldX = from.x + ((to.x - from.x) * progress);
      const worldY = from.y + ((to.y - from.y) * progress);
      const point = this.camera.projectTerrain(worldX, worldY);
      if (!point) {
        return;
      }
      lights.push({
        x: point.x,
        y: point.y - (tileSize * 0.45 * point.scale),
        radius: Math.max(32, 120 * point.scale),
        colour: colours[projectile.kind] || colours.monster,
        intensity: 0.95,
      });
    });

    const player = this.map.player;
    const animation = player && player.animation;
    if (animation && ['attack', 'dash'].includes(animation.state)) {
      const foot = this.getPlayerFoot(tileSize);
      const point = this.camera.projectTerrain(foot.x, foot.y);
      if (point) {
        lights.push({
          x: point.x,
          y: point.y - (tileSize * 0.35 * point.scale),
          radius: Math.max(38, 96 * point.scale),
          colour: colours.player,
          intensity: 0.58,
        });
      }
    }

    return lights;
  }

  setUserZoom(value) {
    this.userZoom = clamp(value, 0.72, 1.6);
  }

  handleWheel(event) {
    if (!this.map.isPerspectiveMode()) {
      return;
    }
    this.setUserZoom(this.userZoom * (event.deltaY > 0 ? 0.92 : 1.08));
    event.preventDefault();
  }

  handleTouchStart(event) {
    if (event.touches.length !== 2) {
      this.pinchDistance = 0;
      return;
    }
    this.pinchDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
    this.pinchZoom = this.userZoom;
  }

  handleTouchMove(event) {
    if (!this.map.isPerspectiveMode() || event.touches.length !== 2 || !this.pinchDistance) {
      return;
    }
    const distance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
    this.setUserZoom(this.pinchZoom * (distance / this.pinchDistance));
    event.preventDefault();
  }

  destroy() {
    this.map.canvas.removeEventListener('wheel', this.handleWheel);
    this.map.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.map.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.terrainRenderer.destroy();
    this.lightingRenderer.destroy();
    this.atmosphereRenderer.destroy();
    this.legacyGroundCanvas.width = 1;
    this.legacyGroundCanvas.height = 1;
  }
}

export default PerspectiveRenderer;
