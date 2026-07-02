export const isStackableItem = (item) => {
  if (!item) {
    return false;
  }

  if (typeof item.stackable === 'boolean') {
    return item.stackable;
  }

  if (item.maxStack && item.maxStack > 1) {
    return true;
  }

  if (item.qty && item.qty > 1) {
    return true;
  }

  return false;
};

export const canStackWith = (source, target) => {
  if (!source || !target) {
    return false;
  }

  if (!isStackableItem(source) || !isStackableItem(target)) {
    return false;
  }

  if (source.id !== target.id) {
    return false;
  }
  return true;
};

export const applyStacking = (source, target) => {
  if (!canStackWith(source, target)) {
    return null;
  }

  const maxStack = target.maxStack || source.maxStack || Infinity;
  const targetQty = Number.isFinite(target.qty) ? target.qty : 1;
  const sourceQty = Number.isFinite(source.qty) ? source.qty : 1;
  if (targetQty >= maxStack) {
    return null;
  }

  const combined = targetQty + sourceQty;
  const newQty = Math.min(combined, maxStack);

  return {
    sourceRemainder: Math.max(0, combined - maxStack),
    targetQty: newQty,
  };
};
