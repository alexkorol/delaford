import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import ClientUI, { plainContextLabel } from '@/core/utilities/client-ui.js';
import { useUiStore } from '@/stores/ui.js';

describe('client context-action labels', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('converts server menu markup into a plain compact canvas hint', () => {
    const firstItem = {
      id: 280,
      label: "Mine <span style='color:#1ffe8c'>Copper Rocks</span>",
    };

    ClientUI.displayFirstAction({
      data: {
        data: {
          count: 2,
          firstItem,
        },
      },
    });

    expect(useUiStore().action).toEqual({
      object: firstItem,
      label: 'Mine Copper Rocks / 2 other options',
    });
  });

  it('never exposes arbitrary markup in a text-rendered hint', () => {
    expect(plainContextLabel('<img src=x onerror=alert(1)>Examine <b>Rock</b>'))
      .toBe('Examine Rock');
  });
});
