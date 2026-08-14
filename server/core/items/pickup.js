import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import { claimCirculatingRelic } from '#server/core/services/chronicles.js';
import { notifyTutorial } from '#server/core/tutorial.js';
import { notifyProgression } from '#server/core/progression-events.js';

const getSceneItems = (scene) => {
  if (!scene) return [];
  if (!Array.isArray(scene.items)) scene.items = [];
  return scene.items;
};

const recipientsFor = scene => (scene?.id ? world.getScenePlayers(scene.id) : []);

export const refreshInventory = (player) => {
  if (!player?.socket_id) return;
  Socket.emit('core:refresh:inventory', {
    player: { socket_id: player.socket_id },
    data: player.inventory.slots,
  });
};

export const commitGroundItemPickup = (player, scene, itemIndex) => {
  const sceneItems = getSceneItems(scene);
  const worldItem = sceneItems[itemIndex];
  if (!player || !worldItem || worldItem.shopDisplay
    || !player.inventory || typeof player.inventory.add !== 'function') {
    return { ok: false, added: 0, remainder: worldItem?.qty || 1 };
  }

  const baseData = Query.getItemData(worldItem.id) || {};
  const quantity = Number.isFinite(worldItem.qty) ? Math.max(1, Math.floor(worldItem.qty)) : 1;
  const result = player.inventory.add(baseData.id || worldItem.id, quantity, {
    uuid: worldItem.uuid,
    existingItem: worldItem,
  });
  const added = result && Number.isFinite(result.added) ? result.added : 0;
  const remainder = result && Number.isFinite(result.remainder) ? result.remainder : quantity;

  if (added <= 0) return { ok: false, added: 0, remainder: quantity };

  if (remainder > 0) worldItem.qty = remainder;
  else sceneItems.splice(itemIndex, 1);

  Socket.broadcast('item:change', sceneItems, recipientsFor(scene));
  refreshInventory(player);
  if (remainder === 0 && claimCirculatingRelic(worldItem, player)) {
    const origin = worldItem.legacy?.sourceScionName || 'a fallen scion';
    Socket.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text: `You found ${worldItem.displayName || worldItem.name} — once carried by ${origin}.`,
    });
  }
  return { ok: remainder === 0, added, remainder };
};

export const autoPickupCurrency = (player, { radius = 1 } = {}) => {
  const scene = typeof world.getSceneForPlayer === 'function'
    ? world.getSceneForPlayer(player)
    : world.getScene(player?.sceneId);
  const items = getSceneItems(scene);
  let collected = 0;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.id !== 'coins' || item.shopDisplay) continue;
    const distance = Math.max(Math.abs(player.x - item.x), Math.abs(player.y - item.y));
    if (distance > radius) continue;
    const pickup = commitGroundItemPickup(player, scene, index);
    collected += pickup.added;
  }

  if (collected > 0) {
    // Walking over gold is a real claim: it advances quest loot objectives
    // exactly like a context-menu Take would.
    notifyProgression(player, 'loot', { itemId: 'coins', quantity: collected });
    notifyTutorial(player, 'loot');
    Socket.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text: `Picked up ${collected} gold.`,
    });
  }
  return collected;
};

export default { commitGroundItemPickup, autoPickupCurrency, refreshInventory };
