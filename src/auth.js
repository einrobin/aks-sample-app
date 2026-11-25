import { createHash, timingSafeEqual } from 'node:crypto';

// Paths that work without login: the kubelet probes don't send credentials
const PUBLIC_PATHS = new Set(['/healthz', '/readyz']);

// Comparison with constant runtime, so the password can't be guessed character by
// character from response times. Hashing first gives both sides the same length,
// which timingSafeEqual requires.
function safeEqual(a, b) {
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function parseBasicHeader(header) {
  const [scheme, encoded] = (header ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return null;

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = decoded.indexOf(':'); // the password may contain ':', the user name may not
  if (separator === -1) return null;
  return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

// Simple shared login (HTTP Basic Auth). Only safe over HTTPS: the browser sends
// user name and password with every request, merely Base64-encoded.
export function basicAuth({ username, password }) {
  return (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) return next();

    const credentials = parseBasicHeader(req.headers.authorization);
    // Always compare both, so a wrong user name takes as long as a wrong password
    const userOk = safeEqual(credentials?.username ?? '', username);
    const passOk = safeEqual(credentials?.password ?? '', password);
    if (credentials && userOk && passOk) return next();

    res.set('WWW-Authenticate', 'Basic realm="notes", charset="UTF-8"');
    res.status(401).json({ error: 'Login required' });
  };
}
