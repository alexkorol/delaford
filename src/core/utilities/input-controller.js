import {
  MOVEMENT_BINDINGS,
  DIAGONAL_BINDINGS,
  SKILL_BINDINGS,
  MOVEMENT_REPEAT,
} from '../config/controls.js';

const NORMALISED_SPECIAL_KEYS = {
  space: ' ',
  spacebar: ' ',
};

const MOVEMENT_KEYS = new Set(
  Object.values(MOVEMENT_BINDINGS)
    .reduce((acc, keys) => acc.concat(keys), [])
    .map((key) => key.toLowerCase()),
);

const SKILL_KEY_LOOKUP = SKILL_BINDINGS.reduce((acc, binding) => {
  binding.keys.forEach((key) => {
    acc.set(key.toLowerCase(), binding);
  });
  return acc;
}, new Map());

class InputController {
  constructor(options = {}) {
    this.onMove = options.onMove || null;
    this.onStop = options.onStop || null;
    this.onSkill = options.onSkill || null;

    this.pressedKeys = new Set();
    this.activeDirection = null;
    this.repeatTimeout = null;
    this.repeatInterval = null;
  }

  destroy() {
    this.clearRepeat();
    this.pressedKeys.clear();
  }

  normaliseKey(rawKey) {
    if (!rawKey) {
      return '';
    }
    const lower = rawKey.toLowerCase();
    if (NORMALISED_SPECIAL_KEYS[lower] !== undefined) {
      return NORMALISED_SPECIAL_KEYS[lower];
    }
    return lower;
  }

  handleKeyDown(event) {
    const key = this.normaliseKey(event.key);
    if (!key) {
      return false;
    }

    if (this.isMovementKey(key)) {
      if (!this.pressedKeys.has(key)) {
        this.pressedKeys.add(key);
        this.updateMovement(true);
      }
      return true;
    }

    const binding = this.getSkillBinding(key);
    if (binding) {
      if (event && event.repeat) {
        return true;
      }
      this.triggerSkill(binding, 'start', event);
      return true;
    }

    return false;
  }

  handleKeyUp(event) {
    const key = this.normaliseKey(event.key);
    if (!key) {
      return false;
    }

    let handled = false;
    if (this.pressedKeys.has(key)) {
      this.pressedKeys.delete(key);
      this.updateMovement(false);
      handled = true;
    }

    const binding = this.getSkillBinding(key);
    if (binding && binding.type === 'hold') {
      this.triggerSkill(binding, 'end', event);
      handled = true;
    }

    if (binding && binding.type !== 'hold') {
      handled = true;
    }

    return handled;
  }

  isMovementKey(key) {
    return MOVEMENT_KEYS.has(key);
  }

  getSkillBinding(key) {
    return SKILL_KEY_LOOKUP.get(key) || null;
  }

  updateMovement(initialTrigger = false) {
    const direction = this.computeDirection();

    if (!direction) {
      if (this.activeDirection && typeof this.onStop === 'function') {
        this.onStop(this.activeDirection);
      }
      this.activeDirection = null;
      this.clearRepeat();
      return;
    }

    if (direction !== this.activeDirection || initialTrigger) {
      this.activeDirection = direction;
      if (typeof this.onMove === 'function') {
        this.onMove(direction, { initial: true });
      }
      this.restartRepeat();
      return;
    }

    this.ensureRepeat();
  }

  computeDirection() {
    const has = (keys) => keys.some((key) => this.pressedKeys.has(key));

    const up = has(MOVEMENT_BINDINGS.up);
    const down = has(MOVEMENT_BINDINGS.down);
    const left = has(MOVEMENT_BINDINGS.left);
    const right = has(MOVEMENT_BINDINGS.right);

    if ((up && down) || (left && right)) {
      return null;
    }

    for (let i = 0; i < DIAGONAL_BINDINGS.length; i += 1) {
      const [vertical, horizontal, diagonal] = DIAGONAL_BINDINGS[i];
      if (vertical === 'up' && horizontal === 'right' && up && right) {
        return diagonal;
      }
      if (vertical === 'down' && horizontal === 'right' && down && right) {
        return diagonal;
      }
      if (vertical === 'up' && horizontal === 'left' && up && left) {
        return diagonal;
      }
      if (vertical === 'down' && horizontal === 'left' && down && left) {
        return diagonal;
      }
    }

    if (up) return 'up';
    if (down) return 'down';
    if (left) return 'left';
    if (right) return 'right';

    return null;
  }

  getRepeatDelay() {
    return MOVEMENT_REPEAT.repeatDelayMs;
  }

  restartRepeat() {
    this.clearRepeat();
    if (!this.activeDirection) {
      return;
    }

    this.repeatTimeout = setTimeout(() => {
      if (!this.activeDirection) {
        return;
      }
      if (typeof this.onMove === 'function') {
        this.onMove(this.activeDirection, { repeated: true });
      }
      this.repeatInterval = setInterval(() => {
        if (!this.activeDirection) {
          this.clearRepeat();
          return;
        }
        if (typeof this.onMove === 'function') {
          this.onMove(this.activeDirection, { repeated: true });
        }
      }, this.getRepeatDelay());
    }, MOVEMENT_REPEAT.initialDelayMs);
  }

  ensureRepeat() {
    if (this.repeatTimeout !== null || this.repeatInterval !== null) {
      return;
    }
    this.restartRepeat();
  }

  clearRepeat() {
    if (this.repeatTimeout !== null) {
      clearTimeout(this.repeatTimeout);
      this.repeatTimeout = null;
    }
    if (this.repeatInterval !== null) {
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
    }
  }

  triggerSkill(binding, phase, event) {
    if (!binding) {
      return;
    }

    if (binding.type !== 'hold' && phase !== 'start') {
      return;
    }

    if (typeof this.onSkill === 'function') {
      this.onSkill({
        skillId: binding.id,
        phase,
        event,
      });
    }
  }
}

export default InputController;
