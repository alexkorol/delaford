/**
 * File-based persistence for guest/dev accounts. Guests have no account API
 * behind them, so without this every relogin reset the character — loot,
 * levels, bank, skill tree, all gone (playtest feedback). Snapshots are
 * written in the same shape as data/helpers/player.json so they merge
 * straight over the guest template at login and the Player constructor
 * hydrates them exactly like a fresh profile.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { structuredCloneSafe } from '#server/core/items/affix-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// GUEST_SAVE_DIR override keeps automated playtests hermetic — they must
// never inherit (or clobber) the developer's own character save.
const SAVE_DIR = process.env.GUEST_SAVE_DIR
  ? path.resolve(process.env.GUEST_SAVE_DIR)
  : path.resolve(here, '..', '..', 'data', 'guest-saves');

const savePath = uuid => path.join(SAVE_DIR, `${String(uuid).replace(/[^a-zA-Z0-9-]/g, '')}.json`);

export const buildDurableItemSnapshot = (item) => {
  if (!item || typeof item !== 'object' || !item.id) {
    return item || null;
  }

  const snapshot = structuredCloneSafe(item);
  // World placement and interaction locks are session state, not item
  // identity. Everything else (UUID, rolled stats, affixes, vessel, layout,
  // binding) must survive exactly.
  delete snapshot.x;
  delete snapshot.y;
  delete snapshot.timestamp;
  delete snapshot.context;
  delete snapshot.respawn;
  delete snapshot.respawnIn;
  delete snapshot.willRespawnIn;
  delete snapshot.isLocked;
  return snapshot;
};

const wearInstances = (wear = {}) => Object.fromEntries(
  Object.entries(wear)
    // Keep retired quiver data from being written back by stale guest saves.
    .filter(([slot]) => slot !== 'arrows')
    .map(([slot, item]) => [slot, item && typeof item === 'object'
      ? buildDurableItemSnapshot(item)

      : item]),
);

const durableInventory = (slots = []) => slots
  .filter(item => item && item.id)
  .map(buildDurableItemSnapshot);

// Never persist instance coordinates: guests always reload into town, and
// raw dungeon x/y would strand them at meaningless surface tiles.
const surfacePosition = (player) => {
  const inInstance = typeof player.sceneId === 'string' && player.sceneId.startsWith('instance');
  if (!inInstance) {
    return { x: player.x, y: player.y };
  }
  const back = player.preInstancePosition;
  if (back && Number.isFinite(back.x) && Number.isFinite(back.y)) {
    return { x: back.x, y: back.y };
  }
  return { x: 38, y: 115 }; // town spawn
};

export const buildGuestSnapshot = (player) => ({
  savedAt: Date.now(),
  ...surfacePosition(player),
  level: player.level,
  skills: player.skills || {},
  wear: wearInstances(player.wear),
  inventory: durableInventory(player.inventory && player.inventory.slots),
  bank: Array.isArray(player.bank) ? player.bank : [],
  passiveTree: player.passiveTree || null,
  quests: player.quests || null,
  questPoints: player.questPoints || 0,
  chronicles: player.chronicles || null,
  lifecycle: player.stats && player.stats.lifecycle ? player.stats.lifecycle : null,
  resources: player.stats && player.stats.resources ? player.stats.resources : null,
});

export const saveGuest = (player) => {
  if (!player || !player.uuid) {
    return null;
  }

  try {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    const snapshot = buildGuestSnapshot(player);
    fs.writeFileSync(savePath(player.uuid), JSON.stringify(snapshot, null, 2));
    return snapshot;
  } catch (error) {
    console.warn(`[guest-save] Failed to save ${player.username || player.uuid}:`, error.message);
    return null;
  }
};

export const loadGuest = (uuid) => {
  try {
    const file = savePath(uuid);
    if (!fs.existsSync(file)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn(`[guest-save] Failed to load ${uuid}:`, error.message);
    return null;
  }
};

export default { saveGuest, loadGuest, buildGuestSnapshot };
