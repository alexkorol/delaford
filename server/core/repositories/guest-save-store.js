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

const here = path.dirname(fileURLToPath(import.meta.url));
// GUEST_SAVE_DIR override keeps automated playtests hermetic — they must
// never inherit (or clobber) the developer's own character save.
const SAVE_DIR = process.env.GUEST_SAVE_DIR
  ? path.resolve(process.env.GUEST_SAVE_DIR)
  : path.resolve(here, '..', '..', 'data', 'guest-saves');

const savePath = uuid => path.join(SAVE_DIR, `${String(uuid).replace(/[^a-zA-Z0-9-]/g, '')}.json`);

const serialiseWear = (wear = {}) => Object.fromEntries(
  Object.entries(wear)
    .filter(([slot]) => slot !== 'arrows')
    .map(([slot, item]) => [slot, item && typeof item === 'object'
      ? JSON.parse(JSON.stringify(item))
      : item]),
);

const slimInventory = (slots = []) => slots
  .filter(item => item && item.id)
  .map(item => ({
    id: item.id,
    slot: item.slot,
    uuid: item.uuid,
    ...(Number.isFinite(item.qty) ? { qty: item.qty } : {}),
  }));

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
  wear: serialiseWear(player.wear),
  inventory: slimInventory(player.inventory && player.inventory.slots),
  bank: Array.isArray(player.bank) ? player.bank : [],
  passiveTree: player.passiveTree || null,
  quests: player.quests || {},
  questPoints: player.questPoints || 0,
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
