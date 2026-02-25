import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shield, Upload, Terminal, Lock, Download, FileUp, KeyRound, Settings, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [theme, setTheme] = useState(() => localStorage.getItem('fortify_theme') || 'dark');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('fortify_theme', theme);
  }, [theme]);

  return (
    <div className={`min-h-[100svh] app-shell font-sans overflow-x-hidden ${theme === 'light' ? 'theme-light selection:bg-black selection:text-white' : 'selection:bg-white selection:text-black'}`}>
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <LandingView onStart={() => setView('dashboard')} />
        ) : (
          <DashboardView
            isMobile={isMobile}
            onBack={() => setView('landing')}
            theme={theme}
            onToggleTheme={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LandingView({ onStart }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-screen p-8 text-center">
      <Shield size={64} className="mb-12 animate-pulse" />
      <h1 className="type-h1 font-extralight mb-8">
        FortifyOS
      </h1>
      <p className="type-meta txt-meta font-mono mb-8">
        Powered by KNOX Kernel v3
      </p>
      <button onClick={onStart} className="btn-secondary px-12 py-5 type-meta font-bold transition-all hover:opacity-80">
        Enter FortifyOS
      </button>
      <p className="mt-6 type-meta txt-meta font-mono">Offline-first • Local vault • Capability agents</p>
    </motion.div>
  );
}

function DashboardView({ isMobile, onBack, theme, onToggleTheme }) {
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
  const [ingestStatus, setIngestStatus] = useState(null);
  const ingestInputRef = useRef(null);
  const vaultImportInputRef = useRef(null);
  const nativeRuntime = isNativeRuntime();
  const isVaultEmpty = !!(chainStatus?.ok && (chainStatus?.count || 0) === 0);

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
      await unlock(nativeRuntime ? undefined : pass);
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
    if (adoptPhrase.trim().toUpperCase() !== 'TRANSFER') {
      setAdoptErr('Type TRANSFER to confirm new-device vault transfer.');
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

  const handleIngestPick = () => {
    setIngestStatus(null);
    ingestInputRef.current?.click();
  };

  const handlePrimaryAction = () => {
    if (isVaultEmpty) {
      vaultImportInputRef.current?.click();
      return;
    }
    handleIngestPick();
  };

  const handleIngestFile = async (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setIngestStatus({
        kind: 'error',
        title: 'Unsupported format',
        detail: 'Only bank statement PDF files are accepted.',
        next: 'Upload a PDF export from your bank. Nothing was saved.'
      });
      return;
    }
    setIngestStatus({
      kind: 'pending',
      title: 'PDF verified',
      detail: `File accepted: ${file.name}`,
      next: 'Processing securely...'
    });
    await executeSovereignAction('UPLOAD_BANK_STATEMENT', stage, async () => {
      // Parser pipeline not wired yet.
    });
    setIngestStatus({
      kind: 'success',
      title: 'PDF verified',
      detail: 'Transactions parser is not enabled in this build.',
      next: 'No transactions were saved yet.'
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1400px] mx-auto px-5 py-5 md:px-6 md:py-10">
      <Modal open={locked} title="Sovereign Vault">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {nativeRuntime
              ? 'Use Face ID / Touch ID to unlock this device vault.'
              : 'Enter your passphrase to decrypt your local vault.'}
          </p>

          {!nativeRuntime ? (
            <>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                type="password"
                className="w-full bg-black border border-zinc-800 p-3 text-sm outline-none focus:border-zinc-500"
                placeholder="Passphrase"
                autoFocus
              />
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                Minimum 10 characters.
              </p>
            </>
          ) : null}

          {unlockErr ? <p className="text-xs text-red-400 font-mono">{unlockErr}</p> : null}
          {passkeyState?.supported && passkeyState?.enabled ? (
            <button
              onClick={async () => {
                setPasskeyMsg('');
                try { await unlockWithPasskey(); }
                catch (e) { setPasskeyMsg(e?.message || 'Passkey unlock unavailable'); }
              }}
              className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
            >
              Use Passkey Instead <KeyRound size={14} />
            </button>
          ) : null}

          {passkeyMsg ? <p className="text-xs text-zinc-400 font-mono">{passkeyMsg}</p> : null}

          <button
            onClick={handleUnlock}
            className="w-full bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200 transition-all"
          >
            {nativeRuntime ? 'Unlock with Face ID' : 'Unlock'}
          </button>
        </div>
      </Modal>

      <Modal open={adoptOpen} title="Transfer Vault to This Device" onClose={() => setAdoptOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            This replaces this device vault with the selected backup. Use this when moving to a new phone/computer.
          </p>
          <div className="bg-zinc-900/30 border border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Confirmation</p>
            <p className="text-xs text-zinc-300 mt-1">Type <span className="font-mono text-white">TRANSFER</span> to proceed.</p>
          </div>
          <input
            value={adoptPhrase}
            onChange={(e) => setAdoptPhrase(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-3 text-sm outline-none focus:border-zinc-500"
            placeholder="Type TRANSFER"
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
              Transfer
            </button>
          </div>
        </div>
      </Modal>

      <header className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <Shield size={isMobile ? 24 : 32} />
          <div>
            <h1 className="type-h1 font-light uppercase">FortifyOS</h1>
            <p className="type-meta txt-meta font-mono">KNOX Kernel v3</p>
          </div>
        </div>
        <div className="flex items-center gap-2 app-panel p-1.5 rounded">
          <div className="hidden md:flex items-center px-2">
            {chainStatus?.ok ? (
              <span className="type-meta txt-meta font-mono">Chain: OK</span>
            ) : chainStatus ? (
              <span className="type-meta font-mono text-red-500">Chain: ALERT</span>
            ) : (
              <span className="type-meta txt-meta font-mono">Chain: —</span>
            )}
          </div>

          <button onClick={onToggleTheme} className="p-2 txt-meta transition-colors hover:opacity-80" title="Theme">
            <span className="type-meta font-mono">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 txt-meta transition-colors hover:opacity-80" title="Settings">
            <Settings size={18} />
          </button>
          <button onClick={onBack} className="p-2 txt-meta transition-colors hover:opacity-80" title="Back">
            <Terminal size={18} />
          </button>
          <button onClick={lock} className="p-2 txt-meta transition-colors hover:opacity-80" title="Lock">
            <Lock size={18} />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <input
          ref={ingestInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleIngestFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={vaultImportInputRef}
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

        <div className="app-panel rounded-sm px-4 py-3 flex items-center justify-between gap-3">
          <span className="type-meta txt-meta font-mono">Banner: B-Year (Sell)</span>
          <button onClick={handlePrimaryAction} className="btn-primary px-4 py-2 type-meta font-bold flex items-center gap-2">
            <Upload size={12} /> Sync
          </button>
        </div>

        <div className="app-panel rounded-sm p-0 overflow-hidden">
          <div className="grid grid-cols-3 md:grid-cols-9 divide-x divide-zinc-900">
            {[
              { k: 'BITCOIN', v: '$65,377', c: '-3.89%', t: 'down' },
              { k: 'ETH', v: '$1,874', c: '-5.11%', t: 'down' },
              { k: 'GOLD', v: '$2,936', c: '+0.81%', t: 'up' },
              { k: 'SILVER', v: '$32.18', c: '+0.62%', t: 'up' },
              { k: 'OIL', v: '—', c: '—', t: 'flat' },
              { k: 'SPY', v: '—', c: '—', t: 'flat' },
              { k: 'VIX', v: '—', c: '—', t: 'flat' },
              { k: 'S&P 500', v: '—', c: '—', t: 'flat' },
              { k: 'NASDAQ', v: '—', c: '—', t: 'flat' }
            ].map((x) => (
              <div key={x.k} className="p-3">
                <p className="type-meta txt-meta font-mono">{x.k}</p>
                <p className="type-body mt-1">{x.v}</p>
                <p className={`text-xs font-mono mt-1 ${x.t === 'up' ? 'text-emerald-500' : x.t === 'down' ? 'text-red-500' : 'txt-meta'}`}>{x.c}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel rounded-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusMetric label="Velocity" value={String(velocity.value)} badge={velocity.trend} tone="warn" />
            <StatusMetric label="Daily Burn" value="$100.00" badge="$3,000/mo" tone="warn" />
            <StatusMetric label="Savings Rate" value="0%" badge="No Data" tone="ok" />
            <StatusMetric label="Runway" value={`${runway.days}d`} badge={runway.mode} tone="ok" />
          </div>
        </div>

        <div className="app-panel rounded-sm px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="type-h2 font-bold text-emerald-500">{stage}</span>
            <div>
              <p className="type-body">Debt Liberation</p>
              <p className="type-meta txt-meta font-mono">Stage {stage} · {posture}</p>
            </div>
          </div>
          <div className="type-body txt-muted">
            Ingest: upload PDFs via Sync
          </div>
        </div>

        {ingestStatus ? (
          <div className={`p-3 rounded-sm border ${ingestStatus.kind === 'error' ? 'border-red-900 bg-red-950/20' : ingestStatus.kind === 'success' ? 'border-emerald-800 bg-emerald-950/20' : 'app-panel'}`}>
            <div className="flex items-center gap-2">
              {ingestStatus.kind === 'error' ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className={ingestStatus.kind === 'pending' ? 'txt-meta' : 'text-emerald-500'} />}
              <p className="type-body">{ingestStatus.title}</p>
            </div>
            <p className="text-sm txt-muted mt-1">{ingestStatus.detail}</p>
            <p className="type-meta txt-meta font-mono mt-2">{ingestStatus.next}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="app-panel rounded-sm p-4 min-h-[220px]">
            <p className="type-meta txt-meta font-mono mb-3">CFO Daily Pulse</p>
            <h2 className="type-h2 text-emerald-500">The Law of Data Hygiene</h2>
            <p className="type-meta txt-meta font-mono mt-2">Infrastructure // Feb — Apprenticeship</p>
            <p className="type-body txt-muted mt-4 border-l-2 border-emerald-500 pl-3">
              Physical clutter leads to digital entropy. Clean workspace and verify thermal stability on primary devices.
            </p>
          </section>
          <section className="app-panel rounded-sm p-4 min-h-[220px] flex flex-col justify-between">
            <p className="type-meta txt-meta font-mono">Net Worth</p>
            <p className="type-metric font-semibold">$0</p>
            <div className="flex justify-between type-meta txt-meta font-mono">
              <span>Assets $0</span>
              <span>Liabilities $0</span>
            </div>
          </section>
        </div>

        <section className="app-panel rounded-sm p-4 space-y-4">
          <div>
            <p className="type-meta txt-meta font-mono">Market Intelligence</p>
            <p className="type-meta txt-meta font-mono">FRED as of 2026-02-22</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <IntelMetric label="Fed Cycle" value="QE" sub="WALCL $6613.40T" tone="ok" />
            <IntelMetric label="Net Liquidity" value="$5724.54T" sub="WALCL - TGA - RRP" tone="ok" />
            <IntelMetric label="RRP" value="$0.00T" sub="Overnight reverse repo" tone="warn" />
            <IntelMetric label="WALCL" value="$6613.40T" sub="Fed balance sheet" tone="ok" />
            <IntelMetric label="TGA" value="$888.85T" sub="Treasury General Account" tone="warn" />
            <IntelMetric label="As Of" value="2026-02-22" sub="FRED data timestamp" tone="ok" />
          </div>
          <div className="border border-emerald-900 bg-emerald-950/30 rounded-sm p-3">
            <p className="type-meta font-mono text-emerald-500">Macro Narrative</p>
            <p className="text-sm txt-muted mt-1">
              Net liquidity is elevated. Balance sheet expansion supports risk assets; monitor reversal signals.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="app-panel rounded-sm p-4">
            <p className="type-meta txt-meta font-mono mb-2">Debt Destruction</p>
            <p className="type-metric font-semibold">$0</p>
          </section>
          <section className="app-panel rounded-sm p-4">
            <p className="type-meta txt-meta font-mono mb-2">Emergency Fund</p>
            <p className="type-body txt-muted">Starter → 1 month → 3 months → 6 months</p>
          </section>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary px-5 py-2 type-meta font-bold flex items-center gap-2"
          >
            <ChevronDown size={14} /> Control Panel
          </button>
        </div>
      </div>

      <Modal open={settingsOpen} title="Control Panel">
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

          {!passkeyState?.enabled && passkeyState?.supported ? (
            <button
              onClick={async () => {
                setPasskeyMsg('');
                try { await registerPasskey(); setPasskeyMsg('Passkey created on this device.'); }
                catch (e) { setPasskeyMsg(e?.message || 'Passkey setup failed'); }
              }}
              className="w-full border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all"
            >
              Create Device Passkey
            </button>
          ) : null}

          {passkeyMsg ? <p className="text-xs text-zinc-400 font-mono">{passkeyMsg}</p> : null}

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

function StatusMetric({ label, value, badge, tone }) {
  const toneClass = tone === 'warn' ? 'bg-red-950/40 text-red-500 border-red-900' : 'bg-zinc-900/40 txt-muted border-zinc-800';
  return (
    <div className="min-w-0">
      <p className="type-meta txt-meta font-mono mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="type-metric font-light tracking-tight truncate">{value}</span>
        <span className={`type-meta font-mono border px-2 py-0.5 rounded-full ${toneClass}`}>{badge}</span>
      </div>
    </div>
  );
}

function IntelMetric({ label, value, sub, tone }) {
  return (
    <div className="app-panel rounded-sm p-3">
      <p className="type-meta txt-meta font-mono">{label}</p>
      <p className={`type-h2 mt-2 ${tone === 'warn' ? 'text-amber-500' : 'text-emerald-500'}`}>{value}</p>
      <p className="type-meta txt-meta font-mono mt-1">{sub}</p>
    </div>
  );
}
