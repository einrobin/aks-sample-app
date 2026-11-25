// Splits a URL like https://acct.blob.core.windows.net/container/sub/folder
// into the container URL and a prefix (virtual subfolder within the container).
export function parseContainerUrl(raw) {
  if (!raw) {
    throw new Error('BLOB_CONTAINER_URL is not set');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`BLOB_CONTAINER_URL is not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error('BLOB_CONTAINER_URL must use https');
  }
  if (url.search) {
    throw new Error('BLOB_CONTAINER_URL must not contain a query string (e.g. a SAS token)');
  }

  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) {
    throw new Error('BLOB_CONTAINER_URL must include at least a container');
  }

  const [container, ...rest] = segments;
  const prefix = rest.length ? `${rest.join('/')}/` : '';

  return {
    containerUrl: `${url.origin}/${encodeURIComponent(container)}`,
    container,
    prefix,
  };
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Optional summary feature. Returns null if it is not configured.
// AZURE_OPENAI_CLIENT_ID selects a separate identity for Azure OpenAI; without it the
// default identity is used (in the pod: AZURE_CLIENT_ID, locally: az login).
export function parseOpenAiConfig(env) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
  const deployment = env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const clientId = env.AZURE_OPENAI_CLIENT_ID?.trim() || undefined;

  if (!endpoint && !deployment) return null;
  if (!endpoint || !deployment) {
    throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT must be set together');
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`AZURE_OPENAI_ENDPOINT is not a valid URL: ${endpoint}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error('AZURE_OPENAI_ENDPOINT must use https');
  }
  if (url.search) {
    throw new Error('AZURE_OPENAI_ENDPOINT must not contain a query string (no API keys)');
  }
  if (url.pathname !== '/') {
    throw new Error('AZURE_OPENAI_ENDPOINT must be the resource endpoint only, e.g. https://<name>.openai.azure.com/');
  }
  if (clientId && !GUID_PATTERN.test(clientId)) {
    throw new Error('AZURE_OPENAI_CLIENT_ID must be a client ID (GUID)');
  }

  return {
    // Azure OpenAI "v1" API: works with the regular OpenAI client, no api-version needed
    baseURL: `${url.origin}/openai/v1/`,
    deployment,
    clientId,
  };
}

const MIN_PASSWORD_LENGTH = 12;

// Optional shared login. Returns null if it is not configured.
export function parseBasicAuthConfig(env) {
  const username = env.BASIC_AUTH_USER;
  const password = env.BASIC_AUTH_PASSWORD;

  if (!username && !password) return null;
  if (!username || !password) {
    throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set together');
  }
  if (username.includes(':')) {
    throw new Error('BASIC_AUTH_USER must not contain ":"');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`BASIC_AUTH_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  return { username, password };
}

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 8080),
    ...parseContainerUrl(env.BLOB_CONTAINER_URL),
    openai: parseOpenAiConfig(env),
    basicAuth: parseBasicAuthConfig(env),
  };
}
