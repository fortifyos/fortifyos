/**
 * TASK-FOS-002: Security Error Handling — vaultSigning
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

export class SigningError extends Error {
  constructor(message, public readonly code, public readonly severity = 'WARN') {
    super(message);
    this.name = 'SigningError';
  }
}

export class CryptoKeyError extends Error {
  constructor(message, public readonly code, public readonly severity = 'CRITICAL') {
    super(message);
    this.name = 'CryptoKeyError';
  }
}

export class SignatureError extends Error {
  constructor(message, public readonly code, public readonly severity = 'WARN') {
    super(message);
    this.name = 'SignatureError';
  }
}

// =============================================================================
// Helpers
// =============================================================================

const enc = new TextEncoder();

function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function stableStringify(obj) {
  const allKeys = [];
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v));
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

// =============================================================================
// Audit Logging Wrapper — replaces bare throw with audit trail
// =============================================================================

async function auditSigningEvent(event, message, severity = 'INFO', extra = {}) {
  const log = secureLogRef();
  await log(event, message, 'vaultSigning', severity, extra);
}

// =============================================================================
// Core Operations
// =============================================================================

export async function sha256B64(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return b64(new Uint8Array(h));
}

export async function ensureSigningKeys({ encKey, cryptoMeta, saveCryptoMeta, encryptJSON, decryptJSON }) {
  const STAGE = 'vaultSigning';

  // Validate required inputs — reject before any crypto operation
  if (!encKey) {
    throw new CryptoKeyError('Encryption key is required', 'KEY_MISSING', 'CRITICAL');
  }

  try {
    // Check for existing key material
    if (cryptoMeta?.signingPubJwk && cryptoMeta?.signingPrivSealed?.ivB64 && cryptoMeta?.signingPrivSealed?.payloadB64) {
      await auditSigningEvent('SIGNING_KEY_LOAD', 'Loading existing signing keypair', 'INFO');

      let privJwk, pubKey, privKey, fp;

      try {
        privJwk = await decryptJSON(encKey, cryptoMeta.signingPrivSealed);
      } catch (err) {
        await auditSigningEvent(
          'SIGNING_KEY_DECRYPT_FAILED',
          'Failed to decrypt signing private key — may be corrupted or wrong encryption key',
          'CRITICAL',
          { code: err instanceof Error ? err.name : 'UnknownError' }
        );
        throw new CryptoKeyError(
          'Signing key decryption failed — the encryption key may have changed',
          'KEY_DECRYPT_FAILED',
          'CRITICAL'
        );
      }

      try {
        pubKey = await crypto.subtle.importKey(
          'jwk', cryptoMeta.signingPubJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true, ['verify']
        );
      } catch (err) {
        await auditSigningEvent(
          'PUBLIC_KEY_IMPORT_FAILED',
          'Failed to import signing public key',
          'CRITICAL',
          { code: err instanceof Error ? err.name : 'UnknownError' }
        );
        throw new CryptoKeyError('Public key import failed', 'PUBKEY_IMPORT_FAILED', 'CRITICAL');
      }

      try {
        privKey = await crypto.subtle.importKey(
          'jwk', privJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false, ['sign']
        );
      } catch (err) {
        await auditSigningEvent(
          'PRIVATE_KEY_IMPORT_FAILED',
          'Failed to import signing private key',
          'CRITICAL',
          { code: err instanceof Error ? err.name : 'UnknownError' }
        );
        throw new CryptoKeyError('Private key import failed', 'PRIVKEY_IMPORT_FAILED', 'CRITICAL');
      }

      try {
        fp = await sha256B64(stableStringify(cryptoMeta.signingPubJwk));
      } catch (err) {
        await auditSigningEvent(
          'FINGERPRINT_COMPUTE_FAILED',
          'Failed to compute key fingerprint',
          'WARN',
          { code: err instanceof Error ? err.name : 'UnknownError' }
        );
        throw new SigningError('Fingerprint computation failed', 'FINGERPRINT_FAILED', 'WARN');
      }

      await auditSigningEvent('SIGNING_KEY_LOADED', 'Signing keypair loaded successfully', 'INFO', { fingerprintB64: fp });
      return { pubKey, privKey, fingerprintB64: fp };
    }

    // No existing keys — generate new keypair
    await auditSigningEvent('SIGNING_KEY_GEN', 'Generating new ECDSA P-256 signing keypair', 'INFO');

    let keypair, pubJwk, privJwk, sealedPriv, fp;

    try {
      keypair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
    } catch (err) {
      await auditSigningEvent(
        'SIGNING_KEY_GEN_FAILED',
        'Failed to generate signing keypair',
        'CRITICAL',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new CryptoKeyError('Signing key generation failed', 'KEY_GEN_FAILED', 'CRITICAL');
    }

    try {
      pubJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
      privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    } catch (err) {
      await auditSigningEvent(
        'KEY_EXPORT_FAILED',
        'Failed to export JWK from generated keypair',
        'CRITICAL',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new SigningError('Key export failed', 'KEY_EXPORT_FAILED', 'CRITICAL');
    }

    try {
      sealedPriv = await encryptJSON(encKey, privJwk);
    } catch (err) {
      await auditSigningEvent(
        'PRIVATE_KEY_SEAL_FAILED',
        'Failed to encrypt private key for storage',
        'CRITICAL',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new SigningError('Private key sealing failed', 'KEY_SEAL_FAILED', 'CRITICAL');
    }

    try {
      fp = await sha256B64(stableStringify(pubJwk));
    } catch (err) {
      await auditSigningEvent(
        'FINGERPRINT_COMPUTE_FAILED',
        'Fingerprint computation failed after new key generation',
        'WARN',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new SigningError('Fingerprint computation failed', 'FINGERPRINT_FAILED', 'WARN');
    }

    try {
      await saveCryptoMeta({
        ...(cryptoMeta || {}),
        signingPubJwk: pubJwk,
        signingPrivSealed: sealedPriv,
        signingFingerprintB64: fp
      });
    } catch (err) {
      await auditSigningEvent(
        'CRYPTO_META_SAVE_FAILED',
        'Failed to save signing metadata — keypair generated but not persisted',
        'CRITICAL',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new SigningError('Failed to save signing metadata', 'META_SAVE_FAILED', 'CRITICAL');
    }

    let pubKey, privKey;
    try {
      pubKey = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true, ['verify']
      );
      privKey = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
      );
    } catch (err) {
      await auditSigningEvent(
        'KEY_IMPORT_AFTER_SAVE_FAILED',
        'Keypair saved but failed to re-import for return',
        'CRITICAL',
        { code: err instanceof Error ? err.name : 'UnknownError' }
      );
      throw new CryptoKeyError('Key import after save failed', 'KEY_IMPORT_POST_SAVE_FAILED', 'CRITICAL');
    }

    await auditSigningEvent(
      'SIGNING_KEY_CREATED',
      'New signing keypair generated and stored',
      'INFO',
      { fingerprintB64: fp }
    );

    return { pubKey, privKey, fingerprintB64: fp };
  } catch (err) {
    // Already audited + rethrown as typed error — propagate unchanged
    if (err instanceof SigningError || err instanceof CryptoKeyError) throw err;
    // Defensive: any unexpected error gets audited before propagation
    await auditSigningEvent(
      'UNEXPECTED_SIGNING_ERROR',
      err instanceof Error ? err.message : String(err),
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new SigningError(
      err instanceof Error ? err.message : 'Unknown signing error',
      'UNEXPECTED',
      'CRITICAL'
    );
  }
}

export async function signExport(privKey, exportObj) {
  if (!privKey) {
    throw new CryptoKeyError('Private key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (!exportObj) {
    throw new SigningError('Export object is required', 'EXPORT_OBJ_MISSING', 'WARN');
  }

  const canonical = stableStringify(exportObj);

  let sig;
  try {
    sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privKey,
      enc.encode(canonical)
    );
  } catch (err) {
    await auditSigningEvent(
      'SIGN_FAILED',
      'Signing operation failed',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new SignatureError('Signing failed', 'SIGN_FAILED', 'WARN');
  }

  await auditSigningEvent('EXPORT_SIGNED', 'Export object signed', 'INFO', { type: typeof exportObj });
  return b64(new Uint8Array(sig));
}

export async function verifyExportSignature(pubKey, exportObj, sigB64) {
  if (!pubKey) {
    throw new CryptoKeyError('Public key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (!exportObj) {
    throw new SigningError('Export object is required', 'EXPORT_OBJ_MISSING', 'WARN');
  }
  if (!sigB64) {
    throw new SignatureError('Signature is required', 'SIG_MISSING', 'WARN');
  }

  const canonical = stableStringify(exportObj);

  let ok;
  try {
    ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      unb64(sigB64),
      enc.encode(canonical)
    );
  } catch (err) {
    await auditSigningEvent(
      'SIG_VERIFY_ERROR',
      'Signature verification threw an error',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    // Verification errors return false, not exceptions
    return false;
  }

  if (!ok) {
    await auditSigningEvent('SIG_VERIFY_FAILED', 'Export signature mismatch — data may have been tampered with', 'WARN');
  } else {
    await auditSigningEvent('SIG_VERIFY_OK', 'Export signature verified', 'INFO');
  }

  return ok;
}
