import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLatestSearch, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from './search-logic.ts';

test('search queries are trimmed and bounded before reaching the API', () => {
  assert.equal(normalizeSearchQuery('  AI  '), 'AI');
  assert.equal(normalizeSearchQuery('x'.repeat(80)).length, 60);
  assert.equal(SEARCH_DEBOUNCE_MS, 250);
});

test('only the latest search request may update results', () => {
  assert.equal(isLatestSearch(4, 4), true);
  assert.equal(isLatestSearch(3, 4), false);
});
