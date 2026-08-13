import world from '#server/core/world.js';
import { smithing } from '#server/core/data/items/index.js';
import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';

import Skill from './index.js';

const itemQuantity = item => (
  Number.isFinite(item?.qty) ? Math.max(0, Math.floor(item.qty)) : 1
);

const countItem = (inventory, itemId) => inventory
  .filter(item => item && item.id === itemId)
  .reduce((total, item) => total + itemQuantity(item), 0);

const consumeItem = (inventory, itemId, quantity) => {
  let remaining = quantity;
  for (let index = inventory.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const item = inventory[index];
    if (!item || item.id !== itemId) {
      continue;
    }

    const available = itemQuantity(item);
    if (available <= remaining) {
      inventory.splice(index, 1);
      remaining -= available;
    } else {
      item.qty = available - remaining;
      remaining = 0;
    }
  }

  return remaining === 0;
};

export default class Smithing extends Skill {
  constructor(playerIndex, resourceId, type) {
    super(playerIndex);
    this.player = world.players[playerIndex];
    this.resourceId = resourceId;
    this.type = type; // bar | ore
    this.columnId = 'smithing';
    this.inventory = this.player.inventory.slots;
  }

  static ores() {
    return {
      'bronze-bar': {
        requires: {
          'tin-ore': 1,
          'copper-ore': 1,
        },
        experience: 6,
      },
      'iron-bar': {
        requires: {
          'iron-ore': 1,
        },
        experience: 13,
      },
      'silver-bar': {
        requires: {
          'silver-ore': 1,
        },
        experience: 15,
      },
      'steel-bar': {
        requires: {
          'iron-ore': 1,
          'coal-ore': 2,
        },
        experience: 18,
      },
      'gold-bar': {
        requires: {
          'gold-ore': 1,
        },
        experience: 22,
      },
      'jatite-bar': {
        requires: {
          'jatite-ore': 1,
          'coal-ore': 4,
        },
        experience: 30,
      },
    };
  }

  async forge(inventory) {
    if (!this.resourceId || !this.resourceId.id) {
      Socket.sendMessageToPlayer(this.playerIndex, 'There is nothing to forge.');
      return false;
    }

    const itemToForge = Smithing.getItemsToSmith(this.resourceId.id).find(item => this.resourceId.id === item.id);
    if (!itemToForge) {
      Socket.sendMessageToPlayer(this.playerIndex, 'You cannot smith that item.');
      return false;
    }

    // Enforce the level requirement server-side — the pane lists every bronze
    // recipe, and a crafted client could otherwise forge gear above its level.
    const smithingLevel = this.player.skills && this.player.skills.smithing
      ? this.player.skills.smithing.level
      : 1;
    if (smithingLevel < itemToForge.level) {
      Socket.sendMessageToPlayer(
        this.playerIndex,
        `You need a smithing level of ${itemToForge.level} to forge that.`,
      );
      return false;
    }

    const barToTakeAway = itemToForge.item.split('-')[0];

    const barId = `${barToTakeAway}-bar`;
    const hasEnoughBars = countItem(inventory, barId) >= itemToForge.bars;

    if (hasEnoughBars) {
      consumeItem(this.inventory, barId, itemToForge.bars);

      world.players[this.playerIndex].inventory.slots = this.inventory;
      await world.players[this.playerIndex].inventory.add(itemToForge.id, 1);
      const forgedItem = Query.getItemData(itemToForge.id);
      Socket.sendMessageToPlayer(
        this.playerIndex,
        `You successfully smithed a ${forgedItem?.name || itemToForge.id}.`,
      );

      Socket.emit('core:refresh:inventory', {
        player: { socket_id: world.players[this.playerIndex].socket_id },
        data: world.players[this.playerIndex].inventory.slots,
      });

      Socket.emit('core:pane:close', {
        player: { socket_id: world.players[this.playerIndex].socket_id },
      });
      return itemToForge;
    } else {
      Socket.sendMessageToPlayer(
        this.playerIndex,
        'You do not have enough bars to smith this item.',
      );
      return false;
    }
  }

  async smelt(inventory) {
    const barToSmelt = Smithing.ores()[this.resourceId];
    if (!barToSmelt) {
      Socket.sendMessageToPlayer(this.playerIndex, 'You cannot smelt that.');
      return null;
    }

    const hasEnoughOre = Object.entries(barToSmelt.requires)
      .every(([ore, quantity]) => countItem(inventory, ore) >= quantity);

    if (!hasEnoughOre) {
      Socket.sendMessageToPlayer(
        this.playerIndex,
        'You do not have enough ore.',
      );
      return null;
    }

    Object.entries(barToSmelt.requires).forEach(([ore, quantity]) => {
      consumeItem(this.inventory, ore, quantity);
    });

    world.players[this.playerIndex].inventory.slots = this.inventory;
    await world.players[this.playerIndex].inventory.add(this.resourceId, 1);

    const resource = smithing.find(i => i.id === this.resourceId);
    Socket.sendMessageToPlayer(
      this.playerIndex,
      `You successfully smelted a ${resource.name}.`,
    );

    Socket.emit('core:refresh:inventory', {
      player: { socket_id: world.players[this.playerIndex].socket_id },
      data: world.players[this.playerIndex].inventory.slots,
    });

    Socket.emit('core:pane:close', {
      player: { socket_id: world.players[this.playerIndex].socket_id },
    });

    return resource;
  }

  static getItemsToSmith(bar) {
    // TODO: Make a getter to fetch that item's smithing
    // data getItemSkillData('smithing', 'bronze-dagger')
    // Query.getItemData('bronze-dagger')
    if (bar.includes('bronze')) {
      return [
        {
          id: 'bronze-dagger',
          item: 'bronze-dagger',
          level: 1,
          expGained: 13,
          bars: 1,
        },
        {
          item: 'bronze-axe',
          id: 'bronze-axe',
          level: 1,
          expGained: 15,
          bars: 2,
        },
        {
          id: 'bronze-mace',
          item: 'bronze-mace',
          level: 2,
          expGained: 19,
          bars: 5,
        },
        {
          id: 'bronze-med-helm',
          item: 'bronze-med-helm',
          level: 3,
          expGained: 21,
          bars: 1,
        },
        {
          id: 'bronze-sword',
          item: 'bronze-sword',
          level: 4,
          expGained: 25,
          bars: 2,
        },
      ];
    }

    return [];
  }

  static bars() {
    // The bars available to smith and their level needed.
    return {
      'bronze-bar': 1,
      'iron-bar': 19,
      'silver-bar': 25,
      'steel-bar': 40,
      'gold-bar': 47,
      'jatite-bar': 55,
    };
  }
}
