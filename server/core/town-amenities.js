export const MAIN_TOWN_FOUNTAIN = Object.freeze({ x: 38, y: 115 });

export const isMainTownFountain = (scene, coordinates) => (
  scene?.type === 'town'
  && coordinates?.x === MAIN_TOWN_FOUNTAIN.x
  && coordinates?.y === MAIN_TOWN_FOUNTAIN.y
);

export default { MAIN_TOWN_FOUNTAIN, isMainTownFountain };
