/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';
import SoundSystem from '@/core/audio/sound-system.js';
import bus from '@/core/utilities/bus.js';

const makeContext = () => {
  const oscillators = [];
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    createOscillator: () => {
      const oscillator = {
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
    close: vi.fn(() => Promise.resolve()),
  };
  return { context, oscillators };
};

describe('game sound system', () => {
  it('synthesizes distinct layered cues without external audio assets', () => {
    const { context, oscillators } = makeContext();
    const sounds = new SoundSystem({ contextFactory: () => context });
    sounds.play('hit');
    sounds.play('loot');
    sounds.play('death');
    expect(oscillators).toHaveLength(5);
    expect(new Set(oscillators.map(entry => entry.type)).size).toBeGreaterThan(1);
  });

  it('routes game events and unregisters cleanly', () => {
    const { context, oscillators } = makeContext();
    const sounds = new SoundSystem({ contextFactory: () => context });
    sounds.start();
    bus.$emit('sound:combat-hit');
    expect(oscillators).toHaveLength(1);
    sounds.destroy();
    bus.$emit('sound:combat-hit');
    expect(oscillators).toHaveLength(1);
  });

  it('does not queue cues while browser audio is locked', () => {
    const { context, oscillators } = makeContext();
    context.state = 'suspended';
    context.resume = vi.fn(() => Promise.resolve());
    const sounds = new SoundSystem({ contextFactory: () => context });
    sounds.play('death');
    expect(context.resume).toHaveBeenCalledOnce();
    expect(oscillators).toHaveLength(0);
  });
});
