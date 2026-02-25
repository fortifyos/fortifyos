import { getKeyProvider } from './keyProvider';

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

export async function initSovereignKey({ passphrase } = {}) {
  const provider = getKeyProvider();
  // Native ignores passphrase by default (device secret), but web requires it.
  const { encKey, macKey } = await provider.init({ passphrase });
  return { encKey, macKey, providerId: provider.id };
}

export async function encryptJSON(encKey, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(obj));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, plaintext);
  return { ivB64: b64(iv), payloadB64: b64(new Uint8Array(ciphertext)) };
}

export async function decryptJSON(encKey, { ivB64, payloadB64 }) {
  const iv = unb64(ivB64);
  const payload = unb64(payloadB64);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, payload);
  return JSON.parse(dec.decode(new Uint8Array(plaintext)));
}

export async function hmacB64(macKey, text) {
  const sig = await crypto.subtle.sign('HMAC', macKey, enc.encode(String(text)));
  return b64(new Uint8Array(sig));
}

export async function verifyHmac(macKey, text, macB64) {
  const sig = unb64(macB64);
  return crypto.subtle.verify('HMAC', macKey, sig, enc.encode(String(text)));
}
