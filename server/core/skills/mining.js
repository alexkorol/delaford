import Query from '#server/core/data/query.js';
import { foregroundObjects } from '#server/core/data/foreground/index.js';
import world from '#server/core/world.js';
import Skill from './index.js';

export default class Mining extends Skill {
  // Track which players are currently mining to prevent concurrent attempts
  static _activeMiningLocks = new Set();

  constructor(playerIndex, rockId) {
    super(playerIndex);
    this.player = world.players[playerIndex];
    this.rockId = rockId;
    this.columnId = 'mining';
  }

  get rock() {
    return foregroundObjects.find(e => e.id === this.rockId);
  }

  /**
   * Checks to see if the player has a pickaxe in their inventory or is weilding one.
   *
   * @returns {boolean}
   */
  checkForPickaxe() {
    const pickaxe = this.player.inventory.slots.find(i => i.id.includes('pickaxe')) || this.player.wear.right_hand;
    if (!pickaxe) return false;

    const itemFound = Query.getItemData(pickaxe.id);

    return Mining.isAPickaxe(itemFound) ? itemFound : false;
  }

  /**
   * Checks to see if the item being inspected is a pickaxe
   *
   * @param {object} item The data item we are inspecting
   * @returns {boolean}
   */
  static isAPickaxe(item) {
    return item.actions.includes('mine') && item.id.includes('pickaxe');
  }

  /**
   * Swing your pickaxe at a rock to mine
   */
  pickAtRock() {
    const playerUuid = this.player ? this.player.uuid : null;
    const rock = this.rock;

    if (!rock) {
      return Promise.reject(new Error('That rock is no longer available.'));
    }

    if (rock.function === 'no-mining-resource') {
      return Promise.reject(new Error(rock.resources));
    }

    if (!this.checkForPickaxe()) {
      return Promise.reject(new Error('You need a pickaxe to mine rocks.'));
    }

    // Prevent concurrent mining by the same player
    if (playerUuid && Mining._activeMiningLocks.has(playerUuid)) {
      return Promise.reject(new Error('You are already mining.'));
    }

    if (playerUuid) {
      Mining._activeMiningLocks.add(playerUuid);
    }

    return new Promise((resolve, reject) => {
      // TODO
      // Create algorithm to determine amount of time spent mining
      // based on player's mining level, rock type, and pickaxe
      setTimeout(() => {
        if (playerUuid) {
          Mining._activeMiningLocks.delete(playerUuid);
        }

        // Re-validate state after the mining delay
        if (!this.player || !world.players.includes(this.player)) {
          reject(new Error('Mining interrupted.'));
          return;
        }

        if (!this.checkForPickaxe()) {
          reject(new Error('You no longer have a pickaxe.'));
          return;
        }

        const currentRock = this.rock;
        if (!currentRock || currentRock.function === 'no-mining-resource') {
          reject(new Error('That rock is no longer available.'));
          return;
        }

        resolve(currentRock);
      }, 1000);
    });
  }
}
