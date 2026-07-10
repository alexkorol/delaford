import bus from '../utilities/bus.js';

const EVENTS = {
  'sound:combat-hit': 'hit',
  'sound:monster-kill': 'kill',
  'sound:loot': 'loot',
  'sound:zone': 'zone',
  'sound:final-death': 'death',
};

export default class SoundSystem {
  constructor({ contextFactory } = {}) {
    this.contextFactory = contextFactory || (() => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context() : null;
    });
    this.context = null;
    this.resumePromise = null;
    this.enabled = true;
    this.handlers = [];
  }

  start() {
    Object.entries(EVENTS).forEach(([event, cue]) => {
      const handler = () => this.play(cue);
      bus.$on(event, handler);
      this.handlers.push([event, handler]);
    });
  }

  unlock() {
    if (!this.context) this.context = this.contextFactory();
    if (this.context?.state === 'suspended' && !this.resumePromise) {
      this.resumePromise = this.context.resume()
        .catch(() => {})
        .finally(() => { this.resumePromise = null; });
    }
    return this.context;
  }

  tone({ frequency, endFrequency = frequency, duration = 0.1, type = 'sine', volume = 0.08, delay = 0 }) {
    const context = this.unlock();
    // Browsers keep a new context suspended until the first gesture. Do not
    // queue a backlog of battle sounds that would all fire when it resumes.
    if (!this.enabled || !context || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play(cue) {
    if (!this.enabled) return;
    if (cue === 'hit') this.tone({ frequency: 105, endFrequency: 62, duration: 0.08, type: 'square', volume: 0.055 });
    if (cue === 'kill') this.tone({ frequency: 190, endFrequency: 70, duration: 0.22, type: 'sawtooth', volume: 0.07 });
    if (cue === 'loot') {
      this.tone({ frequency: 520, endFrequency: 620, duration: 0.12, volume: 0.05 });
      this.tone({ frequency: 780, endFrequency: 920, duration: 0.16, volume: 0.045, delay: 0.08 });
    }
    if (cue === 'zone') this.tone({ frequency: 90, endFrequency: 145, duration: 0.45, type: 'sine', volume: 0.045 });
    if (cue === 'death') {
      this.tone({ frequency: 220, endFrequency: 42, duration: 1.25, type: 'sawtooth', volume: 0.085 });
      this.tone({ frequency: 110, endFrequency: 32, duration: 1.55, type: 'sine', volume: 0.065, delay: 0.12 });
    }
  }

  destroy() {
    this.handlers.forEach(([event, handler]) => bus.$off(event, handler));
    this.handlers = [];
    if (this.context?.close) this.context.close().catch(() => {});
    this.context = null;
    this.resumePromise = null;
  }
}
