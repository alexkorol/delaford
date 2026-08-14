<template>
  <aside class="world-minimap" aria-label="World minimap">
    <canvas
      ref="canvas"
      class="world-minimap__canvas"
      :height="size"
      :width="size"
    />
    <div class="world-minimap__readout">
      <span>{{ displaySceneName }}</span>
      <span>{{ displayCoords }}</span>
    </div>
  </aside>
</template>

<script>
import DUNGEON_TILESET, { DUNGEON_FIRST_GID } from '@shared/dungeon-tiles.js';

const groupLocals = (category, variant = null) => {
  const group = DUNGEON_TILESET.groups[category] || {};
  if (variant) {
    return group[variant] || [];
  }
  return Object.values(group).flat();
};

const WALL_LOCALS = new Set(groupLocals('wall'));
const WATER_LOCALS = new Set(groupLocals('liquid'));
const TREE_LOCALS = new Set(groupLocals('tree'));
const FLOOR_LOCALS = new Set(groupLocals('floor'));
const WALKABLE_DECOR_LOCALS = new Set(groupLocals('decor_walk'));
const PORTAL_LOCALS = new Set([
  DUNGEON_TILESET.names.portal,
  DUNGEON_TILESET.names.exit_portal,
  DUNGEON_TILESET.names.stairs_up,
  DUNGEON_TILESET.names.stairs_down,
  DUNGEON_TILESET.names.hatch_up,
  DUNGEON_TILESET.names.hatch_down,
].filter(Number.isFinite));

const localId = gid => (Number.isFinite(gid) && gid >= DUNGEON_FIRST_GID
  ? gid - DUNGEON_FIRST_GID
  : -1);

const formatSceneName = (game) => {
  if (game && game.sceneName) {
    return game.sceneName;
  }

  const sceneId = game && game.sceneId ? game.sceneId : '';
  const label = sceneId.includes(':') ? sceneId.split(':').pop() : sceneId;
  return label
    ? label.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : 'Unknown';
};

export default {
  name: 'WorldMinimap',
  props: {
    game: {
      type: Object,
      required: true,
    },
    size: {
      type: Number,
      default: 168,
    },
  },
  data() {
    return {
      animationFrame: null,
      lastDrawAt: 0,
      displaySceneName: '',
      displayCoords: '',
    };
  },
  mounted() {
    this.scheduleDraw();
  },
  beforeUnmount() {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  },
  methods: {
    scheduleDraw(timestamp = 0) {
      if (!this.lastDrawAt || timestamp - this.lastDrawAt > 160) {
        this.draw();
        this.lastDrawAt = timestamp;
      }
      this.animationFrame = window.requestAnimationFrame(next => this.scheduleDraw(next));
    },

    tileColor(backgroundGid, foregroundGid) {
      const background = localId(backgroundGid);
      const foreground = localId(foregroundGid);

      if (PORTAL_LOCALS.has(foreground)) {
        return '#47d6ff';
      }
      if (TREE_LOCALS.has(foreground)) {
        return '#31573d';
      }
      if (WALKABLE_DECOR_LOCALS.has(foreground)) {
        return '#58784a';
      }
      if (WALL_LOCALS.has(background)) {
        return '#171a1e';
      }
      if (WATER_LOCALS.has(background)) {
        return '#184f6f';
      }
      if (FLOOR_LOCALS.has(background)) {
        return '#74613f';
      }
      return '#302b22';
    },

    drawPoint(ctx, bounds, point, radius, color) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return;
      }

      const x = bounds.x + (point.x * bounds.scale);
      const y = bounds.y + (point.y * bounds.scale);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    },

    draw() {
      const canvas = this.$refs.canvas;
      const map = this.game && this.game.map;
      if (!canvas || !map) {
        return;
      }

      const ctx = canvas.getContext('2d');
      const mapConfig = map.config && map.config.map ? map.config.map : {};
      const mapSize = mapConfig.size || { x: 200, y: 200 };
      const width = mapSize.x || 200;
      const height = mapSize.y || 200;
      const background = map.background || [];
      const foreground = map.foreground || [];
      const padding = 6;
      const drawable = this.size - (padding * 2);
      const scale = Math.min(drawable / width, drawable / height);
      const bounds = {
        x: Math.round((this.size - (width * scale)) / 2),
        y: Math.round((this.size - (height * scale)) / 2),
        scale,
      };
      const cell = Math.max(1, Math.ceil(scale));

      canvas.width = this.size;
      canvas.height = this.size;

      ctx.clearRect(0, 0, this.size, this.size);
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, this.size, this.size);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width) + x;
          ctx.fillStyle = this.tileColor(background[index], foreground[index]);
          ctx.fillRect(
            bounds.x + (x * scale),
            bounds.y + (y * scale),
            cell,
            cell,
          );
        }
      }

      const portals = this.game.sceneMetadata && Array.isArray(this.game.sceneMetadata.portals)
        ? this.game.sceneMetadata.portals
        : [];
      portals.forEach(portal => this.drawPoint(ctx, bounds, portal, 2.5, '#5ee9ff'));

      const monsters = Array.isArray(map.monsters) ? map.monsters : [];
      monsters.forEach((monster) => {
        const health = monster.stats && monster.stats.resources
          ? monster.stats.resources.health
          : null;
        if (!health || health.current > 0) {
          this.drawPoint(ctx, bounds, monster, 2.3, '#ff595e');
        }
      });

      const npcs = Array.isArray(map.npcs) ? map.npcs : [];
      npcs.forEach(npc => this.drawPoint(ctx, bounds, npc, 2.2, '#ffd166'));

      const player = this.game.player || map.player;
      this.drawPoint(ctx, bounds, player, 3.8, '#f7f5a3');

      if (typeof map.getViewportMetrics === 'function') {
        const metrics = map.getViewportMetrics();
        if (metrics && metrics.tileCrop && metrics.viewport) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            bounds.x + (metrics.tileCrop.x * scale),
            bounds.y + (metrics.tileCrop.y * scale),
            metrics.viewport.x * scale,
            metrics.viewport.y * scale,
          );
        }
      }

      this.displaySceneName = formatSceneName(this.game);
      this.displayCoords = player && Number.isFinite(player.x) && Number.isFinite(player.y)
        ? `${player.x}, ${player.y}`
        : '';
    },
  },
};
</script>

<style scoped lang="scss">
.world-minimap {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 58;
  width: 168px;
  padding: 5px;
  border: 1px solid rgba(205, 174, 105, 0.42);
  border-radius: 0;
  background: rgba(5, 7, 10, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.world-minimap__canvas {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
  border: 1px solid rgba(0, 0, 0, 0.75);
  background: #050608;
}

.world-minimap__readout {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  color: #f3dda1;
  font-family: var(--font-pixel, monospace);
  font-size: 0.58rem;
  line-height: 1.2;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
}

@media (width <= 639px) {
  .world-minimap {
    width: 124px;
    padding: 4px;
  }

  .world-minimap__readout {
    font-size: 0.5rem;
  }
}
</style>
