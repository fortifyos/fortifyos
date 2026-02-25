import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../db/sovereignDB';
import { isNativeRuntime } from '../platform/isNative';
import { initSovereignKey, encryptJSON, decryptJSON, hmacB64 } from '../crypto/sovereignCrypto';
import { setSecureLog } from '../agents/secureLogRef';
import { computeEventHash, verifyAuditChain } from './auditChain';
import { passkeysSupported, createPasskey, authenticatePasskey, newPrfSalt } from './passkeys';
import { ensureSigningKeys, signExport, verifyExportSignature, sha256B64 } from './vaultSigning';
import { issueAgentToken, verifyAgentToken } from '../agents/leaseTokens';
import { verifyBiometric } from '../platform/biometrics';

const SovereignContext = createContext(null);

function bytesToPassphrase(bytes) {
  // deterministic text form for PBKDF2 input
  return btoa(String.fromCharCode(...bytes));
}

function randomVaultId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function randomEpochId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export function SovereignProvider({ children }) {
  const [encKey, setEncKey] = useState(null);
  const [macKey, setMacKey] = useState(null);
  const [locked, setLocked] = useState(true);
  const [isSecure, setIsSecure] = useState(false);

  // Passkey state (stored in cryptoMeta)
  const [passkeyState, setPasskeyState] = useState({ supported: false, enabled: false, require: false, prfReady: false });
  const [passkeyVerified, setPasskeyVerified] = useState(false);

  // Vault lineage + signing
  const [epochId, setEpochId] = useState(null);
  const [signPubKey, setSignPubKey] = useState(null);
  const [signPrivKey, setSignPrivKey] = useState(null);
  const [signFingerprint, setSignFingerprint] = useState(null);

  // Observation Gate
  const [observation, setObservation] = useState({ state: 'NORMAL', days: 90, lastUnlockAt: null });

  const refreshPasskeyState = async () => {
    const meta = await db.cryptoMeta.get('primary');
    const sup = await passkeysSupported();
    setPasskeyState({
      supported: sup.supported,
      enabled: !!meta?.passkeyCredentialIdB64u,
      require: !!meta?.requirePasskey,
      prfReady: !!meta?.passkeyPrfSaltB64u
    });
  };

  useEffect(() => { refreshPasskeyState(); }, []);

  const registerPasskey = async () => {
    const sup = await passkeysSupported();
    if (!sup.supported) throw new Error('Passkeys not supported on this device/browser.');

    const { credentialIdB64u } = await createPasskey({ rpName: 'FortifyOS', userName: 'Primary', userId: 'primary' });
    // Create PRF salt for platforms that support it
    const prfSaltB64u = newPrfSalt();

    const existing = await db.cryptoMeta.get('primary');
    await db.cryptoMeta.put({
      id: 'primary',
      ...(existing || {}),
      passkeyCredentialIdB64u: credentialIdB64u,
      passkeyPrfSaltB64u: prfSaltB64u,
      requirePasskey: existing?.requirePasskey ?? false
    });

    await refreshPasskeyState();
  };

  const verifyPasskey = async () => {
    const meta = await db.cryptoMeta.get('primary');
    if (!meta?.passkeyCredentialIdB64u) throw new Error('No passkey registered.');

    const res = await authenticatePasskey({
      credentialIdB64u: meta.passkeyCredentialIdB64u,
      prfSaltB64u: meta.passkeyPrfSaltB64u
    });

    setPasskeyVerified(true);
    return res;
  };

  const setRequirePasskey = async (value) => {
    const existing = await db.cryptoMeta.get('primary');
    await db.cryptoMeta.put({
      id: 'primary',
      ...(existing || {}),
      requirePasskey: !!value
    });
    await refreshPasskeyState();
  };

  const setRequireBiometricNative = async (value) => {
    const existing = await db.cryptoMeta.get('primary');
    await db.cryptoMeta.put({
      id: 'primary',
      ...(existing || {}),
      requireBiometricNative: !!value
    });
  };

  const unlock = async (passphrase) => {
    // Web requires passphrase; native uses device secret by default.
    const native = isNativeRuntime();
    // If require passkey, enforce verification first (fallback path)
    const meta = await db.cryptoMeta.get('primary');

    // Native: require biometric prompt (default ON) before loading device secret.
    if (native && (meta?.requireBiometricNative ?? true)) {
      const bio = await verifyBiometric({ reason: 'Unlock FortifyOS Vault' });
      if (!bio.ok) throw new Error('Biometric verification required.');
    }

    if (meta?.requirePasskey && meta?.passkeyCredentialIdB64u && !passkeyVerified) {
      throw new Error('Passkey verification required.');
    }

    const { encKey, macKey, providerId } = await initSovereignKey({ passphrase });
    const now = Date.now();
    const metaBeforeUnlock = await db.cryptoMeta.get('primary');
    const previousLastUnlockAt = metaBeforeUnlock?.lastUnlockAt ?? null;
    setEncKey(encKey);
    setMacKey(macKey);
    setLocked(false);
    setIsSecure(true);
    setPasskeyVerified(false);

    // Initialize vault identity + epoch + monotonic counter (anti-rollback)
    await db.transaction('rw', db.cryptoMeta, db.auditLog, async () => {
      const current = await db.cryptoMeta.get('primary');
      const last = await db.auditLog.orderBy('seq').last();
      const maxSeq = current?.maxSeq ?? (last?.seq || 0);

      const obsDays = Number(current?.observationDays ?? 90);
      const shouldObserve = previousLastUnlockAt && (now - previousLastUnlockAt) > obsDays * 24 * 60 * 60 * 1000;
      const obsState = shouldObserve ? 'OBSERVATION' : (current?.observationState || 'NORMAL');

      await db.cryptoMeta.put({
        id: 'primary',
        ...(current || {}),
        providerId,
        vaultId: current?.vaultId || randomVaultId(),
        epochId: current?.epochId || randomEpochId(),
        createdAt: current?.createdAt || Date.now(),
        maxSeq,
        lastUnlockAt: now,
        observationDays: obsDays,
        observationState: obsState
      });
    });

    // Load epoch + observation state into memory
    const metaAfter = await db.cryptoMeta.get('primary');
    setEpochId(metaAfter?.epochId || null);
    setObservation({
      state: metaAfter?.observationState || 'NORMAL',
      days: Number(metaAfter?.observationDays ?? 90),
      lastUnlockAt: metaAfter?.lastUnlockAt ?? null
    });

    // Ensure signing keys exist (used for export provenance + agent lease tokens)
    const keys = await ensureSigningKeys({
      encKey,
      cryptoMeta: metaAfter,
      saveCryptoMeta: async (next) => {
        await db.cryptoMeta.put({ id: 'primary', ...next });
      },
      encryptJSON,
      decryptJSON
    });
    setSignPubKey(keys.pubKey);
    setSignPrivKey(keys.privKey);
    setSignFingerprint(keys.fingerprintB64);

    // Best-effort: request persistent storage (reduces risk of eviction)
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  };

  const unlockWithPasskey = async () => {
    const meta = await db.cryptoMeta.get('primary');
    if (!meta?.passkeyCredentialIdB64u) throw new Error('No passkey registered.');

    const res = await authenticatePasskey({
      credentialIdB64u: meta.passkeyCredentialIdB64u,
      prfSaltB64u: meta.passkeyPrfSaltB64u
    });

    // If PRF results present, we can derive a stable passphrase without user typing.
    if (!res.prfBytes) {
      setPasskeyVerified(true);
      throw new Error('Passkey verified, but PRF not available on this platform. Enter passphrase to unlock.');
    }

    const derivedPass = bytesToPassphrase(res.prfBytes);
    await unlock(derivedPass);
  };

  const lock = () => {
    setEncKey(null);
    setMacKey(null);
    setLocked(true);
    setIsSecure(false);
    setPasskeyVerified(false);
    setSignPubKey(null);
    setSignPrivKey(null);
    setSignFingerprint(null);
    setEpochId(null);
    setObservation({ state: 'NORMAL', days: 90, lastUnlockAt: null });
  };

  const getChainTip = async () => {
    const last = await db.auditLog.orderBy('seq').last();
    return last?.hashB64 || 'GENESIS';
  };

  const secureLog = async (type, message, stage, severity = 'INFO', extra = {}) => {
    if (!encKey) return;

    const timestamp = Date.now();
    const sealed = await encryptJSON(encKey, { message, ts: timestamp, stage, severity, ...extra });

    await db.transaction('rw', db.cryptoMeta, db.auditLog, async () => {
      const meta = await db.cryptoMeta.get('primary');
      const eId = meta?.epochId || epochId || 'UNKNOWN_EPOCH';
      const nextSeq = (meta?.maxSeq || 0) + 1;

      const last = await db.auditLog.orderBy('seq').last();
      const prevHashB64 = last?.hashB64 || 'GENESIS';

      const hashB64 = await computeEventHash({
        epochId: eId,
        prevHashB64,
        seq: nextSeq,
        timestamp,
        type,
        stage,
        severity,
        ivB64: sealed.ivB64,
        payloadB64: sealed.payloadB64
      });

      await db.auditLog.add({
        seq: nextSeq,
        epochId: eId,
        timestamp,
        type,
        stage,
        severity,
        ivB64: sealed.ivB64,
        payloadB64: sealed.payloadB64,
        prevHashB64,
        hashB64
      });

      await db.cryptoMeta.put({ id: 'primary', ...(meta || {}), maxSeq: nextSeq });
    });
  };

  const verifyChain = async () => {
    const events = await db.auditLog.orderBy('seq').toArray();
    return await verifyAuditChain(events);
  };

useEffect(() => {
    if (!locked && encKey) setSecureLog(secureLog);
  }, [locked, encKey]);

  useEffect(() => {
    (async () => {
      if (!locked && encKey) {
        await secureLog('SYSTEM_IGNITION', 'Sovereign Terminal Online', 0, 'INFO');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Auto-lock on inactivity + backgrounding (high ROI for mobile security)
  useEffect(() => {
    if (locked) return;

    let idleTimer = null;
    const AUTO_LOCK_DEFAULT = 300; // seconds

    const schedule = async () => {
      const meta = await db.cryptoMeta.get('primary');
      const seconds = Number(meta?.autoLockSeconds ?? AUTO_LOCK_DEFAULT);
      if (seconds <= 0) return; // disabled

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        lock();
      }, seconds * 1000);
    };

    const onActivity = () => { schedule(); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Immediate lock on background to protect decrypted state
        lock();
      } else {
        schedule();
      }
    };

    schedule();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const executeSovereignAction = async (actionName, stage, actionFn) => {
    if (locked) throw new Error('Sovereign Vault is locked.');

    await secureLog('ACTION_EXECUTE', `User initiated: ${actionName}`, stage);

    try {
      const result = await actionFn();
      await secureLog('ACTION_SUCCESS', `Completed: ${actionName}`, stage);
      return result;
    } catch (err) {
      await secureLog('ACTION_FAILURE', `Failure in ${actionName}: ${err?.message || String(err)}`, stage, 'CRITICAL');
      throw err;
    }
  };

  const exportVault = async () => {
    if (locked) throw new Error('Vault locked.');
    if (!macKey) throw new Error('Integrity key unavailable.');

    const cryptoMeta = await db.cryptoMeta.get('primary');
    const auditLog = await db.auditLog.toArray();
    const ingests = await db.ingests.toArray();
    const signers = await db.signers.toArray();
    const macroHistory = await db.macroHistory.toArray();
    const agents = await db.agents.toArray();
    const policy = await db.policy.toArray();

    const exportedAt = Date.now();
    const payload = { v: '3.0.9', exportedAt, cryptoMeta, auditLog, ingests, signers, macroHistory, agents, policy };
    const sealed = await encryptJSON(encKey, payload);

    // Local integrity: HMAC over sealed payload (detects corruption/tamper of export file)
    const mac = await hmacB64(macKey, `KNOXVAULT|${sealed.ivB64}|${sealed.payloadB64}`);

    // Export provenance signature (device-local signing key)
    if (!signPrivKey) throw new Error('Signing key unavailable.');

    const exportHeader = {
      format: 'KNOXVAULT',
      v: '3.0.9',
      epochId: cryptoMeta?.epochId,
      maxSeq: cryptoMeta?.maxSeq || 0,
      exportedAt,
      ivB64: sealed.ivB64,
      payloadB64: sealed.payloadB64,
      macB64: mac,
      macAlg: 'HMAC-SHA-256',
      signingPubJwk: cryptoMeta?.signingPubJwk,
      signingFingerprintB64: cryptoMeta?.signingFingerprintB64 || signFingerprint
    };

    const sigB64 = await signExport(signPrivKey, exportHeader);
    const fileObj = { ...exportHeader, sigB64, sigAlg: 'ECDSA-P256-SHA256' };
    return new Blob([JSON.stringify(fileObj)], { type: 'application/json' });
  };

  const importVault = async (file) => {
    if (locked) throw new Error('Vault locked.');
    if (!macKey) throw new Error('Integrity key unavailable.');
    const text = await file.text();
    const obj = JSON.parse(text);

    if (obj?.format !== 'KNOXVAULT') throw new Error('Invalid vault file format.');

    // Verify export provenance signature (if present)
    if (obj?.sigAlg === 'ECDSA-P256-SHA256') {
      if (!obj?.signingPubJwk) throw new Error('Missing signing public key in vault file.');
      const pubKey = await crypto.subtle.importKey('jwk', obj.signingPubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
      const headerForVerify = { ...obj };
      delete headerForVerify.sigB64;
      delete headerForVerify.sigAlg;
      const ok = await verifyExportSignature(pubKey, headerForVerify, obj.sigB64);
      if (!ok) throw new Error('Vault signature verification failed.');
    }

    // Verify file integrity before attempting decryption
    if (obj?.macAlg === 'HMAC-SHA-256') {
      const expected = await hmacB64(macKey, `KNOXVAULT|${obj.ivB64}|${obj.payloadB64}`);
      if (!obj?.macB64 || expected !== obj.macB64) {
        throw new Error('Vault integrity check failed (MAC mismatch).');
      }
    }

    const decrypted = await decryptJSON(encKey, { ivB64: obj.ivB64, payloadB64: obj.payloadB64 });


    const currentMeta = await db.cryptoMeta.get('primary');
    const localEpoch = currentMeta?.epochId || null;
    const importedEpoch = obj?.epochId || decrypted?.cryptoMeta?.epochId || null;

    // Epoch/lineage enforcement (STRICT): imported epoch must match local epoch.
    // Note: a brand-new device will still have an epoch after first unlock; adoption must be explicit.
    const localInitialized = !!localEpoch;
    if (localInitialized && importedEpoch && importedEpoch !== localEpoch) {
      throw new Error('Epoch mismatch: vault lineage does not match this device. Use Adopt ceremony to assume this lineage.');
    }
    const currentMaxSeq = currentMeta?.maxSeq || 0;
    const importedMaxSeq = Math.max(
      decrypted?.cryptoMeta?.maxSeq || 0,
      Array.isArray(decrypted?.auditLog) && decrypted.auditLog.length
        ? Math.max(...decrypted.auditLog.map(e => e.seq || 0))
        : 0
    );
    if (currentMaxSeq && importedMaxSeq && importedMaxSeq < currentMaxSeq) {
      throw new Error(`Rollback detected: imported maxSeq ${importedMaxSeq} < local maxSeq ${currentMaxSeq}`);
    }
    // Anti-replay: reject equal-or-lower seq imports within same epoch (unless local is empty)
    if (currentMaxSeq && importedMaxSeq && importedMaxSeq <= currentMaxSeq) {
      throw new Error(`Replay detected: imported maxSeq ${importedMaxSeq} <= local maxSeq ${currentMaxSeq}`);
    }
    await db.transaction('rw', db.cryptoMeta, db.auditLog, db.ingests, db.signers, db.macroHistory, db.agents, db.policy, async () => {
      await db.auditLog.clear();
      await db.ingests.clear();
      await db.signers.clear();
      await db.macroHistory.clear();
      await db.agents.clear();
      await db.policy.clear();

      if (decrypted.cryptoMeta) {
        // If local has no epochId yet, adopt imported lineage.
        const merged = { ...(decrypted.cryptoMeta || {}) };
        if (!localInitialized && importedEpoch) merged.epochId = importedEpoch;
        await db.cryptoMeta.put({ id: 'primary', ...merged });
      }

      if (Array.isArray(decrypted.auditLog) && decrypted.auditLog.length) await db.auditLog.bulkAdd(decrypted.auditLog);
      if (Array.isArray(decrypted.ingests) && decrypted.ingests.length) await db.ingests.bulkAdd(decrypted.ingests);
      if (Array.isArray(decrypted.signers) && decrypted.signers.length) await db.signers.bulkAdd(decrypted.signers);
      if (Array.isArray(decrypted.macroHistory) && decrypted.macroHistory.length) await db.macroHistory.bulkAdd(decrypted.macroHistory);
      if (Array.isArray(decrypted.agents) && decrypted.agents.length) await db.agents.bulkAdd(decrypted.agents);
      if (Array.isArray(decrypted.policy) && decrypted.policy.length) await db.policy.bulkAdd(decrypted.policy);
    });

    await refreshPasskeyState();
    await secureLog('VAULT_IMPORT', 'Vault import completed', 0, 'WARN', { importedAt: Date.now() });
  };

  // Adopt ceremony: explicit lineage takeover for a new device (or deliberate re-alignment).
  // This bypasses epoch mismatch checks by overwriting local epochId with the imported epoch.
  // Anti-corruption remains enforced via MAC + signature checks.
  const adoptVault = async (file) => {
    if (locked) throw new Error('Vault locked.');
    if (!macKey) throw new Error('Integrity key unavailable.');

    const existing = await db.cryptoMeta.get('primary');
    // If passkey required, force verification before lineage changes.
    if (existing?.requirePasskey && existing?.passkeyCredentialIdB64u && !passkeyVerified) {
      throw new Error('Passkey verification required.');
    }

    const text = await file.text();
    const obj = JSON.parse(text);
    if (obj?.format !== 'KNOXVAULT') throw new Error('Invalid vault file format.');

    // Verify export provenance signature (if present)
    if (obj?.sigAlg === 'ECDSA-P256-SHA256') {
      if (!obj?.signingPubJwk) throw new Error('Missing signing public key in vault file.');
      const pubKey = await crypto.subtle.importKey('jwk', obj.signingPubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
      const headerForVerify = { ...obj };
      delete headerForVerify.sigB64;
      delete headerForVerify.sigAlg;
      const ok = await verifyExportSignature(pubKey, headerForVerify, obj.sigB64);
      if (!ok) throw new Error('Vault signature verification failed.');
    }

    // Verify file integrity before attempting decryption
    if (obj?.macAlg === 'HMAC-SHA-256') {
      const expected = await hmacB64(macKey, `KNOXVAULT|${obj.ivB64}|${obj.payloadB64}`);
      if (!obj?.macB64 || expected !== obj.macB64) {
        throw new Error('Vault integrity check failed (MAC mismatch).');
      }
    }

    const decrypted = await decryptJSON(encKey, { ivB64: obj.ivB64, payloadB64: obj.payloadB64 });

    const importedEpoch = obj?.epochId || decrypted?.cryptoMeta?.epochId || null;
    if (!importedEpoch) throw new Error('Imported vault missing epochId.');

    const importedMaxSeq = Math.max(
      decrypted?.cryptoMeta?.maxSeq || 0,
      Array.isArray(decrypted?.auditLog) && decrypted.auditLog.length
        ? Math.max(...decrypted.auditLog.map(e => e.seq || 0))
        : 0
    );

    // Preserve device-local passkey identifiers; vault lineage and content are adopted from import.
    const preserve = {
      passkeyCredentialIdB64u: existing?.passkeyCredentialIdB64u,
      passkeyPrfSaltB64u: existing?.passkeyPrfSaltB64u,
      requirePasskey: existing?.requirePasskey ?? false,
      autoLockSeconds: existing?.autoLockSeconds,
      observationDays: existing?.observationDays
    };

    await db.transaction('rw', db.cryptoMeta, db.auditLog, db.ingests, db.signers, db.macroHistory, db.agents, db.policy, async () => {
      await db.auditLog.clear();
      await db.ingests.clear();
      await db.signers.clear();
      await db.macroHistory.clear();
      await db.agents.clear();
      await db.policy.clear();

      const nextMeta = {
        ...(decrypted.cryptoMeta || {}),
        epochId: importedEpoch,
        maxSeq: importedMaxSeq,
        adoptedAt: Date.now(),
        ...preserve
      };
      await db.cryptoMeta.put({ id: 'primary', ...nextMeta });

      if (Array.isArray(decrypted.auditLog) && decrypted.auditLog.length) await db.auditLog.bulkAdd(decrypted.auditLog);
      if (Array.isArray(decrypted.ingests) && decrypted.ingests.length) await db.ingests.bulkAdd(decrypted.ingests);
      if (Array.isArray(decrypted.signers) && decrypted.signers.length) await db.signers.bulkAdd(decrypted.signers);
      if (Array.isArray(decrypted.macroHistory) && decrypted.macroHistory.length) await db.macroHistory.bulkAdd(decrypted.macroHistory);
      if (Array.isArray(decrypted.agents) && decrypted.agents.length) await db.agents.bulkAdd(decrypted.agents);
      if (Array.isArray(decrypted.policy) && decrypted.policy.length) await db.policy.bulkAdd(decrypted.policy);
    });

    await refreshPasskeyState();
    const metaAfter = await db.cryptoMeta.get('primary');
    setEpochId(metaAfter?.epochId || null);
    setObservation({
      state: metaAfter?.observationState || 'NORMAL',
      days: Number(metaAfter?.observationDays ?? 90),
      lastUnlockAt: metaAfter?.lastUnlockAt ?? null
    });

    await secureLog('VAULT_ADOPT', 'Vault lineage adopted from import', 0, 'CRITICAL', { importedEpoch, importedMaxSeq });
  };

  const setObservationDays = async (days) => {
    const d = Math.max(1, Math.min(3650, Number(days) || 90));
    const existing = await db.cryptoMeta.get('primary');
    await db.cryptoMeta.put({ id: 'primary', ...(existing || {}), observationDays: d });
    setObservation((o) => ({ ...o, days: d }));
    await secureLog('OBSERVATION_CONFIG', `Observation days set to ${d}`, 0, 'INFO');
  };

  const acknowledgeObservation = async () => {
    const existing = await db.cryptoMeta.get('primary');
    // If passkey required, force verification
    if (existing?.requirePasskey && existing?.passkeyCredentialIdB64u && !passkeyVerified) {
      throw new Error('Passkey verification required.');
    }
    await db.cryptoMeta.put({ id: 'primary', ...(existing || {}), observationState: 'NORMAL' });
    setObservation((o) => ({ ...o, state: 'NORMAL' }));
    await secureLog('OBSERVATION_EXIT', 'Observation gate acknowledged and cleared', 0, 'WARN');
  };

  const getNotarySnapshot = async () => {
    const meta = await db.cryptoMeta.get('primary');
    const chain = await verifyChain();
    const chainTip = chain?.ok ? chain.tip : 'ALERT';
    const pubFp = meta?.signingFingerprintB64 || (meta?.signingPubJwk ? await sha256B64(JSON.stringify(meta.signingPubJwk)) : null);
    return {
      epochId: meta?.epochId,
      maxSeq: meta?.maxSeq || 0,
      chainTip,
      signingFingerprintB64: pubFp,
      observedAt: Date.now()
    };
  };

  const reKeyVault = async () => {
    if (locked) throw new Error('Vault locked.');
    const meta = await db.cryptoMeta.get('primary');
    if (meta?.requirePasskey && meta?.passkeyCredentialIdB64u && !passkeyVerified) {
      throw new Error('Passkey verification required.');
    }

    await db.transaction('rw', db.cryptoMeta, db.auditLog, db.agents, async () => {
      const current = await db.cryptoMeta.get('primary');
      const nextEpoch = randomEpochId();
      await db.auditLog.clear();
      await db.agents.clear();
      await db.cryptoMeta.put({
        id: 'primary',
        ...(current || {}),
        epochId: nextEpoch,
        maxSeq: 0,
        observationState: 'NORMAL'
      });
    });

    const after = await db.cryptoMeta.get('primary');
    setEpochId(after?.epochId || null);
    setObservation((o) => ({ ...o, state: 'NORMAL' }));
    await secureLog('VAULT_REKEY', 'Vault lineage rotated (epoch changed)', 0, 'CRITICAL');
  };

  const value = useMemo(
    () => ({
      locked,
      isSecure,
      unlock,
      unlockWithPasskey,
      lock,
      secureLog,
      executeSovereignAction,
      exportVault,
      importVault,
      adoptVault,
      verifyChain,
      getNotarySnapshot,
      reKeyVault,
      issueAgentLeaseToken: async ({ agentId, capabilities, ttlSeconds }) => {
        if (locked) throw new Error('Vault locked.');
        if (!signPrivKey) throw new Error('Signing key unavailable.');
        const meta = await db.cryptoMeta.get('primary');
        return issueAgentToken({
          privKey: signPrivKey,
          epochId: meta?.epochId,
          agentId,
          capabilities,
          ttlSeconds
        });
      },
      verifyAgentLeaseToken: async (token) => {
        if (!signPubKey) return { ok: false, reason: 'No signing pubkey' };
        const meta = await db.cryptoMeta.get('primary');
        return verifyAgentToken({ pubKey: signPubKey, token, expectedEpochId: meta?.epochId });
      },
      passkeyState,
      registerPasskey,
      verifyPasskey,
      setRequirePasskey,
      setRequireBiometricNative,
      getRequireBiometricNative: async () => {
        const meta = await db.cryptoMeta.get('primary');
        return meta?.requireBiometricNative ?? true;
      },
      observation,
      setObservationDays,
      acknowledgeObservation,
      setAutoLockSeconds: async (seconds) => {
        const existing = await db.cryptoMeta.get('primary');
        await db.cryptoMeta.put({ id: 'primary', ...(existing || {}), autoLockSeconds: Number(seconds) });
      },
      getAutoLockSeconds: async () => {
        const meta = await db.cryptoMeta.get('primary');
        return Number(meta?.autoLockSeconds ?? 300);
      }
    }),
    [locked, isSecure, passkeyState, passkeyVerified, observation, signPubKey, signPrivKey, signFingerprint, epochId]
  );

  return <SovereignContext.Provider value={value}>{children}</SovereignContext.Provider>;
}

export function useSovereign() {
  const ctx = useContext(SovereignContext);
  if (!ctx) throw new Error('useSovereign must be used within SovereignProvider');
  return ctx;
}
