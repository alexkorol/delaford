import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import ItemFactory from '#server/core/items/factory.js';

export default class Skill {
  constructor(playerIndex) {
    this.playerIndex = playerIndex;
  }

  /**
   * Update a player's experience in a certain skill
   *
   * @param {integer} expToAdd The experience to add to current skill experience
   */
  updateExperience(expToAdd) {
    const currentExperience = world.players[this.playerIndex].skills[this.columnId].exp;
    const updatedExperience = currentExperience + expToAdd;
    const didUserLevelUp = Skill.didUserLevelUp(currentExperience, updatedExperience);

    if (didUserLevelUp) {
      world.players[this.playerIndex].skills[this.columnId].level += 1;
      Socket.sendMessageToPlayer(this.playerIndex, `You have gained a ${UI.capitalizeFirstLetter(this.columnId)} level!`);
    }

    world.players[this.playerIndex].skills[this.columnId].exp = updatedExperience;
  }

  /**
   * Calculate whether a player has leveled up between experience gains
   *
   * @param {integer} currentExp The current experience points
   * @param {integer} updatedExp The updated experience points after action
   * @return {boolean}
   */
  static didUserLevelUp(currentExp, updatedExp) {
    const a = UI.getLevel(currentExp);
    const b = UI.getLevel(updatedExp);
    return a !== b;
  }

  /**
   * Tell the user to add resource to their inventory
   * or drop on ground based on inventory availability
   *
   * @param {object} getItem The resource we are gathering
   */
  extractResource(getItem) {
    const player = world.players[this.playerIndex];
    if (!player) {
      return;
    }

    const openSlot = UI.getOpenSlot(player.inventory.slots);

    // Do we have an open slot for the newly-mined resource?
    if (openSlot === false) {
      const scene = world.getSceneForPlayer(player) || world.getDefaultTown();
      const resourceId = getItem.resources || getItem.id;

      if (!Array.isArray(scene.items)) {
        scene.items = [];
      }

      // If not, we let it fall on the ground
      const dropped = ItemFactory.toWorldInstance(
        ItemFactory.createById(resourceId) || { id: resourceId },
        {
          x: player.x,
          y: player.y,
        },
        { timestamp: Date.now() },
      );

      world.addItem(dropped, scene.id);

      Socket.broadcast('world:itemDropped', scene.items, world.getScenePlayers(scene.id));
    } else {
      // If so, we add it to our inventory
      player.inventory.add(getItem.resources, 1);

      Socket.emit('core:refresh:inventory', {
        player: { socket_id: player.socket_id },
        data: player.inventory.slots,
      });
    }
  }
}
