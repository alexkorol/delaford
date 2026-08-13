import Inventory from '#server/core/utilities/common/player/inventory.js';
import { wearableItems } from '#server/core/data/items/index.js';
import ItemFactory from '#server/core/items/factory.js';

export const constructWear = (data) => {
  const wearData = { ...data };
  delete wearData.arrows;

  Object.keys(wearData).forEach((property) => {
    if (!Object.prototype.hasOwnProperty.call(wearData, property)) {
      return;
    }

    if (wearData[property] !== null) {
      const saved = wearData[property];
      const id = typeof saved === 'object' ? saved.id : saved;
      const definition = wearableItems.find(db => db.id === id);
      // A saved character can reference an item id that no longer exists in the
      // database (e.g. after an item-pack rename). Clear the slot instead of
      // crashing the whole player load.
      if (!definition) {
        wearData[property] = null;
        return;
      }
      const hydrated = typeof saved === 'object'
        ? ItemFactory.adoptExisting({ ...definition, ...saved }, { baseItem: definition })
        : ItemFactory.createById(id, { includeAffixes: false });
      if (!hydrated) {
        wearData[property] = null;
        return;
      }
      delete hydrated.context;
      delete hydrated.slot;
      hydrated.equipSlot = definition.slot;
      hydrated.slotType = definition.slot;
      wearData[property] = hydrated;
    }
  });

  return wearData;
};

const createPlayerInventoryManager = (player) => ({
  initializeInventory: (inventoryData, socketId) => new Inventory(inventoryData, socketId),
});

export default createPlayerInventoryManager;
