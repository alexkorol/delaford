/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('Verdigris opening presentation', () => {
  it('uses the live Delaford surface art instead of a separate dungeon diorama', () => {
    const backdrop = readSource('src/components/sub/LoginBackdrop.vue');

    expect(backdrop).toContain("from '@server/maps/layers/surface.json'");
    expect(backdrop).toContain("from '@/assets/tiles/terrain.png'");
    expect(backdrop).toContain("from '@/assets/tiles/objects.png'");
    expect(backdrop).not.toContain('dungeonAtlasUrl');
  });

  it('shares the ornate in-game frame and Verdigris palette', () => {
    const container = readSource('src/components/layout/AuthContainer.vue');

    expect(container).toContain("border-image: url('@/assets/inventory/frame_ornate.png')");
    expect(container).toContain('The roads remember');
    expect(container).toContain('A WASD-first multiplayer ARPG');
  });

  it('keeps browser guest entry distinct from the shared developer profile', () => {
    const login = readSource('src/components/ui/Login.vue');

    expect(login).toContain('Play as Guest');
    expect(login).toContain('guestAccount.value = false;');
    expect(login).toContain('uiStore.setGuestAccount(false);');
    expect(login).not.toContain('guestAccount.value = true;');
    expect(login).toContain('Sign in to an existing account');
  });
});
