import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resetPartyClientState } from '@/core/party-state.js';

describe('Chronicles client transition', () => {
  it('clears the fallen Scion party snapshot before successor admission', () => {
    const timeout = setTimeout(() => {}, 1000);
    const context = {
      party: { id: 'old-party', members: [{ username: 'Morrow' }] },
      partyInvites: [{ partyId: 'invite-1' }],
      partyLoading: { active: true, state: 'transitioning' },
      partyStatusMessage: 'Entering instance…',
      partyStatusTimeout: timeout,
    };
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    resetPartyClientState(context);

    expect(context.party).toBeNull();
    expect(context.partyInvites).toEqual([]);
    expect(context.partyLoading).toEqual({ active: false, state: null });
    expect(context.partyStatusMessage).toBe('');
    expect(context.partyStatusTimeout).toBeNull();
    expect(clearSpy).toHaveBeenCalledWith(timeout);
    clearSpy.mockRestore();
  });
});
