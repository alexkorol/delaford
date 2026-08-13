import UI from '@shared/ui.js';

export const buildInventoryContextMenuRequest = (event, item) => {
  const target = event?.currentTarget || event?.target || null;
  return {
    event,
    coordinates: UI.getViewportCoordinates(event),
    slot: item?.slot,
    target,
  };
};

export default buildInventoryContextMenuRequest;
