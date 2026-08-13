/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import monsterDefinitions from '#server/core/data/monsters/index.js';
import npcDefinitions from '#server/core/data/npcs.js';
import GameMap, { THEME_MONSTERS } from '#server/core/map.js';
import { createWorldLayout } from '#server/core/world-layout.js';
import {
  ACTOR_FRAME_SIZE,
  INSTANCE_MONSTER_COLUMNS,
  SURFACE_MONSTER_COLUMNS,
} from '#shared/actor-graphics.js';
import {
  actorIdentityFrame,
  MONSTER_SPRITE_CONFIG,
  NPC_SPRITE_CONFIG,
} from '@/core/config/animation.js';

const pngInfo = (path) => {
  const buffer = readFileSync(path);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colourType: buffer[25],
  };
};

describe('generated actor atlas contract', () => {
  const monsterPath = fileURLToPath(
    new URL('../../src/assets/graphics/actors/monsters.png', import.meta.url),
  );
  const npcPath = fileURLToPath(
    new URL('../../src/assets/graphics/actors/npcs.png', import.meta.url),
  );

  it('ships transparent 64px frames for every live monster and townsfolk identity', () => {
    expect(pngInfo(monsterPath)).toEqual({
      width: 43 * ACTOR_FRAME_SIZE,
      height: ACTOR_FRAME_SIZE,
      colourType: 6,
    });
    expect(pngInfo(npcPath)).toEqual({
      width: 4 * ACTOR_FRAME_SIZE,
      height: ACTOR_FRAME_SIZE,
      colourType: 6,
    });
    expect(MONSTER_SPRITE_CONFIG.tileSize).toBe(ACTOR_FRAME_SIZE);
    expect(NPC_SPRITE_CONFIG.tileSize).toBe(ACTOR_FRAME_SIZE);
  });

  it('allocates one unique, contiguous frame to every monster identity', () => {
    const surfaceColumns = Object.values(SURFACE_MONSTER_COLUMNS);
    const instanceColumns = Object.values(INSTANCE_MONSTER_COLUMNS)
      .flatMap(theme => Object.values(theme));

    expect(surfaceColumns).toEqual(Array.from({ length: 15 }, (_, index) => index));
    expect(instanceColumns).toEqual(Array.from({ length: 28 }, (_, index) => index + 15));
    expect(new Set([...surfaceColumns, ...instanceColumns]).size).toBe(43);
  });

  it('gives every surface campaign monster its named frame', () => {
    const layout = createWorldLayout();
    const surfaceMonsters = [
      ...monsterDefinitions,
      ...layout.scenes.flatMap(scene => scene.metadata.monsterDefinitions || []),
    ];

    expect(new Set(surfaceMonsters.map(monster => monster.id))).toEqual(
      new Set(Object.keys(SURFACE_MONSTER_COLUMNS)),
    );
    surfaceMonsters.forEach((monster) => {
      expect(monster.graphic).toEqual({
        column: SURFACE_MONSTER_COLUMNS[monster.id],
        row: 0,
      });
    });
  });

  it('gives all seven generated-floor roles their theme-specific frames', async () => {
    for (const [theme, columns] of Object.entries(INSTANCE_MONSTER_COLUMNS)) {
      const generation = await GameMap.generateInstance({ seed: 73, template: theme });
      const roleByName = new Map(
        Object.entries(THEME_MONSTERS[theme]).map(([role, name]) => [name, role]),
      );

      generation.monsters.forEach((monster) => {
        const role = roleByName.get(monster.name);
        expect(role).toBeTruthy();
        expect(monster.graphic).toEqual({ column: columns[role], row: 0 });
      });
      expect(new Set(generation.monsters.map(monster => monster.graphic.column))).toEqual(
        new Set(Object.values(columns)),
      );
    }
  });

  it('renders static identities from their server column instead of player animation frames', () => {
    expect(npcDefinitions.map(npc => actorIdentityFrame({ column: npc.graphic.column })))
      .toEqual([
        { column: 0, row: 0 },
        { column: 1, row: 0 },
        { column: 2, row: 0 },
        { column: 3, row: 0 },
      ]);
    expect(actorIdentityFrame({ column: 42, row: 3 })).toEqual({ column: 42, row: 0 });
    expect(actorIdentityFrame(null)).toEqual({ column: 0, row: 0 });
  });
});
