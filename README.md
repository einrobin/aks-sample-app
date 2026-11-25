# notes-app

Small notes app (Node.js/Express) without authentication. Notes are stored as JSON blobs
in Azure Blob Storage. Access works without keys via `DefaultAzureCredential`
(in the AKS pod: Workload Identity, locally: `az login`).

## Configuration

| Variable             | Example                                                     | Required |
|----------------------|-------------------------------------------------------------|----------|
| `BLOB_CONTAINER_URL` | `https://myaccount.blob.core.windows.net/notes/team-a`      | yes      |
| `PORT`               | `8080`                                                      | no       |
| `AZURE_OPENAI_ENDPOINT`   | `https://my-openai.openai.azure.com/`                  | no (enables summaries) |
| `AZURE_OPENAI_DEPLOYMENT` | `summary` (name of the model deployment)               | with endpoint |
| `AZURE_OPENAI_CLIENT_ID`  | client ID of a separate identity for Azure OpenAI      | no       |

Everything after the container name is the "subfolder" (blob prefix).
Each note is stored as `<prefix>/<uuid>.json`.

The identity needs the **Storage Blob Data Contributor** role on the storage account or container.
The container must already exist (Terraform); the app does not create it.

## Summaries with Azure OpenAI (optional)

If `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT` are set, a "Summarize" button appears
in the UI. The app uses the Azure OpenAI v1 API (`<endpoint>/openai/v1/`) with an Entra ID token, no API key.

- **Separate identity:** With `AZURE_OPENAI_CLIENT_ID` the app uses its own managed identity for Azure OpenAI.
  It needs a federated credential for the **same** service account as the storage identity
  (`system:serviceaccount:<namespace>:<serviceaccount>`) and the role **Cognitive Services OpenAI User**
  on the Azure OpenAI resource. The storage identity gets no access to Azure OpenAI and vice versa.
- **Not part of readiness:** If Azure OpenAI is unavailable, `/readyz` stays green and only the summary fails.
- **Costs:** The app has no authentication, so anyone with access can trigger summaries. Input
  (20,000 characters) and output (1,000 tokens) are capped per request; the actual cap on throughput
  is the deployment's capacity (tokens per minute) in Azure.

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
| POST    | `/api/notes/:id/summary` | summarize the saved note (optional) |
| GET     | `/api/features`   | which optional features are enabled     |
| GET     | `/healthz`        | Liveness (no storage dependency)        |
| GET     | `/readyz`         | Readiness (checks storage access)       |

## CI/CD

- Push to `master` and PRs against `master`: tests + Docker build (no push)
- Push a `v*` tag: tests, build, push to `ghcr.io/<owner>/<repo>` with tags `1.2.3`, `1.2`, `sha-…`

```bash
git tag v1.0.0 && git push origin v1.0.0
```
