<template>
  <div class="login-backdrop">
    <canvas
      ref="sceneCanvas"
      class="login-backdrop__canvas"
      :class="{ 'login-backdrop__canvas--pan': !reducedMotion }"
    />
  </div>
</template>

<script setup>
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import { DUNGEON_FIRST_GID, dungeonGid, dungeonGroupGids } from '@shared/dungeon-tiles.js';
import dungeonAtlasUrl from '@/assets/tiles/dungeon.png';
import playerSheetUrl from '@/assets/graphics/actors/players/human-v2.png';
import npcSheetUrl from '@/assets/graphics/actors/npcs.png';
import monsterSheetUrl from '@/assets/graphics/actors/monsters.png';

const props = defineProps({
  seed: {
    type: String,
    default: 'login-vestibule-7',
  },
});

const TILE = 32;
const PLAYER_FRAME_SIZE = 64;
const ACTOR_FRAME_SIZE = 64;
const ATLAS_COLUMNS = 16;
const GRID_W = 48;
const GRID_H = 27;
const FRAME_MS = 33; // ~30fps is plenty for ambience

const VOID = 0;
const FLOOR = 1;
const WALL = 2;
const WATER = 3;

const sceneCanvas = ref(null);
const reducedMotion = ref(false);

let rafId = null;
let resizeHandler = null;

const hashSeed = (text) => {
  let hash = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
};

const mulberry32 = (seedValue) => {
  let state = seedValue;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

/* Carve a deterministic vestibule: entry room, great hall, stair room,
 * crypt annex, corridors. Same bones as the instance generator, sized
 * and dressed for a single ambient frame. */
const buildScene = (rng) => {
  const cells = new Array(GRID_W * GRID_H).fill(VOID);
  const zone = new Array(GRID_W * GRID_H).fill('stone');
  const at = (x, y) => (y * GRID_W) + x;
  const inBounds = (x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;

  const carve = (ax, ay, bx, by, theme = 'stone') => {
    const x1 = Math.min(ax, bx);
    const x2 = Math.max(ax, bx);
    const y1 = Math.min(ay, by);
    const y2 = Math.max(ay, by);
    for (let y = y1; y <= y2; y += 1) {
      for (let x = x1; x <= x2; x += 1) {
        if (inBounds(x, y)) {
          cells[at(x, y)] = FLOOR;
          zone[at(x, y)] = theme;
        }
      }
    }
  };

  const jit = (base, spread) => base + Math.floor(rng() * (spread + 1));

  const entry = { x1: 2, y1: 13, x2: jit(13, 2), y2: jit(23, 1) };
  const hall = { x1: 17, y1: 6, x2: jit(32, 2), y2: jit(20, 1) };
  const stairRoom = { x1: 36, y1: 3, x2: 46, y2: jit(13, 1) };
  const crypt = { x1: 3, y1: 1, x2: jit(12, 1), y2: 8 };

  carve(entry.x1, entry.y1, entry.x2, entry.y2);
  carve(hall.x1, hall.y1, hall.x2, hall.y2);
  carve(stairRoom.x1, stairRoom.y1, stairRoom.x2, stairRoom.y2);
  carve(crypt.x1, crypt.y1, crypt.x2, crypt.y2, 'crypt');

  const entryMidY = Math.floor((entry.y1 + entry.y2) / 2);
  const entryMidX = Math.floor((entry.x1 + entry.x2) / 2);
  const hallMidY = Math.floor((hall.y1 + hall.y2) / 2);
  const hallMidX = Math.floor((hall.x1 + hall.x2) / 2);
  const stairMidY = Math.floor((stairRoom.y1 + stairRoom.y2) / 2);
  const cryptMidX = Math.floor((crypt.x1 + crypt.x2) / 2);
  const cryptMidY = Math.floor((crypt.y1 + crypt.y2) / 2);

  carve(entry.x2 + 1, entryMidY - 1, hall.x1 - 1, entryMidY);
  carve(hall.x2 + 1, hallMidY - 1, stairRoom.x1 - 1, hallMidY);
  carve(stairRoom.x1 - 1, hallMidY, stairRoom.x1 + 1, stairMidY);
  carve(cryptMidX, crypt.y2 + 1, cryptMidX + 1, hall.y1 + 1);
  carve(cryptMidX, hall.y1 - 1, hall.x1 + 1, hall.y1 + 1);

  /* Marble dais in front of the altars. */
  const altarY = hall.y1 + 2;
  for (let y = altarY; y <= altarY + 2; y += 1) {
    for (let x = hallMidX - 2; x <= hallMidX + 3; x += 1) {
      if (inBounds(x, y)) zone[at(x, y)] = 'marble';
    }
  }

  /* Water pool in the hall's south-east corner. */
  const waterCells = [];
  for (let y = hall.y2 - 2; y <= hall.y2; y += 1) {
    for (let x = hall.x2 - 4; x <= hall.x2 - 1; x += 1) {
      cells[at(x, y)] = WATER;
      waterCells.push({ x, y, phase: rng() * Math.PI * 2 });
    }
  }

  /* Walls: any void touching a carved cell, themed by nearest zone. */
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (cells[at(x, y)] !== VOID) continue;
      let touchTheme = null;
      for (let dy = -1; dy <= 1 && !touchTheme; dy += 1) {
        for (let dx = -1; dx <= 1 && !touchTheme; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny) && (cells[at(nx, ny)] === FLOOR || cells[at(nx, ny)] === WATER)) {
            touchTheme = zone[at(nx, ny)];
          }
        }
      }
      if (touchTheme) {
        cells[at(x, y)] = WALL;
        zone[at(x, y)] = touchTheme === 'marble' ? 'relief' : touchTheme;
      }
    }
  }

  /* Overgrown vines on the entry room's south wall. */
  for (let x = entry.x1 + 1; x <= entry.x2 - 1; x += 1) {
    if (rng() < 0.45 && cells[at(x, entry.y2 + 1)] === WALL) {
      zone[at(x, entry.y2 + 1)] = 'vines';
    }
  }

  const decor = [
    { x: entryMidX, y: entryMidY, name: 'stairs_up' },
    { x: entry.x2 + 1, y: entryMidY, name: 'door_open' },
    { x: hall.x2 + 1, y: hallMidY, name: 'door_closed' },
    { x: cryptMidX, y: crypt.y2 + 1, name: 'door_runed' },
    { x: stairRoom.x2 - 2, y: stairMidY, name: 'stairs_down' },
    { x: hallMidX - 1, y: altarY, name: 'statue_angel' },
    { x: hallMidX + 2, y: altarY, name: 'statue_dragon' },
    { x: hall.x1 + 2, y: hall.y2 - 1, name: 'fountain_sparkling' },
    { x: cryptMidX, y: cryptMidY, name: 'sarcophagus' },
    { x: entry.x1 + 1, y: entry.y1 + 1, name: 'tree_dead_0' },
    { x: entry.x2 - 1, y: entry.y2 - 1, name: 'tree_petrified_0' },
    { x: stairRoom.x1 + 1, y: stairRoom.y1 + 1, name: 'fountain_dry' },
  ];

  const altarGids = dungeonGroupGids('decor', 'altar_generic');
  const altars = [hallMidX, hallMidX + 1].map((x) => ({
    x,
    y: altarY,
    gid: pick(rng, altarGids),
  }));

  /* The inhabitants. Columns follow the live generated actor atlases. */
  const actors = [
    { sheet: 'player', column: 0, x: entryMidX - 1.5, y: entryMidY + 1.6, bobAmp: 1.5, bobSpeed: 1.6, phase: 0.4 },
    { sheet: 'player', column: 0, x: entryMidX + 1.2, y: entryMidY + 2.1, bobAmp: 1.5, bobSpeed: 1.4, phase: 2.8 },
    { sheet: 'player', column: 0, x: entryMidX - 0.2, y: entryMidY + 3, bobAmp: 1.5, bobSpeed: 1.8, phase: 4.9 },
    { sheet: 'npc', column: 0, x: hall.x1 + 3.2, y: hall.y2 - 2.2, bobAmp: 1, bobSpeed: 1.1, phase: 1.2 },
    { sheet: 'monster', column: 2, x: hallMidX + 0.5, y: altarY + 1.4, bobAmp: 2, bobSpeed: 0.9, phase: 0 },
    { sheet: 'monster', column: 0, x: cryptMidX + 1.4, y: cryptMidY + 0.8, bobAmp: 1, bobSpeed: 2.2, phase: 3.6 },
    {
      sheet: 'monster',
      column: 1,
      x: hall.x1 + 4,
      y: hallMidY + 1.5,
      bobAmp: 1,
      bobSpeed: 2,
      phase: 1.9,
      patrol: { from: hall.x1 + 3, to: hallMidX - 1.5, period: 14 },
    },
  ];

  return {
    cells,
    zone,
    at,
    decor,
    altars,
    actors,
    waterCells,
    lights: [
      { x: hallMidX + 1, y: altarY + 0.5, radius: 8, strength: 0.75, flicker: 0.35, phase: 0.7 },
      { x: stairRoom.x2 - 2, y: stairMidY, radius: 6.5, strength: 0.65, flicker: 0.25, phase: 2.1 },
      { x: hall.x1 + 2.5, y: hall.y2 - 1.5, radius: 6, strength: 0.55, flicker: 0.2, phase: 3.3 },
      { x: cryptMidX + 0.5, y: cryptMidY, radius: 5.5, strength: 0.5, flicker: 0.3, phase: 4.5 },
      { x: entryMidX, y: entryMidY + 1, radius: 6.5, strength: 0.6, flicker: 0.22, phase: 5.6 },
    ],
  };
};

const sheetFor = (images, name) => {
  if (name === 'player') return images.player;
  if (name === 'npc') return images.npcs;
  return images.monsters;
};

const makeRenderer = (canvas, images, rng) => {
  const scene = buildScene(rng);
  const ctx = canvas.getContext('2d');
  canvas.width = GRID_W * TILE;
  canvas.height = GRID_H * TILE;

  const drawGidTo = (target, gid, px, py) => {
    const local = gid - DUNGEON_FIRST_GID;
    if (local < 0) return;
    target.drawImage(
      images.atlas,
      (local % ATLAS_COLUMNS) * TILE,
      Math.floor(local / ATLAS_COLUMNS) * TILE,
      TILE,
      TILE,
      px,
      py,
      TILE,
      TILE,
    );
  };

  const floorPools = {
    stone: dungeonGroupGids('floor', 'stone'),
    crypt: dungeonGroupGids('floor', 'crypt'),
    marble: dungeonGroupGids('floor', 'marble'),
  };
  const wallPools = {
    stone: dungeonGroupGids('wall', 'stone'),
    crypt: dungeonGroupGids('wall', 'crypt'),
    relief: dungeonGroupGids('wall', 'relief'),
    vines: dungeonGroupGids('wall', 'vines'),
  };
  const flowerGids = dungeonGroupGids('decor_walk', 'flowers');
  const waterShallow = dungeonGid('liquid_water_shallow');
  const waterDeep = dungeonGid('liquid_water_deep');

  /* Static layer: tiles and decor, drawn once. */
  const staticLayer = document.createElement('canvas');
  staticLayer.width = canvas.width;
  staticLayer.height = canvas.height;
  const sctx = staticLayer.getContext('2d');
  sctx.fillStyle = '#07060a';
  sctx.fillRect(0, 0, staticLayer.width, staticLayer.height);

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const cell = scene.cells[scene.at(x, y)];
      const theme = scene.zone[scene.at(x, y)];
      if (cell === FLOOR) {
        drawGidTo(sctx, pick(rng, floorPools[theme] || floorPools.stone), x * TILE, y * TILE);
        if (rng() < 0.025) drawGidTo(sctx, pick(rng, flowerGids), x * TILE, y * TILE);
      } else if (cell === WALL) {
        drawGidTo(sctx, pick(rng, wallPools[theme] || wallPools.stone), x * TILE, y * TILE);
      } else if (cell === WATER) {
        drawGidTo(sctx, waterShallow, x * TILE, y * TILE);
      }
    }
  }
  scene.altars.forEach((altar) => drawGidTo(sctx, altar.gid, altar.x * TILE, altar.y * TILE));
  scene.decor.forEach((d) => drawGidTo(sctx, dungeonGid(d.name), d.x * TILE, d.y * TILE));

  /* Cached gradients: light pools at full strength, dialed per frame
   * with globalAlpha; vignette reused as-is. */
  const lightCache = scene.lights.map((light) => {
    const cx = (light.x * TILE) + (TILE / 2);
    const cy = (light.y * TILE) + (TILE / 2);
    const radius = light.radius * TILE;
    const screenGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    screenGlow.addColorStop(0, `rgba(214, 142, 64, ${light.strength * 0.55})`);
    screenGlow.addColorStop(1, 'rgba(214, 142, 64, 0)');
    const warmGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    warmGlow.addColorStop(0, `rgba(255, 186, 102, ${light.strength})`);
    warmGlow.addColorStop(1, 'rgba(255, 186, 102, 0)');
    return { ...light, cx, cy, r: radius, screenGlow, warmGlow };
  });

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.35,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.66,
  );
  vignette.addColorStop(0, 'rgba(255, 255, 255, 1)');
  vignette.addColorStop(1, 'rgba(150, 138, 158, 1)');

  /* Stateless ember motes: position is a pure function of time. */
  const embers = [];
  lightCache.forEach((light, lightIndex) => {
    for (let i = 0; i < 5; i += 1) {
      embers.push({
        baseX: light.cx + (rng() - 0.5) * light.r * 0.8,
        baseY: light.cy + light.r * 0.25,
        rise: 70 + rng() * 80,
        sway: 4 + rng() * 8,
        size: 1 + rng() * 1.6,
        speed: 0.08 + rng() * 0.07,
        offset: rng() + lightIndex * 0.13,
      });
    }
  });

  const render = (t) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(staticLayer, 0, 0);

    /* Water shimmer: cells trade shallow/deep on slow per-cell clocks. */
    scene.waterCells.forEach((cell) => {
      const deep = Math.sin((t * 1.3) + cell.phase) > 0.2;
      drawGidTo(ctx, deep ? waterDeep : waterShallow, cell.x * TILE, cell.y * TILE);
    });

    /* Inhabitants: idle bob, one guard on patrol. */
    scene.actors.forEach((actor) => {
      let ax = actor.x;
      if (actor.patrol) {
        const span = actor.patrol.to - actor.patrol.from;
        const cycle = (Math.sin((t / actor.patrol.period) * Math.PI * 2) + 1) / 2;
        ax = actor.patrol.from + (span * cycle);
      }
      const bob = Math.round(Math.sin((t * actor.bobSpeed) + actor.phase) * actor.bobAmp);
      const frameSize = actor.sheet === 'player' ? PLAYER_FRAME_SIZE : ACTOR_FRAME_SIZE;
      ctx.drawImage(
        sheetFor(images, actor.sheet),
        actor.column * frameSize,
        0,
        frameSize,
        frameSize,
        Math.round(ax * TILE),
        Math.round((actor.y * TILE) + bob),
        TILE,
        TILE,
      );
    });

    /* Torchlight with flicker. */
    lightCache.forEach((light) => {
      const flicker = 1
        - (light.flicker * 0.5)
        + (light.flicker * (0.32 * Math.sin((t * 7.3) + light.phase) + 0.18 * Math.sin((t * 13.7) + (light.phase * 2))));
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.max(0.1, flicker);
      ctx.fillStyle = light.screenGlow;
      ctx.fillRect(light.cx - light.r, light.cy - light.r, light.r * 2, light.r * 2);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = light.warmGlow;
      ctx.fillRect(light.cx - light.r, light.cy - light.r, light.r * 2, light.r * 2);
    });
    ctx.globalAlpha = 1;

    /* Embers drifting up out of the light pools. */
    ctx.globalCompositeOperation = 'screen';
    embers.forEach((ember) => {
      const cycle = ((t * ember.speed) + ember.offset) % 1;
      const ex = ember.baseX + Math.sin((cycle * Math.PI * 4) + ember.offset * 7) * ember.sway;
      const ey = ember.baseY - (cycle * ember.rise);
      const alpha = Math.sin(cycle * Math.PI) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffc27a';
      ctx.fillRect(ex, ey, ember.size, ember.size);
    });
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  };

  return render;
};

/* Scale the frame to cover the viewport (with margin for the pan drift). */
const coverViewport = (canvas) => {
  const scale = Math.max(
    window.innerWidth / (GRID_W * TILE),
    window.innerHeight / (GRID_H * TILE),
  ) * 1.05;
  canvas.style.width = `${Math.ceil(GRID_W * TILE * scale)}px`;
  canvas.style.height = `${Math.ceil(GRID_H * TILE * scale)}px`;
};

onMounted(async () => {
  const canvas = sceneCanvas.value;
  if (!canvas) return;

  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let images;
  try {
    const [atlas, player, npcs, monsters] = await Promise.all([
      loadImage(dungeonAtlasUrl),
      loadImage(playerSheetUrl),
      loadImage(npcSheetUrl),
      loadImage(monsterSheetUrl),
    ]);
    images = { atlas, player, npcs, monsters };
  } catch (error) {
    return; // No backdrop is better than a broken one.
  }

  const render = makeRenderer(canvas, images, mulberry32(hashSeed(props.seed)));
  coverViewport(canvas);

  if (reducedMotion.value) {
    render(0);
  } else {
    let last = 0;
    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      render(now / 1000);
    };
    rafId = requestAnimationFrame(tick);
  }

  resizeHandler = () => coverViewport(canvas);
  window.addEventListener('resize', resizeHandler, { passive: true });
});

onBeforeUnmount(() => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
});
</script>

<style lang="scss" scoped>
.login-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-backdrop__canvas {
  flex: none;
  image-rendering: pixelated;
  filter: saturate(0.95);
}

.login-backdrop__canvas--pan {
  animation: backdrop-pan 56s ease-in-out infinite alternate;
}

@keyframes backdrop-pan {
  from { transform: translateX(-1.4%); }
  to { transform: translateX(1.4%); }
}
</style>
