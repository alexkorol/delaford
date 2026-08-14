import { PLAYER_TILE_TRAVEL_MS } from '@shared/movement.js';

export const TILE_SIZE = 32; // px
export const DEFAULT_MOVE_DURATION_MS = PLAYER_TILE_TRAVEL_MS;
export const DEFAULT_ENGINE_FPS = 20;
export const MAX_ENGINE_FPS = 60;

export const DEFAULT_MOVE_DURATION_SECONDS = DEFAULT_MOVE_DURATION_MS / 1000;
export const DEFAULT_ENTITY_SPEED = TILE_SIZE / DEFAULT_MOVE_DURATION_SECONDS; // pixels per second

export const MOVEMENT_EPSILON = 0.0001;

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
