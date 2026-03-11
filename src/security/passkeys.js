const enc = new TextEncoder();

function toB64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64Url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function passkeysSupported() {
  if (!window.PublicKeyCredential) return { supported: false };
  const uvpaa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false);
  return { supported: !!uvpaa };
}

export async function prfSupported() {
  // Best-effort: PRF extension presence can only be confirmed after calls,
  // but we can feature-detect the API surface.
  return !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function createPasskey({ rpName = 'FORTIFY OS', userName = 'Primary', userId = 'primary' }) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const uid = enc.encode(userId);

  const publicKey = {
    challenge,
    rp: { name: rpName },
    user: { id: uid, name: userName, displayName: userName },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
    timeout: 60000,
    attestation: 'none'
  };

  const cred = await navigator.credentials.create({ publicKey });
  if (!cred) throw new Error('Passkey creation failed.');

  const rawId = new Uint8Array(cred.rawId);
  return { credentialIdB64u: toB64Url(rawId) };
}

export async function authenticatePasskey({ credentialIdB64u, prfSaltB64u = null }) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowCredentials = credentialIdB64u ? [{ type: 'public-key', id: fromB64Url(credentialIdB64u) }] : [];

  const publicKey = {
    challenge,
    allowCredentials,
    userVerification: 'required',
    timeout: 60000,
    extensions: prfSaltB64u
      ? { prf: { eval: { first: fromB64Url(prfSaltB64u) } } }
      : undefined
  };

  const assertion = await navigator.credentials.get({ publicKey });
  if (!assertion) throw new Error('Passkey authentication failed.');

  const ext = assertion.getClientExtensionResults?.() || {};
  // PRF output is the only path to stable secret derivation without server.
  const prfRes = ext?.prf?.results?.first;

  return {
    verified: true,
    prfBytes: prfRes ? new Uint8Array(prfRes) : null
  };
}

export function newPrfSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return toB64Url(salt);
}
