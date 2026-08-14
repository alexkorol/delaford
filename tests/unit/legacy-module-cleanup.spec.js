/** @vitest-environment node */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = relativePath => fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
const readSource = relativePath => readFileSync(sourcePath(relativePath), 'utf8');

describe('legacy module cleanup', () => {
  it('keeps each live replacement and excludes retired parallel modules', () => {
    const delaford = readSource('src/Delaford.vue');
    const gameContainer = readSource('src/components/layout/GameContainer.vue');
    const chronicles = readSource('src/components/ui/auth/ChroniclesScreen.vue');

    expect(gameContainer).toContain('<GameHUD');
    expect(gameContainer).toContain('<PaneHost');
    expect(delaford).toContain("import GeometricSkillTreePane from './components/passives/GeometricSkillTreePane.vue'");
    expect(chronicles).toContain('@submit.prevent="createScion"');

    [
      'src/components/Info.vue',
      'src/components/ui/panes/FloatingWindow.vue',
      'src/components/passives/FlowerOfLifePane.vue',
      'src/components/passives/FlowerOfLifeTree.vue',
      'src/components/ui/auth/CharacterCreate.vue',
      'server/player/player-socket.js',
    ].forEach((relativePath) => {
      expect(existsSync(sourcePath(relativePath)), relativePath).toBe(false);
    });
  });
});
