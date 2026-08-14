import Socket from '#server/socket.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import {
  beginScionSession,
  buildScionSnapshot,
  sendChronicleState,
} from '#server/core/services/chronicles.js';
import world from '#server/core/world.js';
import playerPersistence from '#server/core/services/player-persistence.js';
import wagonService from '#server/core/services/wagon-service.js';

const carriedGold = player => (player?.inventory?.slots || [])
  .filter(item => item?.id === 'coins')
  .reduce((total, item) => total + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);

const removeGold = (player, amount) => {
  let remaining = amount;
  player.inventory.slots.forEach((item) => {
    if (remaining <= 0 || item?.id !== 'coins') return;
    const available = Math.max(0, Math.floor(Number(item.qty) || 0));
    const removed = Math.min(available, remaining);
    item.qty = available - removed;
    remaining -= removed;
  });
  player.inventory.slots = player.inventory.slots
    .filter(item => item?.id !== 'coins' || item.qty > 0);
};

const sendGameMessage = (player, text) => Socket.emit('game:send:message', {
  player: { socket_id: player.socket_id },
  text,
});

const sendBankState = (player, house) => {
  Socket.emit('core:refresh:inventory', {
    player: { socket_id: player.socket_id },
    data: player.inventory.slots,
  });
  Socket.emit('open:screen', {
    player: { socket_id: player.socket_id },
    screen: 'bank',
    payload: {
      items: player.bank,
      carriedCoins: carriedGold(player),
      house: {
        id: house.id,
        name: house.name,
        treasury: house.treasury,
      },
    },
  });
};

const sendError = (ws, reason) => {
  Socket.emit('chronicles:error', {
    player: { socket_id: ws.id },
    reason,
  });
};

export default {
  'chronicles:house:found': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.foundHouse(accountId, data?.name);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws);
  },

  'chronicles:scion:create': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.createScion(accountId, data?.houseId, data?.name);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws, { createdScionId: result.scionId });
  },

  'chronicles:house:claim-daily': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.claimDailyGold(accountId, data?.houseId);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws, { houseReward: { amount: result.amount, reason: 'daily stipend' } });
  },

  'chronicles:house:upgrade': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.upgradeHouse(accountId, data?.houseId, data?.upgradeId);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws);
  },

  'chronicles:house:deposit': ({ data }, ws) => {
    const player = world.players.find(entry => entry.socket_id === ws.id);
    if (!player?.accountId || !player.houseId || !player.scionId) return;
    // Gold goes home under the wagon boards — or, for the old habit, through
    // the countinghouse. Both live at the Crossroads.
    if (!['bank', 'wagon'].includes(player.currentPane) || player.sceneId !== world.defaultTownId) {
      sendGameMessage(player, 'Deposit House gold at your wagon or the countinghouse at the Crossroads.');
      return;
    }

    const available = carriedGold(player);
    const requested = data?.amount === 'all'
      ? available
      : Math.max(0, Math.floor(Number(data?.amount) || 0));
    const amount = Math.min(available, requested);
    if (amount < 1) {
      sendGameMessage(player, 'This scion is not carrying any gold to deposit.');
      return;
    }

    const originalInventory = structuredClone(player.inventory.slots);
    removeGold(player, amount);
    const result = chroniclesRepository.depositScionGold(
      player.accountId,
      player.houseId,
      player.scionId,
      amount,
      buildScionSnapshot(player),
    );
    if (!result.ok) {
      player.inventory.slots = originalInventory;
      sendGameMessage(player, result.reason);
      return;
    }

    playerPersistence.markDirty(player);
    const house = result.chronicle.houses.find(entry => entry.id === player.houseId);
    if (player.currentPane === 'wagon') {
      Socket.emit('core:refresh:inventory', {
        player: { socket_id: player.socket_id },
        data: player.inventory.slots,
      });
      wagonService.sendWagonScreen(player);
    } else {
      sendBankState(player, house);
    }
    sendGameMessage(player, `${amount} gold nailed under the boards: from ${player.username} to House ${house.name}.`);
  },

  'chronicles:scion:set-out': async ({ data }, ws) => {
    const result = await beginScionSession(ws, data?.scionId);
    if (!result.ok) sendError(ws, result.reason);
  },
};
