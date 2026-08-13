/**
 * Clear client-only party state at identity/session boundaries. The server
 * already removes the world membership; this prevents a newly admitted
 * Scion from inheriting the previous Scion's panel snapshot or invitations.
 */
export const resetPartyClientState = (target) => {
  if (!target) {
    return;
  }

  target.party = null;
  target.partyInvites = [];
  target.partyLoading = { active: false, state: null };
  target.partyStatusMessage = '';
  if (target.partyStatusTimeout) {
    clearTimeout(target.partyStatusTimeout);
    target.partyStatusTimeout = null;
  }
};

export default resetPartyClientState;
