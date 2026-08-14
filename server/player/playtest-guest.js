const PLAYTEST_GUEST_ID = /^[a-z0-9][a-z0-9-]{0,31}$/i;
const PLAYTEST_GUEST_NAME = /^[a-z][a-z0-9_-]{1,23}$/i;
const BROWSER_GUEST_ID = /^[a-z0-9][a-z0-9-]{7,63}$/i;

const clone = value => JSON.parse(JSON.stringify(value));

/**
 * Give hermetic playtests distinct guest identities so multiplayer flows can
 * use the real login and WebSocket pipeline. This is deliberately unavailable
 * in production; an ordinary browser login never sends the playtest identity
 * field and therefore still receives the canonical dev guest.
 */
export const resolveGuestProfile = (template, payload = {}, env = process.env) => {
  if (!template) {
    return template;
  }

  // Interactive browser guests carry a cryptographically generated id in
  // localStorage. Give each one a durable legacy-profile namespace instead
  // of dropping every browser into the shared `dev` character. This path is
  // production-safe; only the separate playtest override remains dev-only.
  const browserId = typeof payload.guestId === 'string'
    ? payload.guestId.trim()
    : '';
  if (BROWSER_GUEST_ID.test(browserId)) {
    const normalisedId = browserId.toLowerCase();
    const suffix = normalisedId.replace(/-/g, '').slice(-6) || 'guest';
    return {
      ...clone(template),
      uuid: `browser-guest-${normalisedId}`,
      username: `Guest-${suffix}`,
    };
  }

  if (env.NODE_ENV !== 'development') {
    return template;
  }

  const id = typeof payload.playtestGuestId === 'string'
    ? payload.playtestGuestId.trim()
    : '';
  if (!PLAYTEST_GUEST_ID.test(id)) {
    return template;
  }

  const requestedName = typeof payload.playtestGuestName === 'string'
    ? payload.playtestGuestName.trim()
    : '';
  const username = PLAYTEST_GUEST_NAME.test(requestedName)
    ? requestedName
    : `Playtest-${id}`.slice(0, 24);

  return {
    ...clone(template),
    uuid: `playtest-guest-${id.toLowerCase()}`,
    username,
  };
};

export default resolveGuestProfile;
