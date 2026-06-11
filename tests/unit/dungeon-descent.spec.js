/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { DUNGEON_FIRST_GID, dungeonGid } from '#shared/dungeon-tiles.js';
import GameMap from '#server/core/map.js';

describe('dungeon floor descent generation', () => {
  it('derives deterministic but distinct layouts per depth', async () => {
    const floor1a = await GameMap.generateInstance({ seed: 4242, template: 'dungeon', depth: 1 });
    const floor1b = await GameMap.generateInstance({ seed: 4242, template: 'dungeon', depth: 1 });
    const floor2a = await GameMap.generateInstance({ seed: 4242, template: 'dungeon', depth: 2 });
    const floor2b = await GameMap.generateInstance({ seed: 4242, template: 'dungeon', depth: 2 });

    // Same (seed, depth) regenerates the identical floor — revisiting works
    expect(floor1a.map.background).toEqual(floor1b.map.background);
    expect(floor2a.map.background).toEqual(floor2b.map.background);

    // Different depths produce different floors
    expect(floor2a.map.background).not.toEqual(floor1a.map.background);

    expect(floor1a.metadata.depth).toBe(1);
    expect(floor2a.metadata.depth).toBe(2);
    expect(floor1a.metadata.baseSeed).toBe(4242);
    expect(floor2a.metadata.baseSeed).toBe(4242);
    expect(floor2a.metadata.seed).not.toBe(floor1a.metadata.seed);
  });

  it('rotates themes as the party descends', async () => {
    const themes = [];
    for (let depth = 1; depth <= 6; depth += 1) {
      const { metadata } = await GameMap.generateInstance({ seed: 7, template: 'dungeon', depth });
      themes.push(metadata.theme);
    }

    // Floor 1 uses the template theme, deeper floors rotate through the rest
    expect(themes[0]).toBe('stone');
    expect(new Set(themes.slice(0, 5)).size).toBe(5);
    // The rotation wraps around after exhausting all themes
    expect(themes[5]).toBe(themes[0]);
  });

  it('scales monster levels and rewards with depth', async () => {
    const floor1 = await GameMap.generateInstance({ seed: 99, template: 'dungeon', depth: 1 });
    const floor3 = await GameMap.generateInstance({ seed: 99, template: 'dungeon', depth: 3 });

    expect(floor1.monsters.length).toBeGreaterThan(0);
    expect(floor3.monsters.length).toBeGreaterThan(0);

    const firstShallow = floor1.monsters[0];
    const firstDeep = floor3.monsters[0];

    expect(firstDeep.level).toBe(firstShallow.level + 4);
    expect(firstDeep.rewards.experience).toBeGreaterThan(firstShallow.rewards.experience);
    expect(floor3.metadata.rewards.coinsPerPlayer)
      .toBeGreaterThan(floor1.metadata.rewards.coinsPerPlayer);
  });

  it('records stairs and keeps spawn points off them', async () => {
    const { map, metadata } = await GameMap.generateInstance({ seed: 31337, template: 'crypt', depth: 2 });
    const width = 200;

    expect(metadata.stairsUp).toBeTruthy();
    expect(metadata.stairsDown).toBeTruthy();
    expect(map.foreground[(metadata.stairsUp.y * width) + metadata.stairsUp.x])
      .toBe(dungeonGid('stairs_up'));
    expect(map.foreground[(metadata.stairsDown.y * width) + metadata.stairsDown.x])
      .toBe(dungeonGid('stairs_down'));

    metadata.spawnPoints.forEach((spawn) => {
      expect(spawn.x === metadata.stairsUp.x && spawn.y === metadata.stairsUp.y).toBe(false);
    });

    // floors stay fully within the dungeon tileset at any depth
    expect(map.background.every((gid) => gid >= DUNGEON_FIRST_GID)).toBe(true);
  });
});
