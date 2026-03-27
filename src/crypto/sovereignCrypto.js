/**
 * TASK-FOS-002: Security Error Handling — sovereignCrypto
 *
 * Requirements:
 * - Typed exception classes
 * - No silent catches
 * - Consistent audit logging
 * - No sensitive detail leakage in user-facing errors
 */

import { secureLogRef } from '../agents/secureLogRef.js';
import { getKeyProvider } from './keyProvider/index.js';

// =============================================================================
// Typed Error Classes
// =============================================================================

export class CryptoError extends Error {
  constructor(message, public readonly code, public readonly severity = 'CRITICAL') {
    super(message);
    this.name = 'CryptoError';
  }
}

export class KeyProviderError extends Error {
  constructor(message, public readonly code, public readonly severity = 'CRITICAL') {
    super(message);
    this.name = 'KeyProviderError';
  }
}

export class EncryptionError extends Error {
  constructor(message, public readonly code, public readonly severity = 'CRITICAL') {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message, public readonly code, public readonly severity = 'CRITICAL') {
    super(message);
    this.name = 'DecryptionError';
  }
}

// =============================================================================
// Helpers
// =============================================================================

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// =============================================================================
// Audit Logging Wrapper
// =============================================================================

async function auditCryptoEvent(event, message, severity = 'INFO', extra = {}) {
  const log = secureLogRef();
  await log(event, message, 'sovereignCrypto', severity, extra);
}

// =============================================================================
// Core Operations
// =============================================================================

/**
 * Initializes the Sovereignty key set using the configured KeyProvider.
 * Returns encKey and macKey for use with sealJSON / hmacB64.
 *
 * @param {{ passphrase?: string }} [opts]
 * @param {string} [opts.passphrase] - Passphrase to pass to the key provider (provider-dependent)
 * @returns {Promise<{ encKey: CryptoKey, macKey: CryptoKey, providerId: string }>}
 * @throws {KeyProviderError} If the key provider is unavailable or initialization fails
 */
export async function initSovereignKey({ passphrase } = {}) {
  let provider;
  try {
    provider = getKeyProvider();
  } catch (err) {
    await auditCryptoEvent(
      'KEY_PROVIDER_INIT_FAILED',
      'Key provider unavailable',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new KeyProviderError('Key provider unavailable', 'PROVIDER_UNAVAILABLE', 'CRITICAL');
  }

  let result;
  try {
    result = await provider.init({ passphrase });
  } catch (err) {
    await auditCryptoEvent(
      'KEY_INIT_FAILED',
      'Sovereign key initialization failed',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new KeyProviderError(
      'Key initialization failed',
      'INIT_FAILED',
      'CRITICAL'
    );
  }

  if (!result?.encKey || !result?.macKey) {
    await auditCryptoEvent(
      'KEY_INIT_INCOMPLETE',
      'Key provider returned incomplete result',
      'CRITICAL',
      { hasEncKey: !!(result?.encKey), hasMacKey: !!(result?.macKey) }
    );
    throw new KeyProviderError('Key initialization returned incomplete result', 'INCOMPLETE_RESULT', 'CRITICAL');
  }

  await auditCryptoEvent('KEY_INIT_OK', `Sovereign key initialized (provider: ${provider.id})`, 'INFO', {
    providerId: provider.id
  });

  return { encKey: result.encKey, macKey: result.macKey, providerId: provider.id };
}

/**
 * Encrypts a serializable object to a sealed JSON blob using AES-256-GCM.
 * The result contains ivB64 and payloadB64 suitable for storage.
 *
 * @param {CryptoKey} encKey - AES-256-GCM key
 * @param {object} obj - Serializable object to encrypt
 * @returns {Promise<{ ivB64: string, payloadB64: string }>}
 * @throws {EncryptionError} If encKey is missing, obj is undefined, or encryption fails
 */
export async function encryptJSON(encKey, obj) {
  if (!encKey) {
    throw new EncryptionError('Encryption key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (obj === undefined) {
    throw new EncryptionError('Object to encrypt must be defined', 'UNDEFINED_PAYLOAD', 'CRITICAL');
  }

  let iv;
  try {
    iv = crypto.getRandomValues(new Uint8Array(12));
  } catch (err) {
    await auditCryptoEvent('ENCRYPT_IV_FAILED', 'Failed to generate IV', 'CRITICAL');
    throw new EncryptionError('Failed to generate IV', 'IV_FAILED', 'CRITICAL');
  }

  let plaintext;
  try {
    plaintext = enc.encode(JSON.stringify(obj));
  } catch (err) {
    await auditCryptoEvent(
      'ENCODE_FAILED',
      'Failed to encode object as JSON',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new EncryptionError('Failed to encode payload', 'ENCODE_FAILED', 'CRITICAL');
  }

  let ciphertext;
  try {
    ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, plaintext);
  } catch (err) {
    await auditCryptoEvent(
      'ENCRYPT_FAILED',
      'AES-GCM encryption failed',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new EncryptionError('Encryption failed', 'ENCRYPT_FAILED', 'CRITICAL');
  }

  return { ivB64: b64(iv), payloadB64: b64(new Uint8Array(ciphertext)) };
}

/**
 * Decrypts a sealed blob (from encryptJSON) back to a plain object.
 *
 * @param {CryptoKey} encKey - AES-256-GCM key (same key used to encrypt)
 * @param {{ ivB64: string, payloadB64: string }} sealed - Sealed object from encryptJSON
 * @returns {Promise<object>} Decrypted and parsed JSON object
 * @throws {DecryptionError} If encKey or sealed fields are missing, or decryption fails.
 *   Note: decryption failures do not reveal whether the key was wrong or the data was corrupted.
 */
export async function decryptJSON(encKey, { ivB64, payloadB64 }) {
  if (!encKey) {
    throw new DecryptionError('Encryption key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (!ivB64 || !payloadB64) {
    throw new DecryptionError('Sealed object must have ivB64 and payloadB64', 'INVALID_SEALED_OBJ', 'CRITICAL');
  }

  let iv, payload;
  try {
    iv = unb64(ivB64);
    payload = unb64(payloadB64);
  } catch (err) {
    await auditCryptoEvent(
      'B64_DECODE_FAILED',
      'Failed to decode base64 from sealed object',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new DecryptionError('Invalid sealed object encoding', 'B64_DECODE_FAILED', 'CRITICAL');
  }

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, payload);
  } catch (err) {
    await auditCryptoEvent(
      'DECRYPT_FAILED',
      'AES-GCM decryption failed',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    // Do not reveal whether the failure was due to wrong key vs. corrupted data
    throw new DecryptionError('Decryption failed', 'DECRYPT_FAILED', 'CRITICAL');
  }

  let parsed;
  try {
    parsed = JSON.parse(dec.decode(new Uint8Array(plaintext)));
  } catch (err) {
    await auditCryptoEvent(
      'JSON_PARSE_FAILED',
      'Decrypted payload is not valid JSON',
      'CRITICAL'
    );
    throw new DecryptionError('Decrypted payload is not valid JSON', 'JSON_PARSE_FAILED', 'CRITICAL');
  }

  return parsed;
}

/**
 * Computes HMAC-SHA256 of a text string and returns the result as base64.
 *
 * @param {CryptoKey} macKey - HMAC key
 * @param {string} text - Text to authenticate
 * @returns {Promise<string>} Base64-encoded HMAC-SHA256
 * @throws {CryptoError} If macKey is missing or text is undefined
 */
export async function hmacB64(macKey, text) {
  if (!macKey) {
    throw new CryptoError('MAC key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (text === undefined) {
    throw new CryptoError('Text to MAC must be defined', 'UNDEFINED_TEXT', 'CRITICAL');
  }

  let sig;
  try {
    sig = await crypto.subtle.sign('HMAC', macKey, enc.encode(String(text)));
  } catch (err) {
    await auditCryptoEvent(
      'HMAC_FAILED',
      'HMAC computation failed',
      'CRITICAL',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    throw new CryptoError('HMAC failed', 'HMAC_FAILED', 'CRITICAL');
  }

  return b64(new Uint8Array(sig));
}

/**
 * Verifies an HMAC over a text string.
 * Returns false if the MAC does not match — does not throw on verification failure.
 *
 * @param {CryptoKey} macKey - HMAC key
 * @param {string} text - Text that was authenticated
 * @param {string} macB64 - Base64-encoded HMAC to verify
 * @returns {Promise<boolean>} True if MAC is valid, false otherwise
 * @throws {CryptoError} If macKey or macB64 is missing
 */
export async function verifyHmac(macKey, text, macB64) {
  if (!macKey) {
    throw new CryptoError('MAC key is required', 'KEY_MISSING', 'CRITICAL');
  }
  if (!macB64) {
    throw new CryptoError('MAC value is required', 'MAC_MISSING', 'CRITICAL');
  }

  let sig;
  try {
    sig = unb64(macB64);
  } catch (err) {
    await auditCryptoEvent(
      'HMAC_VERIFY_B64_FAILED',
      'Invalid base64 in MAC value',
      'WARN'
    );
    throw new CryptoError('Invalid MAC encoding', 'B64_DECODE_FAILED', 'WARN');
  }

  let ok;
  try {
    ok = await crypto.subtle.verify('HMAC', macKey, sig, enc.encode(String(text)));
  } catch (err) {
    await auditCryptoEvent(
      'HMAC_VERIFY_FAILED',
      'HMAC verification threw',
      'WARN',
      { code: err instanceof Error ? err.name : 'UnknownError' }
    );
    // Verification errors return false rather than throwing
    return false;
  }

  if (!ok) {
    await auditCryptoEvent('HMAC_VERIFY_FAILED', 'MAC mismatch', 'WARN');
  } else {
    await auditCryptoEvent('HMAC_VERIFY_OK', 'MAC verified', 'INFO');
  }

  return ok;
}
