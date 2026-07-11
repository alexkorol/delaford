import world from '#server/core/world.js';

const BRAND_COST = 100;

const vesselforgeBrandStrategy = {
  actionIds: ['player:vesselforge:add-brand'],
  description: 'Add a random brand to a vessel item at the Delaford forge.',
  canExecute: ({ menu, dynamicItem }) => (
    menu.isFromInventory()
    && menu.scene?.id === world.defaultTownId
    && Boolean(dynamicItem?.vessel?.item)
    && dynamicItem.vessel.item.patience > 0
    && (
      dynamicItem.vessel.item.brands.length
      + dynamicItem.vessel.item.bonds.length
      + dynamicItem.vessel.item.trophies.length
      + dynamicItem.vessel.item.scars
    ) < dynamicItem.vessel.item.vessel
  ),
  execute: ({ action, dynamicItem, miscData }) => [{
    label: `Add a random brand (${BRAND_COST} coins)`,
    action,
    type: 'item',
    miscData,
    uuid: dynamicItem.uuid,
    id: dynamicItem.id,
  }],
};

export { BRAND_COST };
export default vesselforgeBrandStrategy;
