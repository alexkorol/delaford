import UI from '@shared/ui.js';
import DUNGEON_TILESET, { DUNGEON_FIRST_GID } from '@shared/dungeon-tiles.js';
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
const VERTICAL_TILE_RANGE = Object.freeze({ x: 32, north: 44, south: 20 });

const globalGidsForGroup = (category) => new Set(
  Object.values(DUNGEON_TILESET.groups?.[category] || {})
    .flat()
    .map(localId => DUNGEON_FIRST_GID + localId),
);
const WALL_GIDS = globalGidsForGroup('wall');
const TREE_GIDS = globalGidsForGroup('tree');

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
const directionAngle = (direction = 'down') => ({
  right: 0,
  'down-right': Math.PI * 0.25,
  down: Math.PI * 0.5,
  'down-left': Math.PI * 0.75,
  left: Math.PI,
  'up-left': Math.PI * 1.25,
  up: Math.PI * 1.5,
  'up-right': Math.PI * 1.75,
}[direction] ?? Math.PI * 0.5);

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
      // Wall tiles are drawn below as raised billboards. Keeping their dark
      // top-down copies in the ground bake was the source of the flat double
      // image running around every building and boundary.
      skipBackgroundGids: WALL_GIDS,
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
      channel * [0.78, 0.80, 0.76][index]
    ));
    this.drawSky(ctx, canvas, skyColour);
    if (this.terrainRenderer.render(this.camera, skyColour)) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.terrainRenderer.canvas, 0, 0);
    } else {
      this.map.drawMap();
      this.alignLegacyGround(ctx, canvas);
    }

    // Mist belongs to the landscape rather than over the actors. Keeping it
    // below the combat layer preserves atmosphere without erasing silhouettes.
    this.atmosphereRenderer.drawMist(ctx, this.camera, elapsedSeconds);

    this.drawGroundTelegraphs(ctx);
    const draws = this.collectBillboards();
    draws.sort((left, right) => left.depthY - right.depthY);
    draws.forEach(entry => entry.draw());

    this.drawSkillEffects(ctx);
    this.drawAttackEffects(ctx);
    this.drawProjectiles(ctx);
    this.drawCombatFeedback(ctx);
    this.drawMouse(ctx);
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
    this.drawPlayerDamageVignette(ctx, canvas.width, canvas.height, timestamp);
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

    this.collectVerticalTerrain(draws, tileSize);

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

  collectVerticalTerrain(draws, tileSize) {
    const mapSize = this.map.config.map.size;
    const playerX = Math.round(this.map.player?.x || 0);
    const playerY = Math.round(this.map.player?.y || 0);
    const minimumX = Math.max(0, playerX - VERTICAL_TILE_RANGE.x);
    const maximumX = Math.min(mapSize.x - 1, playerX + VERTICAL_TILE_RANGE.x);
    const minimumY = Math.max(0, playerY - VERTICAL_TILE_RANGE.north);
    const maximumY = Math.min(mapSize.y - 1, playerY + VERTICAL_TILE_RANGE.south);

    for (let worldY = minimumY; worldY <= maximumY; worldY += 1) {
      for (let worldX = minimumX; worldX <= maximumX; worldX += 1) {
        const index = (worldY * mapSize.x) + worldX;
        const foregroundGid = this.map.foreground[index] || 0;
        const backgroundGid = this.map.background[index] || 0;
        const verticalForeground = foregroundGid
          && !UI.tileWalkable(foregroundGid - 1, 'foreground');
        const wall = WALL_GIDS.has(backgroundGid);
        if (!verticalForeground && !wall) {
          continue;
        }

        const gid = verticalForeground ? foregroundGid : backgroundGid;
        const kind = TREE_GIDS.has(gid) ? 'tree' : (wall ? 'wall' : 'decor');
        const foot = centerOfTile(worldX, worldY + 0.42, tileSize);
        draws.push({
          depthY: foot.y,
          draw: () => this.drawVerticalTerrainTile(gid, foot, tileSize, kind),
        });
      }
    }
  }

  drawVerticalTerrainTile(gid, foot, tileSize, kind) {
    const point = this.camera.projectTerrain(foot.x, foot.y);
    if (!point) {
      return;
    }

    const dimensions = {
      tree: { width: 1.24, height: 2.12 },
      wall: { width: 1.08, height: 1.52 },
      decor: { width: 1.08, height: 1.36 },
    }[kind];
    const width = tileSize * point.scale * dimensions.width;
    const height = tileSize * point.scale * dimensions.height;
    const drawX = point.x - (width / 2);
    const drawY = point.y - height;
    if (
      point.x + width < 0
      || point.x - width > this.camera.width
      || point.y < -height
      || drawY > this.camera.height
    ) {
      return;
    }

    const zeroId = gid - 1;
    const sheet = this.map.resolveTileSheet(zeroId);
    if (!sheet?.image || !sheet.columns) {
      return;
    }
    const local = zeroId - sheet.from;
    const sourceSize = this.map.config.map.tileset.tile.width;
    const sourceX = Math.floor(local % sheet.columns) * sourceSize;
    const sourceY = Math.floor(local / sheet.columns) * sourceSize;
    const ctx = this.map.bufferContext;

    ctx.save();
    this.drawVerticalTerrainShadow(ctx, point, width, height, kind);

    ctx.fillStyle = 'rgba(4, 7, 5, 0.42)';
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, width * 0.38, width * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (kind === 'tree') {
      const trunkWidth = Math.max(2, width * 0.14);
      ctx.fillStyle = 'rgba(62, 43, 24, 0.9)';
      ctx.fillRect(point.x - (trunkWidth / 2), point.y - (height * 0.55), trunkWidth, height * 0.52);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = Math.max(2, point.scale * 5);
    ctx.shadowOffsetY = Math.max(1, point.scale * 2);
    ctx.drawImage(
      sheet.image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      drawX,
      drawY,
      width,
      height,
    );

    if (kind === 'wall') {
      const faceTop = drawY + (height * 0.42);
      const faceGradient = ctx.createLinearGradient(0, faceTop, 0, point.y);
      faceGradient.addColorStop(0, 'rgba(58, 48, 38, 0.08)');
      faceGradient.addColorStop(1, 'rgba(2, 3, 4, 0.58)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = faceGradient;
      ctx.fillRect(drawX, faceTop, width, point.y - faceTop);

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 230, 174, 0.30)';
      ctx.lineWidth = Math.max(1, point.scale);
      ctx.beginPath();
      ctx.moveTo(drawX, faceTop + 0.5);
      ctx.lineTo(drawX + width, faceTop + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVerticalTerrainShadow(ctx, point, width, height, kind) {
    const reach = kind === 'tree' ? height * 0.62 : height * 0.34;
    const spread = kind === 'tree' ? width * 0.42 : width * 0.50;
    const alpha = kind === 'tree' ? 0.34 : 0.26;

    ctx.save();
    ctx.translate(point.x + (reach * 0.34), point.y + (reach * 0.12));
    ctx.rotate(-0.18);
    ctx.scale(1, 0.34);
    const gradient = ctx.createRadialGradient(0, 0, spread * 0.08, 0, 0, spread + reach);
    gradient.addColorStop(0, `rgba(2, 5, 3, ${alpha})`);
    gradient.addColorStop(0.58, `rgba(2, 5, 3, ${alpha * 0.62})`);
    gradient.addColorStop(1, 'rgba(2, 5, 3, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, spread + reach, spread, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const blur = this.camera.circleOfConfusion(projected.depth) * 2;
    if (blur > 0.3) {
      const quantizedBlur = Math.round(blur * 4) / 4;
      ctx.filter = `blur(${quantizedBlur}px)`;
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.imageSmoothingEnabled = false;
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.82)';
    ctx.shadowBlur = Math.max(2, projected.scale * 4);
    ctx.shadowOffsetY = Math.max(1, projected.scale * 2);
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

      const colour = projectile.skillId === 'ability-1'
        ? '#ff7a24'
        : (colours[projectile.kind] || colours.monster);
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
    const duration = 1050;
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
      const fontSize = Math.max(13, 15 * point.scale * ACTOR_SCALE);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `600 ${fontSize}px "GameFont", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(3, point.scale * 3.5);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillStyle = entry.blocked
        ? '#8bd5ff'
        : (entry.critical
          ? '#fff176'
          : (entry.beastbane ? '#8de6a5' : (entry.targetType === 'player' ? '#ff5252' : '#ffd54f')));
      const hitPrefix = [entry.critical ? 'CRIT' : '', entry.beastbane ? 'BANE' : '']
        .filter(Boolean)
        .join(' ');
      const label = entry.blocked
        ? 'BLOCK'
        : `${hitPrefix ? `${hitPrefix} ` : ''}${entry.amount > 0 ? `-${entry.amount}` : '0'}`;
      ctx.strokeText(label, point.x, point.y - rise);
      ctx.fillText(label, point.x, point.y - rise);
      ctx.restore();
    });
  }

  drawGroundTelegraphs(ctx) {
    if (!Array.isArray(this.map.groundTelegraphs) || !this.map.groundTelegraphs.length) {
      return;
    }

    const tileSize = this.map.config.map.tileset.tile.width;
    const timestamp = now();
    this.map.groundTelegraphs = this.map.groundTelegraphs.filter((telegraph) => {
      const duration = Math.max(100, telegraph.durationMs || 1000);
      const progress = clamp((timestamp - telegraph.receivedAt) / duration, 0, 1);
      if (progress >= 1) {
        return false;
      }

      const centerWorld = centerOfTile(telegraph.x, telegraph.y, tileSize);
      const center = this.camera.projectTerrain(centerWorld.x, centerWorld.y);
      if (!center) {
        return true;
      }

      const worldRadius = Math.max(0.5, telegraph.radius) * tileSize;
      const edge = this.camera.projectTerrain(centerWorld.x + worldRadius, centerWorld.y);
      if (!edge) {
        return true;
      }
      const radiusX = Math.max(4, Math.abs(edge.x - center.x));
      const radiusY = Math.max(2, radiusX * 0.34);

      ctx.save();
      ctx.strokeStyle = '#ff7048';
      ctx.fillStyle = `rgba(255, 70, 42, ${0.1 + (progress * 0.24)})`;
      ctx.lineWidth = Math.max(2, center.scale * 3);
      ctx.setLineDash([Math.max(4, center.scale * 7), Math.max(3, center.scale * 5)]);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(
        center.x,
        center.y,
        radiusX * progress,
        radiusY * progress,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }

  drawAttackEffects(ctx) {
    if (!Array.isArray(this.map.attackEffects) || !this.map.attackEffects.length) {
      return;
    }

    const tileSize = this.map.config.map.tileset.tile.width;
    const timestamp = now();
    this.map.attackEffects = this.map.attackEffects.filter((effect) => {
      const age = timestamp - effect.startedAt;
      const duration = effect.monster ? 210 : 300;
      if (age >= duration) {
        return false;
      }

      const fromWorld = centerOfTile(effect.fromX, effect.fromY, tileSize);
      const toWorld = centerOfTile(effect.toX, effect.toY, tileSize);
      const from = this.camera.projectTerrain(fromWorld.x, fromWorld.y);
      const to = this.camera.projectTerrain(toWorld.x, toWorld.y);
      if (!from || !to) {
        return true;
      }

      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const progress = clamp(age / duration, 0, 1);
      const radius = tileSize * from.scale * (0.58 + (progress * 0.78));
      const colour = effect.monster ? '#ff765c' : '#ffe09a';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - progress) * (effect.monster ? 0.72 : 0.95);
      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.shadowColor = colour;
      ctx.shadowBlur = Math.max(4, from.scale * 9);
      ctx.lineWidth = Math.max(effect.monster ? 2 : 3, from.scale * 3.5);
      ctx.lineCap = 'round';
      if (effect.style === 'stab' || effect.style === 'range') {
        ctx.beginPath();
        ctx.moveTo(
          from.x + (Math.cos(angle) * tileSize * from.scale * 0.2),
          from.y + (Math.sin(angle) * tileSize * from.scale * 0.2),
        );
        ctx.lineTo(
          from.x + (Math.cos(angle) * radius),
          from.y + (Math.sin(angle) * radius),
        );
        ctx.stroke();
      } else if (effect.style === 'crush') {
        ctx.beginPath();
        ctx.ellipse(to.x, to.y, radius * 0.48, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const spread = effect.style === 'sweep' ? 1.15 : (effect.monster ? 0.45 : 0.78);
        ctx.beginPath();
        ctx.arc(from.x, from.y, radius, angle - spread, angle + spread);
        ctx.stroke();
      }
      ctx.restore();
      return true;
    });
  }

  drawSkillEffects(ctx) {
    if (!Array.isArray(this.map.skillEffects) || !this.map.skillEffects.length) return;
    const tileSize = this.map.config.map.tileset.tile.width;
    const timestamp = now();

    this.map.skillEffects = this.map.skillEffects.filter((effect) => {
      const age = timestamp - effect.startedAt;
      if (age >= effect.durationMs) return false;
      const progress = clamp(age / effect.durationMs, 0, 1);
      const fade = effect.skillId === 'ability-3'
        ? Math.min(1, (1 - progress) * 4)
        : 1 - progress;
      const actor = typeof this.map.skillEffectActor === 'function'
        ? this.map.skillEffectActor(effect)
        : null;
      const worldX = actor && effect.skillId === 'ability-3' ? actor.x : effect.fromX;
      const worldY = actor && effect.skillId === 'ability-3' ? actor.y : effect.fromY;
      const centerWorld = centerOfTile(worldX, worldY, tileSize);
      const center = this.camera.projectTerrain(centerWorld.x, centerWorld.y);
      if (!center) return true;

      const angle = directionAngle(effect.direction);
      const baseRadius = tileSize * center.scale;
      const ellipse = (radius, start = 0, end = Math.PI * 2) => {
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, radius, radius * 0.34, 0, start, end);
        ctx.stroke();
      };

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, fade);
      ctx.lineCap = 'round';
      if (effect.skillId === 'primary-attack') {
        const radius = baseRadius * (0.7 + (progress * 0.9));
        ctx.strokeStyle = '#ffca63';
        ctx.shadowColor = '#ed7f28';
        ctx.shadowBlur = 12;
        ctx.lineWidth = Math.max(3, center.scale * 4);
        for (let band = 0; band < 3; band += 1) {
          ctx.beginPath();
          ctx.arc(center.x, center.y - (baseRadius * 0.3), radius - (band * 5), angle - 0.9, angle + 0.9);
          ctx.stroke();
        }
      } else if (effect.skillId === 'dash') {
        const fromWorld = centerOfTile(effect.fromX, effect.fromY, tileSize);
        const toWorld = centerOfTile(effect.toX, effect.toY, tileSize);
        const from = this.camera.projectTerrain(fromWorld.x, fromWorld.y);
        const to = this.camera.projectTerrain(toWorld.x, toWorld.y);
        if (from && to) {
          ctx.strokeStyle = '#67f0ce';
          ctx.shadowColor = '#24bd9a';
          ctx.shadowBlur = 15;
          ctx.lineWidth = Math.max(2, center.scale * 3);
          for (let trail = -1; trail <= 1; trail += 1) {
            ctx.globalAlpha = Math.max(0, fade * (0.7 - (Math.abs(trail) * 0.16)));
            ctx.beginPath();
            ctx.moveTo(from.x, from.y - (baseRadius * 0.4) + (trail * 5));
            ctx.lineTo(to.x, to.y - (baseRadius * 0.4) + (trail * 5));
            ctx.stroke();
          }
        }
      } else if (effect.skillId === 'ability-1') {
        ctx.strokeStyle = '#ff8a2d';
        ctx.shadowColor = '#ff4518';
        ctx.shadowBlur = 16;
        ctx.lineWidth = Math.max(2, center.scale * 3.4);
        for (let ray = -1; ray <= 1; ray += 1) {
          const rayAngle = angle + (ray * 0.25);
          ctx.beginPath();
          ctx.moveTo(center.x, center.y - (baseRadius * 0.42));
          ctx.lineTo(
            center.x + (Math.cos(rayAngle) * baseRadius * (1 + progress)),
            center.y - (baseRadius * 0.42) + (Math.sin(rayAngle) * baseRadius * (0.42 + (progress * 0.25))),
          );
          ctx.stroke();
        }
      } else if (effect.skillId === 'ability-2') {
        const radius = baseRadius * Math.max(0.5, Number(effect.radius) || 2) * (0.25 + (progress * 0.75));
        ctx.strokeStyle = '#9addff';
        ctx.shadowColor = '#4a9fff';
        ctx.shadowBlur = 15;
        ctx.lineWidth = Math.max(2, center.scale * 3.5);
        ellipse(radius);
        for (let shard = 0; shard < 8; shard += 1) {
          const shardAngle = (Math.PI * 2 * shard) / 8;
          ctx.beginPath();
          ctx.moveTo(center.x + (Math.cos(shardAngle) * radius * 0.72), center.y + (Math.sin(shardAngle) * radius * 0.24));
          ctx.lineTo(center.x + (Math.cos(shardAngle) * (radius + 8)), center.y + (Math.sin(shardAngle) * (radius * 0.34 + 5)));
          ctx.stroke();
        }
      } else if (effect.skillId === 'ability-3') {
        const radius = baseRadius * (0.82 + (Math.sin(age / 150) * 0.05));
        ctx.strokeStyle = '#72d4aa';
        ctx.fillStyle = 'rgba(55, 119, 84, 0.2)';
        ctx.shadowColor = '#3db98c';
        ctx.shadowBlur = 12;
        ctx.lineWidth = Math.max(2, center.scale * 2.5);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, radius, radius * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        for (let stone = 0; stone < 6; stone += 1) {
          const stoneAngle = (age / 1600) + ((Math.PI * 2 * stone) / 6);
          ctx.fillStyle = stone % 2 ? '#78a17c' : '#b69b64';
          ctx.fillRect(
            center.x + (Math.cos(stoneAngle) * radius) - 2,
            center.y + (Math.sin(stoneAngle) * radius * 0.34) - 4,
            Math.max(4, center.scale * 5),
            Math.max(6, center.scale * 8),
          );
        }
      } else if (effect.skillId === 'ability-4') {
        const radius = baseRadius * (0.48 + (progress * 1.15));
        ctx.strokeStyle = '#ffe17a';
        ctx.shadowColor = '#f2a63b';
        ctx.shadowBlur = 18;
        ctx.lineWidth = Math.max(2, center.scale * 3.5);
        ellipse(radius);
        for (let ray = 0; ray < 8; ray += 1) {
          const rayAngle = ((Math.PI * 2 * ray) / 8) - (progress * 0.8);
          ctx.beginPath();
          ctx.moveTo(center.x + (Math.cos(rayAngle) * radius * 0.45), center.y + (Math.sin(rayAngle) * radius * 0.16));
          ctx.lineTo(center.x + (Math.cos(rayAngle) * radius), center.y + (Math.sin(rayAngle) * radius * 0.34));
          ctx.stroke();
        }
      }
      ctx.restore();
      return true;
    });
  }

  drawPlayerDamageVignette(ctx, width, height, timestamp) {
    const latestHit = (this.map.combatFeedback || [])
      .filter(entry => entry.targetType === 'player' && entry.amount > 0)
      .reduce((latest, entry) => Math.max(latest, entry.startedAt || 0), 0);
    const age = timestamp - latestHit;
    if (!latestHit || age < 0 || age >= 360) {
      return;
    }

    const alpha = 0.22 * (1 - (age / 360));
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.24,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.68,
    );
    gradient.addColorStop(0, 'rgba(160, 12, 16, 0)');
    gradient.addColorStop(1, `rgba(190, 18, 22, ${alpha})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
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
        colour: projectile.skillId === 'ability-1'
          ? [255, 112, 34]
          : (colours[projectile.kind] || colours.monster),
        intensity: 0.95,
      });
    });

    const skillColours = {
      'primary-attack': [255, 194, 82],
      dash: [80, 236, 194],
      'ability-1': [255, 105, 28],
      'ability-2': [108, 190, 255],
      'ability-3': [87, 190, 137],
      'ability-4': [255, 218, 98],
    };
    (this.map.skillEffects || []).forEach((effect) => {
      const progress = (timestamp - effect.startedAt) / effect.durationMs;
      if (progress < 0 || progress >= 1) return;
      const actor = typeof this.map.skillEffectActor === 'function'
        ? this.map.skillEffectActor(effect)
        : null;
      const x = actor && effect.skillId === 'ability-3' ? actor.x : effect.fromX;
      const y = actor && effect.skillId === 'ability-3' ? actor.y : effect.fromY;
      const world = centerOfTile(x, y, tileSize);
      const point = this.camera.projectTerrain(world.x, world.y);
      if (!point) return;
      const persistent = effect.skillId === 'ability-3';
      lights.push({
        x: point.x,
        y: point.y - (tileSize * 0.25 * point.scale),
        radius: Math.max(42, tileSize * point.scale * (persistent ? 2.2 : 3.4)),
        colour: skillColours[effect.skillId] || colours.player,
        intensity: persistent ? 0.38 : Math.max(0.15, (1 - progress) * 0.92),
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
