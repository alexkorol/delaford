import Socket from '@/core/utilities/socket.js';

const GUEST_ID_KEY = 'verdigris_guest_id';

export const getBrowserGuestId = () => {
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const generated = globalThis.crypto?.randomUUID?.()
    || `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

