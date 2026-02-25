import { getCryptoMeta, saveCryptoMeta } from '../../db/sovereignDB';

const enc = new TextEncoder();

function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

async function getOrCreateSalt() {
  const meta = await getCryptoMeta();
  if (meta?.saltB64) return unb64(meta.saltB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await saveCryptoMeta({ saltB64: b64(salt) });
  return salt;
}

async function deriveKeysFromPassphrase(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, baseKey, 512);
  const bytes = new Uint8Array(bits);
  return await importKeys(bytes.slice(0,32), bytes.slice(32,64));
}

async function importKeys(aesRaw, hmacRaw) {
  const encKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
  const macKey = await crypto.subtle.importKey('raw', hmacRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
  return { encKey, macKey };
}

export const WebKeyProvider = {
  id: 'web',
  async init({ passphrase }) {
    if (!passphrase || passphrase.length < 10) throw new Error('Passphrase required (min 10 chars).');
    const salt = await getOrCreateSalt();
    return deriveKeysFromPassphrase(passphrase, salt);
  }
};
