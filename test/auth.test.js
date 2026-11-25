import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { basicAuth } from '../src/auth.js';
import { parseBasicAuthConfig } from '../src/config.js';

const USER = 'demo';
const PASS = 'a:long:passw0rd'; // with ':' on purpose, which is allowed in the password

// Small real Express app with the middleware, so routing and headers behave as in production
let baseUrl;
let server;
before(async () => {
  const app = express();
  app.use(basicAuth({ username: USER, password: PASS }));
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => res.json({ ready: true }));
  app.get('/api/notes', (_req, res) => res.json([]));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const authHeader = (user, pass) => ({ Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` });

test('without credentials: 401 with a challenge for the browser dialog', async () => {
  const res = await fetch(`${baseUrl}/api/notes`);
  assert.equal(res.status, 401);
  assert.match(res.headers.get('www-authenticate'), /^Basic realm="notes"/);
});

test('correct credentials pass', async () => {
  const res = await fetch(`${baseUrl}/api/notes`, { headers: authHeader(USER, PASS) });
  assert.equal(res.status, 200);
});

test('wrong password, wrong user or wrong scheme are rejected', async () => {
  for (const headers of [
    authHeader(USER, 'wrong-password'),
    authHeader('admin', PASS),
    { Authorization: `Bearer ${Buffer.from(`${USER}:${PASS}`).toString('base64')}` },
    { Authorization: 'Basic not-base64-without-colon' },
  ]) {
    const res = await fetch(`${baseUrl}/api/notes`, { headers });
    assert.equal(res.status, 401, JSON.stringify(headers));
  }
});

test('probes work without credentials', async () => {
  assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
});

test('config: off when nothing is set', () => {
  assert.equal(parseBasicAuthConfig({}), null);
});

test('config: incomplete, weak or invalid settings are rejected', () => {
  assert.throws(() => parseBasicAuthConfig({ BASIC_AUTH_USER: 'demo' }), /together/);
  assert.throws(() => parseBasicAuthConfig({ BASIC_AUTH_PASSWORD: 'long-enough-password' }), /together/);
  assert.throws(() => parseBasicAuthConfig({ BASIC_AUTH_USER: 'demo', BASIC_AUTH_PASSWORD: 'short' }), /at least 12/);
  assert.throws(() => parseBasicAuthConfig({ BASIC_AUTH_USER: 'a:b', BASIC_AUTH_PASSWORD: 'long-enough-password' }), /":"/);
});
