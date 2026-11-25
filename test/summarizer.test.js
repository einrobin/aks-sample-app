import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Summarizer, SummaryError } from '../src/summarizer.js';

// Fake client in place of Azure OpenAI: records the request and returns a fixed response
function fakeClient(content) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (request) => {
          calls.push(request);
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };
}

const config = { baseURL: 'https://x.openai.azure.com/openai/v1/', deployment: 'summary' };

test('sends the note to the deployment and returns the trimmed summary', async () => {
  const client = fakeClient('  Short summary.  ');
  const summarizer = new Summarizer(config, { credential: {}, client });

  const summary = await summarizer.summarize({ title: 'Shopping', content: 'Milk, bread, butter' });

  assert.equal(summary, 'Short summary.');
  assert.equal(client.calls[0].model, 'summary');
  assert.match(client.calls[0].messages.at(-1).content, /Shopping[\s\S]*Milk, bread, butter/);
});

test('very long notes are truncated before sending', async () => {
  const client = fakeClient('ok');
  const summarizer = new Summarizer(config, { credential: {}, client });

  await summarizer.summarize({ title: 'Long', content: 'x'.repeat(100_000) });

  assert.ok(client.calls[0].messages.at(-1).content.length < 21_000);
});

test('an empty note is not sent at all', async () => {
  const client = fakeClient('ok');
  const summarizer = new Summarizer(config, { credential: {}, client });

  await assert.rejects(summarizer.summarize({ title: 'Empty', content: '   ' }), (err) => {
    assert.ok(err instanceof SummaryError);
    assert.equal(err.status, 400);
    return true;
  });
  assert.equal(client.calls.length, 0);
});

test('an empty model response is reported as an error', async () => {
  const summarizer = new Summarizer(config, { credential: {}, client: fakeClient('') });
  await assert.rejects(summarizer.summarize({ title: 'A', content: 'B' }), /did not return a summary/);
});
