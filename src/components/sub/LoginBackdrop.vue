<template>
  <div class="login-backdrop">
    <canvas
      ref="sceneCanvas"
      class="login-backdrop__canvas"
      :class="{ 'login-backdrop__canvas--pan': !reducedMotion }"
    />
    <div class="login-backdrop__wash" />
  </div>
</template>

<script setup>
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import surfaceMap from '@server/maps/layers/surface.json';
import terrainAtlasUrl from '@/assets/tiles/terrain.png';
import objectAtlasUrl from '@/assets/tiles/objects.png';
import playerSheetUrl from '@/assets/graphics/actors/players/human-v2.png';
import npcSheetUrl from '@/assets/graphics/actors/npcs.png';

const TILE = 32;
const GRID_WIDTH = 48;
const GRID_HEIGHT = 27;
const ORIGIN = { x: 18, y: 102 };
const TERRAIN_FIRST_GID = 1;
const OBJECT_FIRST_GID = 253;
const FRAME_MS = 42;

const sceneCanvas = ref(null);
const reducedMotion = ref(false);

let rafId = null;
let resizeHandler = null;

const surfaceLayer = surfaceMap.layers.find(layer => layer.name === 'Surface');
const objectLayer = surfaceMap.layers.find(layer => layer.name === 'Objects');

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const worldIndex = (x, y) => (y * surfaceMap.width) + x;

const drawTile = (ctx, images, gid, x, y, options = {}) => {
  const cleanGid = Number(gid) & 0x1fffffff;
  if (!cleanGid) return;

  const isObject = cleanGid >= OBJECT_FIRST_GID;
  const image = isObject ? images.objects : images.terrain;
  const firstGid = isObject ? OBJECT_FIRST_GID : TERRAIN_FIRST_GID;
  const localId = cleanGid - firstGid;
  const columns = Math.max(1, Math.floor(image.naturalWidth / TILE));
  const sourceX = (localId % columns) * TILE;
  const sourceY = Math.floor(localId / columns) * TILE;

  if (options.shadow) {
    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(image, sourceX, sourceY, TILE, TILE, x, y, TILE, TILE);
    ctx.restore();
  }

  ctx.drawImage(image, sourceX, sourceY, TILE, TILE, x, y, TILE, TILE);
};

const makeStaticScene = (images) => {
  const layer = document.createElement('canvas');
  layer.width = GRID_WIDTH * TILE;
  layer.height = GRID_HEIGHT * TILE;
  const ctx = layer.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#08100b';
  ctx.fillRect(0, 0, layer.width, layer.height);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const mapX = ORIGIN.x + x;
      const mapY = ORIGIN.y + y;
      const index = worldIndex(mapX, mapY);
      drawTile(ctx, images, surfaceLayer.data[index], x * TILE, y * TILE);
    }
  }

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const mapX = ORIGIN.x + x;
      const mapY = ORIGIN.y + y;
      const index = worldIndex(mapX, mapY);
      const gid = objectLayer.data[index];
      drawTile(ctx, images, gid, x * TILE, y * TILE, { shadow: Boolean(gid) });
    }
  }

  return layer;
};

const ACTORS = [
  { sheet: 'player', column: 0, x: 7.5, y: 15.2, phase: 0.2, speed: 1.45 },
  { sheet: 'npc', column: 0, x: 11.2, y: 9.4, phase: 2.1, speed: 1.1 },
  { sheet: 'player', column: 0, x: 38.4, y: 16.8, phase: 4.2, speed: 1.35 },
  { sheet: 'npc', column: 0, x: 42.2, y: 8.6, phase: 1.4, speed: 1.2 },
];

const LIGHTS = [
  { x: 8.5, y: 12, radius: 150, phase: 0.2 },
  { x: 40.5, y: 11, radius: 170, phase: 2.4 },
  { x: 24, y: 13, radius: 230, phase: 4.3 },
];

const makeRenderer = (canvas, images) => {
  const ctx = canvas.getContext('2d');
  const staticScene = makeStaticScene(images);
  canvas.width = staticScene.width;
  canvas.height = staticScene.height;
  ctx.imageSmoothingEnabled = false;

  const motes = Array.from({ length: 26 }, (_, index) => ({
    x: ((index * 193) % canvas.width) + 20,
    baseY: ((index * 97) % canvas.height) + 80,
    speed: 0.018 + ((index % 5) * 0.004),
    phase: index * 0.73,
    size: 1 + (index % 2),
  }));

  return (timeSeconds) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(staticScene, 0, 0);

    ACTORS.forEach((actor) => {
      const image = images[actor.sheet];
      const bob = Math.round(Math.sin((timeSeconds * actor.speed) + actor.phase) * 1.5);
      const x = Math.round(actor.x * TILE);
      const y = Math.round((actor.y * TILE) + bob);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;
      ctx.drawImage(image, actor.column * 64, 0, 64, 64, x, y, TILE, TILE);
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'screen';
    LIGHTS.forEach((light) => {
      const flicker = 0.86 + (Math.sin((timeSeconds * 2.3) + light.phase) * 0.08);
      const x = light.x * TILE;
      const y = light.y * TILE;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, light.radius);
      gradient.addColorStop(0, `rgba(238, 176, 88, ${0.2 * flicker})`);
      gradient.addColorStop(0.45, `rgba(95, 168, 147, ${0.06 * flicker})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - light.radius, y - light.radius, light.radius * 2, light.radius * 2);
    });

    motes.forEach((mote) => {
      const cycle = ((timeSeconds * mote.speed) + mote.phase) % 1;
      const x = mote.x + (Math.sin((cycle * Math.PI * 4) + mote.phase) * 10);
      const y = mote.baseY - (cycle * 90);
      ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.35;
      ctx.fillStyle = indexColour(mote.phase);
      ctx.fillRect(x, y, mote.size, mote.size);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
};

const indexColour = phase => (Math.floor(phase) % 3 === 0 ? '#9ee3bf' : '#f0c36a');

const coverViewport = (canvas) => {
  const scale = Math.max(
    window.innerWidth / canvas.width,
    window.innerHeight / canvas.height,
  ) * 1.04;
  canvas.style.width = `${Math.ceil(canvas.width * scale)}px`;
  canvas.style.height = `${Math.ceil(canvas.height * scale)}px`;
};

onMounted(async () => {
  const canvas = sceneCanvas.value;
  if (!canvas || !surfaceLayer || !objectLayer) return;

  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    const [terrain, objects, player, npc] = await Promise.all([
      loadImage(terrainAtlasUrl),
      loadImage(objectAtlasUrl),
      loadImage(playerSheetUrl),
      loadImage(npcSheetUrl),
    ]);
    const render = makeRenderer(canvas, {
      terrain,
      objects,
      player,
      npc,
    });
    coverViewport(canvas);

    if (reducedMotion.value) {
      render(0);
    } else {
      let lastFrame = 0;
      const tick = (timestamp) => {
        rafId = requestAnimationFrame(tick);
        if (timestamp - lastFrame < FRAME_MS) return;
        lastFrame = timestamp;
        render(timestamp / 1000);
      };
      rafId = requestAnimationFrame(tick);
    }

    resizeHandler = () => coverViewport(canvas);
    window.addEventListener('resize', resizeHandler, { passive: true });
  } catch (_error) {
    // The auth panel remains usable over its CSS fallback if an atlas fails.
  }
});

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
});
</script>

<style lang="scss" scoped>
.login-backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  background: #08100b;
}

.login-backdrop__canvas {
  flex: none;
  image-rendering: pixelated;
  filter: saturate(1.12) contrast(1.08) brightness(0.86);
}

.login-backdrop__canvas--pan {
  animation: village-pan 42s ease-in-out infinite alternate;
}

.login-backdrop__wash {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 8, 8, 0.08), rgba(3, 5, 4, 0.18)),
    radial-gradient(circle at 50% 48%, transparent 18%, rgba(2, 5, 4, 0.32) 72%, rgba(1, 2, 2, 0.68));
  pointer-events: none;
}

@keyframes village-pan {
  from { transform: scale(1.015) translate3d(-0.7%, -0.25%, 0); }
  to { transform: scale(1.035) translate3d(0.7%, 0.3%, 0); }
}
</style>
