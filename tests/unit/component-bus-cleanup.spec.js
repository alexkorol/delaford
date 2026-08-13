import { afterEach, describe, expect, it, vi } from 'vitest';

import GameCanvas from '@/components/GameCanvas.vue';
import ContextMenu from '@/components/sub/ContextMenu.vue';
import ItemGrid from '@/components/util/ItemGrid.vue';
import AnvilGrid from '@/components/util/AnvilGrid.vue';
import ClientUI from '@/core/utilities/client-ui.js';
import bus from '@/core/utilities/bus.js';

const handler = () => {};

describe('component event-bus cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('removes every GameCanvas listener with the same handler used to register it', () => {
    vi.stubGlobal('window', {
      removeEventListener: vi.fn(),
    });
    const on = vi.spyOn(bus, '$on').mockImplementation(() => {});
    const off = vi.spyOn(bus, '$off').mockImplementation(() => {});
    const vm = {
      handleCanvasGetMouse: handler,
      openScreen: handler,
      closePane: handler,
      handleCanvasResetContextMenu: handler,
      onRendererModeChanged: handler,
      handleGlobalKeyDown: handler,
      handleGlobalKeyUp: handler,
      inputController: null,
    };

    GameCanvas.created.call(vm);
    GameCanvas.beforeUnmount.call(vm);

    const pairs = [
      ['canvas:getMouse', vm.handleCanvasGetMouse],
      ['open:screen', vm.openScreen],
      ['screen:close', vm.closePane],
      ['game:context-menu:first-only', ClientUI.displayFirstAction],
      ['canvas:reset-context-menu', vm.handleCanvasResetContextMenu],
      ['game:renderer:mode', vm.onRendererModeChanged],
    ];
    pairs.forEach(([event, callback]) => {
      expect(on).toHaveBeenCalledWith(event, callback);
      expect(off).toHaveBeenCalledWith(event, callback);
    });
  });

  it('removes all ContextMenu listeners on reconnect teardown', () => {
    const on = vi.spyOn(bus, '$on').mockImplementation(() => {});
    const off = vi.spyOn(bus, '$off').mockImplementation(() => {});
    const vm = {
      buildMenu: handler,
      createMenu: handler,
      closeMenu: handler,
      handleCanvasSelectAction: handler,
    };

    ContextMenu.created.call(vm);
    ContextMenu.beforeUnmount.call(vm);

    [
      ['PLAYER:MENU', vm.buildMenu],
      ['game:context-menu:items', vm.createMenu],
      ['contextmenu:close', vm.closeMenu],
      ['canvas:select-action', vm.handleCanvasSelectAction],
    ].forEach(([event, callback]) => {
      expect(on).toHaveBeenCalledWith(event, callback);
      expect(off).toHaveBeenCalledWith(event, callback);
    });
  });

  it.each([
    ['ItemGrid', ItemGrid],
    ['AnvilGrid', AnvilGrid],
  ])('removes the shared hover listener from %s', (_name, component) => {
    const on = vi.spyOn(bus, '$on').mockImplementation(() => {});
    const off = vi.spyOn(bus, '$off').mockImplementation(() => {});
    const vm = { $forceUpdate: vi.fn() };

    component.created.call(vm);
    component.beforeUnmount.call(vm);

    expect(on).toHaveBeenCalledWith(
      'game:context-menu:first-only',
      ClientUI.displayFirstAction,
    );
    expect(off).toHaveBeenCalledWith(
      'game:context-menu:first-only',
      ClientUI.displayFirstAction,
    );
  });
});
