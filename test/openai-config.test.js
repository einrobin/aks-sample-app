import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAiConfig } from '../src/config.js';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';

test('feature is off when nothing is configured', () => {
  assert.equal(parseOpenAiConfig({}), null);
});

test('endpoint and deployment produce the v1 base URL', () => {
  assert.deepEqual(
    parseOpenAiConfig({
      AZURE_OPENAI_ENDPOINT: 'https://my-openai.openai.azure.com/',
      AZURE_OPENAI_DEPLOYMENT: 'summary',
      AZURE_OPENAI_CLIENT_ID: CLIENT_ID,
    }),
    { baseURL: 'https://my-openai.openai.azure.com/openai/v1/', deployment: 'summary', clientId: CLIENT_ID },
  );
});

test('client ID is optional', () => {
  const cfg = parseOpenAiConfig({
    AZURE_OPENAI_ENDPOINT: 'https://my-openai.openai.azure.com',
    AZURE_OPENAI_DEPLOYMENT: 'summary',
  });
  assert.equal(cfg.clientId, undefined);
});

test('incomplete or invalid configuration is rejected', () => {
  assert.throws(() => parseOpenAiConfig({ AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/' }), /together/);
  assert.throws(() => parseOpenAiConfig({ AZURE_OPENAI_DEPLOYMENT: 'summary' }), /together/);

  const base = { AZURE_OPENAI_DEPLOYMENT: 'summary' };
  assert.throws(() => parseOpenAiConfig({ ...base, AZURE_OPENAI_ENDPOINT: 'nope' }), /valid URL/);
  assert.throws(() => parseOpenAiConfig({ ...base, AZURE_OPENAI_ENDPOINT: 'http://x.openai.azure.com/' }), /https/);
  assert.throws(() => parseOpenAiConfig({ ...base, AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/?api-key=1' }), /query string/);
  assert.throws(() => parseOpenAiConfig({ ...base, AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/openai/v1/' }), /resource endpoint/);
  assert.throws(
    () => parseOpenAiConfig({ ...base, AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/', AZURE_OPENAI_CLIENT_ID: 'abc' }),
    /GUID/,
  );
});
