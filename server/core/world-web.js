/**
 * The world web: four roads out of the Crossroads, each a branching chain of
 * procedurally named zone nodes. Node identity (name, art, layout, branching)
 * is deterministic per House — hash(houseId, road, tier, index) — so a House's
 * chart survives restarts with no stored state beyond which Wardens are dead.
 *
 * Lore contract (docs/crossroads-world-web.md): walked ground holds; forsaken
 * ground weathers. Tier 1 of every road is charted from the start; a node's
 * children unlock when its Warden dies.
 */

// Terroir: each road pairs an art template pool with the layouts it favours.
// Templates/layouts must exist in map.js (TEMPLATE_THEMES / LAYOUT_RECIPES).
export const ROADS = [
  {
    id: 'tin',
    name: 'The Tin Road',
    direction: 'north',
    blurb: 'North into the old quarry country: workings, scree, and things that mind the stone.',
    pairs: [
      ['dungeon', 'warren'],
      ['dungeon', 'gauntlet'],
      ['wilds', 'clearings'],
      ['dungeon', 'clearings'],
    ],
  },
  {
    id: 'salt',
    name: 'The Salt Road',
    direction: 'east',
    blurb: 'East through the fens toward a sea nobody has confirmed in living memory.',
    pairs: [
      ['marsh', 'clearings'],
      ['grove', 'clearings'],
      ['marsh', 'gauntlet'],
      ['grove', 'warren'],
    ],
  },
  {
    id: 'chalk',
    name: 'The Chalk Road',
    direction: 'south',
    blurb: 'South over the downs and their graves. The dead were the only ones who never moved.',
    pairs: [
      ['crypt', 'warren'],
      ['crypt', 'gauntlet'],
      ['wilds', 'clearings'],
      ['crypt', 'clearings'],
    ],
  },
  {
    id: 'copper',
    name: 'The Copper Road',
    direction: 'west',
    blurb: 'West into the burnt hills that gave the world its verdigris.',
    pairs: [
      ['volcanic', 'warren'],
      ['sand', 'clearings'],
      ['volcanic', 'gauntlet'],
      ['sand', 'warren'],
    ],
  },
];

const ROAD_INDEX = new Map(ROADS.map(road => [road.id, road]));

// Toponym tables. Compounds assemble first+second ("Sedgemere", "Hoarfell");
// standalone names are used whole, article and all. Old working words on
// purpose — delf (quarry), carr (wet wood), hythe (landing), kist (burial
// chest) — because these roads were trade roads before they were anything.
const NAMES = {
  tin: {
    firsts: ['Hoar', 'Grey', 'Whet', 'Stone', 'Cold', 'Tor', 'Fell', 'Crag', 'Scree', 'Adit', 'Delf', 'Grit'],
    seconds: ['fell', 'moor', 'delf', 'gate', 'cleft', 'howe', 'scarp', 'shelf', 'crag', 'stang'],
    standalone: ['The Old Workings', 'Whetstone Delf', 'The Dry Adit', 'Millstone Howe', 'The Broken Stair', 'The Counting Cairns'],
  },
  salt: {
    firsts: ['Eel', 'Sedge', 'Rush', 'Weir', 'Mere', 'Fen', 'Reed', 'Carr', 'Osier', 'Slough'],
    seconds: ['fen', 'mere', 'carr', 'slough', 'weir', 'holm', 'wash', 'hythe', 'eyot', 'dyke'],
    standalone: ['The Drowned Meadow', 'The Saltings', 'The Eel Runs', 'Wrackmoor', 'The Sunken Causey', 'The Tithe Pools'],
  },
  chalk: {
    firsts: ['Barrow', 'Chalk', 'Bone', 'Lych', 'Candle', 'Bell', 'Grave', 'Kist', 'Dust', 'Pall'],
    seconds: ['down', 'barrow', 'field', 'kirk', 'garth', 'vault', 'howe', 'cross', 'acre', 'stead'],
    standalone: ['The Nine Graves', 'Lychfield', 'The Undercroft', "Kings' Rest", 'The Chalk Giants', 'The Quiet Acre'],
  },
  copper: {
    firsts: ['Ash', 'Cinder', 'Ember', 'Slag', 'Brass', 'Copper', 'Scoria', 'Char', 'Forge', 'Smoke'],
    seconds: ['hill', 'works', 'field', 'gate', 'hollow', 'kiln', 'heath', 'brink', 'barrens', 'reach'],
    standalone: ['The Green Fire', 'Slagside', 'The Cooling Beds', 'Old Bellows', 'The Glass Desert', 'The Burnt Ledger'],
  },
};

// Small deterministic string hash + PRNG (xmur3 / mulberry32) so node
// identity needs no storage and agrees across restarts.
const hashString = (input) => {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
};

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const nodeRng = (houseId, roadId, tier, index, salt = '') => (
  mulberry32(hashString(`${houseId}|${roadId}|${tier}|${index}|${salt}`))
);

const pick = (rng, pool) => pool[Math.floor(rng() * pool.length)];

const MAX_TIER_WIDTH = 3;

// How many nodes a tier holds: a deterministic walk that widens and narrows
// (1..3) so roads branch and pinch back instead of fanning out forever.
const tierWidth = (houseId, roadId, tier) => {
  if (tier <= 1) return 1;
  const previous = tierWidth(houseId, roadId, tier - 1);
  const rng = nodeRng(houseId, roadId, tier, 0, 'width');
  const step = [-1, 0, 0, 1][Math.floor(rng() * 4)];
  return Math.max(1, Math.min(MAX_TIER_WIDTH, previous + step));
};

const composeName = (rng, roadId, used) => {
  const tables = NAMES[roadId];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const useStandalone = rng() < 0.22;
    const name = useStandalone
      ? pick(rng, tables.standalone)
      : `${pick(rng, tables.firsts)}${pick(rng, tables.seconds)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Exhausted variety at extreme depths: qualify the compound instead of
  // repeating it bare.
  const fallback = `${pick(rng, tables.firsts)}${pick(rng, tables.seconds)} Deep`;
  used.add(fallback);
  return fallback;
};

export const nodeId = (roadId, tier, index) => `${roadId}:${tier}:${index}`;

export const parseNodeId = (id) => {
  const [roadId, tier, index] = String(id || '').split(':');
  const road = ROAD_INDEX.get(roadId);
  const tierNumber = Number.parseInt(tier, 10);
  const indexNumber = Number.parseInt(index, 10);
  if (!road || !Number.isInteger(tierNumber) || tierNumber < 1
    || !Number.isInteger(indexNumber) || indexNumber < 0) {
    return null;
  }
  return { roadId, tier: tierNumber, index: indexNumber };
};

const levelHintForTier = (tier) => {
  const floor = 1 + ((tier - 1) * 2);
  return `${floor}–${floor + 4}`;
};

/**
 * Generate a road's nodes from tier 1 through maxTier, deterministically.
 * Names are deduplicated in tier order so the same House always reads the
 * same chart.
 */
export const getRoadNodes = (houseId, roadId, maxTier) => {
  const road = ROAD_INDEX.get(roadId);
  if (!road || !houseId) return [];

  const tiers = Math.max(1, Math.floor(maxTier || 1));
  const usedNames = new Set();
  const nodes = [];
  let previousTier = [];

  for (let tier = 1; tier <= tiers; tier += 1) {
    const width = tierWidth(houseId, roadId, tier);
    const currentTier = [];
    for (let index = 0; index < width; index += 1) {
      const rng = nodeRng(houseId, roadId, tier, index);
      const [template, layout] = pick(rng, road.pairs);
      const name = composeName(rng, roadId, usedNames);
      // Spread children across the previous tier so every node has exactly
      // one parent and gates never exceed the map's onward-gate pair.
      const parent = previousTier.length
        ? previousTier[Math.min(
          previousTier.length - 1,
          Math.floor((index * previousTier.length) / width),
        )]
        : null;
      const node = {
        id: nodeId(roadId, tier, index),
        roadId,
        roadName: road.name,
        tier,
        index,
        name,
        template,
        layout,
        levelHint: levelHintForTier(tier),
        parentId: parent ? parent.id : null,
        childIds: [],
        wardenName: `Warden of ${name}`,
      };
      if (parent) parent.childIds.push(node.id);
      currentTier.push(node);
      nodes.push(node);
    }
    previousTier = currentTier;
  }

  return nodes;
};

export const getNode = (houseId, id) => {
  const parsed = parseNodeId(id);
  if (!parsed) return null;
  // Children live one tier deeper; generate through tier+1 so the node's
  // childIds are populated for onward gates.
  const nodes = getRoadNodes(houseId, parsed.roadId, parsed.tier + 1);
  return nodes.find(node => node.id === id) || null;
};

/**
 * Build the chart payload for one road: everything from tier 1 through the
 * deepest cleared tier plus one (the children the House has earned a look
 * at), each node flagged cleared / open / barred.
 */
export const buildChart = (houseId, roadId, clearedNodeIds = []) => {
  const road = ROAD_INDEX.get(roadId);
  if (!road) return null;

  const cleared = new Set(clearedNodeIds);
  let frontier = 1;
  cleared.forEach((id) => {
    const parsed = parseNodeId(id);
    if (parsed && parsed.roadId === roadId) {
      frontier = Math.max(frontier, parsed.tier + 1);
    }
  });

  const nodes = getRoadNodes(houseId, roadId, frontier).map((node) => {
    const isCleared = cleared.has(node.id);
    const unlocked = node.tier === 1 || cleared.has(node.parentId);
    return {
      ...node,
      status: isCleared ? 'cleared' : (unlocked ? 'open' : 'barred'),
    };
  });

  return {
    roadId,
    roadName: road.name,
    direction: road.direction,
    blurb: road.blurb,
    nodes,
  };
};

export const isNodeUnlocked = (houseId, id, clearedNodeIds = []) => {
  const node = getNode(houseId, id);
  if (!node) return false;
  if (node.tier === 1) return true;
  return new Set(clearedNodeIds).has(node.parentId);
};

export default {
  ROADS,
  buildChart,
  getNode,
  getRoadNodes,
  isNodeUnlocked,
  nodeId,
  parseNodeId,
};
