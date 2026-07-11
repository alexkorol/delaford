import UI from '#shared/ui.js';
import Query from '#server/core/data/query.js';

const openScreenStrategy = {
  actionIds: ['player:screen:bank', 'player:screen:npc:trade', 'player:screen:shop-display'],
  description: 'Open banking or trading panes from world interactions.',
  canExecute: ({ menu, foregroundData, npcs, groundItems }) => (
    menu.isFromGameCanvas()
      && (Boolean(foregroundData)
        || (Array.isArray(npcs) && npcs.length > 0)
        || (Array.isArray(groundItems) && groundItems.some(item => item.shopDisplay)))
  ),
  execute: ({ action, menu, foregroundData, npcs, groundItems }) => {
    if (!menu.isFromGameCanvas()) {
      return [];
    }

    const results = [];

    if (foregroundData && menu.canDoAction(foregroundData.actions, action)) {
      const fgColor = UI.getContextSubjectColor(foregroundData.context);
      results.push({
        label: `${action.name} <span style='color:${fgColor}'>${foregroundData.name}</span>`,
        action,
        examine: foregroundData.examine,
        type: 'foreground',
        id: foregroundData.id,
      });
    }

    if (Array.isArray(npcs)) {
      npcs.forEach((npc) => {
        if (!menu.canDoAction(npc.actions, action)) {
          return;
        }
        const color = UI.getContextSubjectColor(npc.context);
        results.push({
          label: `${action.name} <span style='color:${color}'>${npc.name}</span>`,
          action,
          examine: npc.examine,
          type: 'npc',
          id: npc.id,
        });
      });
    }

    if (action.actionId === 'player:screen:shop-display' && Array.isArray(groundItems)) {
      groundItems.filter(item => item.shopDisplay && item.shopNpcId).forEach((item) => {
        const itemData = Query.getItemData(item.id) || item;
        const shop = menu.shops.find(entry => entry.npcId === item.shopNpcId);
        const color = UI.getContextSubjectColor('item');
        results.push({
          label: `Browse <span style='color:${color}'>${itemData.name || item.id}</span>${shop ? ` at ${shop.name}` : ''}`,
          action,
          type: 'shop-display',
          id: item.shopNpcId,
          shopItemId: item.id,
        });
      });
    }

    return results;
  },
};

export default openScreenStrategy;
