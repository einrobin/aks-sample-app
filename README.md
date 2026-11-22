# notes-app

Small notes app (Node.js/Express) without authentication. Notes are stored as JSON blobs
in Azure Blob Storage. Access works without keys via `DefaultAzureCredential`
(in the AKS pod: Workload Identity, locally: `az login`).

## Configuration

| Variable             | Example                                                     | Required |
|----------------------|-------------------------------------------------------------|----------|
| `BLOB_CONTAINER_URL` | `https://myaccount.blob.core.windows.net/notes/team-a`      | yes      |
| `PORT`               | `8080`                                                      | no       |

Everything after the container name is the "subfolder" (blob prefix).
Each note is stored as `<prefix>/<uuid>.json`.

The identity needs the **Storage Blob Data Contributor** role on the storage account or container.
The container must already exist (Terraform); the app does not create it.

## Running locally

```bash
az login
npm ci
BLOB_CONTAINER_URL=https://<account>.blob.core.windows.net/<container>/<folder> npm start
```

Your own user also needs "Storage Blob Data Contributor" for this.

## Endpoints

| Method  | Path              | Purpose                                 |
|---------|-------------------|-----------------------------------------|
| GET     | `/`               | Web UI                                  |
| GET     | `/api/notes`      | all notes                               |
| POST    | `/api/notes`      | create `{ "title", "content" }`         |
| GET     | `/api/notes/:id`  | a single note                           |
| PUT     | `/api/notes/:id`  | update                                  |
| DELETE  | `/api/notes/:id`  | delete                                  |
| GET     | `/healthz`        | Liveness (no storage dependency)        |
| GET     | `/readyz`         | Readiness (checks storage access)       |

## CI/CD

- Push to `master` and PRs against `master`: tests + Docker build (no push)
- Push a `v*` tag: tests, build, push to `ghcr.io/<owner>/<repo>` with tags `1.2.3`, `1.2`, `sha-…`

```bash
git tag v1.0.0 && git push origin v1.0.0
```
