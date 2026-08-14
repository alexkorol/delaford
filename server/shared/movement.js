export const PLAYER_TILE_TRAVEL_MS = 150;
export const PLAYER_MOVE_SAMPLE_MS = 50;
export const PLAYER_MOVE_DISTANCE = PLAYER_MOVE_SAMPLE_MS / PLAYER_TILE_TRAVEL_MS;
export const POSITION_PRECISION = 6;

export const DIRECTION_VECTORS = Object.freeze({
  right: Object.freeze({ x: 1, y: 0 }),
  left: Object.freeze({ x: -1, y: 0 }),
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  'up-right': Object.freeze({ x: 1, y: -1 }),
  'down-right': Object.freeze({ x: 1, y: 1 }),
  'up-left': Object.freeze({ x: -1, y: -1 }),
  'down-left': Object.freeze({ x: -1, y: 1 }),
});

export const directionVector = (direction, { normalise = false, distance = 1 } = {}) => {
  const vector = DIRECTION_VECTORS[direction];
  if (!vector) {
    return null;
  }

  const length = normalise ? Math.hypot(vector.x, vector.y) : 1;
  return {
    x: (vector.x / length) * distance,
    y: (vector.y / length) * distance,
  };
};

export const playerMovementDelta = direction => directionVector(direction, {
  normalise: true,
  distance: PLAYER_MOVE_DISTANCE,
});

export const roundPosition = (value) => {
  const rounded = Number(Number(value).toFixed(POSITION_PRECISION));
  const nearestTile = Math.round(rounded);
  const snapEpsilon = (10 ** -POSITION_PRECISION) * 2;
  return Math.abs(rounded - nearestTile) <= snapEpsilon ? nearestTile : rounded;
};

export const occupiedTile = position => ({
  x: Math.round(position?.x || 0),
  y: Math.round(position?.y || 0),
});

export default {
  PLAYER_TILE_TRAVEL_MS,
  PLAYER_MOVE_SAMPLE_MS,
  PLAYER_MOVE_DISTANCE,
  POSITION_PRECISION,
  DIRECTION_VECTORS,
  directionVector,
  playerMovementDelta,
  roundPosition,
  occupiedTile,
};
