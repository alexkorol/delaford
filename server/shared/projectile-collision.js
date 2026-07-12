import config from '../config.js';
import UI from './ui.js';

const DEFAULT_SAMPLES_PER_TILE = 8;

const mapDimensions = (map) => {
  const width = Number.isInteger(map?.width) && map.width > 0
    ? map.width
    : config.map.size.x;
  const height = Number.isInteger(map?.height) && map.height > 0
    ? map.height
    : config.map.size.y;
  return { width, height };
};

const entityCell = value => Math.floor((Number(value) || 0) + 0.5);

export const projectileTileBlocked = (map, x, y) => {
  if (!map) {
    return false;
  }

  const { width, height } = mapDimensions(map);
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return true;
  }

  const index = (y * width) + x;
  const backgroundGid = Array.isArray(map.background) ? map.background[index] : 0;
  const foregroundGid = Array.isArray(map.foreground) ? map.foreground[index] : 0;
  const background = Number.isFinite(backgroundGid) ? backgroundGid - 1 : -1;
  const foreground = Number.isFinite(foregroundGid) ? foregroundGid - 1 : -1;

  return !UI.tileWalkable(background) || !UI.tileWalkable(foreground, 'foreground');
};

/**
 * Trace a zero-width projectile through the authoritative tile map.
 *
 * Entity coordinates identify tile centres (integer 10 is the centre of tile
 * 10), so cells change at n + 0.5. Diagonal transitions check both cardinal
 * neighbours before entering the diagonal cell: bolts cannot squeeze through
 * the shared corner of two walls even though actors are point-sampled.
 */
export const traceProjectilePath = (map, from, to, options = {}) => {
  const fromX = Number(from?.x);
  const fromY = Number(from?.y);
  const toX = Number(to?.x);
  const toY = Number(to?.y);

  if (![fromX, fromY, toX, toY].every(Number.isFinite)) {
    return {
      clear: false,
      impact: { x: Number.isFinite(fromX) ? fromX : 0, y: Number.isFinite(fromY) ? fromY : 0 },
      blockedTile: null,
      tiles: [],
    };
  }

  if (!map) {
    return { clear: true, impact: { x: toX, y: toY }, blockedTile: null, tiles: [] };
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const samplesPerTile = Math.max(2, Math.floor(options.samplesPerTile || DEFAULT_SAMPLES_PER_TILE));
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * samplesPerTile));
  const tiles = [];
  const visited = new Set();
  let previous = { x: entityCell(fromX), y: entityCell(fromY) };

  const inspect = (cell, impact) => {
    const key = `${cell.x}:${cell.y}`;
    if (visited.has(key)) {
      return null;
    }
    visited.add(key);
    tiles.push({ ...cell });
    if (!projectileTileBlocked(map, cell.x, cell.y)) {
      return null;
    }
    return {
      clear: false,
      impact,
      blockedTile: { ...cell },
      tiles,
    };
  };

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const point = {
      x: fromX + (dx * progress),
      y: fromY + (dy * progress),
    };
    const cell = { x: entityCell(point.x), y: entityCell(point.y) };
    if (cell.x === previous.x && cell.y === previous.y) {
      continue;
    }

    if (cell.x !== previous.x && cell.y !== previous.y) {
      const horizontal = inspect({ x: cell.x, y: previous.y }, point);
      if (horizontal) return horizontal;
      const vertical = inspect({ x: previous.x, y: cell.y }, point);
      if (vertical) return vertical;
    }

    const collision = inspect(cell, point);
    if (collision) return collision;
    previous = cell;
  }

  return {
    clear: true,
    impact: { x: toX, y: toY },
    blockedTile: null,
    tiles,
  };
};

export const hasProjectileLineOfSight = (map, from, to) => (
  traceProjectilePath(map, from, to).clear
);

