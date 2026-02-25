import { getCryptoMeta, saveCryptoMeta } from '../../db/sovereignDB';

/**
 * Native keystore model (hybrid):
 * - Store a random 32-byte device secret in the OS secure storage plugin
 * - Derive AES/HMAC keys from that secret (HKDF via WebCrypto)
 *
 * This provides device-bound custody in native shells (Capacitor) where the
 * secure storage implementation is backed by Keychain/Keystore.
 *
 * Requires: @capacitor-community/secure-storage (or compatible) available at runtime.
 */

const enc = new TextEncoder();

function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

async function getSecureStorage() {
  // Dynamic import so web builds don't require the plugin at runtime.
  const mod = await import('@capacitor-community/secure-storage');
  return mod?.SecureStoragePlugin;
}

async function getOrCreateSalt() {
  const meta = await getCryptoMeta();
  if (meta?.saltB64) return unb64(meta.saltB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await saveCryptoMeta({ saltB64: b64(salt) });
  return salt;
}

async function getOrCreateDeviceSecret() {
  const SecureStorage = await getSecureStorage();
  if (!SecureStorage) throw new Error('Secure storage plugin not available.');

  const key = 'FORTIFY_DEVICE_SECRET_V1';
  const existing = await SecureStorage.get({ key }).catch(() => null);
  if (existing?.value) return unb64(existing.value);

  const secret = crypto.getRandomValues(new Uint8Array(32));
  await SecureStorage.set({ key, value: b64(secret) });
  return secret;
}

async function hkdf(secret, salt) {
  const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('FORTIFYOS_KNOX_V3_KEYS') },
    ikm,
    512
  );
  const bytes = new Uint8Array(bits);
  const aesRaw = bytes.slice(0, 32);
  const hmacRaw = bytes.slice(32, 64);
  const encKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
  const macKey = await crypto.subtle.importKey('raw', hmacRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
  return { encKey, macKey };
}

export const NativeKeyProvider = {
  id: 'native',
  async init() {
    const salt = await getOrCreateSalt();
    const secret = await getOrCreateDeviceSecret();
    return hkdf(secret, salt);
  }
};
