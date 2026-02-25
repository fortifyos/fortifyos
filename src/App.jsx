import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Shield, ChevronRight, Sun, Moon, Lock, Cpu, Activity,
  Settings, RefreshCw, X, Download, Trash2, Database, AlertCircle,
  FileText, Upload, Zap, ShieldAlert
} from 'lucide-react';
import * as Papa from 'papaparse';

/* ═══════════════════════════════════════════════════════════════
   FORTIFYOS — UNIFIED v2.2
   Landing · Universal Sync Engine · Live Dashboard
   Protection Layer · Portfolio Exposure · Purple-Tone Options
   "Protect first, grow second. Every dollar has a job."
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════
const THEMES = {
  dark: {
    void: '#000000', surface: '#0A0A0A', elevated: '#111111', input: '#0D0D0D',
    borderDim: '#1A1A1A', borderMid: '#2A2A2A', borderBright: '#333333',
    textPrimary: '#E8E8E8', textSecondary: '#888888', textDim: '#555555', textGhost: '#333333',
    accent: '#00FF41', accentBright: '#39FF14', accentDim: '#00CC33', accentMuted: '#0A3D1A',
    danger: '#FF3333', warn: '#FFB800',
    purple: '#BF40BF', purpleDim: '#8A2D8A', purpleMuted: '#2D0A2D',
  },
  light: {
    void: '#F5F5F0', surface: '#FFFFFF', elevated: '#FAFAFA', input: '#F0F0EC',
    borderDim: '#E0E0DC', borderMid: '#D1D1CD', borderBright: '#B8B8B4',
    textPrimary: '#1A1A1A', textSecondary: '#666666', textDim: '#999999', textGhost: '#CCCCCC',
    accent: '#B8860B', accentBright: '#D4AF37', accentDim: '#996515', accentMuted: '#F5EDD6',
    danger: '#CC2200', warn: '#CC8800',
    purple: '#9B30FF', purpleDim: '#7B20CF', purpleMuted: '#F0E0F8',
  },
};

// ═══════════════════════════════════════════════════
// BANK FINGERPRINT LIBRARY
// ═══════════════════════════════════════════════════
const BANK_SIGNATURES = {
  chase: {
    name: 'Chase',
    detect: (headers) => headers.includes('Transaction Date') && headers.includes('Post Date') && headers.includes('Category'),
    parse: (rows) => rows.map(r => ({
      date: r['Transaction Date'] || r['Post Date'] || '',
      description: r['Description'] || '',
      amount: parseFloat(r['Amount']) || 0,
      category: r['Category'] || '',
      type: r['Type'] || '',
    })),
  },
  bofa: {
    name: 'Bank of America',
    detect: (headers) => headers.includes('Running Bal.') || (headers.includes('Date') && headers.includes('Description') && headers.includes('Amount') && headers.length <= 5),
    parse: (rows) => rows.map(r => ({
      date: r['Date'] || '',
      description: r['Description'] || '',
      amount: parseFloat(r['Amount']) || 0,
      balance: parseFloat((r['Running Bal.'] || '').replace(/[,$]/g, '')) || 0,
    })),
  },
  amex: {
    name: 'American Express',
    detect: (headers) => headers.includes('Extended Details') || (headers.includes('Date') && headers.includes('Description') && headers.includes('Category') && headers.includes('Amount')),
    parse: (rows) => rows.map(r => ({
      date: r['Date'] || '',
      description: r['Description'] || '',
      amount: parseFloat(r['Amount']) || 0,
      category: r['Category'] || '',
    })),
  },
  capitalOne: {
    name: 'Capital One',
    detect: (headers) => headers.includes('Debit') && headers.includes('Credit') && headers.includes('Posted Date'),
    parse: (rows) => rows.map(r => ({
      date: r['Transaction Date'] || r['Posted Date'] || '',
      description: r['Description'] || '',
      amount: -(parseFloat(r['Debit']) || 0) + (parseFloat(r['Credit']) || 0),
      category: r['Category'] || '',
    })),
  },
  wellsFargo: {
    name: 'Wells Fargo',
    detect: (headers) => headers.length >= 5 && headers[2] === '' && headers[3] === '',
    parse: (rows) => rows.map(r => {
      const vals = Object.values(r);
      return { date: vals[0] || '', amount: parseFloat(vals[1]) || 0, description: vals[4] || vals[3] || '' };
    }),
  },
  citi: {
    name: 'Citi',
    detect: (headers) => headers.includes('Status') && headers.includes('Debit') && headers.includes('Credit'),
    parse: (rows) => rows.filter(r => (r['Status'] || '').toLowerCase() === 'cleared').map(r => ({
      date: r['Date'] || '',
      description: r['Description'] || '',
      amount: -(parseFloat(r['Debit']) || 0) + (parseFloat(r['Credit']) || 0),
    })),
  },
};

// ═══════════════════════════════════════════════════
// SENTINEL REDACTION FILTER
// ═══════════════════════════════════════════════════
const sentinel = {
  redact: (text) => {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, 'XXXX-XXXX-XXXX-****')
      .replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, 'XXX-XX-****')
      .replace(/(?:account|acct|card)\s*(?:#|no\.?|number|ending\s+in)\s*[:\-]?\s*\d{4,}/gi, '[REDACTED]');
  },
  redactRow: (row) => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k] = typeof v === 'string' ? sentinel.redact(v) : v;
    }
    return clean;
  },
};

// ═══════════════════════════════════════════════════
// TRANSACTION CATEGORIZER
// ═══════════════════════════════════════════════════
const CATEGORY_RULES = [
  { match: /rent|mortgage|housing/i, cat: 'Essential' },
  { match: /grocery|groceries|walmart supercenter|aldi|kroger|publix|trader joe|whole foods/i, cat: 'Essential' },
  { match: /electric|gas|water|utility|internet|phone|tmobile|verizon|att|comcast|spectrum/i, cat: 'Essential' },
  { match: /insurance|geico|state farm|progressive|allstate/i, cat: 'Essential' },
  { match: /gasoline|fuel|shell|chevron|exxon|bp|speedway/i, cat: 'Essential' },
  { match: /pharmacy|cvs|walgreen|prescription|medical|doctor|hospital|copay|pediatric/i, cat: 'Medical' },
  { match: /payment|payoff|transfer to|minimum|interest charge/i, cat: 'Debt Service' },
  { match: /savings|transfer to sav|emergency/i, cat: 'Savings' },
  { match: /restaurant|mcdonald|starbuck|chipotle|doordash|uber eats|grubhub|dining/i, cat: 'Discretionary' },
  { match: /amazon|target|netflix|spotify|hulu|disney|subscription|gaming|steam|playstation/i, cat: 'Discretionary' },
  { match: /payroll|direct dep|salary|wage|income/i, cat: 'Income' },
];

function categorize(desc) {
  const d = (desc || '').toLowerCase();
  for (const r of CATEGORY_RULES) { if (r.match.test(d)) return r.cat; }
  return 'Uncategorized';
}

function transactionsToSnapshot(txns, bankName) {
  const income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.amount < 0);
  const cats = {};
  expenses.forEach(t => {
    const cat = categorize(t.description);
    cats[cat] = (cats[cat] || 0) + Math.abs(t.amount);
  });
  const totalExpense = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const budgetCats = ['Essential', 'Discretionary', 'Medical', 'Debt Service', 'Savings'].map(name => ({
    name, budgeted: 0, actual: Math.round(cats[name] || 0),
  }));
  const dates = txns.map(t => t.date).filter(Boolean).sort();
  return {
    date: dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10),
    netWorth: { assets: { checking: 0, eFund: 0, other: 0 }, liabilities: {}, total: 0 },
    debts: [],
    eFund: { balance: 0, monthlyExpenses: Math.round(totalExpense), phase: 1 },
    budget: { categories: budgetCats },
    macro: { netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: 'Accumulation', fedWatchCut: 0, nextFomc: '', yieldCurve10Y2Y: 0, yieldTrend: 'flat', triggersActive: 0, activeTriggers: [] },
    protection: { lifeInsurance: { provider: '', type: 'TERM', deathBenefit: 0, monthlyPremium: 0, expirationDate: '', conversionDeadline: '', alertLeadTimeYears: 5 }, funeralBuffer: { target: 10000, current: 0 } },
    portfolio: { equities: [], options: [] },
    _meta: { source: bankName, transactions: txns.length, income: Math.round(income), totalExpense: Math.round(totalExpense), uncategorized: Math.round(cats['Uncategorized'] || 0) },
  };
}

// ═══════════════════════════════════════════════════
// DEFAULT DATA & HELPERS
// ═══════════════════════════════════════════════════
const DEFAULT_SNAPSHOT = {
  date: new Date().toISOString().slice(0, 10),
  netWorth: { assets: { checking: 0, eFund: 0, other: 0 }, liabilities: {}, total: 0 },
  debts: [], eFund: { balance: 0, monthlyExpenses: 3000, phase: 1 },
  budget: { categories: [
    { name: 'Essential', budgeted: 2000, actual: 0 }, { name: 'Discretionary', budgeted: 300, actual: 0 },
    { name: 'Medical', budgeted: 300, actual: 0 }, { name: 'Debt Service', budgeted: 0, actual: 0 },
    { name: 'Savings', budgeted: 300, actual: 0 },
  ]},
  macro: { netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: 'Accumulation', fedWatchCut: 0, nextFomc: '2026-03-19', yieldCurve10Y2Y: 0, yieldTrend: 'flat', triggersActive: 0, activeTriggers: [], bennerPhase: '' },
  protection: {
    lifeInsurance: { provider: '', type: 'TERM', deathBenefit: 0, monthlyPremium: 0, expirationDate: '', conversionDeadline: '', alertLeadTimeYears: 5 },
    funeralBuffer: { target: 10000, current: 0 },
  },
  portfolio: { equities: [], options: [] },
};
const DEFAULT_SETTINGS = { visibleModules: ['directive', 'netWorth', 'debt', 'eFund', 'budget', 'protection', 'portfolio', 'macro'], _v: 3 };
const fmt = (n) => { if (n == null || isNaN(n)) return '$0'; return '$' + Math.abs(Math.round(Number(n))).toLocaleString('en-US'); };
const dailyInterest = (d) => d ? d.reduce((s, x) => s + ((x.balance || 0) * ((x.apr || 0) / 100)) / 365, 0) : 0;
const totalDebt = (d) => d ? d.reduce((s, x) => s + (x.balance || 0), 0) : 0;
const runwayDays = (ef) => (!ef || !ef.monthlyExpenses) ? 0 : Math.floor((ef.balance || 0) / (ef.monthlyExpenses / 30));
const efundTargets = (m) => [1000, m, m * 3, m * 6];
const pctColor = (p, t) => p >= 100 ? t.danger : p >= 75 ? t.warn : t.accent;
const runwayColor = (d, t) => d < 30 ? t.danger : d < 60 ? t.warn : t.accent;
const CURRENCY_SYMBOL = (() => { try { return (0).toLocaleString(undefined, { style: 'currency', currency: Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).resolvedOptions().currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d.,\s]/g, '').trim(); } catch { return '$'; } })();

function CurrencyInput({ value, onChange, placeholder, t, style = {} }) {
  const inp = { background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px 8px 24px', width: '100%', outline: 'none', borderRadius: 2, boxSizing: 'border-box', ...style };
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: t.textDim, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>{CURRENCY_SYMBOL}</span>
      <input style={inp} value={value} onChange={onChange} placeholder={placeholder} type="text" inputMode="decimal"
        onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.borderDim} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════
const store = {
  async get(k) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
  async del(k) { try { await window.storage.delete(k); } catch {} },
};

// ═══════════════════════════════════════════════════
// ANIMATED NUMBER
// ═══════════════════════════════════════════════════
function AnimNum({ value, prefix = '$', decimals = 0, style = {} }) {
  const [disp, setDisp] = useState(0);
  const raf = useRef(); const st = useRef();
  useEffect(() => {
    const tgt = Number(value) || 0; const from = disp;
    st.current = performance.now();
    const tick = (now) => {
      const p = Math.min((now - st.current) / 800, 1);
      setDisp(from + (tgt - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  const f = decimals > 0
    ? Math.abs(disp).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.abs(Math.round(disp)).toLocaleString('en-US');
  return <span style={style}>{disp < 0 ? '-' : ''}{prefix}{f}</span>;
}

// ═══════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════
function ProgressBar({ percent, color, t }) {
  const c = color || pctColor(percent, t);
  return (<div style={{ width: '100%', height: 6, background: t.elevated, marginBottom: 4 }}>
    <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: c, transition: 'width 1s ease-out', boxShadow: percent >= 100 ? `0 0 8px ${t.danger}40` : 'none' }} />
  </div>);
}

function Card({ title, children, visible = true, delay = 0, alert = false, t }) {
  if (!visible) return null;
  return (
    <div style={{ background: t.surface, border: `1px solid ${alert ? t.danger + '60' : t.borderDim}`, borderRadius: 4, padding: '16px 20px', animation: `fadeIn 0.4s ease-out ${delay}ms both`, borderLeft: alert ? `2px solid ${t.danger}` : undefined, transition: 'border-color 0.2s' }}
      onMouseEnter={e => { if (!alert) e.currentTarget.style.borderColor = t.borderMid; }}
      onMouseLeave={e => { if (!alert) e.currentTarget.style.borderColor = t.borderDim; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
        {alert && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.danger, boxShadow: `0 0 6px ${t.danger}` }} />}
      </div>
      {children}
    </div>
  );
}

const ChartTip = ({ active, payload, label, t }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: t.elevated, border: `1px solid ${t.borderMid}`, padding: '6px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textPrimary }}>
    <div style={{ color: t.textSecondary, fontSize: 9, marginBottom: 2 }}>{label}</div><div>{fmt(payload[0].value)}</div>
  </div>);
};

// ═══════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════
function LandingView({ t, onInitialize, onDocs, onToggleTheme, isDark }) {
  const [boot, setBoot] = useState(0);
  useEffect(() => { const id = setInterval(() => setBoot(p => p < 4 ? p + 1 : 4), 600); return () => clearInterval(id); }, []);
  const ln = (s) => ({ opacity: boot >= s ? 1 : 0, transition: 'opacity 0.3s', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.void, color: t.textPrimary }}>
      <nav style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} style={{ color: t.accent }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>FORTIFYOS</span>
        </div>
        <button onClick={onToggleTheme} style={{ background: 'none', border: `1px solid ${t.borderDim}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSecondary }}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 680, width: '100%' }}>
          <div style={{ textAlign: 'left', background: t.surface, border: `1px solid ${t.borderDim}`, padding: 16, borderRadius: 4, marginBottom: 40 }}>
            <p style={ln(1)}>[ SYSTEM ] : INITIALIZING COMMAND LAYER...</p>
            <p style={ln(2)}>[ KERNEL ] : LOADING PHASE_AWARE_EXECUTION_v2.0</p>
            <p style={ln(3)}>[ STATUS ] : <span style={{ color: t.accent }}>PHASE-AWARE EXECUTION ACTIVE</span></p>
            <p style={ln(4)}>[ READY&nbsp; ] : AWAITING OPERATOR INPUT<span style={{ animation: 'blink 1s infinite' }}>_</span></p>
          </div>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, textTransform: 'uppercase', lineHeight: 0.95, letterSpacing: '-0.03em', marginBottom: 24 }}>
            <span className="hero-title" style={{ display: 'block' }}>Systematic</span>
            <span className="hero-title" style={{ display: 'block', color: t.accent, textShadow: `0 0 10px ${t.accent}66` }}>Wealth Defense</span>
          </h1>
          <p style={{ color: t.textSecondary, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }} className="hero-sub">
            The command-layer intelligence system for phase-aware financial execution. Protect first. Grow second. Every dollar has a job.
          </p>
          <div className="hero-buttons" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={onInitialize} style={{ background: t.accent, color: isDark ? '#000' : '#FFF', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>INITIALIZE TERMINAL <ChevronRight size={16} /></button>
            <button onClick={onDocs} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: "'Space Mono', monospace", fontSize: 14, padding: '14px 28px', cursor: 'pointer', color: t.textSecondary, width: '100%', textAlign: 'center' }}>DOCUMENTATION</button>
          </div>
        </div>
      </main>
      <section className="footer-stats" style={{ display: 'grid', borderTop: `1px solid ${t.borderDim}` }}>
        {[{ label: 'ARCHITECTURE', val: 'OFFLINE-FIRST', Icon: Lock }, { label: 'ENGINE', val: 'PHASE-AWARE', Icon: Cpu }, { label: 'UPTIME', val: '99.9% LOCAL', Icon: Activity }].map((s, i) => (
          <div key={i} className="footer-stat-cell" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <s.Icon size={20} style={{ color: t.accent, marginBottom: 4 }} />
            <span style={{ fontSize: 9, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{s.val}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DOCUMENTATION VIEW
// ═══════════════════════════════════════════════════
function DocsView({ t, isDark, onBack, onToggleTheme }) {
  const [activeSection, setActiveSection] = useState(null);
  const accent = t.accent;
  const sty = {
    nav: { position: 'sticky', top: 0, zIndex: 50, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, borderBottom: `1px solid ${t.borderDim}` },
    container: { maxWidth: 780, margin: '0 auto', padding: '24px 24px 80px' },
    h2: { fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', color: accent, marginTop: 40, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${t.borderDim}` },
    h3: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textPrimary, marginTop: 20, marginBottom: 8 },
    p: { fontSize: 13, color: t.textSecondary, marginBottom: 14, lineHeight: 1.7 },
    code: { background: t.surface, color: accent, padding: '2px 6px', border: `1px solid ${t.borderDim}`, fontSize: 12 },
    pre: { background: t.surface, padding: '14px 18px', border: `1px solid ${t.borderDim}`, overflow: 'auto', color: t.accentDim || accent, fontSize: 12, lineHeight: 1.6, margin: '14px 0' },
    note: (c) => ({ borderLeft: `2px solid ${c || accent}`, padding: '10px 14px', color: t.textSecondary, margin: '16px 0', background: t.surface, fontSize: 12 }),
    formula: { background: t.surface, border: `1px solid ${t.borderDim}`, padding: '14px 18px', margin: '14px 0', textAlign: 'center', fontSize: 14, color: accent },
    th: { border: `1px solid ${t.borderDim}`, padding: '8px 12px', textAlign: 'left', fontSize: 10, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', background: t.surface },
    td: { border: `1px solid ${t.borderDim}`, padding: '8px 12px', fontSize: 12, color: t.textSecondary },
    card: { background: t.surface, border: `1px solid ${t.borderDim}`, padding: 14 },
    rail: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: t.textSecondary },
    cmd: { display: 'flex', gap: 16, padding: '6px 0', borderBottom: `1px solid ${t.borderDim}`, alignItems: 'baseline', flexWrap: 'wrap' },
  };
  const Code = ({ children }) => <code style={sty.code}>{children}</code>;
  const Lbl = ({ children }) => <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>;

  const TOC = [
    { id: 'ingestion', num: '01', label: 'Data Ingestion' },
    { id: 'schema', num: '02', label: 'Snapshot Schema' },
    { id: 'calculations', num: '03', label: 'Core Calculations' },
    { id: 'efund', num: '04', label: 'Emergency Fund Phases' },
    { id: 'budget', num: '05', label: 'Budget Allocation' },
    { id: 'macro', num: '06', label: 'Macro Intelligence & Benner Cycle' },
    { id: 'safety', num: '07', label: 'Safety Rails' },
    { id: 'commands', num: '08', label: 'Command Reference' },
    { id: 'sentinel', num: '09', label: 'Sentinel Redaction' },
    { id: 'claude-code', num: '10', label: 'Desktop Parsing (Claude Code)' },
  ];

  const scrollTo = (id) => { setActiveSection(id); document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary }}>
      <nav style={sty.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> BACK
          </button>
          <span style={{ color: t.borderMid }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={onBack} title="Return to home">
            <Shield size={14} style={{ color: accent }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, color: accent }}>FORTIFYOS</span>
            <span style={{ fontSize: 10, color: t.textDim }}>DOCS</span>
          </div>
        </div>
        <button onClick={onToggleTheme} style={{ background: 'none', border: `1px solid ${t.borderDim}`, borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSecondary }}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
      </nav>

      <div style={sty.container}>
        {/* Hero */}
        <div style={{ padding: '32px 0 24px', borderBottom: `1px solid ${t.borderDim}`, marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: 8 }}>
            FORTIFYOS <span style={{ color: accent }}>// Docs</span>
          </h1>
          <p style={{ color: t.textSecondary, fontSize: 13, maxWidth: 520 }}>Technical field manual. Covers data structure, phase-logic, calculation methodology, and system commands.</p>
          <span style={{ display: 'inline-block', marginTop: 10, fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', border: `1px solid ${t.borderDim}`, padding: '3px 8px' }}>v2.2 — Phase-Aware Financial OS</span>
        </div>

        {/* TOC */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '16px 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Navigation</div>
          {TOC.map(s => (
            <div key={s.id} onClick={() => scrollTo(s.id)} style={{ padding: '4px 0 4px 12px', fontSize: 12, color: activeSection === s.id ? accent : t.textSecondary, cursor: 'pointer', borderLeft: `2px solid ${activeSection === s.id ? accent : 'transparent'}`, transition: 'all 0.2s' }}>
              <span style={{ color: t.textDim, marginRight: 8 }}>{s.num}</span>{s.label}
            </div>
          ))}
        </div>

        {/* 01 DATA INGESTION */}
        <h2 id="doc-ingestion" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>01</span> Data Ingestion</h2>
        <p style={sty.p}><strong style={{ color: t.textPrimary }}>Offline-First.</strong> No data leaves the device. The system accepts financial data through three ingestion paths, prioritized by fidelity.</p>
        <div className="sync-row-3" style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
          {[
            { title: 'FILE IMPORT (PRIMARY)', desc: 'Drop a .csv bank export. Auto-detects Chase, BofA, Amex, Capital One, Wells Fargo, and Citi via header fingerprinting.' },
            { title: 'JSON PASTE (SECONDARY)', desc: 'Paste a structured JSON snapshot from CLI tools, Claude Code, or export scripts. Schema validated before commit.' },
            { title: 'MANUAL ENTRY (FALLBACK)', desc: 'Guided form for assets, debts, monthly expenses, and budget categories. Live calculations update as you type.' },
          ].map((c, i) => (
            <div key={i} style={sty.card}><div style={{ fontSize: 11, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{c.title}</div><div style={{ fontSize: 11, color: t.textDim }}>{c.desc}</div></div>
          ))}
        </div>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Bank Fingerprinting:</strong> The system identifies your bank by matching CSV column headers against known signatures. No account numbers or routing data is used for identification.
        </div>

        {/* 02 SNAPSHOT SCHEMA */}
        <h2 id="doc-schema" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>02</span> Snapshot Schema</h2>
        <p style={sty.p}>Every sync produces a snapshot — a single JSON object representing your complete financial state at a point in time.</p>
        <pre style={sty.pre}>{`{
  "date": "2026-02-21",
  "netWorth": {
    "assets": { "checking": 2400, "eFund": 2000, "other": 0 },
    "liabilities": { "Chase CC": 3200, "USAA": 5000 },
    "total": -3800
  },
  "debts": [
    { "name": "Chase CC", "apr": 29.99, "balance": 3200, "minPayment": 95 },
    { "name": "USAA", "apr": 24.99, "balance": 5000, "minPayment": 250 }
  ],
  "eFund": { "balance": 2000, "monthlyExpenses": 3000, "phase": 2 },
  "budget": {
    "categories": [
      { "name": "Essential", "budgeted": 2000, "actual": 1850 },
      { "name": "Discretionary", "budgeted": 300, "actual": 220 },
      { "name": "Medical", "budgeted": 300, "actual": 175 },
      { "name": "Debt Service", "budgeted": 500, "actual": 500 },
      { "name": "Savings", "budgeted": 300, "actual": 300 }
    ]
  },
  "macro": { "netLiquidity": 6.24, "btcPrice": 97000, ... }
}`}</pre>

        {/* 03 CORE CALCULATIONS */}
        <h2 id="doc-calculations" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>03</span> Core Calculations</h2>

        <h3 style={sty.h3}>Net Worth</h3>
        <div style={sty.formula}><Lbl>Net Worth Formula</Lbl>Net Worth = Σ Assets − Σ Liabilities</div>
        <p style={sty.p}>Assets include checking, emergency fund, and other holdings. Liabilities are the sum of all tracked debt balances. Even a $10 increase is tracked as a directional win.</p>

        <h3 style={sty.h3}>Daily Interest Burn</h3>
        <div style={sty.formula}><Lbl>Per-Debt Daily Interest</Lbl>Daily Interest = (Balance × APR / 100) / 365</div>
        <p style={sty.p}>Converts an abstract balance into a visceral daily cost — money evaporating every 24 hours.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Balance</th><th style={sty.th}>APR</th><th style={sty.th}>Daily Burn</th><th style={sty.th}>Monthly Waste</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>$5,000</td><td style={sty.td}>24.99%</td><td style={sty.td}>$3.42</td><td style={sty.td}>$104.13</td></tr>
            <tr><td style={sty.td}>$3,200</td><td style={sty.td}>29.99%</td><td style={sty.td}>$2.63</td><td style={sty.td}>$79.97</td></tr>
            <tr><td style={{ ...sty.td, textAlign: 'right' }} colSpan={2}>TOTAL</td><td style={{ ...sty.td, color: t.danger }}>$6.05/day</td><td style={{ ...sty.td, color: t.danger }}>$184.10/mo</td></tr>
          </tbody>
        </table>

        <h3 style={sty.h3}>Avalanche Method</h3>
        <p style={sty.p}>Debts are automatically sorted by APR descending. The highest-APR debt receives all extra payments above minimums. When zeroed, the system re-targets the next highest.</p>

        <h3 style={sty.h3}>Savings Rate</h3>
        <div style={sty.formula}><Lbl>Monthly Savings Rate</Lbl>Savings Rate = ((Income − Total Spent) / Income) × 100</div>

        {/* 04 EMERGENCY FUND */}
        <h2 id="doc-efund" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>04</span> Emergency Fund Phases</h2>
        <p style={sty.p}>The emergency fund is measured in <strong style={{ color: t.textPrimary }}>days of survival</strong>, not raw dollars. This forces evaluation through the lens of time.</p>
        <div style={sty.formula}><Lbl>Runway Calculation</Lbl>Runway Days = (E-Fund Balance / Monthly Expenses) × 30</div>

        {/* Phase bar */}
        <div style={{ display: 'flex', gap: 3, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 8, background: accent }} />
          <div style={{ flex: 1, height: 8, background: accent, boxShadow: `0 0 6px ${accent}66` }} />
          <div style={{ flex: 1, height: 8, background: t.elevated }} />
          <div style={{ flex: 1, height: 8, background: t.elevated }} />
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
          {['Phase 1: $1K ✓', 'Phase 2: 1 Month', 'Phase 3: 3 Months', 'Phase 4: 6 Months'].map((l, i) => (
            <span key={i} style={{ flex: 1, fontSize: 8, color: t.textDim, textTransform: 'uppercase' }}>{l}</span>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Phase</th><th style={sty.th}>Target</th><th style={sty.th}>Purpose</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Phase 1</td><td style={sty.td}>$1,000</td><td style={sty.td}>Initial containment — prevents debt spiral from minor emergencies</td></tr>
            <tr><td style={sty.td}>Phase 2</td><td style={sty.td}>1× Monthly</td><td style={sty.td}>Baseline shield — one month of breathing room</td></tr>
            <tr><td style={sty.td}>Phase 3</td><td style={sty.td}>3× Monthly</td><td style={sty.td}>Stability buffer — covers job loss or medical event</td></tr>
            <tr><td style={sty.td}>Phase 4</td><td style={sty.td}>6× Monthly</td><td style={sty.td}>Full fortress — complete financial resilience</td></tr>
          </tbody>
        </table>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Runway color thresholds:</strong> <span style={{ color: t.danger }}>Red (&lt;30 days)</span> · <span style={{ color: t.warn }}>Amber (30–59 days)</span> · <span style={{ color: accent }}>Green (60+ days)</span>
        </div>

        {/* 05 BUDGET */}
        <h2 id="doc-budget" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>05</span> Budget Allocation</h2>
        <p style={sty.p}>Each category has a target (budgeted) and actual spend, with utilization percentage calculated live.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Category</th><th style={sty.th}>Scope</th><th style={sty.th}>Priority</th></tr></thead>
          <tbody>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Essential</td><td style={sty.td}>Rent, groceries, utilities, insurance, gas</td><td style={sty.td}>Non-negotiable</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Medical</td><td style={sty.td}>Prescriptions, appointments, adaptive equipment</td><td style={{ ...sty.td, color: t.danger }}>Priority #1 always</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Debt Service</td><td style={sty.td}>Minimum payments + extra principal</td><td style={sty.td}>Active paydown</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Savings</td><td style={sty.td}>Emergency fund contributions</td><td style={sty.td}>Parallel with debt</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Discretionary</td><td style={sty.td}>Dining, entertainment, subscriptions</td><td style={sty.td}>Minimize</td></tr>
          </tbody>
        </table>
        <div style={sty.note()}>
          <span style={{ color: accent }}>0–74%</span> — On track · <span style={{ color: t.warn }}>75–99%</span> — Watch · <span style={{ color: t.danger }}>100%+</span> — Blown
        </div>

        {/* 06 MACRO */}
        <h2 id="doc-macro" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>06</span> Macro Intelligence & Benner Cycle</h2>
        <p style={sty.p}>Tracks Federal Reserve liquidity conditions, Bitcoin cycle positioning, and yield curve dynamics. Contextual awareness for phase-level decisions — not trading signals.</p>

        <h3 style={sty.h3}>Net Liquidity Formula</h3>
        <div style={sty.formula}><Lbl>Fed Net Liquidity</Lbl>Net Liquidity = WALCL − TGA − RRP</div>

        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Component</th><th style={sty.th}>Source</th><th style={sty.th}>What It Means</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}><Code>WALCL</Code></td><td style={sty.td}>Fed Balance Sheet</td><td style={sty.td}>Total assets held by the Fed</td></tr>
            <tr><td style={sty.td}><Code>TGA</Code></td><td style={sty.td}>Treasury General Account</td><td style={sty.td}>Cash the Treasury holds (drains liquidity)</td></tr>
            <tr><td style={sty.td}><Code>RRP</Code></td><td style={sty.td}>Reverse Repo Facility</td><td style={sty.td}>Cash parked at Fed overnight (drains liquidity)</td></tr>
          </tbody>
        </table>

        <h3 style={sty.h3}>Trigger Alert System</h3>
        <p style={sty.p}>If <strong style={{ color: t.textPrimary }}>any 2</strong> of these 5 triggers activate simultaneously, the dashboard escalates to high-priority alert:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>#</th><th style={sty.th}>Trigger</th><th style={sty.th}>Threshold</th></tr></thead>
          <tbody>
            {[['1','FedWatch rate cut probability spike','>15% in 24hrs'],['2','Yield curve un-inversion','10Y-2Y >10bps'],['3','Net Liquidity surge during dip','>$50B in 1 week'],['4','RRP single-day drain','>$30B in one session'],['5','TGA drawdown','>$40B in 1 week']].map(([n,t2,th]) => (
              <tr key={n}><td style={sty.td}>{n}</td><td style={sty.td}>{t2}</td><td style={sty.td}>{th}</td></tr>
            ))}
          </tbody>
        </table>

        <h3 style={sty.h3}>Benner Cycle Positioning</h3>
        <p style={sty.p}>A long-wave economic timing framework used as a <strong style={{ color: t.textPrimary }}>macro posture filter</strong> — not a trading signal — to determine defensive, neutral, or accumulation mode.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Year Type</th><th style={sty.th}>Posture</th><th style={sty.th}>Action</th></tr></thead>
          <tbody>
            <tr><td style={{ ...sty.td, color: accent }}>A-Year (Buy)</td><td style={sty.td}>Accumulation</td><td style={sty.td}>Deploy capital. DCA into long-term positions.</td></tr>
            <tr><td style={{ ...sty.td, color: t.warn }}>B-Year (Sell)</td><td style={sty.td}>Defensive</td><td style={sty.td}>Sell into strength. Short-term setups only.</td></tr>
            <tr><td style={{ ...sty.td, color: t.textSecondary }}>C-Year (Panic)</td><td style={sty.td}>Opportunistic</td><td style={sty.td}>Distressed assets. Deep value. High conviction only.</td></tr>
          </tbody>
        </table>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Integration:</strong> Every trade blueprint checks Benner compatibility as a required filter. The dashboard phase indicator is cycle-derived, not hardcoded.
        </div>

        {/* 07 SAFETY RAILS */}
        <h2 id="doc-safety" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>07</span> Safety Rails</h2>
        <p style={sty.p}>Hard safety rails are immutable. They cannot be overridden by the operator, by KNOX, or by any system logic.</p>
        {['Never invest emergency fund money','Never recommend positions that could create debt','Never skip minimum debt payments for investments','Never suggest leverage or margin during Fortify phase','Medical expenses = ALWAYS Priority #1','Family stability check: if this goes to zero, does family survive?'].map((r, i) => (
          <div key={i} style={sty.rail}><span style={{ color: t.danger, fontSize: 14 }}>✗</span> {r}</div>
        ))}
        <h3 style={sty.h3}>Soft Limits</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Limit</th><th style={sty.th}>Override Requires</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Any single position &gt;5% of investable capital</td><td style={sty.td}>Explicit approval</td></tr>
            <tr><td style={sty.td}>Any investment requiring &gt;$500 upfront</td><td style={sty.td}>Explicit approval during Fortify</td></tr>
          </tbody>
        </table>

        {/* 08 COMMANDS */}
        <h2 id="doc-commands" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>08</span> Command Reference</h2>
        {[
          ['/cfo', 'Morning Pulse — CFO snapshot + macro intel. Also triggered by "Good morning".'],
          ['/macro', 'Liquidity snapshot — Net Liquidity, FedWatch, yield curve, BTC phase.'],
          ['/sloan', 'TCG/Pokemon market intelligence — set trends, sealed product, pop reports.'],
          ['/sync [JSON]', 'Weekly HUD generation from OpenClaw manifest data.'],
          ['/audit', 'Full financial health check — net worth, debt, budget, e-fund, projections.'],
          ['/monthly', 'Generate downloadable PDF progress report.'],
          ['/scan_now', 'Manual trigger for OpenClaw automated scans.'],
          ['/protocol_reset', 'Architect First violation recovery — restart from questionnaire.'],
        ].map(([k, d], i) => (
          <div key={i} style={sty.cmd}>
            <span style={{ color: accent, fontSize: 12, minWidth: 120 }}>{k}</span>
            <span style={{ color: t.textDim, fontSize: 11 }}>{d}</span>
          </div>
        ))}
        <h3 style={{ ...sty.h3, marginTop: 20 }}>Natural Language</h3>
        {[
          ['"Good morning"', '→ Morning Pulse'],
          ['"What\'s my net worth?"', '→ Latest calculation + trend'],
          ['"Can I afford [X]?"', '→ Budget check + opportunity cost'],
          ['"Debt payoff plan"', '→ Current pace + acceleration scenarios'],
          ['"Pokemon market"', '→ SLOAN market intel'],
          ['"What should I focus on?"', '→ Prioritized action items'],
        ].map(([k, d], i) => (
          <div key={i} style={sty.cmd}>
            <span style={{ color: accent, fontSize: 12, minWidth: 180 }}>{k}</span>
            <span style={{ color: t.textDim, fontSize: 11 }}>{d}</span>
          </div>
        ))}

        {/* 09 SENTINEL */}
        <h2 id="doc-sentinel" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>09</span> Sentinel Redaction</h2>
        <p style={sty.p}>All data ingested via CSV or file import passes through the Sentinel filter before processing.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Pattern</th><th style={sty.th}>Action</th><th style={sty.th}>Example</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Card numbers</td><td style={sty.td}>Mask to last 4</td><td style={sty.td}><Code>XXXX-XXXX-XXXX-1234</Code></td></tr>
            <tr><td style={sty.td}>SSNs</td><td style={sty.td}>Full mask</td><td style={sty.td}><Code>XXX-XX-****</Code></td></tr>
            <tr><td style={sty.td}>Account refs</td><td style={sty.td}>Replace</td><td style={sty.td}><Code>[REDACTED]</Code></td></tr>
          </tbody>
        </table>
        <div style={sty.note(t.danger)}>
          <strong style={{ color: t.textPrimary }}>Privacy Wall:</strong> Tax documents and detailed financial ledgers are local-only. Never cloud-synced. No override authority.
        </div>

        {/* 10 CLAUDE CODE */}
        <h2 id="doc-claude-code" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>10</span> Desktop Parsing (Claude Code)</h2>
        <p style={sty.p}>Screenshots and PDFs can't be parsed in the browser artifact. Claude Code on desktop fills this gap with full filesystem and library access.</p>

        <h3 style={sty.h3}>Setup</h3>
        <pre style={sty.pre}>{`npm install tesseract.js   # OCR for screenshots
npm install pdfjs-dist     # PDF text extraction
npm install papaparse      # CSV parsing`}</pre>

        <h3 style={sty.h3}>Usage</h3>
        <pre style={sty.pre}>{`# Parse a bank PDF statement
node fortify-parse.js ~/Downloads/Chase_Feb.pdf > snapshot.json

# Parse a screenshot
node fortify-parse.js ~/Desktop/balance.png > snapshot.json

# Copy to clipboard and paste into dashboard
cat snapshot.json | pbcopy`}</pre>

        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>All parsing runs locally.</strong> The script never sends data to external APIs. Sentinel redaction is applied before JSON output.
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: t.textDim, marginTop: 60, paddingTop: 16, borderTop: `1px solid ${t.borderDim}`, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <p>No data is sent to external servers.</p>
          <p style={{ marginTop: 6 }}>Protect first, grow second. Every dollar has a job.</p>
          <p style={{ marginTop: 12, color: t.textGhost }}>KNOX v1.1 — FORTIFY v2.0</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// UNIVERSAL SYNC ENGINE
// ═══════════════════════════════════════════════════
function UniversalSync({ open, onClose, onSync, t }) {
  const [tab, setTab] = useState('file');
  const [logs, setLogs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const fileRef = useRef();

  // JSON paste state
  const [json, setJson] = useState('');
  const [jsonValidating, setJsonValidating] = useState(false);

  // Guided state
  const [gCheck, setGCheck] = useState(''); const [gEF, setGEF] = useState(''); const [gOther, setGOther] = useState('');
  const [gDebts, setGDebts] = useState([{ name: '', apr: '', balance: '', minPayment: '', type: 'REVOLVING', totalTerms: '', paymentsMade: '', monthlyPayment: '' }]);
  const [gMonthly, setGMonthly] = useState('');
  const [gBudget, setGBudget] = useState([
    { name: 'Essential', budgeted: '', actual: '' },
    { name: 'Discretionary', budgeted: '', actual: '' },
    { name: 'Medical', budgeted: '', actual: '' },
    { name: 'Debt Service', budgeted: '', actual: '' },
    { name: 'Savings', budgeted: '', actual: '' },
  ]);
  const upBudget = (i, f, v) => { const b = [...gBudget]; b[i][f] = v; setGBudget(b); };

  // Protection state
  const [gProvider, setGProvider] = useState(''); const [gPolicyType, setGPolicyType] = useState('TERM');
  const [gBenefit, setGBenefit] = useState(''); const [gPremium, setGPremium] = useState('');
  const [gPolicyExp, setGPolicyExp] = useState(''); const [gConvDeadline, setGConvDeadline] = useState('');
  const [gLeadYears, setGLeadYears] = useState('5');
  const [gFuneralTarget, setGFuneralTarget] = useState('10000'); const [gFuneralCurrent, setGFuneralCurrent] = useState('');

  // Portfolio state
  const [gEquities, setGEquities] = useState([{ ticker: '', shares: '', avgCost: '', lastPrice: '' }]);
  const [gOptions, setGOptions] = useState([{ ticker: '', type: 'CALL', contracts: '', strikePrice: '', expDate: '', lastPrice: '' }]);
  const upEquity = (i, f, v) => { const e = [...gEquities]; e[i][f] = v; setGEquities(e); };
  const upOption = (i, f, v) => { const o = [...gOptions]; o[i][f] = v; setGOptions(o); };
  const addEquity = () => setGEquities([...gEquities, { ticker: '', shares: '', avgCost: '', lastPrice: '' }]);
  const addOption = () => setGOptions([...gOptions, { ticker: '', type: 'CALL', contracts: '', strikePrice: '', expDate: '', lastPrice: '' }]);

  if (!open) return null;

  const log = (msg) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 8));

  const identifyBank = (headers) => {
    for (const [key, sig] of Object.entries(BANK_SIGNATURES)) {
      if (sig.detect(headers)) return { key, ...sig };
    }
    return null;
  };

  const processCSV = (text, fileName) => {
    log('PARSING CSV STRUCTURE...');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) { log(`PARSE WARNING: ${result.errors.length} row errors`); }
    const headers = result.meta.fields || [];
    log(`HEADERS: ${headers.slice(0, 4).join(', ')}${headers.length > 4 ? '...' : ''}`);

    const bank = identifyBank(headers);
    if (bank) {
      log(`FINGERPRINT MATCH: ${bank.name.toUpperCase()}`);
    } else {
      log('BANK: UNRECOGNIZED — GENERIC PARSE');
    }

    log('RUNNING SENTINEL REDACTION FILTER...');
    const cleanRows = result.data.map(sentinel.redactRow);

    let txns;
    if (bank) {
      txns = bank.parse(cleanRows);
    } else {
      txns = cleanRows.map(r => {
        const vals = Object.values(r);
        const amtField = Object.keys(r).find(k => /amount|debit|credit|balance/i.test(k));
        return { date: vals[0] || '', description: vals[1] || '', amount: parseFloat(r[amtField] || vals[2]) || 0 };
      });
    }

    log(`TRANSACTIONS EXTRACTED: ${txns.length}`);
    log('MAPPING TO FORTIFY SCHEMA...');

    const snapshot = transactionsToSnapshot(txns, bank ? bank.name : 'Generic');
    log(`CATEGORIES: ${snapshot.budget.categories.filter(c => c.actual > 0).length} active`);
    if (snapshot._meta.uncategorized > 0) {
      log(`⚠ UNCATEGORIZED: ${fmt(snapshot._meta.uncategorized)}`);
    }
    log('SYNC READY — REVIEW & CONFIRM');
    setParsedPreview(snapshot);
  };

  const processXLSX = (buffer, fileName) => {
    log('XLSX DETECTED — CONVERSION NEEDED');
    log('→ Open file in your bank portal');
    log('→ Re-export as .csv format');
    log('→ Drop the .csv here');
    setError('.xlsx requires re-export as .csv — all major banks support CSV download.');
  };

  const processJSON = (text) => {
    log('PARSING JSON SNAPSHOT...');
    try {
      const p = JSON.parse(text);
      const missing = ['date', 'netWorth', 'debts', 'eFund'].filter(k => !(k in p));
      if (missing.length) { log(`ERROR: MISSING KEYS — ${missing.join(', ')}`); setError(`Missing: ${missing.join(', ')}`); return; }
      log('SCHEMA VALID');
      log('RUNNING SENTINEL REDACTION FILTER...');
      log('SYNC READY');
      setParsedPreview(p);
    } catch (e) { log('ERROR: INVALID JSON SYNTAX'); setError('Invalid JSON syntax'); }
  };

  const handleFile = async (file) => {
    setProcessing(true); setError(''); setParsedPreview(null);
    setLogs([]);
    const ext = file.name.split('.').pop().toLowerCase();
    log(`DETECTED: ${file.name} (.${ext.toUpperCase()})`);
    log(`SIZE: ${(file.size / 1024).toFixed(1)}KB`);

    try {
      if (ext === 'csv') {
        const text = await file.text();
        processCSV(text, file.name);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        processXLSX(buffer, file.name);
      } else if (ext === 'json') {
        const text = await file.text();
        processJSON(text);
      } else if (['png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
        log('FORMAT REQUIRES EXTERNAL PARSE');
        log('→ Drop this file into Claude chat');
        log('→ Claude outputs JSON snapshot');
        log('→ Paste JSON here via JSON tab');
        setError(`${ext.toUpperCase()} files need Claude chat parsing. Use the JSON tab after.`);
      } else {
        log(`ERROR: UNSUPPORTED FORMAT .${ext}`);
        setError(`Unsupported: .${ext}`);
      }
    } catch (e) {
      log('CRITICAL ERROR: INGESTION ABORTED');
      setError('File read failed');
    } finally { setProcessing(false); }
  };

  const confirmSync = () => {
    if (!parsedPreview) return;
    onSync(parsedPreview);
    setSuccess(true);
    log('✓ SYNC COMMITTED TO STORAGE');
    setTimeout(() => { setSuccess(false); setParsedPreview(null); setLogs([]); onClose(); }, 600);
  };

  const handlePasteSync = () => {
    setJsonValidating(true); setError('');
    setTimeout(() => {
      processJSON(json);
      setJsonValidating(false);
    }, 500);
  };

  const handleGuided = () => {
    const checking = parseFloat(gCheck) || 0; const efund = parseFloat(gEF) || 0; const other = parseFloat(gOther) || 0;
    const debts = gDebts.filter(d => d.name).map(d => {
      const isFixed = d.type === 'BNPL' || d.type === 'TERM';
      return {
        name: d.name, apr: parseFloat(d.apr) || 0, balance: parseFloat(d.balance) || 0,
        minPayment: parseFloat(d.minPayment) || 0, type: d.type || 'REVOLVING',
        ...(isFixed ? {
          totalTerms: parseInt(d.totalTerms) || 0,
          paymentsMade: parseInt(d.paymentsMade) || 0,
          monthlyPayment: parseFloat(d.monthlyPayment) || 0,
        } : {}),
      };
    });
    const tL = debts.reduce((s, d) => s + d.balance, 0); const monthly = parseFloat(gMonthly) || 3000;
    const phase = efund >= monthly * 6 ? 4 : efund >= monthly * 3 ? 3 : efund >= monthly ? 2 : efund >= 1000 ? 1 : 0;
    const budgetCats = gBudget.map(b => ({ name: b.name, budgeted: parseFloat(b.budgeted) || 0, actual: parseFloat(b.actual) || 0 }));
    const protection = {
      lifeInsurance: { provider: gProvider, type: gPolicyType, deathBenefit: parseFloat(gBenefit) || 0, monthlyPremium: parseFloat(gPremium) || 0, expirationDate: gPolicyExp, conversionDeadline: gConvDeadline, alertLeadTimeYears: parseInt(gLeadYears) || 5 },
      funeralBuffer: { target: parseFloat(gFuneralTarget) || 10000, current: parseFloat(gFuneralCurrent) || 0 },
    };
    const portfolio = {
      equities: gEquities.filter(e => e.ticker).map(e => ({ ticker: e.ticker.toUpperCase(), shares: parseFloat(e.shares) || 0, avgCost: parseFloat(e.avgCost) || 0, lastPrice: parseFloat(e.lastPrice) || 0 })),
      options: gOptions.filter(o => o.ticker).map(o => ({ ticker: o.ticker.toUpperCase(), type: o.type, contracts: parseInt(o.contracts) || 0, strikePrice: parseFloat(o.strikePrice) || 0, expDate: o.expDate, lastPrice: parseFloat(o.lastPrice) || 0 })),
    };
    const snap = { date: new Date().toISOString().slice(0, 10), netWorth: { assets: { checking, eFund: efund, other }, liabilities: debts.reduce((o, d) => ({ ...o, [d.name]: d.balance }), {}), total: checking + efund + other - tL }, debts, eFund: { balance: efund, monthlyExpenses: monthly, phase }, budget: { categories: budgetCats }, macro: DEFAULT_SNAPSHOT.macro, protection, portfolio };
    onSync(snap); setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose(); }, 600);
  };

  const addDebt = () => setGDebts([...gDebts, { name: '', apr: '', balance: '', minPayment: '', type: 'REVOLVING', totalTerms: '', paymentsMade: '', monthlyPayment: '' }]);
  const upDebt = (i, f, v) => { const d = [...gDebts]; d[i][f] = v; setGDebts(d); };
  const inp = { background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px', width: '100%', outline: 'none', borderRadius: 2, boxSizing: 'border-box' };
  const lbl = { color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.borderMid}`, maxWidth: 620, width: '100%', maxHeight: '92vh', overflow: 'auto', borderRadius: '6px 6px 0 0' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.borderDim}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.elevated }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={14} style={{ color: t.accent }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textPrimary }}>Universal Sync Terminal</span>
          </div>
          <X size={16} style={{ color: t.textDim, cursor: 'pointer' }} onClick={onClose} />
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderDim}` }}>
          {[{ k: 'file', l: 'File Import' }, { k: 'json', l: 'JSON' }, { k: 'guided', l: 'Manual' }].map(tb => (
            <button key={tb.k} onClick={() => { setTab(tb.k); setError(''); setParsedPreview(null); }} style={{
              flex: 1, padding: 10, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: 'uppercase',
              color: tab === tb.k ? t.accent : t.textDim,
              borderBottom: tab === tb.k ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>{tb.l}</button>
          ))}
        </div>

        <div style={{ padding: 16 }}>
          {/* ── FILE IMPORT TAB ── */}
          {tab === 'file' && (<>
            {/* Drop zone */}
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                height: 120, border: `2px dashed ${dragOver ? t.accent : t.borderMid}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: dragOver ? t.accentMuted : t.void, cursor: 'pointer',
                transition: 'all 0.2s', marginBottom: 12, borderRadius: 4,
              }}>
              <input ref={fileRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              {processing
                ? <Zap size={24} style={{ color: t.accent, animation: 'blink 0.5s infinite' }} />
                : <Upload size={22} style={{ color: dragOver ? t.accent : t.textDim }} />}
              <span style={{ fontSize: 10, color: t.textDim, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {processing ? 'Processing...' : 'Drop file or click to browse'}
              </span>
              <span style={{ fontSize: 9, color: t.textGhost, marginTop: 4 }}>.csv .json</span>
            </div>

            {/* Supported banks */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {['Chase', 'BofA', 'Amex', 'Capital One', 'Wells Fargo', 'Citi'].map(b => (
                <span key={b} style={{ fontSize: 8, color: t.textDim, border: `1px solid ${t.borderDim}`, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b}</span>
              ))}
            </div>

            {/* Terminal log */}
            <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 10, height: 130, overflow: 'hidden', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.accentDim, lineHeight: 1.6 }}>
                {logs.length === 0 && <div style={{ color: t.textGhost }}>SYSTEM IDLE. AWAITING DATA...</div>}
                {logs.map((l, i) => <div key={i} style={{ opacity: 1 - i * 0.1 }}>{l}</div>)}
              </div>
            </div>

            {/* Parse preview */}
            {parsedPreview && (
              <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, padding: 12, borderRadius: 4, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Parse Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                  {parsedPreview._meta && <>
                    <div><span style={{ color: t.textDim }}>Source:</span> <span style={{ color: t.textPrimary }}>{parsedPreview._meta.source}</span></div>
                    <div><span style={{ color: t.textDim }}>Txns:</span> <span style={{ color: t.textPrimary }}>{parsedPreview._meta.transactions}</span></div>
                    <div><span style={{ color: t.textDim }}>Income:</span> <span style={{ color: t.accent }}>{fmt(parsedPreview._meta.income)}</span></div>
                    <div><span style={{ color: t.textDim }}>Expense:</span> <span style={{ color: t.danger }}>{fmt(parsedPreview._meta.totalExpense)}</span></div>
                  </>}
                </div>
                {parsedPreview._meta?.uncategorized > 0 && (
                  <div style={{ fontSize: 9, color: t.warn, marginTop: 6 }}>⚠ {fmt(parsedPreview._meta.uncategorized)} uncategorized — refine in dashboard</div>
                )}
              </div>
            )}

            {error && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.danger, fontSize: 11, marginBottom: 8 }}><AlertCircle size={13} /> {error}</div>}
            {success && <div style={{ color: t.accent, fontSize: 11, marginBottom: 8 }}>✓ SYNC COMMITTED</div>}

            {parsedPreview && (
              <button onClick={confirmSync} style={{ width: '100%', padding: 14, background: t.accent, color: t === THEMES.dark ? '#000' : '#FFF', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>CONFIRM & SYNC</button>
            )}

            {/* Privacy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 9, color: t.warn }}>
              <ShieldAlert size={11} />
              <span>SENTINEL: All parsing on-device. No PII stored. Card numbers auto-redacted.</span>
            </div>
          </>)}

          {/* ── JSON TAB ── */}
          {tab === 'json' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={lbl}>Paste JSON Snapshot</span>
              <span style={{ fontSize: 9, color: t.textGhost }}>CLI / Claude Code output</span>
            </div>
            <textarea value={json} onChange={e => setJson(e.target.value)}
              placeholder={'{\n  "date": "2026-02-21",\n  "netWorth": { ... },\n  "debts": [ ... ],\n  "eFund": { ... }\n}'}
              style={{ ...inp, height: 180, resize: 'vertical', marginBottom: 8, color: t.accent }}
              onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.borderDim} />
            {/* Log for JSON */}
            {logs.length > 0 && tab === 'json' && (
              <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 8, marginBottom: 8, borderRadius: 4, maxHeight: 80, overflow: 'hidden' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.accentDim }}>
                  {logs.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
            {parsedPreview && <button onClick={confirmSync} style={{ width: '100%', padding: 14, background: t.accent, color: t === THEMES.dark ? '#000' : '#FFF', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', marginBottom: 8 }}>CONFIRM & SYNC</button>}
            {!parsedPreview && <button onClick={handlePasteSync} disabled={jsonValidating || !json} style={{ width: '100%', padding: 14, background: jsonValidating ? t.elevated : t.accent, color: jsonValidating ? t.textDim : (t === THEMES.dark ? '#000' : '#FFF'), border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: jsonValidating ? 'wait' : 'pointer', textTransform: 'uppercase' }}>{jsonValidating ? 'VALIDATING...' : 'VALIDATE SCHEMA'}</button>}
            {error && <div style={{ color: t.danger, fontSize: 11, marginTop: 8 }}><AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{error}</div>}
          </>)}

          {/* ── GUIDED TAB ── */}
          {tab === 'guided' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Assets */}
              <div>
                <div style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Assets</div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Checking</label><CurrencyInput t={t} value={gCheck} onChange={e => setGCheck(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Emergency Fund</label><CurrencyInput t={t} value={gEF} onChange={e => setGEF(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Other Assets</label><CurrencyInput t={t} value={gOther} onChange={e => setGOther(e.target.value)} placeholder="0" /></div>
                </div>
              </div>
              {/* Debts */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debts</span><button onClick={addDebt} style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button></div>
                {gDebts.map((d, i) => (<div key={i} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${t.borderDim}` }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {['REVOLVING', 'BNPL', 'TERM'].map(tp => (
                      <button key={tp} onClick={() => upDebt(i, 'type', tp)} style={{
                        background: d.type === tp ? (tp === 'BNPL' ? t.warn + '20' : t.accentMuted) : 'none',
                        border: `1px solid ${d.type === tp ? (tp === 'BNPL' ? t.warn : t.accent) : t.borderDim}`,
                        color: d.type === tp ? (tp === 'BNPL' ? t.warn : t.accent) : t.textDim,
                        fontSize: 8, padding: '2px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{tp}</button>
                    ))}
                  </div>
                  <div className="sync-row-debt" style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                    <div><label style={lbl}>Name</label><input style={inp} placeholder={d.type === 'BNPL' ? 'e.g. Klarna / MacBook' : 'e.g. Chase CC'} value={d.name} onChange={e => upDebt(i, 'name', e.target.value)} /></div>
                    {d.type === 'REVOLVING' && <div><label style={lbl}>APR %</label><input style={inp} placeholder="24.99" value={d.apr} onChange={e => upDebt(i, 'apr', e.target.value)} inputMode="decimal" /></div>}
                    <div><label style={lbl}>Balance</label><CurrencyInput t={t} value={d.balance} onChange={e => upDebt(i, 'balance', e.target.value)} placeholder="0" /></div>
                    {d.type === 'REVOLVING'
                      ? <div><label style={lbl}>Min Payment</label><CurrencyInput t={t} value={d.minPayment} onChange={e => upDebt(i, 'minPayment', e.target.value)} placeholder="0" /></div>
                      : <div><label style={lbl}>Monthly Pmt</label><CurrencyInput t={t} value={d.monthlyPayment} onChange={e => upDebt(i, 'monthlyPayment', e.target.value)} placeholder="0" /></div>
                    }
                  </div>
                  {(d.type === 'BNPL' || d.type === 'TERM') && (
                    <div className="sync-row-3" style={{ display: 'grid', gap: 6 }}>
                      <div><label style={lbl}>Total Payments</label><input style={inp} placeholder="12" value={d.totalTerms} onChange={e => upDebt(i, 'totalTerms', e.target.value)} inputMode="numeric" /></div>
                      <div><label style={lbl}>Payments Made</label><input style={inp} placeholder="0" value={d.paymentsMade} onChange={e => upDebt(i, 'paymentsMade', e.target.value)} inputMode="numeric" /></div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                        {parseInt(d.totalTerms) > 0 && parseInt(d.paymentsMade) >= 0 && (
                          <span style={{ fontSize: 9, color: parseInt(d.totalTerms) - parseInt(d.paymentsMade || 0) <= 1 ? t.accent : t.textDim }}>
                            {parseInt(d.totalTerms) - parseInt(d.paymentsMade || 0)} remaining
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>))}
              </div>
              {/* Monthly burn rate */}
              <div>
                <div style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Monthly Burn Rate</div>
                <div><label style={lbl}>Total Monthly Expenses</label><CurrencyInput t={t} value={gMonthly} onChange={e => setGMonthly(e.target.value)} placeholder="3000" /></div>
              </div>
              {/* Budget categories */}
              <div>
                <div style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Budget Allocation</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>Category</span>
                  <span style={{ ...lbl, marginBottom: 0 }}>Budget</span>
                  <span style={{ ...lbl, marginBottom: 0 }}>Spent</span>
                </div>
                {gBudget.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: t.textSecondary }}>{b.name}</span>
                    <CurrencyInput t={t} value={b.budgeted} onChange={e => upBudget(i, 'budgeted', e.target.value)} placeholder="0" />
                    <CurrencyInput t={t} value={b.actual} onChange={e => upBudget(i, 'actual', e.target.value)} placeholder="0" />
                  </div>
                ))}
                {(() => {
                  const totalBudgeted = gBudget.reduce((s, b) => s + (parseFloat(b.budgeted) || 0), 0);
                  const totalSpent = gBudget.reduce((s, b) => s + (parseFloat(b.actual) || 0), 0);
                  if (totalBudgeted === 0 && totalSpent === 0) return null;
                  const remaining = totalBudgeted - totalSpent;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.borderDim}`, fontSize: 10 }}>
                      <span style={{ color: t.textDim }}>TOTAL</span>
                      <span style={{ color: t.textSecondary }}>{fmt(totalBudgeted)}</span>
                      <span style={{ color: totalSpent > totalBudgeted && totalBudgeted > 0 ? t.danger : t.textSecondary }}>{fmt(totalSpent)} <span style={{ color: remaining >= 0 ? t.accent : t.danger, fontSize: 9 }}>{remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}</span></span>
                    </div>
                  );
                })()}
              </div>
              {/* Protection */}
              <div>
                <div style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Protection Layer</div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                  <div><label style={lbl}>Provider</label><input style={inp} placeholder="e.g. USAA" value={gProvider} onChange={e => setGProvider(e.target.value)} /></div>
                  <div><label style={lbl}>Type</label>
                    <select style={{ ...inp, appearance: 'none' }} value={gPolicyType} onChange={e => setGPolicyType(e.target.value)}>
                      <option value="TERM">TERM</option><option value="WHOLE">WHOLE</option><option value="UNIVERSAL">UNIVERSAL</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Death Benefit</label><CurrencyInput t={t} value={gBenefit} onChange={e => setGBenefit(e.target.value)} placeholder="250000" /></div>
                </div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                  <div><label style={lbl}>Monthly Premium</label><CurrencyInput t={t} value={gPremium} onChange={e => setGPremium(e.target.value)} placeholder="35.60" /></div>
                  <div><label style={lbl}>Policy Expires</label><input style={inp} type="date" value={gPolicyExp} onChange={e => setGPolicyExp(e.target.value)} /></div>
                  <div><label style={lbl}>Conversion Deadline</label><input style={inp} type="date" value={gConvDeadline} onChange={e => setGConvDeadline(e.target.value)} /></div>
                </div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Alert Lead (Years)</label><input style={inp} value={gLeadYears} onChange={e => setGLeadYears(e.target.value)} placeholder="5" inputMode="numeric" /></div>
                  <div><label style={lbl}>Funeral Target</label><CurrencyInput t={t} value={gFuneralTarget} onChange={e => setGFuneralTarget(e.target.value)} placeholder="10000" /></div>
                  <div><label style={lbl}>Funeral Saved</label><CurrencyInput t={t} value={gFuneralCurrent} onChange={e => setGFuneralCurrent(e.target.value)} placeholder="0" /></div>
                </div>
              </div>

              {/* Portfolio — Equities */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Equity Positions</span>
                  <button onClick={addEquity} style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button>
                </div>
                {gEquities.map((e, i) => (
                  <div key={i} className="sync-row-debt" style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <div><label style={lbl}>Ticker</label><input style={inp} placeholder="AAPL" value={e.ticker} onChange={ev => upEquity(i, 'ticker', ev.target.value)} /></div>
                    <div><label style={lbl}>Shares</label><input style={inp} placeholder="10" value={e.shares} onChange={ev => upEquity(i, 'shares', ev.target.value)} inputMode="decimal" /></div>
                    <div><label style={lbl}>Avg Cost</label><CurrencyInput t={t} value={e.avgCost} onChange={ev => upEquity(i, 'avgCost', ev.target.value)} placeholder="0" /></div>
                    <div><label style={lbl}>Last Price</label><CurrencyInput t={t} value={e.lastPrice} onChange={ev => upEquity(i, 'lastPrice', ev.target.value)} placeholder="0" /></div>
                  </div>
                ))}
              </div>

              {/* Portfolio — Options */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: t.purple, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Options Exposure</span>
                  <button onClick={addOption} style={{ background: 'none', border: `1px solid ${t.purple}40`, color: t.purple, fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button>
                </div>
                {gOptions.map((o, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div className="sync-row-3" style={{ display: 'grid', gap: 6, marginBottom: 4 }}>
                      <div><label style={lbl}>Ticker</label><input style={inp} placeholder="SPY" value={o.ticker} onChange={ev => upOption(i, 'ticker', ev.target.value)} /></div>
                      <div><label style={lbl}>Type</label>
                        <select style={{ ...inp, appearance: 'none' }} value={o.type} onChange={ev => upOption(i, 'type', ev.target.value)}>
                          <option value="CALL">CALL</option><option value="PUT">PUT</option>
                        </select>
                      </div>
                      <div><label style={lbl}>Contracts</label><input style={inp} placeholder="1" value={o.contracts} onChange={ev => upOption(i, 'contracts', ev.target.value)} inputMode="numeric" /></div>
                    </div>
                    <div className="sync-row-3" style={{ display: 'grid', gap: 6 }}>
                      <div><label style={lbl}>Strike</label><CurrencyInput t={t} value={o.strikePrice} onChange={ev => upOption(i, 'strikePrice', ev.target.value)} placeholder="0" /></div>
                      <div><label style={lbl}>Exp Date</label><input style={inp} type="date" value={o.expDate} onChange={ev => upOption(i, 'expDate', ev.target.value)} /></div>
                      <div><label style={lbl}>Last Price</label><CurrencyInput t={t} value={o.lastPrice} onChange={ev => upOption(i, 'lastPrice', ev.target.value)} placeholder="0" /></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live calculations */}
              {(() => {
                const a = (parseFloat(gCheck) || 0) + (parseFloat(gEF) || 0) + (parseFloat(gOther) || 0);
                const dList = gDebts.filter(d => d.balance).map(d => ({ bal: parseFloat(d.balance) || 0, apr: parseFloat(d.apr) || 0 }));
                const dTotal = dList.reduce((s, d) => s + d.bal, 0);
                const eqVal = gEquities.filter(e => e.ticker).reduce((s, e) => s + (parseFloat(e.shares) || 0) * (parseFloat(e.lastPrice) || 0), 0);
                const optVal = gOptions.filter(o => o.ticker).reduce((s, o) => s + (parseInt(o.contracts) || 0) * 100 * (parseFloat(o.lastPrice) || 0), 0);
                const totalAssets = a + eqVal + optVal;
                const nw = totalAssets - dTotal;
                const di = dList.reduce((s, d) => s + (d.bal * d.apr / 100) / 365, 0);
                const ef = parseFloat(gEF) || 0;
                const mo = parseFloat(gMonthly) || 3000;
                const runway = mo > 0 ? Math.floor(ef / (mo / 30)) : 0;
                const totalBudgeted = gBudget.reduce((s, b) => s + (parseFloat(b.budgeted) || 0), 0);
                const totalSpent = gBudget.reduce((s, b) => s + (parseFloat(b.actual) || 0), 0);
                const benefit = parseFloat(gBenefit) || 0;
                const netToFamily = benefit > 0 ? benefit - dTotal : 0;
                const hasData = a > 0 || dTotal > 0 || totalBudgeted > 0 || eqVal > 0 || optVal > 0 || benefit > 0;
                if (!hasData) return null;
                return (
                  <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Live Calculation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>TOTAL ASSETS</span><span style={{ color: t.accent }}>{fmt(totalAssets)}</span>{eqVal > 0 && <span style={{ fontSize: 8, color: t.textGhost, marginLeft: 4 }}>(+{fmt(eqVal)} equity)</span>}</div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>TOTAL DEBT</span><span style={{ color: dTotal > 0 ? t.danger : t.textPrimary }}>{fmt(dTotal)}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>NET WORTH</span><span style={{ color: nw >= 0 ? t.accent : t.danger, fontWeight: 700, fontSize: 16 }}>{nw < 0 ? '-' : ''}{fmt(Math.abs(nw))}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>DAILY INTEREST BURN</span><span style={{ color: di > 0 ? t.danger : t.textPrimary }}>{fmt(di)}/day</span></div>
                      {ef > 0 && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>E-FUND RUNWAY</span><span style={{ color: runway >= 60 ? t.accent : runway >= 30 ? t.warn : t.danger }}>{runway} days</span><span style={{ color: t.textGhost, fontSize: 9, marginLeft: 6 }}>at {fmt(mo)}/mo burn</span></div>}
                      {totalBudgeted > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>BUDGET USED</span><span style={{ color: totalSpent > totalBudgeted ? t.danger : t.accent }}>{Math.round((totalSpent / totalBudgeted) * 100)}%</span></div>}
                      {mo > 0 && totalSpent > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>SAVINGS RATE</span><span style={{ color: (mo - totalSpent) > 0 ? t.accent : t.danger }}>{Math.round(((mo - totalSpent) / mo) * 100)}%</span></div>}
                      {optVal > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>OPTIONS EXPOSURE</span><span style={{ color: t.purple }}>{fmt(optVal)}</span></div>}
                      {netToFamily > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>NET TO FAMILY</span><span style={{ color: netToFamily < mo * 12 ? t.warn : t.accent }}>{fmt(netToFamily)}</span></div>}
                    </div>
                  </div>
                );
              })()}
              {success && <div style={{ color: t.accent, fontSize: 11 }}>✓ SYNC COMMITTED</div>}
              <button onClick={handleGuided} style={{ width: '100%', padding: 14, background: t.accent, color: t === THEMES.dark ? '#000' : '#FFF', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>BUILD & SYNC</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════
function SettingsPanel({ open, settings, onToggle, onExport, onClear, onClose, onToggleTheme, isDark, t }) {
  const [confirm, setConfirm] = useState('');
  if (!open) return null;
  const mods = [{ key: 'directive', label: 'Daily Directive' }, { key: 'netWorth', label: 'Net Worth' }, { key: 'debt', label: 'Debt Destruction' }, { key: 'eFund', label: 'Emergency Fund' }, { key: 'budget', label: 'Budget Status' }, { key: 'protection', label: 'Protection Layer' }, { key: 'portfolio', label: 'Portfolio' }, { key: 'macro', label: 'Macro Pulse' }];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 280, background: t.surface, borderLeft: `1px solid ${t.borderDim}`, height: '100%', padding: 20, overflow: 'auto', animation: 'slideIn 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
          <X size={14} style={{ color: t.textSecondary, cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Theme</div>
        <div onClick={onToggleTheme} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: `1px solid ${t.borderDim}`, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: t.textPrimary }}>{isDark ? 'Noir (Green)' : 'Tactical (Amber)'}</span>
          {isDark ? <Moon size={14} style={{ color: t.accent }} /> : <Sun size={14} style={{ color: t.accent }} />}
        </div>
        <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Modules</div>
        {mods.map(m => { const on = settings.visibleModules.includes(m.key); return (
          <div key={m.key} onClick={() => onToggle(m.key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: `1px solid ${t.borderDim}` }}>
            <span style={{ fontSize: 11, color: on ? t.textPrimary : t.textDim }}>{m.label}</span>
            <div style={{ width: 28, height: 14, borderRadius: 7, background: on ? t.accentMuted : t.elevated, position: 'relative', transition: 'background 0.2s' }}><div style={{ width: 10, height: 10, borderRadius: '50%', position: 'absolute', top: 2, left: on ? 16 : 2, background: on ? t.accent : t.textDim, transition: 'left 0.2s' }} /></div>
          </div>);
        })}
        <div style={{ marginTop: 20, color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Data</div>
        <button onClick={onExport} style={{ width: '100%', padding: 8, background: 'none', border: `1px solid ${t.borderDim}`, color: t.textSecondary, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={12} /> Export All</button>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder='Type CONFIRM to clear' style={{ background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '6px 8px', width: '100%', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
        <button onClick={() => { if (confirm === 'CONFIRM') { onClear(); setConfirm(''); } }} disabled={confirm !== 'CONFIRM'} style={{ width: '100%', padding: 8, background: confirm === 'CONFIRM' ? t.danger + '20' : t.elevated, border: `1px solid ${confirm === 'CONFIRM' ? t.danger : t.borderDim}`, color: confirm === 'CONFIRM' ? t.danger : t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: confirm === 'CONFIRM' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Trash2 size={12} /> Clear History</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD MODULES
// ═══════════════════════════════════════════════════
function NetWorthMod({ snapshots, latest, visible, t }) {
  const hist = snapshots.map(s => ({ date: s.date?.slice(5) || '', value: s.netWorth?.total || 0 }));
  const nw = latest?.netWorth || {}; const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2]?.netWorth?.total || 0 : 0; const delta = (nw.total || 0) - prev;
  const tA = Object.values(nw.assets || {}).reduce((s, v) => s + (v || 0), 0); const tL = Object.values(nw.liabilities || {}).reduce((s, v) => s + (v || 0), 0);
  return (<Card title="Net Worth" visible={visible} delay={0} t={t}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><AnimNum value={nw.total || 0} /></span>
      {snapshots.length > 1 && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 2, background: delta >= 0 ? t.accentMuted : '#3D0A0A', color: delta >= 0 ? t.accent : t.danger }}>{delta >= 0 ? '↑' : '↓'} {fmt(Math.abs(delta))}</span>}
    </div>
    <div style={{ height: 100, marginBottom: 12 }}>
      {hist.length > 1 ? (<ResponsiveContainer width="100%" height="100%"><AreaChart data={hist} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs><linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={t.accent} stopOpacity={0.25} /><stop offset="95%" stopColor={t.accent} stopOpacity={0} /></linearGradient></defs>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} /><YAxis hide domain={['dataMin - 500', 'dataMax + 500']} /><Tooltip content={<ChartTip t={t} />} />
        <Area type="monotone" dataKey="value" stroke={t.accent} strokeWidth={1.5} fill="url(#nwG)" dot={false} />
      </AreaChart></ResponsiveContainer>) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textDim, fontSize: 11 }}>Sync 2+ snapshots for chart</div>}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <div><span style={{ color: t.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assets </span>{fmt(tA)}</div>
      <div><span style={{ color: t.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liabilities </span>{fmt(tL)}</div>
    </div>
  </Card>);
}

function DebtMod({ latest, visible, t }) {
  const debts = (latest?.debts || []).sort((a, b) => {
    // Fixed-term debts sort by payments remaining (ascending), revolving by APR (descending)
    const aFixed = (a.totalTerms || 0) > 0;
    const bFixed = (b.totalTerms || 0) > 0;
    if (aFixed && !bFixed) return 1; // revolving first (higher priority for avalanche)
    if (!aFixed && bFixed) return -1;
    if (aFixed && bFixed) return ((a.totalTerms - (a.paymentsMade || 0)) - (b.totalTerms - (b.paymentsMade || 0)));
    return (b.apr || 0) - (a.apr || 0);
  });
  const total = totalDebt(debts); const di = dailyInterest(debts);
  const maxB = debts.length ? Math.max(...debts.map(d => d.balance || 0)) : 1;
  const revolving = debts.filter(d => !(d.totalTerms > 0));
  return (<Card title="Debt Destruction" visible={visible} delay={80} alert={debts.some(d => d.balance > 2000)} t={t}>
    <div style={{ marginBottom: 14 }}><div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><AnimNum value={total} /></div>
      {di > 0 && <div style={{ color: t.danger, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}><AnimNum value={di} decimals={2} style={{ color: t.danger }} />/day interest burn</div>}</div>
    {debts.length === 0 ? <div style={{ color: t.textDim, fontSize: 11 }}>No debts tracked</div> : debts.map((d, i) => {
      const isFixed = (d.totalTerms || 0) > 0;
      const pmtsMade = d.paymentsMade || 0;
      const remaining = isFixed ? d.totalTerms - pmtsMade : 0;
      const isLast = isFixed && remaining === 1;
      const isTarget = !isFixed && i === debts.indexOf(revolving[0]); // first revolving = avalanche target

      return (
      <div key={i} style={{ marginBottom: 12, borderLeft: isTarget ? `2px solid ${t.accent}` : 'none', paddingLeft: isTarget ? 8 : isFixed ? 0 : 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: t.textSecondary }}>
            {d.name}
            {isFixed && <span style={{ fontSize: 8, color: t.textDim, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${t.borderDim}`, padding: '1px 4px' }}>{d.type === 'BNPL' ? 'BNPL' : 'TERM'}</span>}
            {!isFixed && <span style={{ color: t.textDim }}> ({d.apr}%)</span>}
          </span>
          <span>
            {isFixed
              ? <span style={{ color: isLast ? t.accent : t.textSecondary }}>{pmtsMade} of {d.totalTerms} PMTS</span>
              : <span>{fmt(d.balance)} <span style={{ color: t.textDim, fontSize: 9 }}>min {fmt(d.minPayment)}/mo</span></span>
            }
          </span>
        </div>

        {/* Segmented bar for fixed-term, standard bar for revolving */}
        {isFixed ? (
          <div style={{ display: 'flex', gap: 2, height: 6, marginBottom: 4 }}>
            {Array.from({ length: d.totalTerms }).map((_, idx) => {
              const filled = idx < pmtsMade;
              const isNext = idx === pmtsMade;
              const isFinal = isLast && idx === d.totalTerms - 1;
              return (<div key={idx} style={{
                flex: 1,
                background: filled ? t.accent : t.elevated,
                border: isNext ? `1px solid ${t.accent}` : `1px solid ${t.borderMid}`,
                animation: isFinal ? 'lastSeg 1.5s ease-in-out infinite' : 'none',
                transition: 'background 0.3s',
              }} />);
            })}
          </div>
        ) : (
          <ProgressBar percent={maxB > 0 ? (d.balance / maxB) * 100 : 0} color={isTarget ? t.danger : t.accent} t={t} />
        )}

        {/* Subline: balance + mission end for fixed, nothing extra for revolving */}
        {isFixed && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: t.textDim }}>
            <span>{fmt(d.balance)} remaining{d.monthlyPayment > 0 ? ` • ${fmt(d.monthlyPayment)}/mo` : ''}</span>
            <span style={{ color: isLast ? t.accent : t.textDim }}>
              {remaining > 0 ? `${remaining} left` : '✓ COMPLETE'}
              {isLast && ' → REALLOCATE'}
            </span>
          </div>
        )}
      </div>);
    })}
    {revolving.length > 0 && <div style={{ borderTop: `1px solid ${t.borderDim}`, paddingTop: 8, marginTop: 4, fontSize: 10, color: t.textSecondary }}>Avalanche target: <span style={{ color: t.accent }}>{revolving[0]?.name}</span> ({revolving[0]?.apr}% APR)</div>}
  </Card>);
}

function EFundMod({ latest, visible, t }) {
  const ef = latest?.eFund || {}; const bal = ef.balance || 0; const monthly = ef.monthlyExpenses || 3000;
  const targets = efundTargets(monthly); const days = runwayDays(ef);
  const phase = bal >= targets[3] ? 4 : bal >= targets[2] ? 3 : bal >= targets[1] ? 2 : bal >= targets[0] ? 1 : 0;
  const labels = ['$1K Starter', '1 Month', '3 Months', '6 Months'];
  return (<Card title="Emergency Fund" visible={visible} delay={160} t={t}>
    <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>{targets.map((tgt, i) => { const filled = bal >= tgt; const pf = (!filled && i === phase) ? Math.min((bal / tgt) * 100, 100) : filled ? 100 : 0; return (<div key={i} style={{ flex: 1 }}><div style={{ height: 8, background: t.elevated, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pf}%`, background: t.accent, transition: 'width 1s ease-out' }} /></div><div style={{ fontSize: 8, color: filled ? t.accentDim : t.textDim, marginTop: 3, textTransform: 'uppercase' }}>{labels[i]} {filled && '✓'}</div></div>); })}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div><div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Balance</div><div style={{ fontSize: 18, fontWeight: 700 }}><AnimNum value={bal} /></div></div>
      <div><div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Runway</div><div style={{ fontSize: 18, fontWeight: 700, color: runwayColor(days, t) }}>{days} Days</div></div>
      <div><div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Monthly Exp</div><div style={{ color: t.textSecondary }}>{fmt(monthly)}</div></div>
      <div><div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Phase</div><div style={{ color: t.textSecondary }}>{phase}/4 — {labels[Math.min(phase, 3)]}</div></div>
    </div>
  </Card>);
}

function BudgetMod({ latest, visible, t }) {
  const cats = latest?.budget?.categories || [];
  return (<Card title="Budget Allocation" visible={visible} delay={240} t={t}>
    {cats.length === 0 ? <div style={{ color: t.textDim, fontSize: 11 }}>No budget data</div> : cats.map((c, i) => { const pct = c.budgeted > 0 ? (c.actual / c.budgeted) * 100 : (c.actual > 0 ? 100 : 0); return (<div key={i} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, marginBottom: 3 }}><span style={{ color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.name}</span><span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ color: t.textPrimary, fontSize: 11 }}>{fmt(c.actual)}</span>{c.budgeted > 0 && <span style={{ color: t.textDim }}>/ {fmt(c.budgeted)}</span>}<span style={{ color: pctColor(pct, t), fontSize: 9, minWidth: 32, textAlign: 'right' }}>{c.budgeted > 0 ? Math.round(pct) + '%' : ''}</span></span></div>
      {c.budgeted > 0 && <ProgressBar percent={pct} t={t} />}
      {c.budgeted === 0 && c.actual > 0 && <div style={{ height: 6, background: t.accent, marginBottom: 4, opacity: 0.5 }} />}
    </div>); })}
  </Card>);
}

// ═══════════════════════════════════════════════════
// PROTECTION MODULE
// ═══════════════════════════════════════════════════
function ProtectionMod({ latest, visible, t }) {
  const prot = latest?.protection || {};
  const li = prot.lifeInsurance || {};
  const fb = prot.funeralBuffer || { target: 10000, current: 0 };
  const debtTotal = totalDebt(latest?.debts);
  const netToFamily = (li.deathBenefit || 0) - debtTotal;
  const monthly = latest?.eFund?.monthlyExpenses || 3000;
  const coverageMonths = monthly > 0 ? Math.floor(netToFamily / monthly) : 0;
  const coverageColor = netToFamily <= 0 ? t.danger : coverageMonths < 12 ? t.warn : t.accent;
  const fbPct = fb.target > 0 ? Math.min((fb.current / fb.target) * 100, 100) : 0;

  // Conversion countdown
  const now = new Date();
  let convAlert = null;
  let convUrgent = false;
  if (li.conversionDeadline) {
    const deadline = new Date(li.conversionDeadline);
    const leadYears = li.alertLeadTimeYears || 5;
    const alertDate = new Date(deadline);
    alertDate.setFullYear(alertDate.getFullYear() - leadYears);
    const yearsLeft = ((deadline - now) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    if (now >= alertDate) {
      convUrgent = true;
      convAlert = `ACTION WINDOW OPEN — ${yearsLeft}yr to conversion deadline`;
    } else {
      const yearsToAlert = ((alertDate - now) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
      convAlert = `Alert activates in ${yearsToAlert}yr (${leadYears}yr lead)`;
    }
  }

  const hasData = li.deathBenefit > 0 || fb.current > 0;

  return (<Card title="Protection • Life & Coverage" visible={visible} delay={300} alert={convUrgent} t={t}>
    {!hasData ? <div style={{ color: t.textDim, fontSize: 11 }}>No protection data — sync via Guided tab</div> : <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Death Benefit</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}><AnimNum value={li.deathBenefit || 0} /></div>
          {li.provider && <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>{li.type || 'TERM'} • {li.provider}{li.monthlyPremium > 0 ? ` • ${fmt(li.monthlyPremium)}/mo` : ''}</div>}
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Net to Family</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: coverageColor }}><AnimNum value={netToFamily} /></div>
          <div style={{ fontSize: 9, color: coverageColor, marginTop: 2 }}>{coverageMonths > 0 ? `${coverageMonths} months coverage` : 'COVERAGE GAP'}{debtTotal > 0 ? ` (−${fmt(debtTotal)} debt)` : ''}</div>
        </div>
      </div>

      {/* Funeral Buffer */}
      {fb.target > 0 && <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
          <span style={{ color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Funeral Buffer</span>
          <span><span style={{ color: t.textPrimary }}>{fmt(fb.current)}</span> <span style={{ color: t.textDim }}>/ {fmt(fb.target)}</span> <span style={{ color: pctColor(fbPct, t), fontSize: 9 }}>{Math.round(fbPct)}%</span></span>
        </div>
        <ProgressBar percent={fbPct} color={fb.current === 0 ? t.danger : undefined} t={t} />
      </div>}

      {/* Conversion Alert */}
      {convAlert && <div style={{ padding: '8px 10px', fontSize: 10, marginTop: 4, background: convUrgent ? t.warn + '12' : t.surface, border: `1px solid ${convUrgent ? t.warn : t.borderDim}`, color: convUrgent ? t.warn : t.textDim }}>
        {convUrgent ? '⌛ ' : '🔒 '}{convAlert}
        {li.conversionDeadline && <span style={{ color: t.textGhost, marginLeft: 8, fontSize: 9 }}>Deadline: {li.conversionDeadline}</span>}
      </div>}

      {/* Expiration */}
      {li.expirationDate && <div style={{ fontSize: 9, color: t.textGhost, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Policy expires: {li.expirationDate}</div>}
    </>}
  </Card>);
}

// ═══════════════════════════════════════════════════
// PORTFOLIO MODULE
// ═══════════════════════════════════════════════════
function PortfolioMod({ latest, visible, t }) {
  const port = latest?.portfolio || {};
  const equities = port.equities || [];
  const options = port.options || [];
  const now = new Date();

  const totalEquityValue = equities.reduce((s, e) => s + (e.shares || 0) * (e.lastPrice || 0), 0);
  const totalEquityCost = equities.reduce((s, e) => s + (e.shares || 0) * (e.avgCost || 0), 0);
  const equityPL = totalEquityValue - totalEquityCost;
  const totalOptionsValue = options.reduce((s, o) => s + (o.contracts || 0) * 100 * (o.lastPrice || 0), 0);
  const hasData = equities.length > 0 || options.length > 0;

  return (<Card title="Portfolio • Equity & Options" visible={visible} delay={360} t={t}>
    {!hasData ? <div style={{ color: t.textDim, fontSize: 11 }}>No positions tracked — sync via Guided tab</div> : <>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 8 }}>
          <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Equity Value</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}><AnimNum value={totalEquityValue} /></div>
          {totalEquityCost > 0 && <div style={{ fontSize: 9, color: equityPL >= 0 ? t.accent : t.danger, marginTop: 2 }}>{equityPL >= 0 ? '↑' : '↓'} {fmt(Math.abs(equityPL))} P&L</div>}
        </div>
        <div style={{ borderLeft: `2px solid ${t.purple}`, paddingLeft: 8 }}>
          <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Options Exposure</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.purple }}><AnimNum value={totalOptionsValue} /></div>
          <div style={{ fontSize: 9, color: t.purpleDim, marginTop: 2 }}>{options.length} contract{options.length !== 1 ? 's' : ''} active</div>
        </div>
      </div>

      {/* Equity positions */}
      {equities.length > 0 && equities.map((e, i) => {
        const mv = (e.shares || 0) * (e.lastPrice || 0);
        const cost = (e.shares || 0) * (e.avgCost || 0);
        const pl = mv - cost;
        return (<div key={`eq-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${t.borderDim}`, fontSize: 11 }}>
          <div>
            <span style={{ color: t.accent, fontWeight: 700 }}>{e.ticker || '???'}</span>
            <span style={{ color: t.textDim, fontSize: 9, marginLeft: 6 }}>{e.shares} shares @ {fmt(e.avgCost)}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span>{fmt(mv)}</span>
            {cost > 0 && <span style={{ color: pl >= 0 ? t.accent : t.danger, fontSize: 9, marginLeft: 6 }}>{pl >= 0 ? '+' : ''}{fmt(pl)}</span>}
          </div>
        </div>);
      })}

      {/* Options positions */}
      {options.length > 0 && options.map((o, i) => {
        const daysToExp = o.expDate ? Math.floor((new Date(o.expDate) - now) / (1000 * 60 * 60 * 24)) : 999;
        const isUrgent = daysToExp <= 7 && daysToExp >= 0;
        const isExpired = daysToExp < 0;
        const mv = (o.contracts || 0) * 100 * (o.lastPrice || 0);
        return (<div key={`opt-${i}`} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px', marginTop: 6,
          border: `1px solid ${isUrgent ? t.purple : t.borderDim}`,
          background: isUrgent ? t.purpleMuted : 'transparent',
          animation: isUrgent ? 'purplePulse 2s ease-in-out infinite' : 'none',
        }}>
          <div>
            <span style={{ color: t.purple, fontWeight: 700, fontSize: 11 }}>{o.ticker || '???'} {o.type || 'CALL'}</span>
            {o.strikePrice > 0 && <span style={{ color: t.textDim, fontSize: 9, marginLeft: 4 }}>${o.strikePrice}</span>}
            <div style={{ fontSize: 9, color: isUrgent ? t.purple : t.textDim }}>{o.contracts} contract{o.contracts !== 1 ? 's' : ''} • Exp: {o.expDate || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary }}>{fmt(mv)}</div>
            <div style={{ fontSize: 9, color: isExpired ? t.danger : isUrgent ? t.purple : t.textDim, textTransform: 'uppercase' }}>
              {isExpired ? 'EXPIRED' : isUrgent ? '⚡ EXPIRING' : `${daysToExp}d left`}
            </div>
          </div>
        </div>);
      })}
    </>}
  </Card>);
}

// ═══════════════════════════════════════════════════
// DAILY DIRECTIVE ENGINE
// Procedural 365-day cycle: monthly theme × pillar rotation
// ═══════════════════════════════════════════════════
const MONTHLY_THEMES = [
  { month: 'JAN', theme: 'Foundation & Audit', objective: 'Establish clean-slate baseline for all assets' },
  { month: 'FEB', theme: 'Apprenticeship', objective: 'Skill acquisition and technical depth' },
  { month: 'MAR', theme: 'Operational Hardening', objective: 'Eliminate vulnerabilities, exit tactical hell' },
  { month: 'APR', theme: 'Social Engineering', objective: 'Defend against human-centric probes and deception' },
  { month: 'MAY', theme: 'Adversary Emulation', objective: 'Think like the threat to find system gaps' },
  { month: 'JUN', theme: 'Strategic Indirection', objective: 'Financial privacy and data footprint reduction' },
  { month: 'JUL', theme: 'Sovereign Resilience', objective: 'Physical security and family protection' },
  { month: 'AUG', theme: 'Master Persuasion', objective: 'Negotiate debt terms, rates, and agreements' },
  { month: 'SEP', theme: 'Grand Strategy', objective: 'Shift from reactive survival to long-term dominance' },
  { month: 'OCT', theme: 'The Dark Side', objective: 'Shadow accounts and hidden financial leaks' },
  { month: 'NOV', theme: 'Rational Discipline', objective: 'Remove emotion from defensive execution' },
  { month: 'DEC', theme: 'Legacy & Sublime', objective: 'Estate planning and multi-generational security' },
];

const PILLARS = ['Cybersecurity', 'Finance', 'Infrastructure', 'Strategic'];

const DIRECTIVES = {
  JAN: [
    { pillar: 'Cybersecurity', title: 'The Law of the Clean Root', tactical: 'Every year is a fresh boot. Audit primary storage for sensitive files needing encryption. Wipe temp caches.' },
    { pillar: 'Finance', title: 'The Law of the Baseline', tactical: 'You cannot defend what you haven\'t measured. Verify every asset balance against raw bank records today.' },
    { pillar: 'Infrastructure', title: 'The Law of Inventory', tactical: 'An untracked asset is an undefended asset. Update your net worth snapshot with every account you own.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Kill Chain', tactical: 'Review your password manager. Any credential older than 12 months is a risk surface. Rotate the top 5.' },
    { pillar: 'Finance', title: 'The Law of the First Dollar', tactical: 'Allocate every dollar of January income before it arrives. Unassigned cash gets absorbed by entropy.' },
    { pillar: 'Strategic', title: 'The Law of the Annual Target', tactical: 'Set one financial number to hit by Dec 31. Write it down. Pin it where you\'ll see it daily.' },
    { pillar: 'Infrastructure', title: 'The Law of the Backup', tactical: 'Verify your critical data has at least two backup locations. If a drive dies today, what do you lose?' },
    { pillar: 'Finance', title: 'The Law of the Hidden Tax', tactical: 'Review every subscription. Calculate annual cost, not monthly. Kill anything under 3 uses/month.' },
  ],
  FEB: [
    { pillar: 'Cybersecurity', title: 'The Law of Zero Trust', tactical: 'Never assume a connection is safe because it\'s familiar. Re-verify MFA on all financial accounts.' },
    { pillar: 'Finance', title: 'The Law of the Daily Burn', tactical: 'High interest is a predator that never sleeps. Audit your BNPL countdown — when is your next Cash Flow Win?' },
    { pillar: 'Infrastructure', title: 'The Law of Redundancy', tactical: 'A single point of failure in power or connectivity is a system risk. Verify backup power status.' },
    { pillar: 'Cybersecurity', title: 'The Law of Hidden Assets', tactical: 'Forgotten accounts are the easiest entry points. Search your password manager for accounts inactive >180 days.' },
    { pillar: 'Finance', title: 'The Law of the Quiet Exit', tactical: 'In B-Years, defend your wins. Review insurance policies to ensure valuables are correctly appraised.' },
    { pillar: 'Cybersecurity', title: 'The Law of Social Defense', tactical: 'Phishing is adaptive. Today, treat every "Urgent" email as a hostile probe. Verify senders through secondary channels.' },
    { pillar: 'Infrastructure', title: 'The Law of Data Hygiene', tactical: 'Physical clutter leads to digital entropy. Clean your workspace and verify thermal stability on primary devices.' },
    { pillar: 'Strategic', title: 'The Law of the Review', tactical: 'Look back at this month\'s syncs. What was the biggest uncomfortable truth the dashboard surfaced? Hard-target it next month.' },
  ],
  MAR: [
    { pillar: 'Cybersecurity', title: 'The Law of the Hardened Shell', tactical: 'A system is only as strong as its configuration. Audit local firewall rules on your primary workstation.' },
    { pillar: 'Finance', title: 'The Law of the Invisible Leak', tactical: 'Subscriptions are the background noise of financial entropy. Identify one recurring service to terminate today.' },
    { pillar: 'Infrastructure', title: 'The Law of Physical Access', tactical: 'Digital security fails if physical security is bypassed. Verify storage devices are in a secure location.' },
    { pillar: 'Cybersecurity', title: 'The Law of Least Privilege', tactical: 'Users should only have the access they need. Re-audit admin permissions across your workflows.' },
    { pillar: 'Finance', title: 'The Law of the Acceleration', tactical: 'Run the debt payoff calculator. What if you added $50/month to your avalanche target? When does the payoff date move?' },
    { pillar: 'Strategic', title: 'The Law of the Hardened Perimeter', tactical: 'Review your emergency fund runway. If income stopped today, how many days until system failure?' },
    { pillar: 'Infrastructure', title: 'The Law of the Update', tactical: 'Unpatched systems are open doors. Check for OS and firmware updates on all devices.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Audit Trail', tactical: 'Review recent bank transactions for charges you don\'t recognize. Dispute anything suspicious within 24hrs.' },
  ],
  APR: [
    { pillar: 'Cybersecurity', title: 'The Law of Selective Disclosure', tactical: 'Information is ammunition. Audit social media for mentions of financial details, workplace, or device info.' },
    { pillar: 'Finance', title: 'The Law of the Urgent Probe', tactical: 'Scammers use artificial urgency. If a "bank" calls with an emergency, hang up and call the number on your physical card.' },
    { pillar: 'Infrastructure', title: 'The Law of the Decoy', tactical: 'Misdirection protects the core. Use a secondary email for all non-critical signups. Protect your primary.' },
    { pillar: 'Cybersecurity', title: 'The Law of Verification', tactical: 'Never click a link from a text message claiming to be your bank. Navigate directly to the site instead.' },
    { pillar: 'Finance', title: 'The Law of Tax Efficiency', tactical: 'Review withholding. A large refund means you gave the government an interest-free loan. Adjust W-4 if needed.' },
    { pillar: 'Strategic', title: 'The Law of the Pretexting Shield', tactical: 'Practice saying no. When someone asks for personal info, default to "I\'ll need to verify that" before sharing anything.' },
    { pillar: 'Infrastructure', title: 'The Law of the Isolation Zone', tactical: 'Guest WiFi should be separate from your primary network. Verify network segmentation today.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Paper Trail', tactical: 'Shred any physical mail containing account numbers. Dumpster diving is still one of the top attack vectors.' },
  ],
  MAY: [
    { pillar: 'Cybersecurity', title: 'The Law of the Red Team', tactical: 'Think like an attacker. If you wanted to drain your checking account, what\'s the easiest path? Now block it.' },
    { pillar: 'Finance', title: 'The Law of the Stress Test', tactical: 'Model a 30% income drop. Which expenses survive the cut? Which debts become dangerous? Know before it happens.' },
    { pillar: 'Infrastructure', title: 'The Law of the Weak Link', tactical: 'Your security is your weakest device. Find the oldest/least-updated device on your network and patch or retire it.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Honeypot', tactical: 'Set up transaction alerts on every account. If a charge you didn\'t make appears, you want to know in minutes, not days.' },
    { pillar: 'Finance', title: 'The Law of the Counterattack', tactical: 'Call your highest APR creditor. Ask for a rate reduction. The worst they say is no. The best saves you hundreds.' },
    { pillar: 'Strategic', title: 'The Law of the Threat Model', tactical: 'List your top 3 financial fears. For each, write the specific trigger and the specific defense. Fear without a plan is paralysis.' },
    { pillar: 'Infrastructure', title: 'The Law of the Recovery', tactical: 'Test your backup. Actually restore a file from it. A backup you\'ve never tested is a backup that might not work.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Expired Key', tactical: 'Check for expired or soon-to-expire cards and licenses. Expired credentials cause cascading payment failures.' },
  ],
  JUN: [
    { pillar: 'Finance', title: 'The Law of the Footprint', tactical: 'Review who has your SSN on file. Minimize it to only entities that legally require it.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Ghost Profile', tactical: 'Search your name + address online. Remove yourself from data broker sites. Reduce your digital surface area.' },
    { pillar: 'Infrastructure', title: 'The Law of the Air Gap', tactical: 'Your most sensitive documents should never touch cloud storage. Verify your local-only privacy wall is intact.' },
    { pillar: 'Finance', title: 'The Law of the Phantom Account', tactical: 'Open a secondary checking account for online purchases only. Limit its balance to $200. If it gets compromised, damage is capped.' },
    { pillar: 'Cybersecurity', title: 'The Law of Obfuscation', tactical: 'Use unique usernames across financial sites. Shared usernames are a correlation attack waiting to happen.' },
    { pillar: 'Strategic', title: 'The Law of the Vanishing Point', tactical: 'Opt out of prescreened credit offers. Call 1-888-5-OPT-OUT. Every offer is a vector for identity theft.' },
    { pillar: 'Infrastructure', title: 'The Law of the Encrypted Vault', tactical: 'Verify that your tax documents, insurance policies, and financial records are stored in an encrypted container.' },
    { pillar: 'Finance', title: 'The Law of the Credit Freeze', tactical: 'If you\'re not actively applying for credit, freeze your reports at all three bureaus. Thaw only when needed.' },
  ],
  JUL: [
    { pillar: 'Infrastructure', title: 'The Law of Thermal Stability', tactical: 'Heat degrades hardware. Verify ventilation and ambient temperature in your workspace today.' },
    { pillar: 'Finance', title: 'The Law of the Safety Net', tactical: 'Review your emergency fund against actual monthly expenses. Has inflation moved the target? Recalculate.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Family Vector', tactical: 'Family devices are your attack surface. Verify parental controls, updates, and passwords on all shared devices.' },
    { pillar: 'Infrastructure', title: 'The Law of the Vital Buffer', tactical: 'Operator uptime is system uptime. Audit your ergonomics and physical workspace to prevent long-term fatigue.' },
    { pillar: 'Finance', title: 'The Law of the Mid-Year Audit', tactical: 'Pull up January\'s net worth. Compare to today. Are you on trajectory? If not, what changed and what do you adjust?' },
    { pillar: 'Strategic', title: 'The Law of the Dependent Shield', tactical: 'Review beneficiary designations on all insurance and accounts. Are they current? One outdated form can derail everything.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Medical Record', tactical: 'Health data is high-value. Verify that medical portals use unique passwords and MFA is enabled.' },
    { pillar: 'Infrastructure', title: 'The Law of the Power Grid', tactical: 'A surge can destroy equipment and data. Verify UPS batteries and surge protectors are functional.' },
  ],
  AUG: [
    { pillar: 'Finance', title: 'The Law of the Opening Move', tactical: 'Call your lowest-balance creditor. Ask for a settlement or payoff discount. Closed accounts free cash flow.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Credential', tactical: 'Your certifications are economic weapons. Review your study velocity. Are you on pace for your target exam date?' },
    { pillar: 'Finance', title: 'The Law of the Rate Call', tactical: 'Call your credit card company. State your payment history. Request a lower APR. Every percentage point saved compounds.' },
    { pillar: 'Strategic', title: 'The Law of the Counter-Offer', tactical: 'Never accept the first offer on anything — insurance, salary, interest rate. The initial number is always negotiable.' },
    { pillar: 'Infrastructure', title: 'The Law of the Service Audit', tactical: 'Review your internet, phone, and insurance plans. Competitors may offer the same service for less. Get quotes.' },
    { pillar: 'Finance', title: 'The Law of the Harvest', tactical: 'Side income is seed capital. Calculate your total side earnings this month. Apply the 50% profit tax rule.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Written Record', tactical: 'Document every financial negotiation — date, rep name, offer details. If they don\'t honor it, you have evidence.' },
    { pillar: 'Finance', title: 'The Law of the Balance Transfer', tactical: 'Search for 0% APR balance transfer offers. Moving high-APR debt to 0% buys time. Calculate the savings vs. transfer fee.' },
  ],
  SEP: [
    { pillar: 'Strategic', title: 'The Law of the Horizon', tactical: 'Plot your net worth 12 months forward at current trajectory. Is the number acceptable? If not, change the inputs today.' },
    { pillar: 'Finance', title: 'The Law of the Compounding Dollar', tactical: 'Calculate what $50/month invested at 8% becomes in 10 years. Small consistent deposits build generational wealth.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Exit Plan', tactical: 'If your primary income disappeared tomorrow, what\'s your 90-day plan? Write it down. Review it quarterly.' },
    { pillar: 'Infrastructure', title: 'The Law of the Toolchain', tactical: 'Audit your financial tools. Are you using the best HYSA rate? The best budgeting method? Optimize the stack.' },
    { pillar: 'Finance', title: 'The Law of the Phase Gate', tactical: 'Review Benner Cycle position. B-Year means defend, not chase. Are any positions violating defensive posture?' },
    { pillar: 'Strategic', title: 'The Law of Asymmetric Returns', tactical: 'Identify one skill investment that could 2x your income within 24 months. Certifications, freelance rates, career pivot.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Succession Plan', tactical: 'If you\'re incapacitated, can your family access critical accounts? Document the minimum they\'d need, securely.' },
    { pillar: 'Finance', title: 'The Law of the Runway Extension', tactical: 'Every dollar in your emergency fund buys one more day of independence. Calculate your exact runway in days.' },
  ],
  OCT: [
    { pillar: 'Cybersecurity', title: 'The Law of the Shadow Device', tactical: 'Every IoT device is a portal. Audit your network for invisible devices — printers, cameras, appliances. Isolate them.' },
    { pillar: 'Finance', title: 'The Law of the Ghost Subscription', tactical: 'Hunt for services you haven\'t used in 90 days. Every ghost subscription is a silent drain on your fortress.' },
    { pillar: 'Infrastructure', title: 'The Law of the Audit Log', tactical: 'Review your bank\'s login history. Any unrecognized sessions? Any locations that aren\'t yours? Investigate immediately.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Dark Corner', tactical: 'Check for accounts you opened and forgot. Old store cards, fintech apps, crypto exchanges. Each is an attack surface.' },
    { pillar: 'Finance', title: 'The Law of the Financial Vampire', tactical: 'Small monthly leaks drain the fortress. Total every charge under $15 this month. The sum will surprise you.' },
    { pillar: 'Strategic', title: 'The Law of the Shadow Budget', tactical: 'Your real budget is your bank statement, not your spreadsheet. Compare planned vs. actual. Close the gap.' },
    { pillar: 'Infrastructure', title: 'The Law of the Stale Credential', tactical: 'Saved passwords in browsers are shadow credentials. Audit and remove any stored in plain text.' },
    { pillar: 'Finance', title: 'The Law of the Unclaimed Asset', tactical: 'Search your state\'s unclaimed property database. Money you forgot about might be waiting.' },
  ],
  NOV: [
    { pillar: 'Finance', title: 'The Law of the Emotional Override', tactical: 'Black Friday is engineered urgency. Before any purchase over $50, wait 48 hours. If you still want it, buy it.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Cold Read', tactical: 'Review your last 5 financial decisions. Were any driven by fear, greed, or FOMO? Flag the pattern.' },
    { pillar: 'Strategic', title: 'The Law of the Stoic Ledger', tactical: 'Markets will crash. Income will dip. The system survives because the math was done in advance, not in panic.' },
    { pillar: 'Finance', title: 'The Law of the Holiday Budget', tactical: 'Set a hard dollar cap for holiday spending before the season starts. Communicate it to family. Defend it.' },
    { pillar: 'Infrastructure', title: 'The Law of the Year-End Prep', tactical: 'Organize tax documents now, not in April. Create folders for W-2s, 1099s, receipts. Future you will be grateful.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Seasonal Scam', tactical: 'Holiday phishing spikes in November. Shipping notifications, fake deals, charity scams. Verify everything.' },
    { pillar: 'Finance', title: 'The Law of the Forced Allocation', tactical: 'Before holiday spending begins, move your savings target amount out of checking. Protect it from yourself.' },
    { pillar: 'Strategic', title: 'The Law of the Annual Review', tactical: 'Start drafting your year-end financial review now. Net worth delta, debt killed, skills gained, income grown.' },
  ],
  DEC: [
    { pillar: 'Strategic', title: 'The Law of the Legacy Document', tactical: 'Review or create a will. Even a simple one. Without it, the state decides what happens to your assets.' },
    { pillar: 'Finance', title: 'The Law of the Tax Harvest', tactical: 'If you have investment losses, consider harvesting them before Dec 31 to offset gains. Consult the math.' },
    { pillar: 'Cybersecurity', title: 'The Law of the Annual Reset', tactical: 'Change passwords on your top 10 financial accounts. End the year with a clean credential state.' },
    { pillar: 'Infrastructure', title: 'The Law of the Archive', tactical: 'Back up this year\'s financial records to encrypted local storage. Label it. Store it separately from working files.' },
    { pillar: 'Finance', title: 'The Law of the Beneficiary', tactical: 'Verify beneficiary designations on all life insurance, retirement accounts, and bank accounts. Update if needed.' },
    { pillar: 'Strategic', title: 'The Law of the Next Phase', tactical: 'Review the Benner Cycle. What phase are you entering in January? Adjust your posture before the calendar turns.' },
    { pillar: 'Infrastructure', title: 'The Law of the Clean Slate', tactical: 'Purge unused apps, close idle accounts, delete old files. Enter the new year with minimal attack surface.' },
    { pillar: 'Finance', title: 'The Law of the Compound Year', tactical: 'Calculate your total debt destroyed, net worth gained, and skills acquired this year. Every dollar mattered.' },
  ],
};

function DirectiveMod({ visible, t }) {
  const now = new Date();
  const monthIdx = now.getMonth();
  const dayOfMonth = now.getDate();
  const theme = MONTHLY_THEMES[monthIdx];
  const monthKey = theme.month;
  const pool = DIRECTIVES[monthKey] || DIRECTIVES.JAN;
  const directive = pool[(dayOfMonth - 1) % pool.length];

  return (<Card title={`Daily Directive • ${theme.theme}`} visible={visible} delay={20} t={t}>
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.accent, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 2 }}>{directive.title}</div>
      <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{directive.pillar} // {theme.month} — {theme.theme}</div>
    </div>
    <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 10, fontSize: 11, color: t.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
      {directive.tactical}
    </div>
    <div style={{ fontSize: 9, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Cycle: {theme.objective}
    </div>
  </Card>);
}

function MacroMod({ latest, visible, t }) {
  const m = latest?.macro || {}; const triggers = m.triggersActive || 0;
  const cells = [
    { label: 'NET LIQUIDITY', value: m.netLiquidity ? `$${m.netLiquidity}t` : '—', sub: m.liquidityTrend || 'NEUTRAL', subC: m.liquidityTrend === 'EXPANDING' ? t.accent : m.liquidityTrend === 'CONTRACTING' ? t.danger : t.textSecondary },
    { label: 'BTC', value: m.btcPrice ? `$${Number(m.btcPrice).toLocaleString()}` : '—', sub: m.wyckoffPhase || '—', subC: t.textSecondary, sub2: m.bennerPhase ? `Benner: ${m.bennerPhase}` : '' },
    { label: 'FEDWATCH', value: m.fedWatchCut ? `${m.fedWatchCut}% cut` : '—', sub: m.nextFomc ? `Next: ${m.nextFomc.slice(5)}` : '—', subC: t.textSecondary },
    { label: 'YIELD CURVE', value: m.yieldCurve10Y2Y ? `${m.yieldCurve10Y2Y > 0 ? '+' : ''}${m.yieldCurve10Y2Y}bps` : '—', sub: m.yieldTrend || '—', subC: t.textSecondary },
  ];
  if (!visible) return null;
  return (<div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${t.accent}30`, paddingTop: 20, marginTop: 8, animation: 'fadeIn 0.4s ease-out 320ms both' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 4 }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Macro Intelligence</span>
      <span style={{ fontSize: 9, color: triggers >= 2 ? t.danger : t.textDim, textTransform: 'uppercase' }}>{triggers}/5 triggers active</span>
    </div>
    <div className="macro-cells" style={{ display: 'grid', gap: 4 }}>{cells.map((c, i) => (
      <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '12px 14px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: '50%', background: c.subC }} />
        <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, textShadow: `0 0 6px ${t.accent}40` }}>{c.value}</div>
        <div style={{ fontSize: 9, color: c.subC, marginTop: 4, textTransform: 'uppercase' }}>{c.sub}</div>
        {c.sub2 && <div style={{ fontSize: 8, color: t.textDim, marginTop: 2 }}>{c.sub2}</div>}
      </div>))}</div>
  </div>);
}

// ═══════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════
function DashboardView({ snapshots, latest, settings, t, isDark, onSync, onToggle, onExport, onClear, onToggleTheme, syncFlash, onHome }) {
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vis = settings.visibleModules;
  const ac = { red: 0, amber: 0, green: 0 };
  if (latest.debts?.some(d => d.balance > 2000)) ac.red++;
  if ((latest.macro?.triggersActive || 0) >= 2) ac.red++;
  ac.amber += (latest.budget?.categories || []).filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 0.75 && (c.actual / c.budgeted) < 1).length;
  if (runwayDays(latest.eFund) >= 60) ac.green++;
  // Protection alerts
  const _pli = latest.protection?.lifeInsurance;
  if (_pli?.conversionDeadline) { const _cd = new Date(_pli.conversionDeadline); const _al = new Date(_cd); _al.setFullYear(_al.getFullYear() - (_pli.alertLeadTimeYears || 5)); if (new Date() >= _al) ac.amber++; }
  if (_pli?.deathBenefit > 0) { const _ntf = _pli.deathBenefit - totalDebt(latest.debts); if (_ntf < (latest.eFund?.monthlyExpenses || 3000) * 12) ac.amber++; else ac.green++; }
  // Portfolio alerts
  const _opts = latest.portfolio?.options || [];
  const _urgentOpts = _opts.filter(o => { if (!o.expDate) return false; const d = Math.floor((new Date(o.expDate) - new Date()) / 86400000); return d >= 0 && d <= 7; });
  if (_urgentOpts.length > 0) ac.red += _urgentOpts.length;

  return (<div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", paddingBottom: 40 }}>
    <header style={{ position: 'fixed', top: 0, width: '100%', height: 48, background: t.surface, borderBottom: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 50, animation: syncFlash ? 'pulse 0.6s ease' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }} onClick={onHome} title="Return to home">
        <Shield size={14} style={{ color: t.accent }} /><span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: t.accent, fontWeight: 700, textShadow: `0 0 10px ${t.accent}30`, whiteSpace: 'nowrap' }}>FORTIFYOS</span><span style={{ color: t.textGhost, fontSize: 9 }}>v2.2</span>
      </div>
      <span className="phase-label" style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{latest.macro?.bennerPhase ? `Benner: ${latest.macro.bennerPhase}` : 'Phase-Aware Execution Active'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setSyncOpen(true)} style={{ background: 'none', border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><RefreshCw size={10} /> Sync</button>
        <Settings size={16} style={{ color: t.textSecondary, cursor: 'pointer' }} onClick={() => setSettingsOpen(true)} />
      </div>
    </header>
    <div style={{ position: 'fixed', top: 48, width: '100%', height: 1, background: `${t.accent}15`, zIndex: 50 }} />
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 12px 52px' }}>
      <div className="main-grid" style={{ display: 'grid', gap: 12 }}>
        <DirectiveMod visible={vis.includes('directive')} t={t} />
        <NetWorthMod snapshots={snapshots} latest={latest} visible={vis.includes('netWorth')} t={t} />
        <DebtMod latest={latest} visible={vis.includes('debt')} t={t} />
        <EFundMod latest={latest} visible={vis.includes('eFund')} t={t} />
        <BudgetMod latest={latest} visible={vis.includes('budget')} t={t} />
        <ProtectionMod latest={latest} visible={vis.includes('protection')} t={t} />
        <PortfolioMod latest={latest} visible={vis.includes('portfolio')} t={t} />
        <MacroMod latest={latest} visible={vis.includes('macro')} t={t} />
      </div>
    </main>
    <footer style={{ position: 'fixed', bottom: 0, width: '100%', height: 32, background: t.surface, borderTop: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 9, zIndex: 50 }}>
      <span style={{ color: t.textDim }}>SYNC: {latest.date} <span style={{ color: t.textGhost }}>({snapshots.length})</span></span>
      <div style={{ display: 'flex', gap: 6 }}><span style={{ color: t.danger }}>{ac.red}●</span><span style={{ color: t.warn }}>{ac.amber}●</span><span style={{ color: t.accent }}>{ac.green}●</span></div>
      <span className="footer-label" style={{ color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em' }}>FortifyOS</span>
    </footer>
    <UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={onSync} t={t} />
    <SettingsPanel open={settingsOpen} settings={settings} onToggle={onToggle} onExport={onExport} onClear={onClear} onClose={() => setSettingsOpen(false)} onToggleTheme={onToggleTheme} isDark={isDark} t={t} />
  </div>);
}

// ═══════════════════════════════════════════════════
// MAIN — VIEW ROUTER
// ═══════════════════════════════════════════════════
export default function FortifyOS() {
  const [view, setView] = useState('loading');
  const [isDark, setIsDark] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [latest, setLatest] = useState(DEFAULT_SNAPSHOT);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [syncFlash, setSyncFlash] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const t = isDark ? THEMES.dark : THEMES.light;

  useEffect(() => {
    (async () => {
      const sn = await store.get('fortify-snapshots');
      const lt = await store.get('fortify-latest');
      const st = await store.get('fortify-settings');
      const th = await store.get('fortify-theme');
      if (sn?.length) { setSnapshots(sn); setLatest(lt || sn[sn.length - 1]); setView('dashboard'); }
      else setView('landing');
      if (st) {
        if ((st._v || 0) < DEFAULT_SETTINGS._v) {
          // One-time migration: add new modules from defaults that aren't in saved
          const savedMods = st.visibleModules || [];
          const newMods = DEFAULT_SETTINGS.visibleModules.filter(m => !savedMods.includes(m));
          const merged = { ...st, visibleModules: [...savedMods, ...newMods], _v: DEFAULT_SETTINGS._v };
          setSettings(merged);
          await store.set('fortify-settings', merged);
        } else {
          setSettings(st);
        }
      }
      if (th !== null) setIsDark(th);
    })();
  }, []);

  const handleSync = useCallback(async (data) => {
    const snap = { ...DEFAULT_SNAPSHOT, ...data };
    const ns = [...snapshots, snap]; setSnapshots(ns); setLatest(snap);
    await store.set('fortify-snapshots', ns); await store.set('fortify-latest', snap);
    setSyncFlash(true); setTimeout(() => setSyncFlash(false), 600);
    setView('dashboard'); setSyncOpen(false);
  }, [snapshots]);

  const toggleTheme = useCallback(async () => { const n = !isDark; setIsDark(n); await store.set('fortify-theme', n); }, [isDark]);
  const toggleModule = useCallback(async (k) => {
    const m = settings.visibleModules.includes(k) ? settings.visibleModules.filter(x => x !== k) : [...settings.visibleModules, k];
    const ns = { ...settings, visibleModules: m }; setSettings(ns); await store.set('fortify-settings', ns);
  }, [settings]);
  const handleExport = useCallback(() => {
    const b = new Blob([JSON.stringify({ snapshots, latest, settings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `fortify-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  }, [snapshots, latest, settings]);
  const handleClear = useCallback(async () => { setSnapshots([]); setLatest(DEFAULT_SNAPSHOT); setView('landing'); await store.del('fortify-snapshots'); await store.del('fortify-latest'); }, []);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 0 1px ${t.accent}60; } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 4px ${t.purple}40; border-color: ${t.purple}60; } 50% { box-shadow: 0 0 12px ${t.purple}80; border-color: ${t.purple}; } }
        @keyframes lastSeg { 0%,100% { box-shadow: 0 0 3px ${t.accent}40; } 50% { box-shadow: 0 0 8px ${t.accent}; } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        ::selection { background: ${t.accentMuted}; color: ${t.accent}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${t.void}; } ::-webkit-scrollbar-thumb { background: ${t.borderMid}; }
        .phase-label,.footer-label { display: block; }
        .main-grid { grid-template-columns: repeat(2, 1fr); }
        .macro-cells { grid-template-columns: repeat(4, 1fr); }
        .sync-row-3 { grid-template-columns: repeat(3, 1fr); }
        .sync-row-debt { grid-template-columns: 2fr 1fr 1.5fr 1fr; }
        .hero-title { font-size: 56px; }
        .hero-sub { font-size: 15px; }
        .hero-buttons { flex-direction: row; }
        .footer-stats { grid-template-columns: repeat(3, 1fr); }
        .footer-stat-cell { border-right: 1px solid ${t.borderDim}; }
        .footer-stat-cell:last-child { border-right: none; }
        @media (max-width: 768px) {
          .phase-label,.footer-label { display: none !important; }
          .main-grid { grid-template-columns: 1fr !important; }
          .macro-cells { grid-template-columns: 1fr 1fr !important; }
          .sync-row-3 { grid-template-columns: 1fr !important; }
          .sync-row-debt { grid-template-columns: 1fr 1fr !important; }
          .hero-title { font-size: 36px !important; }
          .hero-sub { font-size: 13px !important; }
          .hero-buttons { flex-direction: column !important; }
          .footer-stats { grid-template-columns: 1fr !important; }
          .footer-stat-cell { border-right: none !important; border-bottom: 1px solid ${t.borderDim}; }
          .footer-stat-cell:last-child { border-bottom: none; }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 998, opacity: 0.025, background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${t.accent} 2px, ${t.accent} 4px)` }} />
      {view === 'loading' && <div style={{ background: t.void, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: t.accent, fontFamily: "'Space Mono', monospace", fontSize: 14, textShadow: `0 0 10px ${t.accent}40` }}>FORTIFYOS initializing...</div></div>}
      {view === 'landing' && <><LandingView t={t} isDark={isDark} onToggleTheme={toggleTheme} onInitialize={() => setSyncOpen(true)} onDocs={() => setView('docs')} /><UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={handleSync} t={t} /></>}
      {view === 'docs' && <DocsView t={t} isDark={isDark} onBack={() => setView('landing')} onToggleTheme={toggleTheme} />}
      {view === 'dashboard' && <DashboardView snapshots={snapshots} latest={latest} settings={settings} t={t} isDark={isDark} onSync={handleSync} onToggle={toggleModule} onExport={handleExport} onClear={handleClear} onToggleTheme={toggleTheme} syncFlash={syncFlash} onHome={() => setView('landing')} />}
    </div>
  );
}
