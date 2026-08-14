import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '@/stores/ui.js';

describe('share-safe login persistence', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('remembers only an opted-in username and never a password', () => {
    const store = useUiStore();

    store.setRememberMe(true);
    store.rememberAccountUsername({ username: 'Mara', password: 'secret-passphrase' });
    expect(store.account).toEqual({ username: 'Mara', password: '' });

    store.setRememberMe(false);
    expect(store.account).toEqual({ username: '', password: '' });
  });

  it('keeps explicit performance and sound preferences', () => {
    const store = useUiStore();

    store.setSettings({ fps: 40, soundEffects: false });

    expect(store.settings).toEqual({ fps: 40, soundEffects: false });
  });
});
