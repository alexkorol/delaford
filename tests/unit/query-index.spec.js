import { describe, expect, it } from 'vitest';

import Query from '#server/core/data/query.js';

describe('indexed data queries', () => {
  it('returns an isolated item clone while preserving the item context', () => {
    const first = Query.getItemData('bronze-sword');
    const second = Query.getItemData('bronze-sword');

    expect(first).toBeTruthy();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.context).toBe('item');

    first.name = 'mutated';
    if (first.stats?.attack) first.stats.attack.slash = -999;
    const third = Query.getItemData('bronze-sword');
    expect(third.name).not.toBe('mutated');
    expect(third.stats?.attack?.slash).not.toBe(-999);
  });

  it('returns undefined for unknown item and foreground ids', () => {
    expect(Query.getItemData('missing-item')).toBeUndefined();
    expect(Query.getForegroundData(-1)).toBeUndefined();
  });
});
