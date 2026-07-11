import bankActionStrategy from './bank-action.js';
import cancelStrategy from './cancel.js';
import drinkFountainStrategy from './drink-fountain.js';
import equipStrategy from './equip.js';
import examineStrategy from './examine.js';
import inventoryDropStrategy from './inventory-drop.js';
import miningRockStrategy from './mining-rock.js';
import openScreenStrategy from './open-screen.js';
import resourcePaneStrategy from './resource-pane.js';
import smeltActionStrategy from './smelt-action.js';
import takeStrategy from './take.js';
import talkStrategy from './talk.js';
import tradeActionStrategy from './trade-action.js';
import unequipStrategy from './unequip.js';
import walkHereStrategy from './walk-here.js';
import vesselforgeBrandStrategy from './vesselforge-brand.js';

const strategies = [
  cancelStrategy,
  drinkFountainStrategy,
  walkHereStrategy,
  inventoryDropStrategy,
  takeStrategy,
  talkStrategy,
  equipStrategy,
  unequipStrategy,
  examineStrategy,
  miningRockStrategy,
  smeltActionStrategy,
  resourcePaneStrategy,
  openScreenStrategy,
  bankActionStrategy,
  tradeActionStrategy,
  vesselforgeBrandStrategy,
];

const registry = new Map();

strategies.forEach((strategy) => {
  const { actionIds } = strategy;
  if (!Array.isArray(actionIds)) {
    return;
  }

  actionIds.forEach((actionId) => {
    registry.set(actionId, strategy);
  });
});

const actionCatalog = strategies.reduce((catalog, strategy) => {
  const description = strategy.description || '';
  if (!Array.isArray(strategy.actionIds)) {
    return catalog;
  }

  strategy.actionIds.forEach((actionId) => {
    catalog[actionId] = description;
  });

  return catalog;
}, {});

const getStrategy = actionId => registry.get(actionId);

export { strategies as contextMenuStrategies, actionCatalog, getStrategy };
export default registry;
