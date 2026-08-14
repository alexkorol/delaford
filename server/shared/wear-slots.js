// Physical equipment seats a scion can wear into, and how an item's base
// `slot` maps onto them. Most slots are 1:1, but rings have two seats so a
// scion can wear two rings at once. Kept in one shared module so the server
// equip pipeline and the client paper-doll agree on the rules.

export const WEAR_SLOTS = Object.freeze([
  'right_hand',
  'left_hand',
  'armor',
  'head',
  'back',
  'belt',
  'gloves',
  'feet',
  'ring',
  'ring2',
  'necklace',
]);

// Base item slot -> the physical seats it may occupy, in fill order. Anything
// not listed here maps 1:1 to a seat of the same id.
const SLOT_GROUPS = Object.freeze({
  ring: ['ring', 'ring2'],
});

export const physicalSlotsForBase = (baseSlot) => {
  if (!baseSlot) return [];
  return SLOT_GROUPS[baseSlot] || [baseSlot];
};

export const baseSlotForPhysical = (physicalSlot) => {
  const match = Object.entries(SLOT_GROUPS).find(([, seats]) => seats.includes(physicalSlot));
  return match ? match[0] : physicalSlot;
};

export const canItemUseSlot = (baseSlot, physicalSlot) => (
  physicalSlotsForBase(baseSlot).includes(physicalSlot)
);

// Choose which physical seat an item should take: honour an explicit, valid
// request; otherwise the first empty seat; otherwise the last one (a swap).
export const resolveEquipSlot = (wear = {}, baseSlot, preferredSlot = null) => {
  const seats = physicalSlotsForBase(baseSlot);
  if (!seats.length) return baseSlot;
  if (preferredSlot && seats.includes(preferredSlot)) return preferredSlot;
  const empty = seats.find(seat => !wear || !wear[seat]);
  return empty || seats[seats.length - 1];
};
