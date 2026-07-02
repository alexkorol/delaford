export const isGameCanvasEventTarget = (target) => {
  if (!target || typeof target !== 'object') {
    return false;
  }

  if (target.id === 'game-map') {
    return true;
  }

  if (target.classList && typeof target.classList.contains === 'function') {
    if (target.classList.contains('main-canvas') || target.classList.contains('gameMap')) {
      return true;
    }
  }

  if (typeof target.closest === 'function') {
    return Boolean(target.closest('#game-map, .main-canvas.gameMap'));
  }

  return false;
};

export const shouldRootHandleQuickbarHotkey = (event, shouldIgnoreHotkeys = () => false) => {
  if (!event || !/^[1-8]$/.test(String(event.key || ''))) {
    return false;
  }

  if (shouldIgnoreHotkeys(event)) {
    return false;
  }

  return !isGameCanvasEventTarget(event.target);
};
