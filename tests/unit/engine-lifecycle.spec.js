/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock requestAnimationFrame/cancelAnimationFrame for Node environment
let rafId = 0;
const rafCallbacks = new Map();
const mockRequestAnimationFrame = vi.fn((cb) => {
  rafId += 1;
  rafCallbacks.set(rafId, cb);
  return rafId;
});
const mockCancelAnimationFrame = vi.fn((id) => {
  rafCallbacks.delete(id);
});

globalThis.requestAnimationFrame = mockRequestAnimationFrame;
globalThis.cancelAnimationFrame = mockCancelAnimationFrame;

// Mock bus before importing Engine
vi.mock('@/core/utilities/bus.js', () => ({
  default: {
    $on: vi.fn(),
    $off: vi.fn(),
    $emit: vi.fn(),
  },
}));

const { default: Engine } = await import('@/core/engine.js');

describe('Engine lifecycle', () => {
  let engine;
  let mockGame;

  beforeEach(() => {
    rafId = 0;
    rafCallbacks.clear();
    mockRequestAnimationFrame.mockClear();
    mockCancelAnimationFrame.mockClear();

    mockGame = {
      map: {
        update: vi.fn(),
        drawMap: vi.fn(),
        drawItems: vi.fn(),
        drawMonsters: vi.fn(),
        drawNPCs: vi.fn(),
        drawPlayers: vi.fn(),
        drawPlayer: vi.fn(),
        drawMouse: vi.fn(),
        context: null,
        bufferCanvas: null,
      },
    };

    engine = new Engine(mockGame);
  });

  afterEach(() => {
    if (engine && engine._running) {
      engine.stop();
    }
  });

  it('initialises with correct default state', () => {
    expect(engine._running).toBe(false);
    expect(engine._rafId).toBeNull();
    expect(engine.maxFps).toBe(20);
  });

  it('start() sets running flag and requests first frame', () => {
    engine.start();
    expect(engine._running).toBe(true);
    expect(engine._rafId).toBeGreaterThan(0);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('stop() clears running flag and cancels animation frame', () => {
    engine.start();
    const id = engine._rafId;
    engine.stop();

    expect(engine._running).toBe(false);
    expect(engine._rafId).toBeNull();
    expect(mockCancelAnimationFrame).toHaveBeenCalledWith(id);
  });

  it('loop() exits immediately when not running', () => {
    engine._running = false;
    engine.loop(1000);
    // Should not request another frame
    expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
  });

  it('loop() requests next frame when running', () => {
    engine._running = true;
    engine.loop(1000);
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('stop() can be called multiple times safely', () => {
    engine.start();
    engine.stop();
    engine.stop();
    expect(engine._running).toBe(false);
    expect(engine._rafId).toBeNull();
  });

  it('paintCanvas calls all draw methods', () => {
    engine.paintCanvas(0.016);
    expect(mockGame.map.update).toHaveBeenCalledWith(0.016);
    expect(mockGame.map.drawMap).toHaveBeenCalled();
    expect(mockGame.map.drawItems).toHaveBeenCalled();
    expect(mockGame.map.drawNPCs).toHaveBeenCalled();
    expect(mockGame.map.drawPlayers).toHaveBeenCalled();
    expect(mockGame.map.drawPlayer).toHaveBeenCalled();
    expect(mockGame.map.drawMouse).toHaveBeenCalled();
  });
});
