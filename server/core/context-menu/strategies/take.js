import UI from '#shared/ui.js';
import Query from '#server/core/data/query.js';

const takeStrategy = {
  actionIds: ['player:take'],
  description: 'Pick up an item from the ground.',
  canExecute: ({ groundItems }) => Array.isArray(groundItems) && groundItems.length > 0,
  execute: ({ action, groundItems, menu }) => {
    if (!Array.isArray(groundItems)) {
      return [];
    }

    return groundItems.reduce((accumulator, item) => {
      if (item.shopDisplay) return accumulator;
      const baseData = Query.getItemData(item.id) || {};
      const combined = { ...baseData, ...item };
      const {
        actions, name, x, y, id, uuid, timestamp,
      } = combined;

      if (!menu.canDoAction(actions, action)) {
        return accumulator;
      }

      const color = UI.getContextSubjectColor(item.context);
      accumulator.push({
        label: `${action.name} <span style='color:${color}'>${name}</span>`,
        action,
        type: 'item',
        at: { x, y },
        id,
        uuid,
        timestamp,
      });

      return accumulator;
    }, []);
  },
};

export default takeStrategy;
