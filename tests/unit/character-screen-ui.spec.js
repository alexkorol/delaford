/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('character screen art', () => {
  it('renders the generated player portrait and real item atlases', () => {
    const source = readSource('src/components/slots/Stats.vue');

    expect(source).toContain('dcssTileStyle(characterSheet.identity.tile)');
    expect(source).toContain('dcssTileStyle(slot.tile)');
    expect(source).toContain("@/assets/graphics/actors/players/human-v2.png");
    expect(source).toContain("@/assets/graphics/items/vessels.png");
    expect(source).toContain("@/assets/tiles/objects.png");
    expect(source).toContain('aria-label="Vesselforge effects"');
    expect(source).toContain('characterSheet.vesselEffects');
    expect(source).not.toContain("@/assets/tiles/dungeon.png");
    expect(source).not.toContain('<span>@</span>');
  });
});
