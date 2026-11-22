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

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 8080),
    ...parseContainerUrl(env.BLOB_CONTAINER_URL),
  };
}
