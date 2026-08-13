import { describe, expect, it } from 'vitest';
import PerspectiveCamera from '../../src/core/rendering/perspective-camera.js';

const makeCamera = (overrides = {}) => {
  const camera = new PerspectiveCamera();
  camera.update({
    width: 1150,
    height: 750,
    x: 1200,
    y: 1600,
    ...overrides,
  });
  return camera;
};

describe('PerspectiveCamera', () => {
  it('pins the camera target to the focus row', () => {
    const camera = makeCamera();
    const projected = camera.project(1200, 1600);

    expect(projected.x).toBeCloseTo(575, 10);
    expect(projected.y).toBeCloseTo(camera.focus, 10);
    expect(projected.scale).toBeCloseTo(camera.zoom, 10);
  });

  it('round-trips ground points through projection and picking', () => {
    const camera = makeCamera();
    const world = { x: 1472.5, y: 1328.25 };
    const projected = camera.project(world.x, world.y);
    const unprojected = camera.unproject(projected.x, projected.y);

    expect(unprojected.x).toBeCloseTo(world.x, 8);
    expect(unprojected.y).toBeCloseTo(world.y, 8);
  });

  it('scales nearer points continuously larger than farther points', () => {
    const camera = makeCamera();
    const far = camera.project(1200, 900);
    const focus = camera.project(1200, 1600);
    const near = camera.project(1200, 2050);

    expect(far.scale).toBeLessThan(focus.scale);
    expect(focus.scale).toBeLessThan(near.scale);
    expect(near.scale / far.scale).toBeGreaterThan(2);
  });

  it('uses the shared height sampler for terrain projection', () => {
    const camera = new PerspectiveCamera({ heightAt: () => 24 });
    camera.update({ width: 1150, height: 750, x: 1200, y: 1600 });
    const ground = camera.project(1200, 1600, 0);
    const terrain = camera.projectTerrain(1200, 1600);

    expect(terrain.y).toBeCloseTo(ground.y - (24 * ground.scale), 10);
  });

  it('matches the WebGL vertex-shader projection numerically', () => {
    const camera = makeCamera();
    const samples = [
      { x: 720, y: 620, height: 0 },
      { x: 1200, y: 1600, height: 24 },
      { x: 1680, y: 1920, height: 8 },
    ];

    samples.forEach((sample) => {
      const javascript = camera.project(sample.x, sample.y, sample.height);
      const shader = camera.projectWithShaderMath(sample.x, sample.y, sample.height);
      expect(shader.x).toBeCloseTo(javascript.x, 10);
      expect(shader.y).toBeCloseTo(javascript.y, 10);
    });
  });

  it('rejects zero-sized startup viewports without producing projection state', () => {
    const camera = new PerspectiveCamera();

    expect(camera.update({ width: 0, height: 0, x: 0, y: 0 })).toBe(false);
    expect(camera.project(0, 0)).toBe(null);
    expect(camera.unproject(0, 0)).toBe(null);
  });
});
