import { describe, expect, it } from 'vitest';

import { resolveGuestProfile } from '#server/player/playtest-guest.js';

const template = {
  uuid: 'canonical-guest',
  username: 'dev',
  skills: { attack: { level: 1, exp: 0 } },
};

describe('playtest guest identities', () => {
  it('keeps the canonical guest when no playtest identity is requested', () => {
    expect(resolveGuestProfile(template, {}, { NODE_ENV: 'development' })).toBe(template);
  });

  it('never enables alternate guests in production', () => {
    expect(resolveGuestProfile(template, {
      playtestGuestId: 'party-leader',
      playtestGuestName: 'Aster',
    }, {
      NODE_ENV: 'production',
    })).toBe(template);
  });

  it('builds isolated identities without mutating the canonical template', () => {
    const profile = resolveGuestProfile(template, {
      playtestGuestId: 'party-leader',
      playtestGuestName: 'Aster',
    }, {
      NODE_ENV: 'development',
    });

    expect(profile).toEqual(expect.objectContaining({
      uuid: 'playtest-guest-party-leader',
      username: 'Aster',
    }));
    expect(profile.skills).not.toBe(template.skills);
    expect(template).toEqual(expect.objectContaining({
      uuid: 'canonical-guest',
      username: 'dev',
    }));
  });

  it('rejects malformed identity fields and derives a bounded fallback name', () => {
    const invalid = resolveGuestProfile(template, {
      playtestGuestId: '../escape',
    }, {
      NODE_ENV: 'development',
    });
    expect(invalid).toBe(template);

    const fallback = resolveGuestProfile(template, {
      playtestGuestId: 'member-2',
      playtestGuestName: '<script>',
    }, {
      NODE_ENV: 'development',
    });
    expect(fallback.username).toBe('Playtest-member-2');
  });
});
