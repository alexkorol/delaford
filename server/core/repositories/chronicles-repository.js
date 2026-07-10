import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_FILE = path.resolve(here, '..', '..', 'data', 'verdigris.sqlite');

const isoNow = () => new Date().toISOString();
const clone = value => JSON.parse(JSON.stringify(value));

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const validateName = (name, minimum, maximum, label) => {
  const value = String(name || '').trim();
  if (value.length < minimum) {
    return { valid: false, reason: `${label} name must be at least ${minimum} characters.` };
  }
  if (value.length > maximum) {
    return { valid: false, reason: `${label} name must be ${maximum} characters or fewer.` };
  }
  return { valid: true, value };
};

export const validateHouseName = name => validateName(name, 3, 20, 'House');
export const validateScionName = name => validateName(name, 2, 20, 'Scion');

const rowToScion = row => ({
  id: row.id,
  name: row.name,
  level: Number.isFinite(row.level) ? row.level : 1,
  bestDepth: Number.isFinite(row.best_depth) ? row.best_depth : 0,
  bornAt: row.born_at,
  diedAt: row.died_at || null,
  cause: row.cause || null,
  deeds: parseJson(row.deeds_json, []),
});

export class ChroniclesRepository {
  constructor({
    dbFile = process.env.VITEST ? ':memory:' : (process.env.CHRONICLES_DB_FILE || DEFAULT_DB_FILE),
  } = {}) {
    this.dbFile = dbFile;
    if (dbFile !== ':memory:') {
      fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    }
    this.db = new Database(dbFile);
    this.db.pragma('foreign_keys = ON');
    if (dbFile !== ':memory:') {
      try {
        this.db.pragma('journal_mode = WAL');
      } catch (error) {
        // Read-only/networked dev folders may reject WAL sidecars. SQLite's
        // default journal still gives authoritative persistence.
        console.warn(`[chronicles] WAL unavailable for ${dbFile}: ${error.message}`);
      }
    }
    this.migrate();
    // A server restart discards its in-world drops. Put unclaimed relics back
    // into circulation instead of losing a dead scion's history to a crash.
    this.db.prepare("UPDATE chronicle_relics SET status = 'circulating' WHERE status = 'dropped'").run();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chronicle_accounts (
        account_id TEXT PRIMARY KEY,
        active_house_id TEXT,
        run_count INTEGER NOT NULL DEFAULT 0,
        best_depth INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chronicle_houses (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        renown INTEGER NOT NULL DEFAULT 0,
        best_depth INTEGER NOT NULL DEFAULT 0,
        founded_at TEXT NOT NULL,
        FOREIGN KEY(account_id) REFERENCES chronicle_accounts(account_id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS chronicle_house_name_per_account
        ON chronicle_houses(account_id, name COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS chronicle_scions (
        id TEXT PRIMARY KEY,
        house_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'living',
        level INTEGER NOT NULL DEFAULT 1,
        best_depth INTEGER NOT NULL DEFAULT 0,
        born_at TEXT NOT NULL,
        died_at TEXT,
        cause TEXT,
        deeds_json TEXT NOT NULL DEFAULT '[]',
        snapshot_json TEXT,
        FOREIGN KEY(house_id) REFERENCES chronicle_houses(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS chronicle_living_scion_name_per_house
        ON chronicle_scions(house_id, name COLLATE NOCASE) WHERE status = 'living';
      CREATE TABLE IF NOT EXISTS chronicle_relics (
        id TEXT PRIMARY KEY,
        house_id TEXT NOT NULL,
        source_scion_id TEXT NOT NULL,
        origin_scion_name TEXT NOT NULL,
        item_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'circulating',
        eligible_run INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        dropped_at TEXT,
        claimed_at TEXT,
        claimed_by_scion_id TEXT,
        FOREIGN KEY(house_id) REFERENCES chronicle_houses(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS chronicle_relic_circulation
        ON chronicle_relics(status, eligible_run, created_at);
      CREATE TABLE IF NOT EXISTS chronicle_house_links (
        account_id TEXT NOT NULL,
        house_id TEXT NOT NULL,
        eligible_run INTEGER NOT NULL,
        PRIMARY KEY(account_id, house_id),
        FOREIGN KEY(account_id) REFERENCES chronicle_accounts(account_id) ON DELETE CASCADE,
        FOREIGN KEY(house_id) REFERENCES chronicle_houses(id) ON DELETE CASCADE
      );
    `);
  }

  close() {
    this.db.close();
  }

  ensureAccount(accountId) {
    const id = String(accountId || '');
    if (!id) return null;
    this.db.prepare(`
      INSERT INTO chronicle_accounts (account_id, created_at)
      VALUES (?, ?)
      ON CONFLICT(account_id) DO NOTHING
    `).run(id, isoNow());
    return id;
  }

  getChronicle(accountId) {
    const id = this.ensureAccount(accountId);
    if (!id) return { houses: [], activeHouseId: null };
    const account = this.db.prepare('SELECT * FROM chronicle_accounts WHERE account_id = ?').get(id);
    const houseRows = this.db.prepare(`
      SELECT * FROM chronicle_houses WHERE account_id = ? ORDER BY founded_at ASC
    `).all(id);
    const livingQuery = this.db.prepare(`
      SELECT * FROM chronicle_scions WHERE house_id = ? AND status = 'living' ORDER BY born_at ASC
    `);
    const cryptQuery = this.db.prepare(`
      SELECT * FROM chronicle_scions WHERE house_id = ? AND status = 'dead' ORDER BY died_at DESC
    `);
    const relicNames = this.db.prepare(`
      SELECT item_json FROM chronicle_relics WHERE source_scion_id = ? ORDER BY created_at ASC
    `);

    const houses = houseRows.map(row => ({
      id: row.id,
      name: row.name,
      renown: row.renown,
      bestDepth: row.best_depth,
      foundedAt: row.founded_at,
      scions: livingQuery.all(row.id).map(rowToScion),
      crypt: cryptQuery.all(row.id).map((scionRow) => ({
        ...rowToScion(scionRow),
        relics: relicNames.all(scionRow.id)
          .map(entry => parseJson(entry.item_json, null))
          .filter(Boolean)
          .map(item => item.displayName || item.name || item.baseName || item.id),
      })),
    }));

    const activeHouseId = houses.some(house => house.id === account.active_house_id)
      ? account.active_house_id
      : (houses[0]?.id || null);

    return {
      houses,
      activeHouseId,
      bestDepth: account.best_depth,
      runCount: account.run_count,
      leaderboard: this.getLeaderboard(),
    };
  }

  getLeaderboard(limit = 10) {
    return this.db.prepare(`
      SELECT id AS houseId, name AS houseName, best_depth AS bestDepth, renown
      FROM chronicle_houses
      WHERE best_depth > 0
      ORDER BY best_depth DESC, renown DESC, founded_at ASC
      LIMIT ?
    `).all(Math.max(1, Math.min(50, Math.floor(limit || 10))));
  }

  recordDepth(accountId, houseId, scionId, depth) {
    const value = Math.max(1, Math.floor(Number(depth) || 1));
    const scion = this.getLivingScion(accountId, scionId);
    if (!scion || scion.houseId !== houseId) return null;
    this.db.transaction(() => {
      this.db.prepare('UPDATE chronicle_scions SET best_depth = MAX(best_depth, ?) WHERE id = ?')
        .run(value, scionId);
      this.db.prepare('UPDATE chronicle_houses SET best_depth = MAX(best_depth, ?) WHERE id = ?')
        .run(value, houseId);
      this.db.prepare('UPDATE chronicle_accounts SET best_depth = MAX(best_depth, ?) WHERE account_id = ?')
        .run(value, accountId);
    })();
    return value;
  }

  foundHouse(accountId, name) {
    const validation = validateHouseName(name);
    if (!validation.valid) return { ok: false, reason: validation.reason };
    const id = this.ensureAccount(accountId);
    const houseId = randomUUID();
    const foundedAt = isoNow();
    try {
      const create = this.db.transaction(() => {
        this.db.prepare(`
          INSERT INTO chronicle_houses (id, account_id, name, founded_at)
          VALUES (?, ?, ?, ?)
        `).run(houseId, id, validation.value, foundedAt);
        this.db.prepare(`
          UPDATE chronicle_accounts SET active_house_id = ? WHERE account_id = ?
        `).run(houseId, id);
      });
      create();
      return { ok: true, houseId, chronicle: this.getChronicle(id) };
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return { ok: false, reason: 'That House name is already recorded.' };
      }
      throw error;
    }
  }

  createScion(accountId, houseId, name) {
    const validation = validateScionName(name);
    if (!validation.valid) return { ok: false, reason: validation.reason };
    const house = this.db.prepare(`
      SELECT id FROM chronicle_houses WHERE id = ? AND account_id = ?
    `).get(houseId, accountId);
    if (!house) return { ok: false, reason: 'House not found.' };
    const scionId = randomUUID();
    try {
      this.db.prepare(`
        INSERT INTO chronicle_scions (id, house_id, name, born_at)
        VALUES (?, ?, ?, ?)
      `).run(scionId, houseId, validation.value, isoNow());
      return { ok: true, scionId, chronicle: this.getChronicle(accountId) };
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return { ok: false, reason: 'A living scion already bears that name.' };
      }
      throw error;
    }
  }

  getLivingScion(accountId, scionId) {
    const row = this.db.prepare(`
      SELECT s.*, h.account_id, h.name AS house_name
      FROM chronicle_scions s
      JOIN chronicle_houses h ON h.id = s.house_id
      WHERE s.id = ? AND h.account_id = ? AND s.status = 'living'
    `).get(scionId, accountId);
    if (!row) return null;
    return {
      ...rowToScion(row),
      houseId: row.house_id,
      houseName: row.house_name,
      snapshot: parseJson(row.snapshot_json, null),
    };
  }

  beginRun(accountId, houseId) {
    const result = this.db.prepare(`
      UPDATE chronicle_accounts SET run_count = run_count + 1, active_house_id = ?
      WHERE account_id = ?
    `).run(houseId, accountId);
    if (!result.changes) return 0;
    return this.db.prepare('SELECT run_count FROM chronicle_accounts WHERE account_id = ?')
      .get(accountId).run_count;
  }

  saveScionSnapshot(accountId, scionId, snapshot) {
    const level = Number.isFinite(snapshot?.level) ? Math.max(1, Math.floor(snapshot.level)) : 1;
    const result = this.db.prepare(`
      UPDATE chronicle_scions
      SET level = ?, snapshot_json = ?
      WHERE id = ? AND status = 'living'
        AND house_id IN (SELECT id FROM chronicle_houses WHERE account_id = ?)
    `).run(level, JSON.stringify(snapshot || {}), scionId, accountId);
    return result.changes ? clone(snapshot) : null;
  }

  entombScion({ accountId, houseId, scionId, level, cause, relicItems = [], deeds = [] }) {
    const account = this.db.prepare('SELECT run_count FROM chronicle_accounts WHERE account_id = ?').get(accountId);
    const scion = this.getLivingScion(accountId, scionId);
    if (!account || !scion || scion.houseId !== houseId) return null;
    const diedAt = isoNow();
    const eligibleRun = account.run_count + 3;
    const uniqueRelics = [...new Map(relicItems
      .filter(item => item && item.id)
      .map(item => [item.uuid || `${item.id}:${item.slot ?? ''}`, item])).values()];
    const commit = this.db.transaction(() => {
      const updated = this.db.prepare(`
        UPDATE chronicle_scions
        SET status = 'dead', level = ?, died_at = ?, cause = ?, deeds_json = ?, snapshot_json = NULL
        WHERE id = ? AND status = 'living'
      `).run(Math.max(1, Math.floor(level || 1)), diedAt, cause || 'Fell in battle', JSON.stringify(deeds), scionId);
      if (!updated.changes) return false;
      const renown = Math.max(100, Math.floor(level || 1) * 100) + (uniqueRelics.length * 50);
      this.db.prepare('UPDATE chronicle_houses SET renown = renown + ? WHERE id = ?').run(renown, houseId);
      const insertRelic = this.db.prepare(`
        INSERT INTO chronicle_relics (
          id, house_id, source_scion_id, origin_scion_name, item_json,
          status, eligible_run, created_at
        ) VALUES (?, ?, ?, ?, ?, 'circulating', ?, ?)
      `);
      uniqueRelics.forEach((item) => {
        insertRelic.run(
          randomUUID(), houseId, scionId, scion.name,
          JSON.stringify(item), eligibleRun, diedAt,
        );
      });
      return true;
    });
    if (!commit()) return null;
    return {
      fallen: { ...scion, level, diedAt, cause: cause || 'Fell in battle' },
      relicCount: uniqueRelics.length,
      eligibleRun,
      chronicle: this.getChronicle(accountId),
    };
  }

  drawEligibleRelic(accountIds = []) {
    const ids = [...new Set(accountIds.filter(Boolean).map(String))];
    if (!ids.length) return null;
    const placeholders = ids.map(() => '?').join(', ');
    const row = this.db.prepare(`
      SELECT r.*, a.run_count
      FROM chronicle_relics r
      JOIN chronicle_houses h ON h.id = r.house_id
      JOIN chronicle_accounts a ON a.account_id = h.account_id
      WHERE r.status = 'circulating'
        AND (
          (h.account_id IN (${placeholders}) AND r.eligible_run <= a.run_count)
          OR EXISTS (
            SELECT 1
            FROM chronicle_house_links l
            JOIN chronicle_accounts viewer ON viewer.account_id = l.account_id
            WHERE l.house_id = h.id
              AND l.account_id IN (${placeholders})
              AND l.eligible_run <= viewer.run_count
          )
        )
      ORDER BY r.created_at ASC
      LIMIT 1
    `).get(...ids, ...ids);
    if (!row) return null;
    this.db.prepare(`
      UPDATE chronicle_relics SET status = 'dropped', dropped_at = ? WHERE id = ? AND status = 'circulating'
    `).run(isoNow(), row.id);
    return {
      id: row.id,
      originScionName: row.origin_scion_name,
      sourceScionId: row.source_scion_id,
      item: parseJson(row.item_json, null),
    };
  }

  grantHouseRelicAccess(accountId, houseId, delayRuns = 3) {
    const account = this.db.prepare('SELECT run_count FROM chronicle_accounts WHERE account_id = ?')
      .get(accountId);
    const house = this.db.prepare('SELECT id FROM chronicle_houses WHERE id = ?').get(houseId);
    if (!account || !house) return null;
    const eligibleRun = account.run_count + Math.max(0, Math.floor(delayRuns));
    this.db.prepare(`
      INSERT INTO chronicle_house_links (account_id, house_id, eligible_run)
      VALUES (?, ?, ?)
      ON CONFLICT(account_id, house_id) DO UPDATE SET
        eligible_run = MIN(eligible_run, excluded.eligible_run)
    `).run(accountId, houseId, eligibleRun);
    return eligibleRun;
  }

  claimRelic(relicId, player) {
    if (!relicId || !player?.scionId) return false;
    const result = this.db.prepare(`
      UPDATE chronicle_relics
      SET status = 'claimed', claimed_at = ?, claimed_by_scion_id = ?
      WHERE id = ? AND status = 'dropped'
    `).run(isoNow(), player.scionId, relicId);
    return Boolean(result.changes);
  }
}

const chroniclesRepository = new ChroniclesRepository();

export default chroniclesRepository;
