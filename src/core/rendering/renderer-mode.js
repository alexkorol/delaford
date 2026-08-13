const PERSPECTIVE_MODE = 'perspective';
const LEGACY_MODE = 'legacy';
const STORAGE_KEY = 'verdigris:renderer';

const normalizeRendererMode = mode => (
  String(mode || '').toLowerCase() === LEGACY_MODE ? LEGACY_MODE : PERSPECTIVE_MODE
);

const getInitialRendererMode = () => {
  if (typeof window === 'undefined') {
    return PERSPECTIVE_MODE;
  }

  try {
    const queryMode = new URLSearchParams(window.location.search).get('renderer');
    if (queryMode) {
      return normalizeRendererMode(queryMode);
    }

    return normalizeRendererMode(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn('[renderer] Could not read renderer preference.', error);
    return PERSPECTIVE_MODE;
  }
};

const saveRendererMode = (mode) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeRendererMode(mode));
  } catch (error) {
    console.warn('[renderer] Could not save renderer preference.', error);
  }
};

export {
  LEGACY_MODE,
  PERSPECTIVE_MODE,
  STORAGE_KEY,
  getInitialRendererMode,
  normalizeRendererMode,
  saveRendererMode,
};
