import ItemFactory from '#server/core/items/factory.js';
import { WEAR_SLOTS } from '#server/shared/wear-slots.js';

const STARTER_SKILLS = Object.freeze([
  'attack',
  'defence',
  'fishing',
  'cooking',
]);

const cleanFriends = value => (Array.isArray(value) ? [...value] : []);

const starterInventory = (ownerId) => [
  ItemFactory.createById('bronze-dagger', {
    bindTo: ownerId,
    includeAffixes: false,
  }),
  ItemFactory.createById('coins', { quantity: 100 }),
].filter(Boolean);

/**
 * Character progression belongs to a Scion, never to the login account or
 * House. Build every new Scion from this explicit contract so adding fields to
 * an account profile cannot silently turn them into inherited character data.
 */
export const createFreshScionProfile = ({
  username = 'Wanderer',
  uuid,
  friendList = [],
} = {}) => ({
  x: 42,
  y: 115,
  username,
  uuid,
  level: 1,
  online: true,
  skills: Object.fromEntries(STARTER_SKILLS.map(id => [id, { level: 1, exp: 0 }])),
  wear: Object.fromEntries(WEAR_SLOTS.map(slot => [slot, null])),
  inventory: starterInventory(uuid),
  bank: [],
  passiveTree: null,
  quests: {},
  questPoints: 0,
  chronicles: null,
  friend_list: cleanFriends(friendList),
});

/**
 * Resume saved Scion progression when it exists; otherwise use the clean
 * starter contract. Account profile progression is intentionally excluded.
 */
export const createScionSessionProfile = ({
  accountProfile = {},
  snapshot = null,
  scion,
} = {}) => {
  const saved = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? structuredClone(snapshot)
    : {};
  const fresh = createFreshScionProfile({
    username: scion?.name,
    uuid: scion?.id,
    friendList: accountProfile.friend_list,
  });

  return {
    ...fresh,
    ...saved,
    username: scion?.name || fresh.username,
    uuid: scion?.id || fresh.uuid,
    friend_list: fresh.friend_list,
  };
};

export default createFreshScionProfile;
