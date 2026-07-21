import Socket from '@/core/utilities/socket.js';

const GUEST_ID_KEY = 'verdigris_guest_id';

export const getBrowserGuestId = () => {
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  // The guest id is the ONLY bearer for a guest chronicle, so it must come
  // from cryptographically secure randomness. Never fall back to
  // Date.now/Math.random (predictable); fail closed on non-secure contexts.
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== 'function') {
    throw new Error('Guest play requires a secure browser context (HTTPS or localhost) with Web Crypto available.');
  }
  const generated = randomUUID.call(globalThis.crypto);
  window.localStorage.setItem(GUEST_ID_KEY, generated);
  return generated;
};

export const startBrowserGuestSession = ({ quickStart = false } = {}) => Socket.emit('player:login', {
  username: '',
  password: '',
  useGuestAccount: true,
  guestId: getBrowserGuestId(),
  ...(quickStart ? { quickGuest: true } : {}),
});
