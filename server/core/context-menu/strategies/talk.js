import UI from '#shared/ui.js';

const talkStrategy = {
  actionIds: ['player:npc:talk'],
  description: 'Speak with a nearby quest guide.',
  canExecute: ({ menu }) => menu.isFromGameCanvas(),
  execute: ({ action, menu, npcs }) => (npcs || [])
    .filter(npc => menu.canDoAction(npc.actions, action))
    .map(npc => ({
      label: `${action.name} <span style='color:${UI.getContextSubjectColor(npc.context)}'>${npc.name}</span>`,
      action,
      type: 'npc',
      id: npc.id,
    })),
};

export default talkStrategy;
