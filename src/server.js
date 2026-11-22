import express from 'express';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { NoteStore, NotFoundError, isValidId } from './store.js';

const config = loadConfig();
const store = new NoteStore(config);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

// --- Probes ---------------------------------------------------------------
// Liveness: is the process alive? Deliberately WITHOUT a dependency on storage,
// otherwise Kubernetes restarts pods just because storage hiccups briefly.
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Readiness: can the pod serve traffic? Checks storage access.
// The result is cached briefly so the probe doesn't flood the storage.
let lastReady = { ok: false, at: 0 };
app.get('/readyz', async (_req, res) => {
  if (Date.now() - lastReady.at > 10_000) {
    try {
      await store.ping();
      lastReady = { ok: true, at: Date.now() };
    } catch (err) {
      console.error('Readiness check failed:', err.message);
      lastReady = { ok: false, at: Date.now() };
    }
  }
  res.status(lastReady.ok ? 200 : 503).json({ ready: lastReady.ok });
});

// --- API ------------------------------------------------------------------
function validateNote(body, { partial = false } = {}) {
  const { title, content } = body ?? {};
  if (!partial && (typeof title !== 'string' || title.trim() === '')) {
    return 'title is required';
  }
  if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
    return 'title must be a string of at most 200 characters';
  }
  if (content !== undefined && (typeof content !== 'string' || content.length > 50_000)) {
    return 'content must be a string of at most 50,000 characters';
  }
  return null;
}

app.param('id', (req, res, next, id) => {
  if (!isValidId(id)) return res.status(400).json({ error: 'invalid id' });
  next();
});

app.get('/api/notes', async (_req, res) => {
  res.json(await store.list());
});

app.get('/api/notes/:id', async (req, res) => {
  res.json(await store.get(req.params.id));
});

app.post('/api/notes', async (req, res) => {
  const error = validateNote(req.body);
  if (error) return res.status(400).json({ error });
  const note = await store.create({ title: req.body.title.trim(), content: req.body.content ?? '' });
  res.status(201).json(note);
});

app.put('/api/notes/:id', async (req, res) => {
  const error = validateNote(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  res.json(await store.update(req.params.id, req.body));
});

app.delete('/api/notes/:id', async (req, res) => {
  await store.delete(req.params.id);
  res.status(204).end();
});

// Express 5 automatically forwards errors from async handlers to here
app.use((err, _req, res, _next) => {
  if (err instanceof NotFoundError) return res.status(404).json({ error: 'Note not found' });
  console.error(err);
  res.status(502).json({ error: 'Storage access failed' });
});

const server = app.listen(config.port, () => {
  console.log(`notes-app listening on port ${config.port}`);
  console.log(`Storage: ${config.containerUrl} (prefix: "${config.prefix}")`);
});

// Shut down gracefully when Kubernetes sends SIGTERM
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down …`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
