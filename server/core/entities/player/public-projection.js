/**
 * The only fields a scene peer may ever learn about another player.
 *
 * Broadcasts that fan a player out to other clients (player:joined,
 * player:equippedAnItem, player:unequippedAnItem) must project through this
 * helper instead of serialising the live Player object. Player has no
 * toJSON, so its own-enumerable state - bank, inventory, passive tree,
 * quests, socket_id, token, account/house/scion identity - would otherwise
 * cross the scene-peer trust boundary (cand-007), and the guest accountId
 * ('guest:<guestId>') handed out the exact identifier cand-008 needs.
 *
 * House names are deliberately included: they are already public via the
 * shared wagon NPC and the chronicle leaderboard.
 */
export const publicPlayerProjection = (player = {}) => ({
  uuid: player.uuid,
  username: player.username,
  x: player.x,
  y: player.y,
  level: player.level,
  facing: player.facing,
  animation: player.animation,
  wear: player.wear || {},
  movementStep: player.movementStep,
  sceneId: player.sceneId,
  houseName: player.houseName || null,
});

export default publicPlayerProjection;
