import Query from '#server/core/data/query.js';
import Player from '#server/core/player.js';
import Socket from '#server/socket.js';
import Authentication from '#server/player/authentication.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import wagonService from '#server/core/services/wagon-service.js';
import world from '#server/core/world.js';
import { sanitiseChronicleName } from '#shared/html.js';

const clone = value => JSON.parse(JSON.stringify(value));

const serialiseWear = (wear = {}) => Object.fromEntries(
  Object.entries(wear)
    // Keep retired quiver data from being written back by stale Chronicle saves.
    .filter(([slot]) => slot !== 'arrows')
    .map(([slot, item]) => [slot, item && typeof item === 'object' ? clone(item) : item]),
);

const cleanInventory = (slots = []) => slots
  .filter(item => item && item.id)
  .map((item) => {
    const copy = clone(item);
    delete copy.x;
    delete copy.y;
    delete copy.timestamp;
    delete copy.respawn;
    delete copy.respawnIn;
    delete copy.willRespawnIn;
    return copy;
  });

const surfacePosition = (player) => {
  if (!String(player.sceneId || '').startsWith('instance')) {
    return { x: player.x, y: player.y };
  }
  if (player.preInstancePosition
    && Number.isFinite(player.preInstancePosition.x)
    && Number.isFinite(player.preInstancePosition.y)) {
    return { x: player.preInstancePosition.x, y: player.preInstancePosition.y };
  }
  return { x: 38, y: 115 };
};

export const buildScionSnapshot = player => ({
  savedAt: Date.now(),
  ...surfacePosition(player),
  level: player.level,
  skills: clone(player.skills || {}),
  wear: serialiseWear(player.wear),
  inventory: cleanInventory(player.inventory?.slots || []),
  bank: clone(Array.isArray(player.bank) ? player.bank : []),
  passiveTree: clone(player.passiveTree || null),
  quests: clone(player.quests || {}),
  questPoints: player.questPoints || 0,
  lifecycle: clone(player.stats?.lifecycle || { mode: 'hard', state: 'alive' }),
  resources: clone(player.stats?.resources || {}),
});

const isNotableGear = (item) => {
  if (!item || !item.id || item.stackable) return false;
  const base = Query.getItemData(item.id) || {};
  return (item.type || base.type) === 'jewelry'
    || Boolean(item.vessel)
    || Boolean(item.affixes?.brand || item.affixes?.bond);
};

const prepareRelic = (item, player) => {
  const relic = clone(item);
  delete relic.slot;
  delete relic.position;
  delete relic.boundTo;
  relic.legacy = {
    sourceScionId: player.scionId,
    sourceScionName: player.username,
    houseId: player.houseId,
    houseName: player.houseName,
  };
  relic.displayName = relic.displayName || relic.name || relic.baseName || relic.id;
  return relic;
};

export const collectNotableGear = player => {
  const inventory = player.inventory?.slots || [];
  const worn = Object.values(player.wear || {}).filter(Boolean);
  return [...inventory, ...worn]
    .filter(isNotableGear)
    .map(item => prepareRelic(item, player));
};

export const sendChronicleState = (ws, extra = {}) => {
  if (!ws?.chronicleAuth?.accountId) return null;
  const chronicle = chroniclesRepository.getChronicle(ws.chronicleAuth.accountId);
  Socket.emit('chronicles:state', {
    player: { socket_id: ws.id },
    chronicle,
    ...extra,
  });
  return chronicle;
};

export const ensureQuickGuestScion = (accountId) => {
  let chronicle = chroniclesRepository.getChronicle(accountId);
  let house = chronicle.houses.find(entry => entry.id === chronicle.activeHouseId) || chronicle.houses[0];
  const suffix = String(accountId).replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'guest';
  if (!house) {
    const founded = chroniclesRepository.foundHouse(accountId, `Wayfarers ${suffix}`);
    if (!founded.ok) return null;
    chronicle = founded.chronicle;
    house = chronicle.houses.find(entry => entry.id === chronicle.activeHouseId) || chronicle.houses[0];
  }
  let scion = house.scions[0];
  if (!scion) {
    const created = chroniclesRepository.createScion(accountId, house.id, `Wanderer ${suffix}`);
    if (!created.ok) return null;
    scion = created.chronicle.houses.find(entry => entry.id === house.id)?.scions
      .find(entry => entry.id === created.scionId);
  }
  return scion || null;
};

const replaceScionSession = async (scionId, socketId) => {
  const existing = world.players.find(player => player.scionId === scionId && player.socket_id !== socketId);
  if (!existing) return;
  try {
    await existing.update({ force: true });
  } catch (error) {
    console.warn(`[chronicles] Failed to flush replaced scion ${scionId}:`, error.message);
  }
  Socket.emit('player:session-replaced', { player: { socket_id: existing.socket_id } });
  const oldWs = world.clients.find(client => client.id === existing.socket_id);
  world.removePlayer(existing);
  if (oldWs) {
    setTimeout(() => {
      try { oldWs.close(); } catch { /* already closed */ }
    }, 150);
  }
};

export const beginScionSession = async (ws, scionId, { resume = false, quickStart = false } = {}) => {
  const auth = ws?.chronicleAuth;
  if (!auth?.accountId) return { ok: false, reason: 'Authenticate before setting out.' };
  const ownedScion = chroniclesRepository.getLivingScion(auth.accountId, scionId);
  if (!ownedScion) return { ok: false, reason: 'That scion is no longer among the living.' };

  await replaceScionSession(ownedScion.id, ws.id);
  // The replaced session flushes immediately above; re-read after that write
  // so its last loot/position/tree is present in the incoming Player.
  const scion = chroniclesRepository.getLivingScion(auth.accountId, scionId);
  if (!scion) return { ok: false, reason: 'That scion is no longer among the living.' };
  const sameSocketPlayer = world.players.find(player => player.socket_id === ws.id);
  if (sameSocketPlayer) world.removePlayer(sameSocketPlayer);

  const saved = scion.snapshot && typeof scion.snapshot === 'object' ? scion.snapshot : {};
  const savedLifecycle = saved.lifecycle && typeof saved.lifecycle === 'object' ? saved.lifecycle : {};
  const lifecycle = {
    ...savedLifecycle,
    mode: 'hard',
    state: ['alive', 'cheat-death'].includes(savedLifecycle.state) ? savedLifecycle.state : 'alive',
    respawn: {
      ...(savedLifecycle.respawn || {}),
      pending: false,
      at: null,
    },
  };
  const data = {
    ...clone(auth.profile),
    ...saved,
    username: scion.name,
    uuid: scion.id,
    lifecycle,
    sceneId: world.defaultTownId,
  };
  // Logging in is the wagon rolling in for the day's market: every scion
  // enters the world at their House's pitch on the Crossroads plaza. This
  // also keeps stale saved coordinates from older town layouts harmless.
  const wagonSpawn = wagonService.spawnPointFor(scion.houseId, scion.houseName);
  data.x = wagonSpawn.x;
  data.y = wagonSpawn.y;
  const player = new Player(data, auth.token, ws.id);
  player.accountId = auth.accountId;
  player.houseId = scion.houseId;
  player.houseName = scion.houseName;
  player.scionId = scion.id;
  player.isGuest = auth.isGuest;
  player.quickStart = quickStart;
  player.chronicleRun = resume
    ? chroniclesRepository.getChronicle(auth.accountId).runCount
    : chroniclesRepository.beginRun(auth.accountId, scion.houseId);
  Authentication.addPlayer(player);
  // First set-out of the day: the road purse goes straight into the ledger.
  wagonService.claimDailyArrival(player);
  return { ok: true, player };
};

export const saveLivingScion = (player) => {
  if (!player?.scionId || !player.accountId || player.permadeathCommitted) return null;
  return chroniclesRepository.saveScionSnapshot(
    player.accountId,
    player.scionId,
    buildScionSnapshot(player),
  );
};

export const entombFallenScion = (player, { cause = 'Fell in battle' } = {}) => {
  if (!player?.scionId || player.permadeathCommitted) return null;
  const result = chroniclesRepository.entombScion({
    accountId: player.accountId,
    houseId: player.houseId,
    scionId: player.scionId,
    level: player.level,
    cause,
    relicItems: collectNotableGear(player),
    deeds: [],
  });
  if (!result) return null;
  player.permadeathCommitted = true;

  const payload = {
    fallen: result.fallen,
    relicCount: result.relicCount,
    eligibleRun: result.eligibleRun,
    chronicle: result.chronicle,
  };
  Socket.emit('chronicles:scion-fallen', {
    player: { socket_id: player.socket_id },
    ...payload,
  });
  const witnesses = world.getScenePlayers(player.sceneId)
    .filter(witness => witness.socket_id !== player.socket_id);
  witnesses.forEach((witness) => {
    if (witness.accountId) {
      chroniclesRepository.grantHouseRelicAccess(witness.accountId, player.houseId, 3);
    }
  });
  if (witnesses.length) {
    Socket.broadcast('chronicles:scion-witnessed', {
      fallen: result.fallen,
      relicCount: result.relicCount,
    }, witnesses);
  }
  return payload;
};

export const drawCirculatingRelic = (players = []) => {
  const record = chroniclesRepository.drawEligibleRelic(players.map(player => player?.accountId));
  if (!record?.item) return null;
  // Legacy chronicles can predate scion-name validation; neutralise any
  // markup metacharacters before the origin name is composed into relic
  // titles that flow into v-html context-menu labels.
  record.originScionName = sanitiseChronicleName(record.originScionName, 'a nameless scion');
  const item = clone(record.item);
  delete item.boundTo;
  item.legacyRelicId = record.id;
  item.legacy = {
    ...(item.legacy || {}),
    sourceScionId: record.sourceScionId,
    sourceScionName: record.originScionName,
  };
  const baseName = item.displayName || item.name || item.baseName || item.id;
  item.name = `${baseName} — Relic of ${record.originScionName}`;
  item.displayName = item.name;
  return item;
};

export const claimCirculatingRelic = (item, player) => {
  if (!item?.legacyRelicId) return false;
  return chroniclesRepository.claimRelic(item.legacyRelicId, player);
};

export default {
  beginScionSession,
  buildScionSnapshot,
  claimCirculatingRelic,
  collectNotableGear,
  drawCirculatingRelic,
  entombFallenScion,
  ensureQuickGuestScion,
  saveLivingScion,
  sendChronicleState,
};
