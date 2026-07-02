import { describe, expect, it, vi } from 'vitest';

import {
  isGameCanvasEventTarget,
  shouldRootHandleQuickbarHotkey,
} from '@/core/hotkeys.js';

const targetWithClasses = (...classes) => ({
  classList: {
    contains: (className) => classes.includes(className),
  },
});

describe('root hotkey routing', () => {
  it('detects the active game canvas as a canvas-owned event target', () => {
    expect(isGameCanvasEventTarget({ id: 'game-map' })).toBe(true);
    expect(isGameCanvasEventTarget(targetWithClasses('main-canvas'))).toBe(true);
    expect(isGameCanvasEventTarget(targetWithClasses('gameMap'))).toBe(true);
  });

  it('detects descendants of the game canvas wrapper via closest when available', () => {
    const target = {
      closest: vi.fn(selector => (selector === '#game-map, .main-canvas.gameMap' ? {} : null)),
    };

    expect(isGameCanvasEventTarget(target)).toBe(true);
    expect(target.closest).toHaveBeenCalledWith('#game-map, .main-canvas.gameMap');
  });

  it('keeps number-key combat input on the canvas instead of double-dispatching globally', () => {
    const event = { key: '1', target: { id: 'game-map' } };

    expect(shouldRootHandleQuickbarHotkey(event)).toBe(false);
  });

  it('allows root quickbar hotkeys outside the canvas', () => {
    const event = { key: '1', target: targetWithClasses('quickbar__slot') };

    expect(shouldRootHandleQuickbarHotkey(event)).toBe(true);
  });

  it('does not handle text-entry targets through the root quickbar path', () => {
    const event = { key: '1', target: { tagName: 'INPUT' } };
    const shouldIgnoreHotkeys = vi.fn(() => true);

    expect(shouldRootHandleQuickbarHotkey(event, shouldIgnoreHotkeys)).toBe(false);
    expect(shouldIgnoreHotkeys).toHaveBeenCalledWith(event);
  });
});
