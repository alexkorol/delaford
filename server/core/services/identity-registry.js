import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const serviceDir = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_DB_FILE = path.join(serviceDir, '../../data/verdigris.sqlite');
const LEGACY_STORE_FILE = path.join(serviceDir, '../../data/identity-store.json');
const clone = value => JSON.parse(JSON.stringify(value));

export class IdentityRegistry {
  constructor({
    dbFile = process.env.VITEST
      ? ':memory:'
      : (process.env.IDENTITY_DB_FILE || process.env.CHRONICLES_DB_FILE || DEFAULT_DB_FILE),
    legacyStoreFile = process.env.IDENTITY_STORE_FILE || LEGACY_STORE_FILE,
  } = {}) {
    this.dbFile = dbFile;
    this.legacyStoreFile = legacyStoreFile;
    if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    this.db = new Database(dbFile);
    this.db.pragma('foreign_keys = ON');
    if (dbFile !== ':memory:') {
      try { this.db.pragma('journal_mode = WAL'); } catch { /* default journal remains safe */ }
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity_accounts (
        account_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.migrateLegacyJson();
  }

  close() {
    this.db.close();
  }

  migrateLegacyJson() {
    if (!this.legacyStoreFile || !fs.existsSync(this.legacyStoreFile)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.legacyStoreFile, 'utf8'));
      const accounts = parsed?.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {};
      const insert = this.db.prepare(`
        INSERT INTO identity_accounts (account_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO NOTHING
      `);
      const migrate = this.db.transaction(() => {
        Object.entries(accounts).forEach(([id, account]) => {
          insert.run(id, JSON.stringify(account), new Date().toISOString());
        });
      });
      migrate();
    } catch (error) {
      process.stderr.write(`[identity-registry] Legacy migration skipped: ${error.message}\n`);
    }
  }

  ensureAccount(accountId) {
    if (!accountId) return null;
    const id = String(accountId);
    const existing = this.getAccount(id);
    if (existing) return existing;
    const account = { accountId: id, history: [], boundIdentity: null };
    this.writeAccount(account);
    return account;
  }

  writeAccount(account) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO identity_accounts (account_id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
    `).run(account.accountId, JSON.stringify(account), now);
  }

  async recordValidation(accountId, payload) {
    if (!accountId) return null;
    const account = this.ensureAccount(accountId);
    const entry = {
      jobId: payload.jobId || null,
      requestedAt: payload.requestedAt || new Date().toISOString(),
      completedAt: payload.completedAt || new Date().toISOString(),
      rawName: payload.rawName,
      normalizedName: payload.normalizedName,
      valid: Boolean(payload.valid),
      reason: payload.reason || null,
      confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
      provider: payload.provider || 'local',
      metadata: payload.metadata || null,
    };
    account.history.push(entry);
    if (entry.valid) {
      account.boundIdentity = {
        name: entry.normalizedName,
        boundAt: entry.completedAt,
        jobId: entry.jobId,
        confidence: entry.confidence,
        provider: entry.provider,
      };
    }
    this.writeAccount(account);
    return clone(account);
  }

  getAccount(accountId) {
    if (!accountId) return null;
    const row = this.db.prepare('SELECT state_json FROM identity_accounts WHERE account_id = ?')
      .get(String(accountId));
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.state_json);
      return parsed && typeof parsed === 'object' ? clone(parsed) : null;
    } catch {
      return null;
    }
  }
}

const identityRegistry = new IdentityRegistry();

export default identityRegistry;
