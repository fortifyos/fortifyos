/**
 * TASK-FOS-002: Security Error Handling — passkeys
 *
 * Requirements:
 * - Typed exception classes
 * - No silent catches
 * - Consistent audit logging
 * - No sensitive detail leakage in user-facing errors
 */

import { secureLogRef } from '../agents/secureLogRef.js';

// =============================================================================
// Typed Error Classes
// =============================================================================

export class PasskeyError extends Error {
  constructor(message, public readonly code, public readonly severity = 'WARN') {
    super(message);
    this.name = 'PasskeyError';
  }
}

export class PasskeyNotAvailableError extends Error {
  constructor(message, public readonly code, public readonly severity = 'WARN') {
    super(message);
    this.name = 'PasskeyNotAvailableError';
  }
}

export class PasskeyAuthError extends Error {
  constructor(message, public readonly code, public readonly severity = 'WARN') {
    super(message);
    this.name = 'PasskeyAuthError';
  }
}

// =============================================================================
// Helpers
// =============================================================================

const enc = new TextEncoder();

function toB64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// =============================================================================
// Audit Logging Wrapper
// =============================================================================

async function auditPasskeyEvent(event, message, severity = 'INFO', extra = {}) {
  const log = secureLogRef();
  await log(event, message, 'passkeys', severity, extra);
}

// =============================================================================
// Core Operations
// =============================================================================

export async function passkeysSupported() {
  if (!window.PublicKeyCredential) {
    await auditPasskeyEvent('PASSKEYS_UNSUPPORTED', 'PublicKeyCredential not available in this browser', 'WARN');
    return { supported: false };
  }

  let uvpaa = false;
  try {
    uvpaa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false;
  } catch (err) {
    // Feature detection failure — log and continue with false
    await auditPasskeyEvent(
      'PASSKEY_UVAA_CHECK_FAILED',
      'UserVerifyingPlatformAuthenticatorAvailable check threw',
      'INFO',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
  }

  const result = { supported: !!uvpaa };

  if (uvpaa) {
    await auditPasskeyEvent('PASSKEYS_AVAILABLE', 'Platform authenticator available', 'INFO');
  } else {
    await auditPasskeyEvent('PASSKEYS_UNAVAILABLE', 'No platform authenticator (UVPAA false)', 'INFO');
  }

  return result;
}

export async function prfSupported() {
  // PRF (Pseudorandom Function) extension support detection.
  // This is best-effort — PRF availability can only be confirmed after calls,
  // but we can feature-detect the API surface.
  const hasApi = !!(window.PublicKeyCredential && navigator.credentials);

  if (hasApi) {
    await auditPasskeyEvent('PRF_API_PRESENT', 'WebAuthn PRF API surface detected', 'INFO');
  } else {
    await auditPasskeyEvent('PRF_API_MISSING', 'WebAuthn PRF API surface not available', 'INFO');
  }

  return hasApi;
}

export async function createPasskey({ rpName = 'FORTIFY OS', userName = 'Primary', userId = 'primary' }) {
  const STAGE = 'passkeys';

  // Validate inputs
  if (!rpName || !userName || !userId) {
    throw new PasskeyError('rpName, userName, and userId are all required', 'INVALID_PARAMS', 'WARN');
  }

  if (!window.PublicKeyCredential) {
    throw new PasskeyNotAvailableError('Passkeys not supported in this browser', 'UNSUPPORTED', 'WARN');
  }

  await auditPasskeyEvent('PASSKEY_CREATE_START', `Starting passkey creation for ${userName}`, 'INFO');

  let challenge;
  try {
    challenge = crypto.getRandomValues(new Uint8Array(32));
  } catch (err) {
    await auditPasskeyEvent('PASSKEY_CHALLENGE_FAILED', 'Failed to generate challenge', 'CRITICAL');
    throw new PasskeyError('Failed to generate challenge', 'CHALLENGE_FAILED', 'CRITICAL');
  }

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

  let cred;
  try {
    cred = await navigator.credentials.create({ publicKey });
  } catch (err) {
    await auditPasskeyEvent(
      'PASSKEY_CREATE_FAILED',
      'Passkey creation failed',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError', type: err instanceof Error ? err.constructor.name : 'UnknownType' }
    );

    // Map common errors to user-safe messages — no sensitive detail leaked
    const msg = err instanceof Error ? err.message : 'Passkey creation failed';
    if (msg.includes('Abort') || msg.includes('cancel')) {
      throw new PasskeyError('Passkey creation was cancelled', 'CANCELLED', 'WARN');
    }
    throw new PasskeyError('Passkey creation failed — check authenticator availability', 'CREATE_FAILED', 'WARN');
  }

  if (!cred) {
    await auditPasskeyEvent('PASSKEY_CREATE_NULL', 'Credentials.create returned null', 'WARN');
    throw new PasskeyError('Passkey creation failed — no credential returned', 'NULL_CREDENTIAL', 'WARN');
  }

  const rawId = new Uint8Array(cred.rawId);
  const credentialIdB64u = toB64Url(rawId);

  await auditPasskeyEvent(
    'PASSKEY_CREATED',
    `Passkey created for ${userName} (credential present: ${!!cred})`,
    'INFO',
    { credentialIdB64u }
  );

  return { credentialIdB64u };
}

export async function authenticatePasskey({ credentialIdB64u = null, prfSaltB64u = null }) {
  const STAGE = 'passkeys';

  await auditPasskeyEvent('PASSKEY_AUTH_START', 'Starting passkey authentication', 'INFO', {
    hasCredentialId: !!credentialIdB64u,
    hasPrfSalt: !!prfSaltB64u
  });

  if (!window.PublicKeyCredential) {
    throw new PasskeyNotAvailableError('Passkeys not supported in this browser', 'UNSUPPORTED', 'WARN');
  }

  let challenge;
  try {
    challenge = crypto.getRandomValues(new Uint8Array(32));
  } catch (err) {
    await auditPasskeyEvent('PASSKEY_AUTH_CHALLENGE_FAILED', 'Failed to generate authentication challenge', 'CRITICAL');
    throw new PasskeyAuthError('Failed to generate challenge', 'CHALLENGE_FAILED', 'CRITICAL');
  }

  const allowCredentials = credentialIdB64u
    ? [{ type: 'public-key', id: fromB64Url(credentialIdB64u) }]
    : [];

  const publicKey = {
    challenge,
    allowCredentials,
    userVerification: 'required',
    timeout: 60000,
    extensions: prfSaltB64u
      ? { prf: { eval: { first: fromB64Url(prfSaltB64u) } } }
      : undefined
  };

  let assertion;
  try {
    assertion = await navigator.credentials.get({ publicKey });
  } catch (err) {
    await auditPasskeyEvent(
      'PASSKEY_AUTH_FAILED',
      'Passkey authentication failed',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );

    const msg = err instanceof Error ? err.message : 'Authentication failed';
    if (msg.includes('Abort') || msg.includes('cancel')) {
      throw new PasskeyAuthError('Passkey authentication was cancelled', 'CANCELLED', 'WARN');
    }
    throw new PasskeyAuthError('Authentication failed — check authenticator availability', 'AUTH_FAILED', 'WARN');
  }

  if (!assertion) {
    await auditPasskeyEvent('PASSKEY_AUTH_NULL', 'credentials.get returned null', 'WARN');
    throw new PasskeyAuthError('Authentication failed — no assertion returned', 'NULL_ASSERTION', 'WARN');
  }

  const ext = assertion.getClientExtensionResults?.() || {};
  const prfRes = ext?.prf?.results?.first;

  await auditPasskeyEvent('PASSKEY_AUTH_OK', 'Passkey authentication succeeded', 'INFO', {
    hasPrfBytes: !!prfRes
  });

  return {
    verified: true,
    prfBytes: prfRes ? new Uint8Array(prfRes) : null
  };
}

export function newPrfSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return toB64Url(salt);
}
