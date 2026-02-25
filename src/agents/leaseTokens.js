const enc = new TextEncoder();

function b64u(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function unb64u(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const s = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function stableStringify(obj) {
  const allKeys = [];
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v));
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

export async function issueAgentToken({ privKey, epochId, agentId, capabilities, ttlSeconds = 3600 }) {
  const header = { alg: 'ES256', typ: 'KNOX-LEASE' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    epochId,
    agentId,
    caps: capabilities,
    iat: now,
    exp: now + Math.max(60, Math.min(24 * 3600, Number(ttlSeconds) || 3600))
  };

  const h = b64u(enc.encode(stableStringify(header)));
  const p = b64u(enc.encode(stableStringify(payload)));
  const toSign = `${h}.${p}`;

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(toSign));
  const s = b64u(new Uint8Array(sig));

  return `${toSign}.${s}`;
}

export async function verifyAgentToken({ pubKey, token, expectedEpochId }) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'Missing token' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'Malformed token' };

  const [h, p, s] = parts;
  const toVerify = `${h}.${p}`;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(unb64u(p)));
  } catch {
    return { ok: false, reason: 'Bad payload' };
  }

  if (expectedEpochId && payload.epochId !== expectedEpochId) return { ok: false, reason: 'Epoch mismatch' };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return { ok: false, reason: 'Expired token' };

  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pubKey,
    unb64u(s),
    enc.encode(toVerify)
  );

  if (!ok) return { ok: false, reason: 'Bad signature' };
  return { ok: true, payload };
}
