import { describe, expect, it } from 'vitest';
import { nextPowerOfTwo } from '../../src/core/rendering/terrain-renderer.js';

describe('terrain texture sizing', () => {
  it('rounds map bakes up to a legal power-of-two texture size', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2048)).toBe(2048);
    expect(nextPowerOfTwo(3456)).toBe(4096);
  });
});
