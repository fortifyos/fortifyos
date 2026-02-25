import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { getNeverListPolicy, setNeverListPolicy } from './neverListStore';
import { useSovereign } from '../security/SovereignWrapper';

export default function NeverListEditor({ open, onClose, stage = 0 }) {
  const { secureLog, passkeyState, verifyPasskey } = useSovereign();
  const [policy, setPolicy] = useState(null);
  const [actionInput, setActionInput] = useState('');
  const [merchantInput, setMerchantInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const p = await getNeverListPolicy();
      setPolicy(structuredClone(p));
    })();
  }, [open]);

  const save = async () => {
    setErr('');
    try {
      // If passkey is required for this vault, require biometric verification for policy writes.
      if (passkeyState?.require && passkeyState?.enabled) {
        await verifyPasskey();
      }

      const cleaned = {
        blockedActions: (policy?.blockedActions || []).map(s => String(s).trim()).filter(Boolean),
        blockedMerchants: (policy?.blockedMerchants || []).map(s => String(s).trim()).filter(Boolean),
        blockedKeywords: (policy?.blockedKeywords || []).map(s => String(s).trim()).filter(Boolean),
      };
      await setNeverListPolicy(cleaned);
      await secureLog('POLICY_UPDATE', 'Never List updated', stage, 'WARN', { policy: cleaned });
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Failed to save policy');
    }
  };

  const addTo = (key, value) => {
    const v = String(value || '').trim();
    if (!v) return;
    setPolicy(p => ({ ...p, [key]: Array.from(new Set([...(p?.[key] || []), v])) }));
  };

  const removeFrom = (key, value) => {
    setPolicy(p => ({ ...p, [key]: (p?.[key] || []).filter(x => x !== value) }));
  };

  return (
    <Modal open={open} title="Never List Policy (Local)">
      {!policy ? (
        <p className="text-sm text-zinc-400">Loading policy…</p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Blocked Actions</h3>
            <div className="flex gap-2">
              <input value={actionInput} onChange={e=>setActionInput(e.target.value)}
                className="flex-1 bg-black border border-zinc-800 p-2 text-sm outline-none focus:border-zinc-500"
                placeholder="e.g., EXTERNAL_TRANSFER"
              />
              <button onClick={()=>{ addTo('blockedActions', actionInput); setActionInput(''); }}
                className="border border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-white hover:text-black transition-all">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(policy.blockedActions || []).map(a => (
                <span key={a} className="text-[10px] font-mono border border-zinc-800 px-2 py-1 text-zinc-300">
                  {a} <button className="ml-2 text-zinc-500 hover:text-white" onClick={()=>removeFrom('blockedActions', a)}>×</button>
                </span>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Blocked Merchants</h3>
            <div className="flex gap-2">
              <input value={merchantInput} onChange={e=>setMerchantInput(e.target.value)}
                className="flex-1 bg-black border border-zinc-800 p-2 text-sm outline-none focus:border-zinc-500"
                placeholder="substring match (case-insensitive)"
              />
              <button onClick={()=>{ addTo('blockedMerchants', merchantInput); setMerchantInput(''); }}
                className="border border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-white hover:text-black transition-all">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(policy.blockedMerchants || []).map(m => (
                <span key={m} className="text-[10px] font-mono border border-zinc-800 px-2 py-1 text-zinc-300">
                  {m} <button className="ml-2 text-zinc-500 hover:text-white" onClick={()=>removeFrom('blockedMerchants', m)}>×</button>
                </span>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Blocked Keywords</h3>
            <div className="flex gap-2">
              <input value={keywordInput} onChange={e=>setKeywordInput(e.target.value)}
                className="flex-1 bg-black border border-zinc-800 p-2 text-sm outline-none focus:border-zinc-500"
                placeholder="e.g., seed phrase"
              />
              <button onClick={()=>{ addTo('blockedKeywords', keywordInput); setKeywordInput(''); }}
                className="border border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-white hover:text-black transition-all">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(policy.blockedKeywords || []).map(k => (
                <span key={k} className="text-[10px] font-mono border border-zinc-800 px-2 py-1 text-zinc-300">
                  {k} <button className="ml-2 text-zinc-500 hover:text-white" onClick={()=>removeFrom('blockedKeywords', k)}>×</button>
                </span>
              ))}
            </div>
          </section>

          {err ? <p className="text-xs text-red-400 font-mono">{err}</p> : null}

          <div className="flex gap-3">
            <button onClick={save} className="flex-1 bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-200 transition-all">
              Save Policy
            </button>
            <button onClick={onClose} className="flex-1 border border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-zinc-900 transition-all">
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            Stored locally in IndexedDB. Policy evolves without code changes.
          </p>
        </div>
      )}
    </Modal>
  );
}
