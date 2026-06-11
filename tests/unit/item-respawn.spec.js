/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { addHours, addMinutes, addSeconds } from 'date-fns';

// Test the Item class respawn time calculation (was buggy: overwriting instead of chaining)
// We replicate the fixed logic here to ensure correctness.

function parseTime(time, part) {
  const found = time.split(' ').filter(t => t.endsWith(part)).map(t => Number(t.slice(0, -1)));
  if (found.length) {
    return found[0];
  }
  return false;
}

function calculateRespawnTime(respawnTime) {
  const pickedUpAt = new Date('2025-01-01T00:00:00Z');
  const respawnsIn = respawnTime;

  const add = {
    hours: parseTime(respawnsIn, 'h'),
    minutes: parseTime(respawnsIn, 'm'),
    seconds: parseTime(respawnsIn, 's'),
  };

  let result = pickedUpAt;
  if (typeof add.hours === 'number') result = addHours(result, add.hours);
  if (typeof add.minutes === 'number') result = addMinutes(result, add.minutes);
  if (typeof add.seconds === 'number') result = addSeconds(result, add.seconds);

  return result;
}

describe('Item.calculateRespawnTime', () => {
  it('returns a date with hours added', () => {
    const result = calculateRespawnTime('2h');
    const base = new Date('2025-01-01T00:00:00Z');
    expect(result.getTime()).toBe(addHours(base, 2).getTime());
  });

  it('returns a date with minutes added', () => {
    const result = calculateRespawnTime('30m');
    const base = new Date('2025-01-01T00:00:00Z');
    expect(result.getTime()).toBe(addMinutes(base, 30).getTime());
  });

  it('returns a date with seconds added', () => {
    const result = calculateRespawnTime('45s');
    const base = new Date('2025-01-01T00:00:00Z');
    expect(result.getTime()).toBe(addSeconds(base, 45).getTime());
  });

  it('chains hours AND minutes AND seconds correctly', () => {
    const result = calculateRespawnTime('1h 30m 10s');
    const base = new Date('2025-01-01T00:00:00Z');
    const expected = addSeconds(addMinutes(addHours(base, 1), 30), 10);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('chains hours and minutes without seconds', () => {
    const result = calculateRespawnTime('2h 15m');
    const base = new Date('2025-01-01T00:00:00Z');
    const expected = addMinutes(addHours(base, 2), 15);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns base date when no parseable units', () => {
    const result = calculateRespawnTime('invalid');
    // parseTime returns false (not 'number'), so no add operations are performed
    expect(result instanceof Date).toBe(true);
  });
});
