import UI from '#shared/ui.js';
import Query from '#server/core/data/query.js';
import { escapeHtml } from '#shared/html.js';

const examineStrategy = {
  actionIds: ['player:examine', 'player:screen:npc:trade:action:value'],
  description: 'Inspect items, NPCs, or foreground objects for more information.',
  canExecute: ({ menu }) => menu.isFromGameCanvas() || menu.isFromInventory(),
  execute: ({
    action,
    menu,
    foregroundData,
    npcs,
    groundItems,
    dynamicItem,
    selectedItemData,
  }) => {
    const results = [];

    if (menu.isFromGameCanvas()) {
      if (foregroundData && menu.canDoAction(foregroundData.actions, action)) {
        const fgColor = UI.getContextSubjectColor(foregroundData.context);
        results.push({
          label: `${action.name} <span style='color:${fgColor}'>${escapeHtml(foregroundData.name)}</span>`,
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
            label: `${action.name} <span style='color:${color}'>${escapeHtml(npc.name)}</span>`,
            action,
            examine: npc.examine,
            type: 'npc',
            id: npc.id,
          });
        });
      }

      if (Array.isArray(groundItems)) {
        groundItems.forEach((item) => {
          const combined = { ...(Query.getItemData(item.id) || {}), ...item };
          const {
            name, examine, id, actions, timestamp,
          } = combined;

          if (!menu.canDoAction(actions, action)) {
            return;
          }

          const color = UI.getContextSubjectColor(item.context);
          results.push({
            label: `Examine <span style='color:${color}'>${escapeHtml(name)}</span>`,
            action,
            examine,
            type: 'item',
            id,
            timestamp,
          });
        });
      }
    }

    if (menu.isFromInventory() && selectedItemData) {
      const color = UI.getContextSubjectColor(selectedItemData.context);
      const displayName = dynamicItem && dynamicItem.name ? dynamicItem.name : selectedItemData.name;
      const displayExamine = dynamicItem && dynamicItem.examine ? dynamicItem.examine : selectedItemData.examine;
      const referenceId = dynamicItem && dynamicItem.id ? dynamicItem.id : selectedItemData.id;

      if (menu.canDoAction(selectedItemData.actions, action)) {
        results.push({
          label: `${action.name} <span style='color:${color}'>${escapeHtml(displayName)}</span>`,
          action,
          examine: displayExamine,
          type: 'item',
          id: referenceId,
        });
      }
    }

    return results;
  },
};

export default examineStrategy;
