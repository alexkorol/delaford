/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IdentityRegistry } from '#server/core/services/identity-registry.js';

describe('SQLite identity registry', () => {
  let registry;
  beforeEach(() => { registry = new IdentityRegistry({ dbFile: ':memory:', legacyStoreFile: null }); });
  afterEach(() => registry.close());

  it('persists validation history and the latest bound identity', async () => {
    await registry.recordValidation('account-1', {
      jobId: 'job-1', rawName: '  Mara ', normalizedName: 'Mara', valid: true, provider: 'local',
    });
    const account = registry.getAccount('account-1');
    expect(account.history).toHaveLength(1);
    expect(account.boundIdentity).toMatchObject({ name: 'Mara', jobId: 'job-1' });
  });

  it('degrades safely when stored JSON is stale', () => {
    registry.ensureAccount('account-stale');
    registry.db.prepare('UPDATE identity_accounts SET state_json = ? WHERE account_id = ?')
      .run('{broken', 'account-stale');
    expect(registry.getAccount('account-stale')).toBeNull();
  });
});
