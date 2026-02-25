import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Upload, Terminal, Smartphone, Users, Lock, Download, FileUp, KeyRound, Settings, ShieldCheck, ShieldX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SovereignProvider, useSovereign } from './security/SovereignWrapper';
import { isNativeRuntime } from './platform/isNative';
import Modal from './ui/Modal';
import NeverListEditor from './policy/NeverListEditor';
import { buildAgentHandshake } from './agents/handshake';
import { createAgentAPI, CAPABILITIES } from './agents/api';
import { startHeartbeatReaper, upsertAgent, heartbeat } from './agents/heartbeat';

export default function App() {
  return (
    <SovereignProvider>
      <FortifyOS />
    </SovereignProvider>
  );
}

function FortifyOS() {
  const [view, setView] = useState('landing'); // landing | dashboard
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-[100svh] bg-black text-white selection:bg-white selection:text-black font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <LandingView onStart={() => setView('dashboard')} />
        ) : (
          <DashboardView isMobile={isMobile} onBack={() => setView('landing')} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LandingView({ onStart }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-screen p-8 text-center">
      <Shield size={64} className="mb-12 animate-pulse" />
      <h1 className="text-4xl md:text-6xl font-extralight tracking-tighter mb-8">
        KNOX <span className="text-zinc-700 font-mono text-2xl md:text-4xl">v3.0</span>
      </h1>
      <button onClick={onStart} className="border border-zinc-800 px-12 py-5 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:text-black transition-all">
        Initialize Sovereign Terminal
      </button>
      <p className="mt-6 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Offline-first • Local vault • Capability agents</p>
    </motion.div>
  );
}

function DashboardView({ isMobile, onBack }) {
  const {
    locked,
    unlock,
    unlockWithPasskey,
    lock,
    executeSovereignAction,
    exportVault,
    importVault,
    adoptVault,
    verifyChain,
    getNotarySnapshot,
    reKeyVault,
    passkeyState,
    registerPasskey,
    verifyPasskey,
    setRequirePasskey,
    setRequireBiometricNative,
    getRequireBiometricNative,
    observation,
    setObservationDays,
    acknowledgeObservation,
    getAutoLockSeconds,
    setAutoLockSeconds,
    issueAgentLeaseToken,
    verifyAgentLeaseToken
  } = useSovereign();

  // Core state stubs (replace with computed metrics)
  const [stage] = useState(3);
  const [posture] = useState('DEFENSIVE');
  const [velocity] = useState({ value: 0.08, trend: 'LOW' });
  const [runway] = useState({ days: 12, mode: 'AUTO' });

  // Unlock modal state
  const [pass, setPass] = useState('');
  const [unlockErr, setUnlockErr] = useState('');

  // Never List editor
  const [neverEditorOpen, setNeverEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requirePasskey, setRequirePasskeyState] = useState(false);
  const [requireBiometricNative, setRequireBiometricNativeState] = useState(true);

  // Audit chain status
  const [chainStatus, setChainStatus] = useState(null);

  // Notary snapshot
  const [snapshot, setSnapshot] = useState(null);

  // Passkey UX state
  const [passkeyMsg, setPasskeyMsg] = useState('');

  // Auto-lock setting
  const [autoLockSeconds, setAutoLockSecondsState] = useState(300);

  // Import handler
  const [importing, setImporting] = useState(false);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptFile, setAdoptFile] = useState(null);
  const [adoptPhrase, setAdoptPhrase] = useState('');
  const [adoptErr, setAdoptErr] = useState('');

  // Expose agent handshake + capability API (read-only snapshot)
  const caps = useMemo(() => [CAPABILITIES.READ_VELOCITY, CAPABILITIES.READ_RUNWAY, CAPABILITIES.PROPOSE_ACTION], []);
  useEffect(() => {
    const agentAPI = createAgentAPI({
      getCapabilities: () => caps,
      getStage: () => stage,
      getSnapshots: () => ({ velocity, runway }),
      verifyLeaseToken: (token) => verifyAgentLeaseToken(token)
    });

    window.FORTIFY = Object.freeze({
      getHandshake: async () => {
        return buildAgentHandshake({ stage, posture, permissions: caps, runway });
      },
      agentRequest: async (req) => agentAPI(req),
      // Optional: issue a lease token for an agent (only works while unlocked)
      issueAgentToken: async ({ agentId, ttlSeconds = 3600 }) => {
        return issueAgentLeaseToken({ agentId, capabilities: caps, ttlSeconds });
      }
    });
  }, [stage, posture, caps, velocity, runway, verifyAgentLeaseToken, issueAgentLeaseToken]);

  // Heartbeat reaper (internal demo)
  useEffect(() => {
    if (locked) return;

    (async () => {
      await upsertAgent({ id: 'agent_demo', name: 'Demo Agent' });
    })();

    const stop = startHeartbeatReaper({
      stage,
      timeoutMs: 60 * 60 * 1000,
      intervalMs: 60 * 1000,
      onReclaim: async (agent) => {
        // Internal-only sweep semantics (ledger/state)
        // For now: no-op
      }
    });

    const hb = setInterval(() => heartbeat('agent_demo'), 30 * 1000);
    return () => { stop(); clearInterval(hb); };
  }, [locked, stage]);

  useEffect(() => {
    setRequirePasskeyState(!!passkeyState?.require);
  }, [passkeyState]);

  useEffect(() => {
    if (!settingsOpen) return;
    (async () => {
      const v = await getAutoLockSeconds().catch(() => 300);
      setAutoLockSecondsState(v);

      const b = await getRequireBiometricNative?.().catch(() => true);
      setRequireBiometricNativeState(b);

      const snap = await getNotarySnapshot().catch(() => null);
      setSnapshot(snap);
    })();
  }, [settingsOpen]);

  useEffect(() => {
    if (locked) { setChainStatus(null); return; }
    (async () => {
      const res = await verifyChain().catch(e => ({ ok: false, error: e?.message || String(e) }));
      setChainStatus(res);
    })();
  }, [locked]);

  const handleUnlock = async () => {
    setUnlockErr('');
    setPasskeyMsg('');
    try {
      const native = isNativeRuntime();
      await unlock(native ? (pass || undefined) : pass);
      setPass('');
    } catch (e) {
      setUnlockErr(e?.message || 'Unlock failed');
    }
  };

  const handleExport = async () => {
    const blob = await exportVault();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `KNOX_VAULT_${new Date().toISOString().slice(0,10)}.knoxvault.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImport = async (file) => {
    setImporting(true);
    try {
      await importVault(file);
    } finally {
      setImporting(false);
    }
  };

  const handleAdoptStart = (file) => {
    setAdoptErr('');
    setAdoptPhrase('');
    setAdoptFile(file);
    setAdoptOpen(true);
  };

  const handleAdoptConfirm = async () => {
    if (!adoptFile) return;
    if (adoptPhrase.trim().toUpperCase() !== 'ADOPT') {
      setAdoptErr('Type ADOPT to confirm lineage takeover.');
      return;
    }
    setImporting(true);
    setAdoptErr('');
    try {
      await adoptVault(adoptFile);
      setAdoptOpen(false);
      setAdoptFile(null);
    } catch (e) {
      setAdoptErr(e?.message || 'Adopt failed');
    } finally {
      setImporting(false);
    }
  };

  const handleIngest = async () => {
    await executeSovereignAction('FORENSIC_INGEST_START', stage, async () => {
      // Placeholder: connect real PDF/Screenshot logic later
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1400px] mx-auto px-6 py-8 md:py-16">
      <Modal open={locked} title="Sovereign Vault Lock">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Enter your Sovereign Passphrase to decrypt the local audit log.
          </p>
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            type="password"
            className="w-full bg-black border border-zinc-800 p-3 text-sm outline-none focus:border-zinc-500"
            placeholder="Passphrase (min 10 chars)"
            autoFocus
          />
          {unlockErr ? <p className="text-xs text-red-400 font-mono">{unlockErr}</p> : null}
                    {passkeyState?.supported ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                <span>Passkeys</span>
                <span className="flex items-center gap-2">
                  {passkeyState.enabled ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                  {passkeyState.enabled ? 'Enabled' : 'Not Set'}
                </span>
              </div>

              {!passkeyState.enabled ? (
                <button
                  onClick={async () => {
                    setPasskeyMsg('');
                    try { await registerPasskey(); setPasskeyMsg('Passkey created on this device.'); }
                    catch (e) { setPasskeyMsg(e?.message || 'Passkey setup failed'); }
                  }}
                  className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
                >
                  Create Passkey <KeyRound size={14} />
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setPasskeyMsg('');
                    try { await unlockWithPasskey(); }
                    catch (e) { setPasskeyMsg(e?.message || 'Passkey unlock unavailable'); }
                  }}
                  className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
                >
                  Unlock with Passkey <KeyRound size={14} />
                </button>
              )}

              {passkeyMsg ? <p className="text-xs text-zinc-400 font-mono">{passkeyMsg}</p> : null}
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                If PRF is unsupported, passkey verifies then passphrase unlocks.
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
              Passkeys not supported on this browser/device.
            </p>
          )}

<button
            onClick={handleUnlock}
            className="w-full bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200 transition-all"
          >
            Unlock Terminal
          </button>
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            Tip: store the passphrase in your offline vault.
          </p>
        </div>
      </Modal>

      <Modal open={adoptOpen} title="Adopt Imported Vault (Lineage Ceremony)" onClose={() => setAdoptOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            This will overwrite the current device vault and adopt the imported vault lineage (epoch). This is intended for new devices or deliberate re-alignment.
          </p>
          <div className="bg-zinc-900/30 border border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Confirmation</p>
            <p className="text-xs text-zinc-300 mt-1">Type <span className="font-mono text-white">ADOPT</span> to proceed.</p>
          </div>
          <input
            value={adoptPhrase}
            onChange={(e) => setAdoptPhrase(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-3 text-sm outline-none focus:border-zinc-500"
            placeholder="Type ADOPT"
          />
          {adoptErr ? <p className="text-xs text-red-400 font-mono">{adoptErr}</p> : null}
          <div className="flex gap-3">
            <button
              onClick={() => setAdoptOpen(false)}
              className="flex-1 border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              disabled={importing}
              onClick={handleAdoptConfirm}
              className="flex-1 bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200 disabled:opacity-50"
            >
              Adopt
            </button>
          </div>
        </div>
      </Modal>

      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <Shield size={isMobile ? 24 : 32} className="text-white" />
          <h1 className="text-xl md:text-2xl font-light tracking-tighter uppercase">Knox <span className="text-zinc-700">v3.0</span></h1>
        </div>
        <div className="flex items-center gap-2 border border-zinc-900 p-1.5 rounded">
          <div className="hidden md:flex items-center px-2">
            {chainStatus?.ok ? (
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Chain: OK</span>
            ) : chainStatus ? (
              <span className="text-[9px] font-mono uppercase tracking-widest text-red-400">Chain: ALERT</span>
            ) : (
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">Chain: —</span>
            )}
          </div>

          <button onClick={() => setSettingsOpen(true)} className="p-2 text-zinc-600 hover:text-white transition-colors" title="Settings">
            <Settings size={18} />
          </button>
          <button onClick={onBack} className="p-2 text-zinc-600 hover:text-white transition-colors" title="Back">
            <Terminal size={18} />
          </button>
          <button onClick={lock} className="p-2 text-zinc-600 hover:text-white transition-colors" title="Lock">
            <Lock size={18} />
          </button>
        </div>
      </header>

      {observation?.state === 'OBSERVATION' ? (
        <div className="mb-10 border border-red-900 bg-red-950/30 p-4 rounded-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-red-300">Observation Gate Active</p>
              <p className="text-sm text-zinc-200 mt-1">
                Inactivity exceeded {observation.days} days. High-risk actions should be paused until acknowledged.
              </p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-2">
                Clear requires passkey verification (if enabled).
              </p>
            </div>
            <div className="flex gap-2">
              {passkeyState?.enabled ? (
                <button
                  onClick={async () => {
                    setPasskeyMsg('');
                    try { await verifyPasskey(); setPasskeyMsg('Passkey verified.'); }
                    catch (e) { setPasskeyMsg(e?.message || 'Passkey verification failed'); }
                  }}
                  className="border border-red-800 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-red-200 hover:bg-red-950/40"
                >
                  Verify Passkey
                </button>
              ) : null}
              <button
                onClick={async () => {
                  try { await acknowledgeObservation(); }
                  catch (e) { setUnlockErr(e?.message || 'Unable to clear observation'); }
                }}
                className="bg-white text-black px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-8 ${isMobile ? 'grid-cols-1' : 'grid-cols-12'}`}>
        <div className={`${isMobile ? 'order-1' : 'col-span-8'} space-y-8`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricHUD label="Velocity" value={String(velocity.value)} sub={velocity.trend} alert />
            <MetricHUD label="Daily Burn" value="$18.47" sub="Loss" alert />
            <MetricHUD label="Runway" value={`${runway.days}d`} sub={runway.mode} />
            <MetricHUD label="Stage" value={String(stage)} sub={posture} />
          </div>

          <div className="bg-zinc-900/20 border border-zinc-900 p-6 md:p-10 rounded-sm group relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-4">Tactical Ingest</h3>
              <p className="text-lg font-light mb-6 leading-tight max-w-sm">Upload a screenshot or PDF to initiate forensic audit.</p>
              <button onClick={handleIngest} className="w-full md:w-auto bg-white text-black px-10 py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2">
                Capture Document <Upload size={14} />
              </button>
            </div>
            <motion.div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Smartphone size={120} /></motion.div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={handleExport}
              className="border border-zinc-800 px-6 py-4 text-[10px] uppercase tracking-[0.25em] font-bold hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
            >
              Export Vault <Download size={14} />
            </button>

            <label className="border border-zinc-800 px-6 py-4 text-[10px] uppercase tracking-[0.25em] font-bold hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 cursor-pointer">
              Import Vault <FileUp size={14} />
              <input
                type="file"
                accept=".json"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = '';
                }}
              />
            </label>

            <label className="border border-red-900/60 text-red-200 px-6 py-4 text-[10px] uppercase tracking-[0.25em] font-bold hover:bg-red-950/30 transition-all flex items-center justify-center gap-2 cursor-pointer md:col-span-2">
              Adopt Vault (New Device) <KeyRound size={14} />
              <input
                type="file"
                accept=".json"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAdoptStart(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {!isMobile && (
          <div className="col-span-4 space-y-8 border-l border-zinc-900 pl-8">
            <h3 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">Master Intelligence</h3>
            <div className="space-y-6">
              <div className="pb-6 border-b border-zinc-900">
                <p className="text-[9px] font-mono text-zinc-500 uppercase mb-2">Fed Net Liquidity</p>
                <p className="text-xl font-light text-white">$5.70T <span className="text-xs text-red-500 font-mono italic ml-2">(Tighter)</span></p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-zinc-500 uppercase mb-2">Legacy Council</p>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Users size={14} /> <span className="text-[10px] font-mono">2/3 Signers Synced</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-900">
              <p className="text-[9px] font-mono text-zinc-500 uppercase mb-3">Agentic Handshake</p>
              <div className="text-[10px] font-mono text-zinc-400 space-y-1">
                <div>window.FORTIFY.getHandshake()</div>
                <div>window.FORTIFY.agentRequest(req)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-20 border-t border-zinc-900 pt-10">
        <div className="flex justify-between items-center">
          {[0,1,2,3,4,5,6,7].map(s => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${s === stage ? 'bg-red-500' : 'bg-zinc-800'}`} />
              <span className="text-[8px] font-mono text-zinc-700 uppercase">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={settingsOpen} title="Sovereign Settings">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">Require Passkey to Unlock</p>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                If enabled, the device passkey must verify before decryption.
              </p>
            </div>
            <button
              onClick={async () => {
                const next = !requirePasskey;
                setRequirePasskeyState(next);
                try { await setRequirePasskey(next); }
                catch (e) { setRequirePasskeyState(!next); }
              }}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] border ${
                requirePasskey ? 'border-white text-white' : 'border-zinc-800 text-zinc-500'
              }`}
              disabled={!passkeyState?.enabled}
              title={!passkeyState?.enabled ? 'Create a passkey first' : 'Toggle'}
            >
              {requirePasskey ? 'ON' : 'OFF'}
            </button>
          </div>

          {isNativeRuntime() && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-200">Require Biometrics (Native)</p>
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                  FaceID/TouchID/Fingerprint is required before loading the device-bound key.
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !requireBiometricNative;
                  setRequireBiometricNativeState(next);
                  try { await setRequireBiometricNative(next); }
                  catch { setRequireBiometricNativeState(!next); }
                }}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] border ${
                  requireBiometricNative ? 'border-white text-white' : 'border-zinc-800 text-zinc-500'
                }`}
              >
                {requireBiometricNative ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          <button
            onClick={() => setNeverEditorOpen(true)}
            className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all"
          >
            Edit Never List
          </button>

          <div className="border border-zinc-900 p-4 rounded-sm space-y-3">
            <div>
              <p className="text-sm text-zinc-200">Observation Gate</p>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                If inactive longer than this, the vault enters OBSERVATION on next unlock.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={3650}
                value={observation?.days ?? 90}
                onChange={(e) => setObservationDays(e.target.value)}
                className="w-28 bg-black border border-zinc-800 p-2 text-sm outline-none focus:border-zinc-500"
              />
              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">days</span>
            </div>
          </div>

          <div className="border border-zinc-900 p-4 rounded-sm space-y-3">
            <div>
              <p className="text-sm text-zinc-200">Notary Snapshot</p>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                Offline provenance: epoch, chain tip, signing fingerprint.
              </p>
            </div>
            {snapshot ? (
              <div className="text-[10px] font-mono text-zinc-400 space-y-1">
                <div>Epoch: <span className="text-zinc-200">{snapshot.epochId}</span></div>
                <div>MaxSeq: <span className="text-zinc-200">{snapshot.maxSeq}</span></div>
                <div>ChainTip: <span className="text-zinc-200 break-all">{snapshot.chainTip}</span></div>
                <div>Signer FP: <span className="text-zinc-200 break-all">{snapshot.signingFingerprintB64}</span></div>
              </div>
            ) : (
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Unavailable</p>
            )}
            <button
              onClick={async () => {
                const snap = await getNotarySnapshot().catch(() => null);
                setSnapshot(snap);
              }}
              className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all"
            >
              Refresh Snapshot
            </button>
          </div>

          <div className="border border-zinc-900 p-4 rounded-sm space-y-3">
            <div>
              <p className="text-sm text-zinc-200">Auto-Lock Timeout</p>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                Locks decrypted state on inactivity (and immediately when backgrounded).
              </p>
            </div>
            <div className="flex gap-2">
              {[60, 300, 900, 0].map(v => (
                <button
                  key={v}
                  onClick={async () => {
                    setAutoLockSecondsState(v);
                    await setAutoLockSeconds(v);
                  }}
                  className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] border ${
                    autoLockSeconds === v ? 'border-white text-white' : 'border-zinc-800 text-zinc-500'
                  }`}
                >
                  {v === 0 ? 'OFF' : v === 60 ? '1m' : v === 300 ? '5m' : '15m'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              const res = await verifyChain().catch(e => ({ ok:false, error:e?.message || String(e) }));
              setChainStatus(res);
            }}
            className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all"
          >
            Verify Audit Chain
          </button>

          <button
            onClick={async () => {
              // Re-key is deliberate and destructive to the chain (new epoch)
              if (!confirm('Re-Key Vault? This rotates the epoch and starts a new audit chain.')) return;
              try {
                if (passkeyState?.enabled && requirePasskey) await verifyPasskey();
                await reKeyVault();
                const snap = await getNotarySnapshot().catch(() => null);
                setSnapshot(snap);
              } catch (e) {
                setUnlockErr(e?.message || 'Re-Key failed');
              }
            }}
            className="w-full border border-red-900 text-red-200 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-red-950/30 transition-all"
          >
            Re-Key Vault Epoch
          </button>

          <button
            onClick={() => setSettingsOpen(false)}
            className="w-full bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200 transition-all"
          >
            Close
          </button>
        </div>
      </Modal>

      <NeverListEditor open={neverEditorOpen} onClose={() => setNeverEditorOpen(false)} stage={stage} />
    </motion.div>
  );
}

function MetricHUD({ label, value, sub, alert }) {
  return (
    <div className={`p-4 border-l ${alert ? 'border-red-600' : 'border-zinc-800'} bg-zinc-900/5`}>
      <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-mono mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-xl md:text-2xl font-light tracking-tighter ${alert ? 'text-red-500' : 'text-white'}`}>{value}</span>
        <span className="text-[9px] text-zinc-700 font-mono uppercase">{sub}</span>
      </div>
    </div>
  );
}
