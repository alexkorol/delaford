import bus from './utilities/bus.js';

class Engine {
  constructor(game) {
    this.game = game;

    this.maxFps = 20;
    this.fps = {
      current: 0,
      accumulator: 0,
      lastSample: 0,
    };

    this.frame = {
      lastTimestamp: 0,
    };

    this._rafId = null;
    this._running = false;

    // Bind context to same method as
    // we will be calling it out-of-context
    this.loop = this.loop.bind(this);

    bus.$on('SETTINGS:FPS', (s) => this.change('fps', s));
  }

  change(setting, val) {
    switch (setting) {
    case 'fps':
      this.maxFps = val;
      break;

    default:
      break;
    }
  }

  /**
   * The main game loop
   *
   * @param {decimal} timestamp The timestamp of when last called
   */
  loop(timestamp) {
    if (!this._running) return;

    const minFrameMs = 1000 / this.maxFps;
    if (this.frame.lastTimestamp && timestamp < this.frame.lastTimestamp + minFrameMs) {
      this._rafId = requestAnimationFrame(this.loop);
      return;
    }

    const deltaMs = this.frame.lastTimestamp ? timestamp - this.frame.lastTimestamp : minFrameMs;
    this.frame.lastTimestamp = timestamp;

    const deltaSeconds = deltaMs / 1000;

    this.sampleFps(deltaMs);

    // Paint the map
    this.paintCanvas(deltaSeconds);

    // and back to the top...
    this._rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Kicks off the main game loop
   */
  start() {
    this._running = true;
    this._rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Stops the game loop and cancels pending animation frame
   */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Draw the new game map
   */
  paintCanvas(deltaSeconds) {
    if (typeof this.game.map.update === 'function') {
      this.game.map.update(deltaSeconds);
    }

    // Draw the tile map
    this.game.map.drawMap();

    // Draw dropped items
    this.game.map.drawItems();

    // Draw monsters
    if (typeof this.game.map.drawMonsters === 'function') {
      this.game.map.drawMonsters();
    }

    // Draw the NPCs
    this.game.map.drawNPCs();

    // Draw other players
    this.game.map.drawPlayers();

    // Draw the player
    this.game.map.drawPlayer();

    // Draw the mouse selection
    this.game.map.drawMouse();

    const mainCtx = this.game.map.context;
    const { bufferCanvas } = this.game.map;

    if (mainCtx && bufferCanvas) {
      mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
      mainCtx.drawImage(
        bufferCanvas,
        0,
        0,
        bufferCanvas.width,
        bufferCanvas.height,
        0,
        0,
        mainCtx.canvas.width,
        mainCtx.canvas.height,
      );
    }
  }

  sampleFps(deltaMs) {
    this.fps.accumulator += deltaMs;
    if (this.fps.accumulator >= 1000) {
      this.fps.current = 1000 / deltaMs;
      this.fps.accumulator = 0;
      this.fps.lastSample = Date.now();
    }
  }
}

export default Engine;
