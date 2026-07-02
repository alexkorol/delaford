/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('character screen DCSS placeholders', () => {
  it('renders the character portrait and equipment rows from DCSS atlas tiles', () => {
    const source = readSource('src/components/slots/Stats.vue');

    expect(source).toContain('dcssTileStyle(characterSheet.identity.tile)');
    expect(source).toContain('dcssTileStyle(slot.tile)');
    expect(source).toContain("@/assets/tiles/dungeon.png");
    expect(source).toContain("@/assets/tiles/objects.png");
    expect(source).not.toContain('<span>@</span>');
  });
});
