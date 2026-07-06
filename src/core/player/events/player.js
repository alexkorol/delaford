// Player event handler

import bus from '../../utilities/bus.js';
import MovementController from '../../utilities/movement-controller.js';
import { now } from '../../config/movement.js';

const applyActorLevel = (actor, snapshot = {}) => {
  const statsLevel = snapshot.stats && Number.isFinite(snapshot.stats.level)
    ? snapshot.stats.level
    : null;
  const payloadLevel = Number.isFinite(snapshot.level) ? snapshot.level : null;
  const level = statsLevel !== null ? statsLevel : payloadLevel;

  if (Number.isFinite(level)) {
    actor.level = level;
  }
};

const applyPlayerSnapshot = (actor, snapshot = {}) => {
  if (!actor || !snapshot) {
    return;
  }

  if (snapshot.inventory) {
    actor.inventory = Array.isArray(snapshot.inventory)
      ? snapshot.inventory
      : snapshot.inventory.slots || actor.inventory;
  }

  if (snapshot.wear) {
    actor.wear = snapshot.wear;
  }

  if (snapshot.combat) {
    actor.combat = snapshot.combat;
  }

  if (snapshot.stats) {
    actor.stats = snapshot.stats;
  }

  applyActorLevel(actor, snapshot);

  const resources = snapshot.resources || (snapshot.stats && snapshot.stats.resources) || {};
  if (resources.health) {
    actor.hp = resources.health;
    if (actor.stats && actor.stats.resources) {
      actor.stats.resources.health = resources.health;
    }
  }

  if (resources.mana) {
    actor.mana = resources.mana;
    if (actor.stats && actor.stats.resources) {
      actor.stats.resources.mana = resources.mana;
    }
  }

  const lifecycle = snapshot.lifecycle || (snapshot.stats && snapshot.stats.lifecycle) || null;
  if (lifecycle) {
    actor.lifecycle = lifecycle;
    if (actor.stats) {
      actor.stats.lifecycle = lifecycle;
    }
  }
};

export default {
  /**
   * A player logins into the game
   */
  'player:login': async (data, context) => {
    context.startGame(data.data);
  },

  /**
   * A player logins into the game
   */
  'player:login-error': (data) => {
    bus.$emit('player:login-error', data.data);
  },

  /**
   * This session was replaced by a login elsewhere (second tab, another
   * machine). Stand down — do NOT reconnect into a session-steal war.
   */
  'player:session-replaced': (data, context) => {
    if (context && typeof context.sessionReplaced === 'function') {
      context.sessionReplaced();
    }
  },

  /**
   * When a player moves.
   */
  'player:movement': (message, context) => {
    const eventData = message.data || {};
    const meta = message.meta || {};

    if (eventData.inventory && eventData.inventory.slots) {
      eventData.inventory = eventData.inventory.slots;
    }

    if (!eventData.movementStep && meta.movementStep) {
      eventData.movementStep = meta.movementStep;
    }

    context.playerMovement(eventData, meta);
  },
  /**
   * A player saying something
   */
  'player:say': (data) => {
    bus.$emit('player:say', data.data);
  },

  /**
   * A player recieves new players
   */
  'player:joined': (data, context) => {
    setTimeout(() => {
      if (context.game.player) {
        const existingPlayers = new Map(
          (context.game.map.players || []).map((player) => [player.uuid, player]),
        );

        const meta = data.meta || {};
        let movementEntries = [];
        if (Array.isArray(meta.players)) {
          movementEntries = meta.players;
        } else if (Array.isArray(meta.movements)) {
          movementEntries = meta.movements;
        }

        const movementLookup = new Map(
          movementEntries
            .map((entry) => {
              const key = entry && (entry.uuid || entry.id);
              if (!key) {
                return null;
              }
              return [key, entry.movementStep || null];
            })
            .filter((entry) => entry !== null),
        );

        context.game.map.players = data.data
          .filter((p) => p.socket_id !== context.game.player.socket_id)
          .map((player) => {
            const existing = existingPlayers.get(player.uuid);
            const controller = existing && existing.movement
              ? existing.movement
              : new MovementController().initialise(player.x, player.y);
            const step = player.movementStep
              || movementLookup.get(player.uuid)
              || null;

            if (step) {
              controller.applyServerStep(player.x, player.y, step, {
                sentAt: meta.sentAt || null,
                receivedAt: now(),
              });
            } else {
              controller.hardSync(player.x, player.y);
            }

            const newcomer = {
              ...player,
              movement: controller,
              animationController: existing && existing.animationController,
            };

            if (context.game && typeof context.game.updateActorAnimation === 'function') {
              context.game.updateActorAnimation(newcomer, player.animation || null);
            }

            return newcomer;
          });
      }
    }, 1000);
  },

  /**
   * A player leaves the game
   */
  'player:left': (data, context) => {
    const playerIndex = context.game.map.players.findIndex((p) => data.data === p.socket_id);
    if (playerIndex !== -1) {
      context.game.map.players.splice(playerIndex, 1);
    }
  },

  /**
   * A player equips an item
   */
  'player:equippedAnItem': (data, context) => {
    if (data.data.uuid === context.game.player.uuid) {
      applyPlayerSnapshot(context.game.player, data.data);
    }
  },

  /**
   * The player stopped moving
   */
  'player:stopped': () => {
    bus.$emit('canvas:getMouse');
  },

  /**
   * A player unequips an item
   */
  'player:unequippedAnItem': (data, context) => {
    if (data.data.uuid === context.game.player.uuid) {
      applyPlayerSnapshot(context.game.player, data.data);
    }
  },
  'player:animation': (message, context) => {
    if (!context.game || !context.game.player) {
      return;
    }

    const payload = message.data || {};
    const playerId = payload.playerId || payload.uuid;
    const animation = payload.animation || null;

    if (!playerId || !animation) {
      return;
    }

    if (context.game.player.uuid === playerId) {
      context.game.updateActorAnimation(context.game.player, animation, { forceSync: true });
      if (context.game.map && context.game.map.player) {
        context.game.map.player.animation = { ...context.game.player.animation };
        context.game.map.player.animationController = context.game.player.animationController;
      }
      return;
    }

    const index = (context.game.map.players || []).findIndex((p) => p.uuid === playerId);
    if (index !== -1) {
      const actor = context.game.map.players[index];
      context.game.updateActorAnimation(actor, animation, { forceSync: true });
      context.game.map.players.splice(index, 1, actor);
    }
  },
  'player:combat:update': (message, context) => {
    if (!context.game || !context.game.player) {
      return;
    }

    const payload = message.data || {};
    const playerId = payload.playerId || payload.uuid;
    const combat = payload.combat || null;
    const animation = payload.animation || null;

    if (!playerId) {
      return;
    }

    if (context.game.player.uuid === playerId) {
      if (combat) {
        context.game.player.combat = combat;
      }
      if (animation) {
        context.game.updateActorAnimation(context.game.player, animation, { forceSync: true });
      }
      return;
    }

    const index = (context.game.map.players || []).findIndex((p) => p.uuid === playerId);
    if (index !== -1) {
      const actor = context.game.map.players[index];
      if (combat) {
        actor.combat = combat;
      }
      if (animation) {
        context.game.updateActorAnimation(actor, animation, { forceSync: true });
      } else {
        context.game.ensureAnimationController(actor);
      }
      context.game.map.players.splice(index, 1, actor);
    }
  },
  'player:stats:update': (message, context) => {
    if (!context.game || !context.game.player) {
      return;
    }

    const payload = message.data || {};
    const playerId = payload.playerId || payload.uuid;
    if (!playerId) {
      return;
    }

    const stats = payload.stats || null;
    const resources = payload.resources || (stats && stats.resources) || {};
    const lifecycle = payload.lifecycle || (stats && stats.lifecycle) || null;

    const applyToActor = (actor) => {
      if (!actor) {
        return;
      }

      if (stats) {
        actor.stats = stats;
      }

      applyActorLevel(actor, { level: payload.level, stats });

      if (resources && resources.health) {
        actor.hp = resources.health;
        if (actor.stats && actor.stats.resources) {
          actor.stats.resources.health = resources.health;
        }
      }

      if (resources && resources.mana) {
        actor.mana = resources.mana;
        if (actor.stats && actor.stats.resources) {
          actor.stats.resources.mana = resources.mana;
        }
      }

      if (lifecycle) {
        actor.lifecycle = lifecycle;
        if (actor.stats) {
          actor.stats.lifecycle = lifecycle;
        }
      }
    };

    if (context.game.player.uuid === playerId) {
      applyToActor(context.game.player);
      return;
    }

    const playerIndex = (context.game.map.players || []).findIndex((p) => p.uuid === playerId);
    if (playerIndex !== -1) {
      const actor = context.game.map.players[playerIndex];
      applyToActor(actor);
      context.game.map.players.splice(playerIndex, 1, actor);
      return;
    }

    const monsterIndex = (context.game.map.monsters || []).findIndex((monster) => monster.uuid === playerId);
    if (monsterIndex !== -1) {
      const monster = context.game.map.monsters[monsterIndex];
      applyToActor(monster);
      context.game.map.monsters.splice(monsterIndex, 1, monster);
    }
  },
};
