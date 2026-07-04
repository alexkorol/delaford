/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  CHARACTER_ARCHETYPES,
  DEFAULT_ARCHETYPE_ID,
  getArchetype,
  isValidArchetypeId,
  resolveArchetype,
} from '#server/shared/archetypes.js';
import verdigrisPack from '#server/core/items/vesselforge/verdigris-pack.js';
import Player from '#server/core/player.js';
import playerGuest from '#server/core/data/helpers/player.json' with { type: 'json' };

describe('Chronicles class archetypes', () => {
  it('offers the three plain classes, each leaning on one attribute', () => {
    expect(CHARACTER_ARCHETYPES.map(archetype => archetype.name)).toEqual(['Warrior', 'Rogue', 'Mage']);

    CHARACTER_ARCHETYPES.forEach((archetype) => {
      const { attributes, primary } = archetype;
      const total = attributes.strength + attributes.dexterity + attributes.intelligence;
      expect(total).toBe(30);
      expect(Math.max(...Object.values(attributes))).toBe(attributes[primary]);
    });
  });

  it('maps every class onto a Vesselforge kinship archetype', () => {
    CHARACTER_ARCHETYPES.forEach((archetype) => {
      expect(verdigrisPack.archetypes[archetype.kinship]).toBeTruthy();
    });
  });

  it('validates and resolves archetype ids defensively', () => {
    expect(isValidArchetypeId('rogue')).toBe(true);
    expect(isValidArchetypeId('paladin')).toBe(false);
    expect(getArchetype('paladin')).toBeNull();
    expect(resolveArchetype('paladin').id).toBe(DEFAULT_ARCHETYPE_ID);
  });

  it('seeds a fresh character with the chosen class attribute spread', () => {
    const player = new Player({ ...playerGuest, archetype: 'mage' }, 'none', 'socket-test-1');

    expect(player.archetype).toBe('mage');
    expect(player.stats.attributes.sources.base).toEqual({
      strength: 7,
      dexterity: 10,
      intelligence: 13,
    });
  });

  it('keeps legacy behaviour when no class is chosen', () => {
    const player = new Player({ ...playerGuest }, 'none', 'socket-test-2');

    expect(player.archetype).toBeNull();
    expect(player.stats.attributes.sources.base).toEqual({
      strength: 10,
      dexterity: 10,
      intelligence: 10,
    });
  });

  it('does not override stored attributes for returning characters', () => {
    const stored = {
      ...playerGuest,
      archetype: 'warrior',
      baseAttributes: { strength: 22, dexterity: 11, intelligence: 9 },
    };
    const player = new Player(stored, 'none', 'socket-test-3');

    expect(player.archetype).toBe('warrior');
    expect(player.stats.attributes.sources.base).toEqual({
      strength: 22,
      dexterity: 11,
      intelligence: 9,
    });
  });
});
