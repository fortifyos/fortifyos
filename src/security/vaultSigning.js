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

export async function sha256B64(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return b64(new Uint8Array(h));
}

export async function ensureSigningKeys({ encKey, cryptoMeta, saveCryptoMeta, encryptJSON, decryptJSON }) {
  // Uses ECDSA P-256 because it is broadly supported in WebCrypto.
  // (Ed25519 is not consistently available across browsers.)
  if (cryptoMeta?.signingPubJwk && cryptoMeta?.signingPrivSealed?.ivB64 && cryptoMeta?.signingPrivSealed?.payloadB64) {
    const privJwk = await decryptJSON(encKey, cryptoMeta.signingPrivSealed);
    const pubKey = await crypto.subtle.importKey('jwk', cryptoMeta.signingPubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    const privKey = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const fp = await sha256B64(stableStringify(cryptoMeta.signingPubJwk));
    return { pubKey, privKey, fingerprintB64: fp };
  }

  const keypair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const pubJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);

  const sealedPriv = await encryptJSON(encKey, privJwk);
  const fp = await sha256B64(stableStringify(pubJwk));

  await saveCryptoMeta({
    ...(cryptoMeta || {}),
    signingPubJwk: pubJwk,
    signingPrivSealed: sealedPriv,
    signingFingerprintB64: fp
  });

  const pubKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  const privKey = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  return { pubKey, privKey, fingerprintB64: fp };
}

export async function signExport(privKey, exportObj) {
  const canonical = stableStringify(exportObj);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    enc.encode(canonical)
  );
  return b64(new Uint8Array(sig));
}

export async function verifyExportSignature(pubKey, exportObj, sigB64) {
  const canonical = stableStringify(exportObj);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pubKey,
    unb64(sigB64),
    enc.encode(canonical)
  );
  return ok;
}
