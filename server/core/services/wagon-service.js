/**
 * House wagons at the Crossroads (docs/crossroads-world-web.md).
 *
 * The wagon IS the House: ledger-chest (treasury), stores chest (outfitting)
 * and the tilt with the House mark. While any scion of a House is on the
 * ground, its wagon stands at a pitch on the plaza ring; scions log in at
 * their House's pitch — logging in is the wagon rolling in for the day's
 * market, which is also when the road purse (daily gold) is handed over.
 */
import NPC from '#server/core/npc.js';
import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import world from '#server/core/world.js';
import { sanitiseChronicleName } from '#shared/html.js';

const WAGON_NPC_COLUMN = 7; // the robed traveller on the npc sheet

// Stores-chest stock, gated by prestige (renown) and economy (forge level).
// Item ids match the instance loot tiers, so they are known-craftable bases.
export const OUTFIT_TIERS = [
  {
    tier: 1,
    label: 'Road kit',
    requirement: null,
    unlocked: () => true,
    items: ['bronze-sword', 'bronze-dagger', 'bronze-mace', 'wooden-shield', 'leather-body', 'bronze-helm'],
  },
  {
    tier: 2,
    label: 'Proven iron',
    requirement: 'renown 500 or a level-1 House Forge',
    unlocked: house => (house.renown >= 500) || ((house.upgrades?.forge || 0) >= 1),
    items: ['iron-sword', 'iron-battleaxe', 'iron-chainmail', 'bronze-shield', 'hard-leather-body', 'shortbow'],
  },
  {
    tier: 3,
    label: 'Named steel',
    requirement: 'renown 1500 or a level-2 House Forge',
    unlocked: house => (house.renown >= 1500) || ((house.upgrades?.forge || 0) >= 2),
    items: ['steel-sword', 'steel-battleaxe', 'steel-warhammer', 'ranger-body', 'longbow', 'gold-ring'],
  },
];

const PRESTIGE_RANKS = [
  { floor: 3000, label: 'Renowned' },
  { floor: 1500, label: 'Esteemed' },
  { floor: 750, label: 'Respected' },
  { floor: 250, label: 'Road-Known' },
  { floor: 0, label: 'Unproven' },
];

export const prestigeRank = renown => PRESTIGE_RANKS
  .find(rank => (renown || 0) >= rank.floor).label;

export const wagonNpcId = houseId => `wagon-${houseId}`;

const hashString = (input) => {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
};

class WagonService {
  constructor() {
    // houseId -> { pitch: {x,y}, npcId, houseName }
    this.wagons = new Map();
  }

  pitches() {
    const town = world.getDefaultTown();
    return Array.isArray(town.metadata?.wagonPitches) ? town.metadata.wagonPitches : [];
  }

  /** Deterministic preferred pitch with linear probing over occupied ones. */
  assignPitch(houseId) {
    const pitches = this.pitches();
    if (!pitches.length) return { x: 42, y: 115 };
    const taken = new Set([...this.wagons.values()].map(w => `${w.pitch.x},${w.pitch.y}`));
    const preferred = hashString(String(houseId)) % pitches.length;
    for (let offset = 0; offset < pitches.length; offset += 1) {
      const pitch = pitches[(preferred + offset) % pitches.length];
      if (!taken.has(`${pitch.x},${pitch.y}`)) return pitch;
    }
    return pitches[preferred];
  }

  ensureWagon(houseId, houseName) {
    if (!houseId) return null;
    const existing = this.wagons.get(houseId);
    if (existing) return existing;

    const pitch = this.assignPitch(houseId);
    // Legacy House names can predate markup validation; the wagon NPC name
    // is spliced into v-html context-menu labels, so render a safe form.
    const displayName = sanitiseChronicleName(houseName, 'Wayfarer');
    const npc = new NPC({
      id: wagonNpcId(houseId),
      name: `House ${displayName} Wagon`,
      examine: `The ${displayName} tilt-canvas, the ledger-chest under the bench, and a quartermaster who knows exactly what you are owed.`,
      graphic: { row: 0, column: WAGON_NPC_COLUMN },
      actions: ['wagon', 'examine'],
      spawn: { x: pitch.x, y: pitch.y, range: 0 },
    });
    world.addNpc(npc);

    const record = { pitch, npcId: npc.id, houseName: houseName || null };
    this.wagons.set(houseId, record);
    return record;
  }

  /** Where a scion of this House enters the world: beside the wagon. */
  spawnPointFor(houseId, houseName) {
    const record = this.ensureWagon(houseId, houseName);
    if (!record) {
      const town = world.getDefaultTown();
      const fallback = town.metadata?.spawnPoints?.[0] || { x: 42, y: 115 };
      return { ...fallback };
    }
    return { x: record.pitch.x, y: record.pitch.y + 1 };
  }

  /** The wagon leaves when the House's last scion does. */
  releaseWagonIfEmpty(houseId) {
    if (!houseId || !this.wagons.has(houseId)) return;
    const stillHere = world.players.some(player => player.houseId === houseId);
    if (stillHere) return;
    const record = this.wagons.get(houseId);
    world.removeNpc(npc => npc.id === record.npcId);
    this.wagons.delete(houseId);
  }

  houseFor(player) {
    if (!player?.accountId || !player.houseId) return null;
    const chronicle = chroniclesRepository.getChronicle(player.accountId);
    return chronicle.houses.find(house => house.id === player.houseId) || null;
  }

  buildStock(house) {
    return OUTFIT_TIERS.map((tier) => {
      const unlocked = tier.unlocked(house);
      return {
        tier: tier.tier,
        label: tier.label,
        unlocked,
        requirement: tier.requirement,
        items: tier.items.map((id) => {
          const data = Query.getItemData(id) || {};
          return {
            id,
            name: data.name || id,
            price: Number.isFinite(data.price) ? data.price : 0,
            graphics: data.graphics,
          };
        }),
      };
    });
  }

  carriedGold(player) {
    return (player?.inventory?.slots || [])
      .filter(item => item?.id === 'coins')
      .reduce((total, item) => total + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);
  }

  buildWagonPayload(player) {
    const house = this.houseFor(player);
    if (!house) return null;
    return {
      house: {
        id: house.id,
        name: house.name,
        renown: house.renown,
        rank: prestigeRank(house.renown),
        treasury: house.treasury,
        upgrades: house.upgrades,
        dailyClaimAvailable: house.dailyClaimAvailable,
        dailyGold: house.dailyGold,
        heirloomCount: house.heirloomCount,
        bestDepth: house.bestDepth,
      },
      houseUpgrades: chroniclesRepository.getChronicle(player.accountId).houseUpgrades,
      stock: this.buildStock(house),
      carriedCoins: this.carriedGold(player),
    };
  }

  sendWagonScreen(player) {
    const payload = this.buildWagonPayload(player);
    if (!payload) return false;
    player.currentPane = 'wagon';
    Socket.emit('open:screen', {
      player: { socket_id: player.socket_id },
      screen: 'wagon',
      payload,
    });
    return true;
  }

  /**
   * The morning-market purse: first set-out of the day claims the daily gold
   * automatically, with the wagon-arrival framing.
   */
  claimDailyArrival(player) {
    if (!player?.accountId || !player.houseId) return null;
    const result = chroniclesRepository.claimDailyGold(player.accountId, player.houseId);
    if (!result.ok) return null;
    Socket.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text: `Your House's wagon rolls in with the dawn market. The quartermaster counts ${result.amount} gold into the ledger — the day's road purse.`,
    });
    return result;
  }
}

export const wagonService = new WagonService();

export default wagonService;
