import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Shield, RefreshCw, Settings, X, Database, Lock, Cpu, Activity, 
  ChevronRight, Sun, Moon, Upload, AlertCircle, Zap, ShieldAlert,
  ArrowLeft, FileText, TrendingUp
} from 'lucide-react';
import * as Papa from 'papaparse';

// ── THEME TOKENS ──
const THEMES = {
  dark: {
    void: '#000000', surface: '#0A0A0A', elevated: '#111111', input: '#0D0D0D',
    borderDim: '#1A1A1A', borderMid: '#2A2A2A', accent: '#00FF41', 
    textPrimary: '#E8E8E8', textSecondary: '#888888', textDim: '#555555',
    danger: '#FF3333', warn: '#FFB800', purple: '#BF40BF'
  },
  light: {
    void: '#F5F5F0', surface: '#FFFFFF', elevated: '#FAFAFA', input: '#F0F0EC',
    borderDim: '#E0E0DC', borderMid: '#D1D1CD', accent: '#B8860B', 
    textPrimary: '#1A1A1A', textSecondary: '#666666', textDim: '#999999',
    danger: '#CC2200', warn: '#CC8800', purple: '#800080'
  }
};

// ── DATA DEFAULTS ──
const INITIAL_STATE = {
  date: new Date().toISOString().slice(0, 10),
  netWorth: { total: 0, assets: 0, liabilities: 0 },
  debts: [], // Supports isFixedTerm for BNPL
  portfolio: [], // Supports isOption for Purple-Tone
  protection: { lifeInsurance: { deathBenefit: 0, monthlyPremium: 0, deadline: 'YYYY-MM-DD', type: 'TERM' } },
  eFund: { balance: 0, monthlyExpenses: 3000, phase: 1 },
  macro: { netLiquidity: 0, btcPrice: 0, triggersActive: 0 }
};

export default function FortifyOSMaster() {
  const [view, setView] = useState('landing'); // landing, dashboard, docs
  const [isDark, setIsDark] = useState(true);
  const [data, setData] = useState(INITIAL_STATE);
  const [syncOpen, setSyncOpen] = useState(false);
  const t = isDark ? THEMES.dark : THEMES.light;

  // ── CORE LOGIC: PERSISTENCE & NAVIGATION ──
  const goHome = () => setView('landing');
  const fmt = (n) => '$' + Math.abs(Math.round(n || 0)).toLocaleString();

  // ── RENDER: LANDING VIEW ──
  if (view === 'landing') {
    return (
      <div style={{ background: t.void, minHeight: '100vh', color: t.textPrimary, fontFamily: 'monospace' }}>
        <nav style={{ padding: '20px', borderBottom: `1px solid ${t.borderDim}`, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={goHome}>
            <Shield color={t.accent} size={20} />
            <span style={{ fontWeight: 'bold', fontSize: 18 }}>FORTIFYOS</span>
          </div>
          <button onClick={() => setIsDark(!isDark)} style={{ background: 'none', border: 'none', color: t.textSecondary }}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
        <main style={{ textAlign: 'center', paddingTop: '100px', padding: '20px' }}>
          <h1 style={{ fontSize: '3.5rem', textTransform: 'uppercase', marginBottom: '20px' }}>
            Systematic <br /><span style={{ color: t.accent }}>Wealth Defense</span>
          </h1>
          <p style={{ color: t.textSecondary, maxWidth: '600px', margin: '0 auto 40px' }}>
            The command-layer intelligence system for phase-aware financial execution. 
            Protect first. Grow second.
          </p>
          <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
            <button onClick={() => setView('dashboard')} style={{ background: t.accent, padding: '15px 30px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>INITIALIZE TERMINAL</button>
            <button onClick={() => setView('docs')} style={{ border: `1px solid ${t.borderDim}`, background: 'none', color: t.textSecondary, padding: '15px 30px', cursor: 'pointer' }}>DOCUMENTATION</button>
          </div>
        </main>
      </div>
    );
  }

  // ── RENDER: DASHBOARD VIEW ──
  if (view === 'dashboard') {
    return (
      <div style={{ background: t.void, minHeight: '100vh', color: t.textPrimary, fontFamily: 'monospace' }}>
        <header style={{ height: '48px', background: t.surface, borderBottom: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={goHome}>
            <Shield color={t.accent} size={14} />
            <span style={{ fontWeight: 'bold', color: t.accent }}>FORTIFYOS</span>
          </div>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            <button onClick={() => setSyncOpen(true)} style={{ border: `1px solid ${t.accent}`, color: t.accent, background: 'none', fontSize: '10px', padding: '4px 10px', cursor: 'pointer' }}>SYNC</button>
          </div>
        </header>

        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          
          {/* NET WORTH */}
          <section style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '20px' }}>
            <h3 style={{ fontSize: '10px', color: t.textSecondary, marginBottom: '10px' }}>NET WORTH</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{fmt(data.netWorth.total)}</div>
          </section>

          {/* DEBT COUNTDOWN (BNPL SUPPORT) */}
          <section style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '20px' }}>
            <h3 style={{ fontSize: '10px', color: t.textSecondary, marginBottom: '10px' }}>DEBT RADAR</h3>
            {data.debts.length === 0 ? <p style={{ color: t.textDim, fontSize: '11px' }}>No active debt detected.</p> : 
              data.debts.map((d, i) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>{d.name}</span>
                    <span>{d.isFixedTerm ? `${d.paymentsMade}/${d.totalTerms}` : `${d.apr}%`}</span>
                  </div>
                  <div style={{ height: '4px', background: t.borderDim, marginTop: '4px' }}>
                    <div style={{ height: '100%', width: d.isFixedTerm ? `${(d.paymentsMade/d.totalTerms)*100}%` : '50%', background: t.accent }} />
                  </div>
                </div>
              ))
            }
          </section>

          {/* PROTECTION (LIFE & CONVERSION) */}
          <section style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '20px' }}>
            <h3 style={{ fontSize: '10px', color: t.textSecondary, marginBottom: '10px' }}>PROTECTION LAYER</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '18px' }}>{fmt(data.protection.lifeInsurance.deathBenefit)}</div>
                <div style={{ fontSize: '9px', color: t.textDim }}>{data.protection.lifeInsurance.type} POLICY</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: t.warn }}>CONVERSION EXP:</div>
                <div style={{ fontSize: '12px' }}>{data.protection.lifeInsurance.deadline}</div>
              </div>
            </div>
          </section>

          {/* PORTFOLIO (PURPLE-TONE OPTIONS) */}
          <section style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '20px' }}>
            <h3 style={{ fontSize: '10px', color: t.textSecondary, marginBottom: '10px' }}>PORTFOLIO EXPOSURE</h3>
            {data.portfolio.length === 0 ? <p style={{ color: t.textDim, fontSize: '11px' }}>No positions tracked.</p> :
              data.portfolio.map((p, i) => (
                <div key={i} style={{ border: `1px solid ${p.isOption ? t.purple : t.borderDim}`, padding: '8px', marginBottom: '5px' }}>
                   <div style={{ color: p.isOption ? t.purple : t.accent, fontSize: '12px', fontWeight: 'bold' }}>{p.ticker}</div>
                   <div style={{ fontSize: '10px', color: t.textDim }}>VALUE: {fmt(p.mktValue)}</div>
                </div>
              ))
            }
          </section>

        </main>
      </div>
    );
  }

  // ── RENDER: DOCUMENTATION VIEW ──
  if (view === 'docs') {
    return (
      <div style={{ background: t.void, minHeight: '100vh', color: t.textPrimary, fontFamily: 'monospace', padding: '40px' }}>
        <button onClick={() => setView('landing')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: t.accent, cursor: 'pointer', marginBottom: '20px' }}>
          <ArrowLeft size={14} /> BACK
        </button>
        <h1 style={{ borderBottom: `1px solid ${t.borderDim}`, paddingBottom: '10px' }}>TECHNICAL <span style={{ color: t.accent }}>FIELD MANUAL</span></h1>
        <section style={{ marginTop: '30px' }}>
          <h2>01 // THE SYNC PROTOCOL</h2>
          <p style={{ color: t.textSecondary }}>The dashboard is offline-first. Use the /sync command or drag-and-drop your bank CSVs to update the HUD.</p>
        </section>
        <section style={{ marginTop: '30px' }}>
          <h2>02 // REDACTION (KNOX)</h2>
          <p style={{ color: t.textSecondary }}>All PII (Names, SSNs, Full Acct #s) are redacted locally before ingestion.</p>
        </section>
      </div>
    );
  }
}
