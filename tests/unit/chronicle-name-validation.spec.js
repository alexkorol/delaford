/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChroniclesRepository } from '#server/core/repositories/chronicles-repository.js';

describe('chronicle name markup rejection (cand-001/cand-002 source control)', () => {
  let repository;

  beforeEach(() => {
    repository = new ChroniclesRepository({ dbFile: ':memory:' });
  });

  afterEach(() => repository.close());

  it('rejects HTML-bearing House names', () => {
    const result = repository.foundHouse('account:xss', '<svg onload=alert()>');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/letters, numbers/);
  });

  it('rejects HTML-bearing scion names', () => {
    const founded = repository.foundHouse('account:xss2', 'Ashfell');
    expect(founded.ok).toBe(true);
    const created = repository.createScion('account:xss2', founded.houseId, '<img src=x>');
    expect(created.ok).toBe(false);
  });

  it('still accepts ordinary fantasy names (spaces, apostrophes, hyphens)', () => {
    const founded = repository.foundHouse('account:ok', 'House Ember-Veil');
    expect(founded.ok).toBe(true);
    expect(repository.getChronicle('account:ok').houses[0].name).toBe('Ember-Veil');

    const created = repository.createScion('account:ok', founded.houseId, "Bryn O'Fael");
    expect(created.ok).toBe(true);
    expect(repository.getChronicle('account:ok').houses[0].scions[0].name).toBe("Bryn O'Fael");
  });
});
