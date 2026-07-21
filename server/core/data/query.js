import { general, wearableItems, smithing } from '#server/core/data/items/index.js';

import { foregroundObjects } from '#server/core/data/foreground/index.js';

const firstById = (items) => {
  const index = new globalThis.Map();
  items.forEach((item) => {
    // Array.find returned the first duplicate. Preserve that behavior rather
    // than letting Map's normal last-write-wins semantics change catalogue
    // resolution.
    if (!index.has(item.id)) {
      index.set(item.id, item);
    }
  });
  return index;
};

const foregroundById = firstById(foregroundObjects);
const itemById = firstById([...wearableItems, ...general, ...smithing]);

class Query {
  /**
   * Obtains the full information of a foreground object by its ID
   *
   * @param {integer} id The ID of the foreground item
   * @returns {object}
   */
  static getForegroundData(id) {
    const item = foregroundById.get(id);
    if (!item) return undefined;
    return { ...item, context: 'action' };
  }

  /**
   * Obtain the full information of an item by its ID on the server-side
   *
   * @param {integer} id The ID of the item
   * @returns {object}
   */
  static getItemData(id) {
    const item = itemById.get(id);
    if (!item) return undefined;
    const clone = JSON.parse(JSON.stringify(item));
    clone.context = 'item';
    return clone;
  }
}

export default Query;
