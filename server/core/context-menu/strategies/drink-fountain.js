import { isMainTownFountain } from '#server/core/town-amenities.js';

const drinkFountainStrategy = {
  actionIds: ['player:fountain:drink'],
  description: 'Drink from the Crossroads fountain to restore health.',
  canExecute: ({ menu, coordinates }) => (
    menu.isFromGameCanvas()
    && isMainTownFountain(menu.scene, coordinates.map)
  ),
  execute: ({ action, coordinates }) => [{
    label: 'Drink from the Crossroads Fountain',
    action,
    type: 'fountain',
    id: 'crossroads-fountain',
    at: {
      x: coordinates.viewport.x,
      y: coordinates.viewport.y,
    },
  }],
};

export default drinkFountainStrategy;
