import { randomUUID } from 'node:crypto';
import { ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const ID_PATTERN = /^[0-9a-f-]{36}$/;

export class NotFoundError extends Error {}

export function isValidId(id) {
  return ID_PATTERN.test(id);
}

export class NoteStore {
  constructor({ containerUrl, prefix }, credential = new DefaultAzureCredential()) {
    // No key, no SAS: in the pod DefaultAzureCredential picks up the Workload Identity,
    // locally e.g. the login from `az login`.
    this.container = new ContainerClient(containerUrl, credential);
    this.prefix = prefix;
  }

  blobName(id) {
    return `${this.prefix}${id}.json`;
  }

  async list() {
    const ids = [];
    for await (const item of this.container.listBlobsFlat({ prefix: this.prefix })) {
      const id = item.name.slice(this.prefix.length).replace(/\.json$/, '');
      // Only direct note blobs under the prefix, no deeper "subfolders" or unrelated files
      if (isValidId(id)) ids.push(id);
    }
    const notes = await Promise.all(ids.map((id) => this.get(id).catch(() => null)));
    return notes
      .filter(Boolean)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id) {
    const blob = this.container.getBlockBlobClient(this.blobName(id));
    try {
      const buffer = await blob.downloadToBuffer();
      return JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      if (err.statusCode === 404) throw new NotFoundError(id);
      throw err;
    }
  }

  async save(note) {
    const body = JSON.stringify(note);
    await this.container
      .getBlockBlobClient(this.blobName(note.id))
      .upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });
    return note;
  }

  async create({ title, content }) {
    const now = new Date().toISOString();
    return this.save({ id: randomUUID(), title, content, createdAt: now, updatedAt: now });
  }

  async update(id, { title, content }) {
    const existing = await this.get(id);
    return this.save({
      ...existing,
      title: title?.trim() || existing.title,
      content: content ?? existing.content,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id) {
    const res = await this.container.getBlockBlobClient(this.blobName(id)).deleteIfExists();
    if (!res.succeeded) throw new NotFoundError(id);
  }

  // Lightweight check for the readiness probe: can we read the container?
  async ping() {
    const pages = this.container.listBlobsFlat({ prefix: this.prefix }).byPage({ maxPageSize: 1 });
    await pages.next();
  }
}
