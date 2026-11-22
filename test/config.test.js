import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContainerUrl } from '../src/config.js';

test('container without subfolder', () => {
  assert.deepEqual(parseContainerUrl('https://acct.blob.core.windows.net/notes'), {
    containerUrl: 'https://acct.blob.core.windows.net/notes',
    container: 'notes',
    prefix: '',
  });
});

test('container with nested subfolder', () => {
  const cfg = parseContainerUrl('https://acct.blob.core.windows.net/notes/team/a/');
  assert.equal(cfg.containerUrl, 'https://acct.blob.core.windows.net/notes');
  assert.equal(cfg.prefix, 'team/a/');
});

test('missing or invalid URL is rejected', () => {
  assert.throws(() => parseContainerUrl(undefined), /not set/);
  assert.throws(() => parseContainerUrl('not-a-url'), /not a valid URL/);
  assert.throws(() => parseContainerUrl('https://acct.blob.core.windows.net/'), /container/);
});

test('http and SAS tokens are rejected', () => {
  assert.throws(() => parseContainerUrl('http://acct.blob.core.windows.net/notes'), /https/);
  assert.throws(() => parseContainerUrl('https://acct.blob.core.windows.net/notes?sv=1&sig=x'), /query string/);
});
