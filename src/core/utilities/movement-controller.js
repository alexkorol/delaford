import {
  TILE_SIZE,
  DEFAULT_MOVE_DURATION_MS,
  DEFAULT_ENTITY_SPEED,
  MOVEMENT_EPSILON,
  now,
} from '../config/movement.js';

const clonePoint = ({ x, y }) => ({ x, y });

const centerOfTile = (tileX, tileY, tileSize = TILE_SIZE) => ({
  x: (tileX + 0.5) * tileSize,
  y: (tileY + 0.5) * tileSize,
});

const computeDurationFromDelta = (deltaX, deltaY, baseDuration) => {
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= MOVEMENT_EPSILON) {
    return 0;
  }
  return Math.round(baseDuration * distance);
};

/**
 * Tracks interpolated positions for any map entity.
 * Rendering code will read {@link render} and {@link getPosition}
 * while networking hooks call {@link hardSync} and {@link startMove}.
 */
class MovementController {
  constructor(options = {}) {
    const {
      tileSize = TILE_SIZE,
      moveDuration = DEFAULT_MOVE_DURATION_MS,
      speed = DEFAULT_ENTITY_SPEED,
    } = options;

    this.tileSize = tileSize;
    this.moveDuration = moveDuration;
    this.speed = speed;

    this.tile = { x: 0, y: 0 };
    this.previous = { x: 0, y: 0 };
    this.render = { x: 0, y: 0 };
    this.next = { x: 0, y: 0 };
    this.lastUpdate = 0;
    this.currentTimestamp = 0;
    this.eta = 0;
    this.sequence = 0;
    this.walkId = null;
    this.lastServerStep = null;
  }

  /**
   * Initialise controller with an absolute tile.
   */
  initialise(tileX, tileY, timestamp = now()) {
    const center = centerOfTile(tileX, tileY, this.tileSize);
    this.tile = { x: tileX, y: tileY };
    this.previous = clonePoint(center);
    this.render = clonePoint(center);
    this.next = clonePoint(center);
    this.lastUpdate = timestamp;
    this.currentTimestamp = timestamp;
    this.eta = 0;
    this.sequence = 0;
    this.walkId = null;
    this.lastServerStep = null;
    return this;
  }

  /**
   * Force the controller to a tile, clearing any ongoing interpolation.
   */
  hardSync(tileX, tileY, timestamp = now()) {
    return this.initialise(tileX, tileY, timestamp);
  }

  /**
   * Start interpolating towards a new tile target.
   */
  startMove(nextTileX, nextTileY, { timestamp = now(), duration = this.moveDuration } = {}) {
    const start = this.getPosition(timestamp);
    const destination = centerOfTile(nextTileX, nextTileY, this.tileSize);

    this.previous = clonePoint(start);
    this.render = clonePoint(start);
    this.next = clonePoint(destination);

    this.tile = { x: nextTileX, y: nextTileY };
    this.lastUpdate = timestamp;
    this.currentTimestamp = timestamp;
    this.eta = duration;

    if (duration <= MOVEMENT_EPSILON) {
      this.complete(timestamp);
    }

    return this;
  }

  /**
   * Compute the current interpolated position without mutating state.
   */
  getPosition(timestamp = now()) {
    if (this.eta <= MOVEMENT_EPSILON) {
      return clonePoint(this.render);
    }

    const alpha = Math.min(1, Math.max(0, (timestamp - this.lastUpdate) / this.eta));
    return {
      x: this.previous.x + ((this.next.x - this.previous.x) * alpha),
      y: this.previous.y + ((this.next.y - this.previous.y) * alpha),
    };
  }

  /**
   * Advance interpolation state to the supplied timestamp,
   * updating {@link render} and settling when eta expires.
   */
  update(input = {}) {
    if (typeof input === 'number') {
      const timestamp = input;
      const position = this.getPosition(timestamp);
      this.render = clonePoint(position);

      if (this.eta > MOVEMENT_EPSILON && timestamp >= this.lastUpdate + this.eta) {
        this.complete(timestamp);
      } else {
        this.currentTimestamp = timestamp;
      }

      return clonePoint(this.render);
    }

    const options = typeof input === 'object' && input !== null ? input : {};
    const deltaSeconds = Number.isFinite(options.deltaSeconds) ? options.deltaSeconds : 0;
    const deltaMs = Math.max(0, deltaSeconds * 1000);

    let timestamp;
    if (Number.isFinite(options.timestamp)) {
      timestamp = options.timestamp;
    } else {
      const reference = (Number.isFinite(this.currentTimestamp) && this.currentTimestamp > 0)
        ? this.currentTimestamp
        : (Number.isFinite(this.lastUpdate) && this.lastUpdate > 0 ? this.lastUpdate : now());
      timestamp = reference + deltaMs;
    }

    const position = this.getPosition(timestamp);
    this.render = clonePoint(position);

    if (this.eta > MOVEMENT_EPSILON && timestamp >= this.lastUpdate + this.eta) {
      this.complete(timestamp);
    } else {
      this.currentTimestamp = timestamp;
    }

    return clonePoint(this.render);
  }

  /**
   * Cancels the current interpolation but keeps the latest render position.
   */
  cancel(timestamp = now()) {
    const position = this.getPosition(timestamp);
    this.previous = clonePoint(position);
    this.render = clonePoint(position);
    this.next = clonePoint(position);
    this.eta = 0;
    this.lastUpdate = timestamp;
    this.currentTimestamp = timestamp;
    return this;
  }

  /**
   * True if the controller is currently interpolating between tiles.
   */
  isMoving(timestamp = now()) {
    if (this.eta <= MOVEMENT_EPSILON) {
      return false;
    }
    return timestamp < this.lastUpdate + this.eta;
  }

  shouldAcceptStep(step = {}) {
    if (!step || typeof step.sequence !== 'number') {
      return true;
    }

    if (typeof this.sequence === 'number' && step.sequence <= this.sequence) {
      return false;
    }

    if (
      this.lastServerStep
      && typeof this.lastServerStep.walkId === 'number'
      && step.walkId !== undefined
      && step.walkId !== null
      && step.walkId === this.lastServerStep.walkId
      && typeof this.lastServerStep.stepIndex === 'number'
      && typeof step.stepIndex === 'number'
    ) {
      return step.stepIndex > this.lastServerStep.stepIndex;
    }

    return true;
  }

  applyServerStep(tileX, tileY, step = {}, meta = {}) {
    const receivedAt = typeof meta.receivedAt === 'number' ? meta.receivedAt : now();

    if (!this.shouldAcceptStep(step)) {
      return false;
    }

    const currentTile = this.tile || { x: tileX, y: tileY };
    const fallbackDuration = computeDurationFromDelta(
      tileX - currentTile.x,
      tileY - currentTile.y,
      this.moveDuration,
    );

    const rawDuration = (step && typeof step.duration === 'number' && step.duration >= 0)
      ? step.duration
      : fallbackDuration;
    const duration = Number.isFinite(rawDuration) ? rawDuration : fallbackDuration;

    const startedAt = step && typeof step.startedAt === 'number' ? step.startedAt : null;
    const sentAt = meta && typeof meta.sentAt === 'number' ? meta.sentAt : null;

    let timestamp = receivedAt;

    if (duration > MOVEMENT_EPSILON) {
      let elapsed = null;
      if (startedAt !== null && sentAt !== null) {
        elapsed = Math.max(0, Math.min(duration, sentAt - startedAt));
      } else if (startedAt !== null) {
        elapsed = Math.max(0, Math.min(duration, receivedAt - startedAt));
      }

      if (elapsed !== null) {
        timestamp = receivedAt - elapsed;
      }
    }

    if (duration <= MOVEMENT_EPSILON || (step && step.blocked)) {
      this.hardSync(tileX, tileY, receivedAt);
      if (step && typeof step.sequence === 'number') {
        this.sequence = step.sequence;
      }
      if (step && step.walkId !== undefined) {
        this.walkId = step.walkId;
      }
      this.lastServerStep = step || null;
      return true;
    }

    if (step && typeof step.sequence === 'number') {
      this.sequence = step.sequence;
    }
    if (step && step.walkId !== undefined) {
      this.walkId = step.walkId;
    }
    this.lastServerStep = step || null;

    this.startMove(tileX, tileY, { duration, timestamp });
    return true;
  }

  complete(timestamp = now()) {
    this.previous = clonePoint(this.next);
    this.render = clonePoint(this.next);
    this.eta = 0;
    this.lastUpdate = timestamp;
    this.currentTimestamp = timestamp;
  }
}

export { centerOfTile };
export default MovementController;
