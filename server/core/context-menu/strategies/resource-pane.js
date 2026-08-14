import UI from '#shared/ui.js';

const resourcePaneStrategy = {
  actionIds: [
    'player:resource:goldenplaque:push',
  ],
  description: 'Open or interact with specialised resource panes.',
  canExecute: ({ foregroundData, menu, action }) => (
    Boolean(foregroundData)
      && menu.canDoAction(foregroundData, action)
  ),
  execute: ({ action, foregroundData, coordinates, menu }) => {
    if (!foregroundData) {
      return [];
    }

    const color = UI.getContextSubjectColor(foregroundData.context);
    return [{
      label: `${action.name} <span style='color:${color}'>${foregroundData.name}</span>`,
      action,
      type: 'object',
      at: {
        x: coordinates.viewport.x,
        y: coordinates.viewport.y,
      },
      id: foregroundData.id,
      tile: menu.tile,
    }];
  },
};

export default resourcePaneStrategy;
