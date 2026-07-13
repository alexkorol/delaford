/**
 * House wagon events: opening the wagon pane at your own House's wagon,
 * outfitting from the stores chest (paid from the House treasury), and
 * claiming the daily road purse (docs/crossroads-world-web.md).
 */
import Socket from '#server/socket.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import playerPersistence from '#server/core/services/player-persistence.js';
import wagonService, { wagonNpcId, OUTFIT_TIERS } from '#server/core/services/wagon-service.js';
import world from '#server/core/world.js';

const getPlayerBySocket = ws => world.players.find(player => player.socket_id === ws.id);

const sendMessage = (player, text) => Socket.emit('game:send:message', {
  player: { socket_id: player.socket_id },
  text,
});

const nearOwnWagon = (player) => {
  const scene = world.getScene(player.sceneId);
  if (!scene || scene.type !== 'town') return false;
  const npc = (scene.npcs || []).find(entry => entry.id === wagonNpcId(player.houseId));
  if (!npc) return false;
  return Math.max(Math.abs(player.x - npc.x), Math.abs(player.y - npc.y)) <= 2;
};

// NOTE: the context-menu action 'player:screen:wagon' lives in
// handlers/actions/index.js — the Action dispatcher only routes into that
// module. This file holds the pane's own socket events.
export default {
  /** Buy from the stores chest: the House treasury pays, not the scion. */
  'wagon:outfit:buy': async ({ data }, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player || player.currentPane !== 'wagon') return;
    if (!nearOwnWagon(player)) return;

    const itemId = data?.itemId;
    const house = wagonService.houseFor(player);
    if (!house || !itemId) return;

    const tier = OUTFIT_TIERS.find(entry => entry.items.includes(itemId));
    if (!tier) {
      sendMessage(player, 'The stores chest holds no such thing.');
      return;
    }
    if (!tier.unlocked(house)) {
      sendMessage(player, `The quartermaster shakes their head. ${tier.label} needs ${tier.requirement}.`);
      return;
    }

    const stockItem = wagonService.buildStock(house)
      .flatMap(entry => entry.items)
      .find(entry => entry.id === itemId);
    const price = stockItem?.price || 0;

    const spend = chroniclesRepository.spendHouseTreasury(player.accountId, player.houseId, Math.max(1, price));
    if (!spend.ok) {
      sendMessage(player, spend.reason);
      return;
    }

    await player.inventory.add(itemId, 1);
    playerPersistence.markDirty(player);
    Socket.emit('core:refresh:inventory', {
      player: { socket_id: player.socket_id },
      data: player.inventory.slots,
    });
    sendMessage(player, `The quartermaster hands over ${stockItem?.name || itemId} and marks ${Math.max(1, price)} gold off the ledger.`);
    wagonService.sendWagonScreen(player);
  },

  /** Manual claim of the road purse, for Houses that missed the auto-claim. */
  'wagon:daily:claim': (_data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player || player.currentPane !== 'wagon') return;
    const result = wagonService.claimDailyArrival(player);
    if (!result) {
      sendMessage(player, "Today's road purse is already in the ledger.");
    }
    wagonService.sendWagonScreen(player);
  },

  /** House improvements bought at the wagon instead of the login screen. */
  'wagon:upgrade': ({ data }, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player || player.currentPane !== 'wagon') return;
    const result = chroniclesRepository.upgradeHouse(player.accountId, player.houseId, data?.upgradeId);
    if (!result.ok) {
      sendMessage(player, result.reason);
    } else {
      sendMessage(player, `The House invests ${result.cost} gold. The wagon rides a little heavier.`);
    }
    wagonService.sendWagonScreen(player);
  },
};
