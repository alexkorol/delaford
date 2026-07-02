import { v4 as uuid } from 'uuid';
import { addHours, addMinutes, addSeconds } from 'date-fns';

import Socket from '#server/socket.js';
import ItemFactory from './items/factory.js';
import world from './world.js';

class Item {
  constructor(data) {
    this.id = data.id;
    this.uuid = uuid();
    this.name = data.name;
    this.examine = data.examine;
    this.price = data.price;
    this.type = data.type;
    this.graphics = data.graphics;
    this.wearable = data.wearable || false;

    // (Load up new weapons constructor)
    this.user = data.user;
    this.carried = data.carried;
    this.slot = data.slot;
    this.equipped = data.equipped;
  }

  /**
   * Check the map resources to see if they need to be replenished
   */
  static resourcesCheck() {
    world.forEachScene((scene) => {
      if (!scene || !scene.respawns || !Array.isArray(scene.respawns.resources)) {
        return;
      }

      const resources = scene.respawns.resources;
      if (!resources.length) {
        return;
      }

      const mapLayers = scene.map || world.map;
      const foreground = mapLayers && Array.isArray(mapLayers.foreground)
        ? mapLayers.foreground
        : null;

      if (!foreground) {
        return;
      }

      for (let index = resources.length - 1; index >= 0; index -= 1) {
        const resource = resources[index];
        if (!resource || !resource.willRespawnIn) {
          continue;
        }

        const readyAt = resource.willRespawnIn instanceof Date
          ? resource.willRespawnIn.getTime()
          : new Date(resource.willRespawnIn).getTime();

        if (Number.isNaN(readyAt) || Date.now() < readyAt) {
          continue;
        }

        if (typeof resource.onTile === 'number' && resource.onTile >= 0) {
          foreground[resource.onTile] = resource.setToTile;
        }

        Socket.broadcast('world:foreground:update', foreground, world.getScenePlayers(scene.id));
        world.removeResourceRespawn(resource, scene.id);
      }
    });
  }

  /**
   * Checks the map for any picked up respawning items
   */
  static check() {
    world.forEachScene((scene) => {
      if (!scene || !scene.respawns || !Array.isArray(scene.respawns.items)) {
        return;
      }

      const itemsWaitingToRespawn = scene.respawns.items.filter(i => i.pickedUp);

      if (!itemsWaitingToRespawn.length) {
        return;
      }

      itemsWaitingToRespawn.forEach((item) => {
        if (Item.itemAlreadyPlaced(item, scene.id) !== undefined) {
          return;
        }

        const baseItem = ItemFactory.createById(item.id);
        const respawned = ItemFactory.toWorldInstance(
          baseItem || { id: item.id },
          { x: item.x, y: item.y },
          { respawn: true },
        );

        respawned.respawnIn = item.respawnIn;
        world.addItem(respawned, scene.id);

        const sceneItems = Array.isArray(scene.items) ? scene.items : [];
        Socket.broadcast('world:itemDropped', sceneItems, world.getScenePlayers(scene.id));

        console.log(`${item.id} is respawning...`);
      });
    });
  }

  /**
   * Is the item already placed in the map waiting to be picked up?
   *
   * @param {object} item The item we are checking
   *
   * @returns {boolean}
   */
  static itemAlreadyPlaced(item, sceneId = world.defaultTownId) {
    const time = new Date();
    const scene = world.getScene(sceneId);
    const items = scene && Array.isArray(scene.items) ? scene.items : world.items;

    return time > item.willRespawnIn
      && items.find(i => i.respawn && i.x === item.x && i.y === item.y);
  }

  /**
   * Take a string like '4hr 5m 1s' and get the numerical values
   *
   * @param {string} time The time for the time to respwan in
   * @param {string} part The part of time we are parsing
   *
   * @returns {integer}
   */
  static parseTime(time, part) {
    const found = time.split(' ').filter(t => t.endsWith(part)).map(t => Number(t.slice(0, -1)));
    if (found.length) {
      return found[0];
    }

    return false;
  }

  /**
   * Calculate the time it will take to respawn this tile
   *
   * @param {string} respawnTime Time in short notation (eg: '1hr 4m 18s')
   * @returns {integer}
   */
  static calculateRespawnTime(respawnTime) {
    // MOVE TO OBJECT ENGINE CLASS AND EXTEND FROM HERE?
    const pickedUpAt = new Date();
    const respawnsIn = respawnTime;

    const add = {
      hours: Item.parseTime(respawnsIn, 'h'),
      minutes: Item.parseTime(respawnsIn, 'm'),
      seconds: Item.parseTime(respawnsIn, 's'),
    };

    let result = pickedUpAt;
    if (typeof add.hours === 'number') result = addHours(result, add.hours);
    if (typeof add.minutes === 'number') result = addMinutes(result, add.minutes);
    if (typeof add.seconds === 'number') result = addSeconds(result, add.seconds);

    return result;
  }
}

export default Item;
