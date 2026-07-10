/**
 * Wiz/dev-mode commands for playtesting. Available only outside production.
 *
 * These exist so a playtest (human or LLM agent driving playtest/harness.mjs)
 * can set up a scenario in seconds — teleport to a zone, grant gear, set a
 * level — instead of grinding there. They mutate through the same real code
 * paths the game uses (assignPlayerToScene, portal transitions, inventory.add,
 * refreshDerivedStats), so using them still exercises production logic.
 */

import Player from '#server/core/player.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import { broadcastStats } from '#server/core/entities/player/stats-manager.js';
import { transitionPlayerIfOnPortal } from '#server/core/world-transitions.js';
import { dropMonsterLoot } from '#server/core/combat/loot.js';

const DEV_MODE = (process.env.NODE_ENV || 'development') !== 'production';

const getPlayerBySocket = (ws) => {
  if (!ws || !ws.id) {
    return null;
  }
  return world.players.find(player => player.socket_id === ws.id) || null;
};

const sendDevMessage = (player, text) => {
  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text: `[dev] ${text}`,
  });
};

// Snapshot of everything a playtest needs to assert on, in one request.
const buildStateSnapshot = (player) => {
  const scene = world.getSceneForPlayer(player);
  return {
    uuid: player.uuid,
    username: player.username,
    x: player.x,
    y: player.y,
    level: player.level,
    sceneId: player.sceneId,
    sceneName: scene ? scene.name : null,
    sceneType: scene ? scene.type : null,
    hp: player.stats && player.stats.resources ? { ...player.stats.resources.health } : null,
    mana: player.stats && player.stats.resources ? { ...player.stats.resources.mana } : null,
    lifecycle: player.stats && player.stats.lifecycle ? player.stats.lifecycle.state : null,
    inventory: Array.isArray(player.inventory && player.inventory.slots)
      ? player.inventory.slots.map(item => ({
        id: item.id, uuid: item.uuid, qty: item.qty || 1, slot: item.slot,
      }))
      : [],
    wear: player.wear
      ? Object.fromEntries(Object.entries(player.wear)
        .map(([slot, item]) => [slot, item ? item.id : null]))
      : {},
    passiveTree: player.passiveTree || null,
    monsters: scene && Array.isArray(scene.monsters)
      ? scene.monsters.filter(m => m && m.isAlive).map(m => ({
        uuid: m.uuid,
        name: m.name,
        x: m.x,
        y: m.y,
        level: m.level,
        rarity: m.rarityId,
        hp: m.stats && m.stats.resources ? { ...m.stats.resources.health } : null,
      }))
      : [],
    groundItems: scene && Array.isArray(scene.items)
      ? scene.items.map(item => ({
        id: item.id,
        uuid: item.uuid,
        name: item.displayName || item.name,
        x: item.x,
        y: item.y,
        qty: item.qty || 1,
        legacyRelicId: item.legacyRelicId || null,
        legacy: item.legacy || null,
      }))
      : [],
    sceneMetadata: scene && scene.metadata ? {
      depth: scene.metadata.depth,
      layout: scene.metadata.layout,
      theme: scene.metadata.theme,
      stairsUp: scene.metadata.stairsUp || null,
      stairsDown: scene.metadata.stairsDown || null,
    } : {},
  };
};

const devEvents = {
  /**
   * Echo a full authoritative player/scene snapshot back to the requester.
   */
  'dev:state': (data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!DEV_MODE || !player) {
      return;
    }

    Socket.emit('dev:state', {
      player: { socket_id: player.socket_id },
      state: buildStateSnapshot(player),
      requestId: data && data.data ? data.data.requestId : undefined,
    });
  },

  /**
   * Teleport within the current scene (or step onto a portal to transition
   * through the real portal logic).
   */
  'dev:teleport': (data, ws) => {
    const player = getPlayerBySocket(ws);
    const payload = (data && data.data) || {};
    if (!DEV_MODE || !player || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) {
      return;
    }

    if (typeof player.cancelPathfinding === 'function') {
      player.cancelPathfinding();
    }

    // Optional cross-scene teleport (playtest scenarios walk the world).
    if (typeof payload.sceneId === 'string' && world.scenes.has(payload.sceneId)) {
      world.assignPlayerToScene(player, payload.sceneId);
    }

    player.x = Math.floor(payload.x);
    player.y = Math.floor(payload.y);
    if (player.path) {
      player.path.grid = null;
    }

    // Landing on a portal tile walks through it, exactly like a real step.
    const transitioned = transitionPlayerIfOnPortal(player);
    Player.broadcastMovement(player);
    sendDevMessage(player, `Teleported to ${player.x}, ${player.y}${transitioned ? ' (portal followed)' : ''}.`);
  },

  /**
   * Grant an item into the inventory through the real inventory pipeline.
   */
  'dev:give': (data, ws) => {
    const player = getPlayerBySocket(ws);
    const payload = (data && data.data) || {};
    if (!DEV_MODE || !player || !payload.itemId || !player.inventory) {
      return;
    }

    const quantity = Number.isFinite(payload.qty) ? Math.max(1, Math.floor(payload.qty)) : 1;
    player.inventory.add(payload.itemId, quantity);
    Socket.emit('core:refresh:inventory', {
      player: { socket_id: player.socket_id },
      data: player.inventory.slots,
    });
    sendDevMessage(player, `Granted ${quantity}x ${payload.itemId}.`);
  },

  /**
   * Set character level and refresh derived stats (HP/mana pools etc.).
   */
  'dev:setlevel': (data, ws) => {
    const player = getPlayerBySocket(ws);
    const payload = (data && data.data) || {};
    if (!DEV_MODE || !player || !Number.isFinite(payload.level)) {
      return;
    }

    player.level = Math.max(1, Math.min(100, Math.floor(payload.level)));
    if (player.experience !== undefined) {
      player.experience = UI.getExperience(player.level);
    }
    if (typeof player.refreshDerivedStats === 'function') {
      player.refreshDerivedStats();
    }
    broadcastStats(player);
    sendDevMessage(player, `Level set to ${player.level}.`);
  },

  /**
   * Restore health and mana to full.
   */
  'dev:heal': (data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!DEV_MODE || !player || !player.stats || !player.stats.resources) {
      return;
    }

    const { health, mana } = player.stats.resources;
    health.current = health.max;
    if (mana) {
      mana.current = mana.max;
    }
    if (player.stats.lifecycle && player.stats.lifecycle.state === 'cheat-death') {
      player.stats.lifecycle.state = 'alive';
    }
    broadcastStats(player);
    sendDevMessage(player, 'Fully healed.');
  },

  /** Put the scion one real monster hit away from its final death. */
  'dev:prepare-final-death': (data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!DEV_MODE || !player?.stats?.lifecycle || !player.stats.resources?.health) return;
    player.stats.lifecycle.mode = 'hard';
    player.stats.lifecycle.state = 'alive';
    player.stats.lifecycle.cheatDeath = player.stats.lifecycle.cheatDeath || {};
    player.stats.lifecycle.cheatDeath.charges = 0;
    player.stats.resources.health.current = 1;
    broadcastStats(player);
    sendDevMessage(player, 'Final death armed; the next damaging monster hit is fatal.');
  },

  /** Exercise the live relic drop pipeline deterministically for playtests. */
  'dev:release-relic': (data, ws) => {
    const player = getPlayerBySocket(ws);
    if (!DEV_MODE || !player) return;
    const rngValues = [0.99, 0];
    dropMonsterLoot({
      x: player.x,
      y: player.y,
      sceneId: player.sceneId,
      rarityId: 'common',
      rewards: { coins: 0 },
    }, {
      killer: player,
      relicChance: 1,
      rng: () => rngValues.shift() ?? 0.99,
    });
    sendDevMessage(player, 'Released the next eligible Chronicle relic into the live loot stream.');
  },
};

export default devEvents;
