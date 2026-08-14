/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IdentityRegistry } from '#server/core/services/identity-registry.js';

describe('SQLite identity registry', () => {
  let registry;
  beforeEach(() => { registry = new IdentityRegistry({ dbFile: ':memory:' }); });
  afterEach(() => registry.close());

  it('creates and authenticates a local account without storing its password', () => {
    const created = registry.createLoginAccount({ username: 'Mara_Stone', password: 'safe-passphrase' });
    expect(created).toMatchObject({ ok: true, username: 'Mara_Stone' });
    expect(registry.authenticateLogin({ username: 'mara_stone', password: 'safe-passphrase' }))
      .toMatchObject({ uuid: created.accountId, username: 'Mara_Stone' });
    expect(registry.authenticateLogin({ username: 'Mara_Stone', password: 'wrong-passphrase' }))
      .toBeNull();
    const row = registry.db.prepare('SELECT * FROM login_accounts WHERE account_id = ?')
      .get(created.accountId);
    expect(JSON.stringify(row)).not.toContain('safe-passphrase');
  });

  it('updates a local account profile without replacing its login identity', () => {
    const created = registry.createLoginAccount({ username: 'Mara_Stone', password: 'safe-passphrase' });

    expect(registry.updateLoginProfile(created.accountId, {
      level: 7,
      bank: [{ id: 'coins', qty: 42 }],
      username: 'Injected Name',
      uuid: 'injected-id',
    })).toBe(true);
    expect(registry.authenticateLogin({ username: 'Mara_Stone', password: 'safe-passphrase' }))
      .toMatchObject({
        uuid: created.accountId,
        username: 'Mara_Stone',
        level: 7,
        bank: [{ id: 'coins', qty: 42 }],
      });
  });

  it('rejects invalid and duplicate account names', () => {
    expect(registry.createLoginAccount({ username: 'x', password: 'safe-passphrase' }).ok).toBe(false);
    expect(registry.createLoginAccount({ username: 'Mara', password: 'short' }).ok).toBe(false);
    expect(registry.createLoginAccount({ username: 'Mara', password: 'safe-passphrase' }).ok).toBe(true);
    expect(registry.createLoginAccount({ username: 'mara', password: 'another-safe-passphrase' }).ok).toBe(false);
  });
});
