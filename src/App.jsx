import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import IntelFreshness from './components/IntelFreshness.jsx';
import MacroRadarPanels from './components/MacroRadarPanels.jsx';
import BitcoinMastery from './pages/BitcoinMastery.jsx';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, CartesianGrid, Legend
} from 'recharts';
import {
  Shield, ChevronRight, Sun, Moon, Lock, Cpu, Activity,
  Settings, RefreshCw, X, Download, Trash2, Database, AlertCircle,
  FileText, Upload, Zap, ShieldAlert, TrendingUp,
  ArrowRight, ChevronDown, Clock, Eye, Menu, Home, LayoutGrid
} from 'lucide-react';
import * as Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ═══════════════════════════════════════════════════════════════
   FORTIFY OS — UNIFIED v2.3
   Landing · Universal Sync Engine · Live Dashboard
   Enforcement Layer · Liberation Countdown · Never List
   "Protect first, grow second. Every dollar has a job."
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════
const THEMES = {
  dark: {
    void: '#000000', surface: '#050505', elevated: '#0B0B0C', input: '#0B0B0C',
    panel: '#0B0B0C', panel2: '#111315',
    borderDim: '#232323', borderMid: '#343434', borderBright: '#4A4A4A',
    textPrimary: '#E4E4E7', textSecondary: '#A8AEBB', textDim: '#828A96', textGhost: '#4E5662',
    accent: '#00FF41', accentBright: '#39FF14', accentDim: '#00CC33', accentMuted: '#0A3D1A',
    danger: '#FF3B3B', warn: '#FFB800',
    purple: '#BF40BF', purpleDim: '#8A2D8A', purpleMuted: '#2D0A2D',
    crypto: '#FFA733', cryptoDim: '#C67A15', cryptoMuted: '#3D250A',
  },
  light: {
    void: '#FFFFFF', surface: '#F7F7F7', elevated: '#F7F7F7', input: '#FFFFFF',
    panel: '#F7F7F7', panel2: '#F7F7F7',
    borderDim: '#CECECE', borderMid: '#B9B9B9', borderBright: '#A8A8A8',
    textPrimary: '#121212', textSecondary: '#2A2A2A', textDim: '#444444', textGhost: '#888888',
    accent: '#1D7A3A', accentBright: '#2A9950', accentDim: '#14572A', accentMuted: '#E6F4EA',
    danger: '#C42B1C', warn: '#D48A00',
    purple: '#8B5CF6', purpleDim: '#7340DB', purpleMuted: '#F1ECF9',
    crypto: '#E8850F', cryptoDim: '#B36C0C', cryptoMuted: '#FFF5E5',
  },
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || String(error) };
  }

  componentDidCatch(error) {
    console.error('FORTIFY OS runtime error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const panel = {
      minHeight: '100vh',
      background: '#000',
      color: '#E8E8E8',
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    };

    const shell = {
      width: '100%',
      maxWidth: 640,
      border: '1px solid #2A2A2A',
      background: '#0A0A0A',
      padding: 16,
    };

    return (
      <div style={panel}>
        <div style={shell}>
          <div style={{ color: '#00FF41', fontSize: 15, marginBottom: 12 }}>FORTIFY OS SAFE RECOVERY MODE</div>
          <div style={{ fontSize: 14, color: '#BFBFBF', lineHeight: 1.5, marginBottom: 12 }}>
            The app hit a runtime error and switched to recovery mode to prevent a blank screen.
          </div>
          {this.state.errorMsg && (
            <div style={{ fontSize: 15, color: '#FF5555', background: '#1A0000', border: '1px solid #440000', padding: '8px 10px', marginBottom: 12, wordBreak: 'break-all', lineHeight: 1.5 }}>
              ERROR: {this.state.errorMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              style={{ background: '#00FF41', color: '#000', border: 'none', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
              onClick={() => window.location.reload()}
            >
              RELOAD
            </button>
            <button
              style={{ background: 'transparent', color: '#E8E8E8', border: '1px solid #444', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
              onClick={async () => {
                try {
                  localStorage.removeItem('fortify-snapshots');
                  localStorage.removeItem('fortify-latest');
                  localStorage.removeItem('fortify-settings');
                  localStorage.removeItem('fortify-theme');
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                  }
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                  }
                } catch (_) { }
                window.location.reload();
              }}
            >
              RESET CACHE + RELOAD
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/* =========================================================================
   GENERIC APP TOPBAR (Unified Header)
   ========================================================================= */
function AppTopbar({ t, isDark, menuOpen, setMenuOpen, menuRef, navItems, onToggleTheme }) {
  const themeIconColor = isDark ? '#FFD84D' : '#8B96AE';
  return (
    <nav className="fo-pagebar" style={{ margin: '0 24px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: isDark ? `linear-gradient(180deg, ${t.surface} 0%, ${t.panel} 100%)` : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`, boxShadow: isDark ? `0 14px 32px rgba(0,0,0,0.32)` : `0 12px 26px rgba(0,0,0,0.06)` }}>
      <div className="fo-pagebar-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppNavMenu t={t} isDark={isDark} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} items={navItems} title="Open navigation" />
        <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} title="Back to top">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: t.textPrimary }}>FORTIFY OS</span>
        </div>
      </div>
      <div className="fo-pagebar-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            width: 20,
            height: 20,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: themeIconColor,
            flexShrink: 0,
          }}
        >
          {isDark ? <Sun size={16} strokeWidth={2.2} fill="currentColor" /> : <Moon size={16} strokeWidth={2.2} fill="currentColor" />}
        </button>
      </div>
    </nav>
  );
}

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
      // Amex CSVs: charges are positive, payments/credits are negative — invert for our schema
      amount: -(parseFloat(r['Amount']) || 0),
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
// Goal: aggressively mask common sensitive fields BEFORE any parsing / display.
// (Matches the desktop Parse Protocols philosophy: redact-first, then reason.)
const sentinel = {
  redact: (text, opts = {}) => {
    const { preserveLabeledAccounts = false, preservePhones = false, preserveLongNumericIds = false } = opts || {};
    if (typeof text !== 'string') return text;
    let t = text;

    // Payment card PAN (13–19 digits, with optional separators) → mask
    t = t.replace(/\b(?:\d[ -]*?){13,19}\b/g, (m) => {
      const digits = (m.match(/\d/g) || []).join('');
      if (digits.length < 13 || digits.length > 19) return m;
      return `XXXX-XXXX-XXXX-${digits.slice(-4)}`;
    });

    // SSN
    t = t.replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, 'XXX-XX-****');

    // Routing number (9 digits) when labeled
    t = t.replace(/\b(?:routing|rt|aba)\s*(?:#|no\.?|number)?\s*[:\-]?\s*\d{9}\b/gi, '[REDACTED ROUTING]');

    // Account numbers when labeled (including "ending in", "last 4")
    if (!preserveLabeledAccounts) {
      t = t.replace(/\b(?:account|acct|card|iban)\s*(?:#|no\.?|number|ending\s+in|last\s*4)\s*[:\-]?\s*\d{3,}\b/gi, '[REDACTED ACCOUNT]');
    }

    // Email addresses
    t = t.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]');

    // US phone numbers
    if (!preservePhones) {
      t = t.replace(/\b(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}\b/g, '[REDACTED PHONE]');
    }

    // DOB / Birthdate when labeled (avoid blanketing all dates)
    t = t.replace(/\b(?:dob|date\s+of\s+birth|birth\s*date)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi, 'DOB: [REDACTED]');

    // Long digit sequences (9+ digits) when likely identifiers (avoid amounts with decimals)
    if (!preserveLongNumericIds) {
      t = t.replace(/\b\d{9,}\b/g, (m) => (m.length <= 4 ? m : `${'X'.repeat(Math.max(0, m.length - 4))}${m.slice(-4)}`));
    }

    return t;
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

const CATEGORY_OPTIONS = Array.from(new Set(CATEGORY_RULES.map(r => r.cat).concat(['Uncategorized'])));

function categorize(desc) {
  const d = (desc || '').toLowerCase();
  for (const r of CATEGORY_RULES) { if (r.match.test(d)) return r.cat; }
  return 'Uncategorized';
}

function normalizeMerchantDescription(desc) {
  return String(desc || '')
    .replace(/\*{3,}\S*/g, ' ')
    .replace(/\bconf#?\s*\d+\b/gi, ' ')
    .replace(/\bchecking\s*#?\d+\b/gi, ' ')
    .replace(/\bach\s+(withdrawal|dep)\s*\d+\b/gi, ' ACH $1 ')
    .replace(/\b(?:from|to)\s+pierre\s+eustache\b/gi, ' ')
    .replace(/\bcredit card ending in \d+\b/gi, 'credit card')
    .replace(/\b(?:mobile|online):\s*#?\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function merchantKeyFromDescription(desc) {
  const source = normalizeMerchantDescription(desc).toLowerCase();
  if (!source.trim()) return '';
  const scrubbed = source
    .replace(/\$?\d[\d,]*(?:\.\d{1,2})?/g, ' ')
    .replace(/\b\d{1,4}[\/\-]\d{1,4}(?:[\/\-]\d{2,4})?\b/g, ' ')
    .replace(/\b(?:ach|withdrawal|deposit|debit|credit|payment|transfer|funds|mobile|checking|savings|online|purchase|card|pending|posted|fee|service|classic|statement|from|to|bank|account|ending|conf)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = scrubbed.split(' ').filter(w => w.length >= 3);
  if (!words.length) return '';
  return words.slice(0, 4).join(' ');
}

function learnedCategoryForDescription(desc, merchantRules) {
  const key = merchantKeyFromDescription(desc);
  if (!key || !Array.isArray(merchantRules) || merchantRules.length === 0) return '';
  const exact = merchantRules.find(r => r?.key === key && r?.category);
  if (exact) return exact.category;
  const fuzzy = merchantRules
    .filter(r => r?.key && r?.category && (key.includes(r.key) || r.key.includes(key)))
    .sort((a, b) => (b.key?.length || 0) - (a.key?.length || 0))[0];
  return fuzzy?.category || '';
}

function inferCategory(desc, merchantRules) {
  return learnedCategoryForDescription(desc, merchantRules) || categorize(desc);
}

function applyMerchantRules(txns, merchantRules) {
  return (txns || []).map((tx) => {
    const learned = learnedCategoryForDescription(tx?.description, merchantRules);
    if (!learned) return tx;
    if (tx?.category && String(tx.category).trim() && String(tx.category).trim() !== 'Uncategorized') return tx;
    return { ...tx, category: learned };
  });
}

/**
 * STATEMENT PARSING (PDF text + OCR)
 * Heuristic line parser for common bank/credit card statement formats.
 * Output: [{ date: 'YYYY-MM-DD'|'', description: '...', amount: number }]
 */
function normalizeDateLike(s) {
  if (!s) return '';
  const str = s.trim();
  const validMD = (mm, dd) => mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
  // MM/DD/YYYY or MM/DD/YY or MM-DD-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (m) {
    const mmN = Number(m[1]);
    const ddN = Number(m[2]);
    if (!validMD(mmN, ddN)) return '';
    let mm = String(mmN).padStart(2, '0');
    let dd = String(ddN).padStart(2, '0');
    let yy = m[3] ? String(m[3]) : '';
    if (yy.length === 2) yy = '20' + yy;
    if (!yy) return `${mm}/${dd}`;
    const dt = new Date(`${yy}-${mm}-${dd}T00:00:00`);
    if (Number.isNaN(dt.getTime()) || (dt.getMonth() + 1) !== mmN || dt.getDate() !== ddN) return '';
    return `${yy}-${mm}-${dd}`;
  }
  // YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const mmN = Number(m[2]);
    const ddN = Number(m[3]);
    if (!validMD(mmN, ddN)) return '';
    return str;
  }
  // Month name (Jan 5 2025)
  m = str.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
  if (m) {
    const map = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };
    const mm = map[m[1].toLowerCase()];
    const ddN = Number(m[2]);
    if (!validMD(Number(mm), ddN)) return '';
    const dd = String(ddN).padStart(2, '0');
    const yy = m[3] ? String(m[3]) : '';
    return yy ? `${yy}-${mm}-${dd}` : `${mm}/${dd}`;
  }
  return '';
}

function parseAmountLike(s) {
  if (!s) return null;
  const raw = String(s).trim();
  let str = raw;
  const hadDollar = /\$/.test(raw);
  const hadSignedMarker = /[()+-]|(?:cr|dr)\b/i.test(raw);
  // parentheses = negative
  let neg = false;
  if (str.startsWith('(') && str.endsWith(')')) { neg = true; str = str.slice(1, -1); }
  str = str.replace(/\$/g, '').replace(/\$/, '').replace(/,/g, '').replace(/\s+/g, '');
  if (str.startsWith('+')) str = str.slice(1);
  if (str.endsWith('-')) { str = str.slice(0, -1); neg = true; }
  // sometimes trailing CR/DR
  if (/cr$/i.test(str)) { str = str.replace(/cr$/i, ''); }
  if (/dr$/i.test(str)) { str = str.replace(/dr$/i, ''); neg = true; }
  // Suppress OCR noise like account IDs unless explicitly money-like.
  if (!/\./.test(str) && !hadDollar && !hadSignedMarker) return null;
  const m = str.match(/^-?\d+(?:\.\d{1,2})?$/);
  if (!m) return null;
  const n = parseFloat(str);
  if (Number.isNaN(n)) return null;
  if (Math.abs(n) > 1e7) return null;
  return neg ? -Math.abs(n) : n;
}

// Bank-issuer templates — matched against header area first (top ~600 chars)
const BANK_TEMPLATES = [
  { key: 'usaa', label: 'USAA', detect: /(usaa|classic checking|ach withdrawal|ach dep)/i },
  { key: 'capitalone', label: 'Capital One', detect: /(capital\s*one|capitalone\.com|cap\s*one)/i },
  { key: 'chase', label: 'Chase', detect: /(chase|jpmorgan)/i },
  { key: 'bofa', label: 'Bank of America', detect: /(bank of america|bofa|running bal|bankofamerica)/i },
  { key: 'wellsfargo', label: 'Wells Fargo', detect: /(wells fargo|wellsfargo)/i },
  { key: 'citi', label: 'Citi', detect: /(citi|citibank)/i },
];
// Non-bank / payment-app templates — only match when no bank header found
// (their names frequently appear as transaction descriptions in bank statements)
const APP_TEMPLATES = [
  { key: 'cashapp', label: 'Cash App', detect: /(cash\s*app|square\s*cash|\$cashtag|block,?\s*inc|cash\s*out\s*to\s*bank|cash\s*in\s*from\s*bank|cashapp\.com|cash\s*app\s*card|cashtag|1-800-969-1940)/i },
];
const ALL_TEMPLATES = [...BANK_TEMPLATES, ...APP_TEMPLATES];

function detectStatementTemplate(rawText = '', fileName = '') {
  const source = `${fileName || ''}\n${rawText || ''}`;
  // Pass 1 — check the statement header (first ~600 chars) for bank-issuer names
  const header = source.slice(0, 600);
  for (const tpl of BANK_TEMPLATES) {
    if (tpl.detect.test(header)) return tpl;
  }
  // Pass 2 — full-text match for banks (e.g. bank name only appears mid-page)
  for (const tpl of BANK_TEMPLATES) {
    if (tpl.detect.test(source)) return tpl;
  }
  // Pass 3 — payment apps (Cash App, etc.) — only if no bank matched
  for (const tpl of APP_TEMPLATES) {
    if (tpl.detect.test(source)) return tpl;
  }
  return { key: 'generic', label: 'Generic' };
}

function preprocessStatementText(text, bankKey = 'generic') {
  let out = String(text || '');
  // OCR cleanup for numeric fields and dates
  out = out
    .replace(/([0-9])O([0-9])/g, '$10$2')
    .replace(/\bO([0-9]{1,2}\/[0-9]{1,2})\b/g, '0$1')
    .replace(/\b([0-9]{1,2})\/O([0-9]{1,2})\b/g, '$1/0$2');
  if (bankKey === 'usaa') {
    out = out
      .replace(/\bTTY[: ]\d+\/\d+\b/gi, ' ')
      .replace(/\bMobile:\s*#?\d+\b/gi, ' ')
      // Handle "0 MM/DD" mid-line in dense (no-newline) PDF blobs — insert \n before it
      .replace(/([^\n])[ \t]+0[ \t]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:[ \t]|$))/g, '$1\n$2')
      // Strip leading "0 " artifact at true line starts
      .replace(/^0[ \t]+(\d{1,2}\/\d{1,2})/gm, '$1')
      // Insert newline before any remaining mid-line MM/DD dates
      .replace(/([^\n])[ \t]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:[ \t]|$))/g, '$1\n$2')
      // Collapse horizontal whitespace ONLY — intentionally does NOT match \n
      .replace(/[ \t]{2,}/g, ' ');
  }
  return out.trim();
}

function scoreTxnConfidence({ date, description, amount, line }) {
  let score = 0;
  const dateNorm = normalizeDateLike(date || '');
  const desc = String(description || '').trim();
  const source = String(line || `${date || ''} ${desc} ${amount ?? ''}`).toLowerCase();
  const descLetters = (desc.match(/[A-Za-z]/g) || []).length;
  const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount || '').replace(/,/g, ''));

  if (dateNorm) score += 0.28;
  if (descLetters >= 5) score += 0.22;
  if (/\b(?:ach|withdrawal|payment|deposit|transfer|card|debit|credit|autopay|pos|zelle|venmo|paypal|atm)\b/i.test(desc)) score += 0.2;
  if (Number.isFinite(amountNum) && Math.abs(amountNum) >= 0.01 && Math.abs(amountNum) <= 1000000) score += 0.2;

  if (descLetters < 3) score -= 0.18;
  if (/\b(?:balance|statement|ending|beginning|available|total due|interest charge)\b/.test(source)) score -= 0.26;
  if (/^\d[\d\s\-./]*$/.test(desc)) score -= 0.12;

  score = Math.max(0, Math.min(1, score));
  const label = score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  return { score: Number(score.toFixed(2)), label };
}

function withTxnConfidence(txn, line = '') {
  const { score, label } = scoreTxnConfidence({
    date: txn?.date,
    description: txn?.description,
    amount: txn?.amount,
    line,
  });
  return { ...txn, confidence: label, confidenceScore: score };
}

function parseStatementTextToTransactions(text, options = {}) {
  const bankKey = options?.bankKey || 'generic';
  const preprocessed = preprocessStatementText(text || '', bankKey);
  const rawLines = (preprocessed || '')
    .split(/\r?\n/)
    .map(l => (l || '').replace(/\t/g, ' ').trim())
    .filter(Boolean);

  // ── Cash App parser ──────────────────────────────────────────────────────────
  // Cash App statement format (from PDF export):
  //   Jan 1  Merchant Name                    $0.00  $12.34      ← debit (no +)
  //   Jan 2  From Bank Standard transfer       $0.00  + $100.00  ← credit (+)
  //   Jan 15 Bitcoin sale                      $1.00  + $500.00
  // Year is inferred from page headers: "January 2026"
  if (bankKey === 'cashapp') {
    const txns = [];
    const CA_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    // Line-start date: "Jan 1", "Feb 23", etc. (no year — inferred from page header)
    const CA_LINE_RX = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})\b/i;
    // Dollar token (with optional leading + or -)
    const CA_AMT_RX = /([+\-]\s*)?\$(\d[\d,]*\.\d{2})/g;

    const isCANoise = (l) => (
      /^\d+\s*\/\s*\d+$/.test(l) ||                              // "1 / 12"
      /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i.test(l) ||
      /^(account statement|transactions)$/i.test(l) ||
      /^date description details fee amount$/i.test(l) ||
      /^balance on|^money in|^money out|^fees\s/i.test(l) ||
      /^\$[\d,]+\.\d{2}(\s+\$[\d,]+\.\d{2}){1,3}$/.test(l) ||  // "$8.16 $17.51 $25.67"
      /starting on or after|range of fees|terms of service|contact us as soon|in order for us|you will need to provide|write us at|call us at|tap cash app|select contact support|please (note|see|review)|updated instant transfer|updated terms/i.test(l) ||
      (l.length > 120 && !/\$\d/.test(l))
    );

    let currentYear = new Date().getFullYear();

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;

      // Capture year from full-month headers like "January 2026"
      const hdrM = line.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i);
      if (hdrM) { currentYear = parseInt(hdrM[2]); continue; }

      if (isCANoise(line)) continue;

      // Must start with an abbreviated month + day
      const dm = line.match(CA_LINE_RX);
      if (!dm) continue;
      const month = CA_MONTHS[dm[1].toLowerCase().slice(0, 4)] || CA_MONTHS[dm[1].toLowerCase().slice(0, 3)];
      if (!month) continue;
      const day = parseInt(dm[2]);
      const date = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Collect all dollar-amount matches on this line
      const dollarHits = Array.from(line.matchAll(CA_AMT_RX));
      if (!dollarHits.length) continue;

      // Last hit = transaction amount; sign before it tells direction
      const lastHit = dollarHits[dollarHits.length - 1];
      const signStr = (lastHit[1] || '').replace(/\s/g, '');
      const amtVal = parseFloat(lastHit[2].replace(/,/g, ''));
      if (isNaN(amtVal) || amtVal < 0.01) continue;

      // Credit = explicit '+'; debit = no sign or '-'
      // Also check description keywords as fallback
      let signed;
      if (signStr === '+') {
        signed = amtVal;
      } else if (signStr === '-') {
        signed = -amtVal;
      } else {
        const ctx = line.slice(dm[0].length).toLowerCase();
        const isCredit = /\bfrom (usaa|.* bank|savings)\b|payroll|direct deposit|drawdown|stock sale|bitcoin sale|refund|reward|cash in\b/i.test(ctx);
        signed = isCredit ? amtVal : -amtVal;
      }

      // Description: between date token and the start of the fee amount
      // (fee = second-to-last dollar amount; amount = last)
      const feeIdx = dollarHits.length >= 2
        ? dollarHits[dollarHits.length - 2].index
        : dollarHits[0].index;
      let desc = line.slice(dm[0].length, feeIdx).replace(/\s{2,}/g, ' ').trim();

      // Absorb continuation line if it's pure location text (no $, no date, short)
      const nextL = rawLines[i + 1];
      if (nextL && !CA_LINE_RX.test(nextL) && !isCANoise(nextL) && !/\$\d/.test(nextL) && nextL.length < 50) {
        desc = `${desc} ${nextL}`.replace(/\s{2,}/g, ' ').trim();
        i++;
      }

      desc = normalizeMerchantDescription(desc);
      if (!desc || (desc.match(/[A-Za-z]/g) || []).length < 2) continue;

      txns.push(withTxnConfidence({ date, description: desc, amount: signed }, line));
    }

    const seen = new Set();
    const out = [];
    for (const t of txns) {
      const key = `${t.date}|${t.description}|${t.amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    out.sort((a, b) => (sanitizeDate(a.date) || '').localeCompare(sanitizeDate(b.date) || ''));
    return out;
  }

  // ── USAA parser ──────────────────────────────────────────────────────────────
  if (bankKey === 'usaa') {
    const txns = [];
    // Support both MM/DD and MM/DD/YYYY formats (real USAA statements use MM/DD/YYYY)
    const dateHeadRx = /^(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?(?:\s|$)/;
    const amountRx = /\$?\d[\d,]*\.\d{2}/g;
    // Diagnostic: count date-headed lines and show first few for debugging
    let datedLines = rawLines.filter(l => dateHeadRx.test(l));
    if (typeof console !== 'undefined') console.log('[USAA] preprocessed lines:', rawLines.length, '| date-headed:', datedLines.length, '| first 5 dated:', datedLines.slice(0, 5));
    // Fallback: if no date-headed lines found, the PDF text may have dates embedded mid-line.
    // Re-split aggressively on date patterns.
    if (datedLines.length === 0 && rawLines.length > 0) {
      if (typeof console !== 'undefined') console.log('[USAA] fallback: re-splitting on date patterns');
      const blob = rawLines.join(' ');
      // Split on "0 MM/DD" or "MM/DD" or "MM/DD/YYYY" patterns that appear mid-string
      const reSplit = blob
        .replace(/\b0\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g, '\n$1')
        .replace(/\s(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s)/g, '\n$1')
        .split(/\n/)
        .map(l => l.trim())
        .filter(Boolean);
      rawLines.length = 0;
      rawLines.push(...reSplit);
      datedLines = rawLines.filter(l => dateHeadRx.test(l));
      if (typeof console !== 'undefined') console.log('[USAA] after re-split:', rawLines.length, 'lines, date-headed:', datedLines.length);
    }
    const isNoiseLine = (line) => (
      /^online:\s*usaa\.com/i.test(line) ||
      /^usaa classic checking/i.test(line) ||
      /^for account number/i.test(line) ||
      /^statement period/i.test(line) ||
      /^transactions?(?:\s*\(continued\))?$/i.test(line) ||
      /^date\s+description/i.test(line) ||
      /^activity summary/i.test(line) ||
      /^page\s+\d+\s+of\s+\d+/i.test(line) ||
      /^phone:\s*\d/i.test(line) ||
      /^\d{6,}/.test(line) ||           // long numeric strings (routing, conf#, account metadata)
      /^0\s+0$/.test(line) ||           // empty Debits/Credits column artifact
      /^\d+\s*$/.test(line) ||
      // Summary / balance rows that should never be transactions
      /^beginning\s+balance/i.test(line) ||
      /^ending\s+balance/i.test(line) ||
      /^total\s+(?:debits?|credits?|deposits?|withdrawals?)/i.test(line) ||
      /^available\s+balance/i.test(line) ||
      /^service\s+charg/i.test(line) ||
      /^deposits?\s*(?:\/\s*credits?)?$/i.test(line) ||
      /^withdrawals?\s*(?:\/\s*debits?)?$/i.test(line) ||
      /^interest\s+(?:paid|earned|charged)/i.test(line) ||
      /^fees?\s+charged/i.test(line) ||
      /^debits?\s+amount/i.test(line) ||
      /^credits?\s+amount/i.test(line) ||
      /^account\s+summary/i.test(line) ||
      /^balance\s+summary/i.test(line)
    );
    const usaaDirection = (line, desc = '') => {
      const s = `${line} ${desc}`.toLowerCase();
      if (/\b(?:funds transfer cr|ach dep|deposit|dep\b|payroll|credit|refund)\b/.test(s)) return 1;
      if (/\b(?:withdrawal|payment|debit|autopay|purchase|atm|card)\b/.test(s)) return -1;
      return -1;
    };
    const pushTxn = (rowDate, rowDesc, amountToken, rowLine) => {
      const normDate = normalizeDateLike(rowDate);
      const amount = parseAmountLike(amountToken);
      if (!normDate || amount === null) return;
      const desc = normalizeMerchantDescription(String(rowDesc || '').replace(/\s{2,}/g, ' ').trim());
      if (!desc || /beginning balance|ending balance|service charges?/i.test(desc)) return;
      const signed = usaaDirection(rowLine, desc) > 0 ? Math.abs(amount) : -Math.abs(amount);
      txns.push(withTxnConfidence({ date: normDate, description: desc, amount: signed }, rowLine));
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (isNoiseLine(line)) continue;
      const dm = line.match(dateHeadRx);
      if (!dm) continue;
      // dm[1] is always MM/DD — strip any trailing /YYYY from the remainder
      const rowDate = dm[1];
      const restOfLine = line.slice(dm[0].length).replace(/^\d{2,4}\s*/, '').trim(); // strip year if date-only token
      let amounts = Array.from(line.matchAll(amountRx)).map(m => m[0]);

      let desc = normalizeMerchantDescription(restOfLine
        .replace(amountRx, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim());

      // Pull continuation lines (merchant/details) under the dated row.
      // Also collect amounts from following lines when date line had none (column-layout PDFs).
      let j = i + 1;
      let descLinesAbsorbed = 0;
      while (j < rawLines.length) {
        const next = rawLines[j];
        if (!next || isNoiseLine(next) || dateHeadRx.test(next)) break;
        // Grab amounts from next lines when the date line itself had none
        if (!amounts.length) {
          const nextAmts = Array.from(next.matchAll(amountRx)).map(m => m[0]);
          if (nextAmts.length) { amounts = nextAmts; j++; continue; }
        }
        // Cap description absorption at 2 continuation lines to prevent over-run
        if (descLinesAbsorbed >= 2) break;
        // Stop if line looks like a balance/summary row (has keyword + dollar amount)
        if (/\b(?:balance|total|available|fee|interest|charge)\b/i.test(next) && amountRx.test(next)) break;
        if (/[A-Za-z]/.test(next) && !/^\*{4,}\d{2,4}$/.test(next)) {
          desc = normalizeMerchantDescription(`${desc} ${next}`.replace(/\s{2,}/g, ' ').trim());
          descLinesAbsorbed++;
        }
        j++;
      }
      i = j - 1;
      if (!amounts.length) continue; // no amount found on date line or continuation — skip
      const amountToken = amounts[0]; // first token is the transaction amount; last is typically running balance
      pushTxn(rowDate, desc, amountToken, line);
    }

    // Dedupe/sort like generic path
    const seen = new Set();
    const out = [];
    for (const t of txns) {
      const key = `${t.date}|${t.description}|${t.amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    out.sort((a, b) => (sanitizeDate(a.date) || '').localeCompare(sanitizeDate(b.date) || ''));
    return out;
  }

  const splitDenseStatementLine = (line, dateRegex) => {
    const dense = (line || '').replace(/\s{2,}/g, ' ').trim();
    if (!dense) return [];
    const hits = Array.from(dense.matchAll(new RegExp(dateRegex.source, 'ig')));
    if (hits.length <= 1) return [dense];
    const parts = [];
    for (let i = 0; i < hits.length; i++) {
      const start = hits[i].index ?? 0;
      const end = i + 1 < hits.length ? (hits[i + 1].index ?? dense.length) : dense.length;
      const seg = dense.slice(start, end).trim();
      if (seg) parts.push(seg);
    }
    return parts.length ? parts : [dense];
  };

  const txns = [];
  const isLikelyBalanceToken = (line, token) => {
    const low = line.toLowerCase();
    const idx = line.indexOf(token);
    if (idx < 0) return false;
    const near = low.slice(Math.max(0, idx - 24), Math.min(low.length, idx + token.length + 24));
    return /\bbalance\b|\bavailable\b|\bbal\.\b/.test(near);
  };
  const pickAmountToken = (line, amountTokens) => {
    const parsed = amountTokens
      .map(tok => ({ tok, val: parseAmountLike(tok), idx: line.indexOf(tok) }))
      .filter(x => x.val !== null);
    if (!parsed.length) return null;
    if (parsed.length === 1) return parsed[0].tok;

    const hasBalanceWord = /\brunning bal|available balance|balance\b|ending balance\b/i.test(line);
    if (hasBalanceWord) {
      const nonBalance = parsed.filter(p => !isLikelyBalanceToken(line, p.tok));
      if (nonBalance.length) return nonBalance[nonBalance.length - 1].tok;
    }

    const sorted = [...parsed].sort((a, b) => a.idx - b.idx);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const lineLooksTxn = /\b(?:ach|withdrawal|payment|purchase|debit|deposit|dep|transfer|autopay|card)\b/i.test(line);
    if (lineLooksTxn && Math.abs(last.val) > Math.abs(prev.val) * 1.8) return prev.tok;
    return last.tok;
  };

  const inferDirection = (line, desc = '') => {
    const s = `${line || ''} ${desc || ''}`.toLowerCase();
    if (/\bfrom\s+.+\b(?:bank|checking|savings|transfer)\b/.test(s)) return 1;
    if (/\bto\s+savings\s+transfer\b/.test(s)) return -1;
    if (/\bcash app card\b/.test(s)) return -1;
    if (/\bloan repayment\b/.test(s)) return -1;
    // Debit-first precedence: catches "credit card payment" correctly as expense.
    if (/\b(?:db|dr)\b/.test(s)) return -1;
    if (/\b(?:withdrawal|withdraw|payment|purchase|debit|atm|pos|autopay|ach\s+withdrawal)\b/.test(s)) return -1;
    if (/\b(?:cr)\b/.test(s)) return 1;
    if (/\b(?:dep|deposit|payroll|direct\s+dep|refund|credit)\b/.test(s)) return 1;
    return 0;
  };

  const applyDirection = (amt, line, desc = '', amtToken = '') => {
    if (amt === null) return null;
    const token = String(amtToken || '').trim();
    if (/^\+/.test(token)) return Math.abs(amt);
    if (/^\-/.test(token) || /dr$/i.test(token)) return -Math.abs(amt);
    const dir = inferDirection(line, desc);
    if (dir < 0) return -Math.abs(amt);
    if (dir > 0) return Math.abs(amt);
    // For statement "Amount" columns, unsigned values are usually debits/outflows.
    return -Math.abs(amt);
  };

  const isContinuationCandidate = (line) => {
    const s = (line || '').trim();
    if (!s) return false;
    if (/^date\s+description|^debits?\b|^credits?\b|^balance\b/i.test(s)) return false;
    if (dateRx.test(s)) return false;
    if (/\(?[+\-]?\$?\d[\d,]*?(?:\.\d{1,2})?\)?(?:\s*(?:CR|DR))?|\$?\d[\d,]*(?:\.\d{1,2})?\-/i.test(s)) return false;
    // Keep important detail lines often printed under ACH/card rows.
    return /\b(?:from|to|checking|savings|conf#|confirmation|credit card|ending in|memo|ref)\b/i.test(s);
  };

  // Date tokens we commonly see in statements (mm/dd[/yyyy], yyyy-mm-dd, "Jan 3 2026", etc.)
  const dateRx = /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*\d{1,2}(?:,?\s*\d{4})?)/i;

  // Money token: supports $1,234.56, 1234.56, (123.45), 123.45CR, 123.45 DR, trailing minus, etc.
  const moneyTokenRx = /(\(?[+\-]?\$?\d[\d,]*?(?:\.\d{1,2})?\)?(?:\s*(?:CR|DR))?|\$?\d[\d,]*(?:\.\d{1,2})?\-)/ig;

  // Fast-path patterns
  const rx1 = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*\d{1,2}(?:,?\s*\d{4})?)\s+(.+?)\s+([\(\+\$\-]?\d[\d,]*(?:\.\d{1,2})?(?:\)?)(?:\s*(?:CR|DR))?)$/i;
  const rx2 = /^(.+?)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*\d{1,2}(?:,?\s*\d{4})?)\s+([\(\+\$\-]?\d[\d,]*(?:\.\d{1,2})?(?:\)?)(?:\s*(?:CR|DR))?)$/i;

  const expandedLines = rawLines.flatMap((line0) => splitDenseStatementLine(line0, dateRx));

  for (const line0 of expandedLines) {
    const line = line0.replace(/\s{2,}/g, ' ').trim();

    // Pattern 1: DATE ... AMOUNT
    let m = line.match(rx1);
    if (m) {
      const date = normalizeDateLike(m[1]);
      const desc = normalizeMerchantDescription((m[2] || '').trim());
      const amt = applyDirection(parseAmountLike(m[3]), line, desc, m[3]);
      if (date && amt !== null && (desc.match(/[A-Za-z]/g) || []).length >= 3 && Math.abs(amt) >= 0.01) {
        txns.push(withTxnConfidence({ date, description: desc, amount: amt }, line));
      }
      continue;
    }

    // Pattern 2: DESC DATE AMOUNT
    m = line.match(rx2);
    if (m) {
      const desc = normalizeMerchantDescription((m[1] || '').trim());
      const date = normalizeDateLike(m[2]);
      const amt = applyDirection(parseAmountLike(m[3]), line, desc, m[3]);
      if (date && amt !== null && (desc.match(/[A-Za-z]/g) || []).length >= 3 && Math.abs(amt) >= 0.01) {
        txns.push(withTxnConfidence({ date, description: desc, amount: amt }, line));
      }
      continue;
    }

    // Heuristic: if the line contains a date and at least one money token, use the last money token as amount.
    const dm = line.match(dateRx);
    if (!dm) {
      if (txns.length && isContinuationCandidate(line)) {
        const prev = txns[txns.length - 1];
        const mergedDesc = normalizeMerchantDescription(`${prev.description} ${line}`.replace(/\s{2,}/g, ' ').trim());
        txns[txns.length - 1] = withTxnConfidence({ ...prev, description: mergedDesc }, mergedDesc);
      }
      continue;
    }

    const amounts = Array.from(line.matchAll(moneyTokenRx)).map(x => x[0]).filter(Boolean);
    if (!amounts.length) continue;
    const pickedAmtToken = pickAmountToken(line, amounts);
    if (!pickedAmtToken) continue;
    const amt = applyDirection(parseAmountLike(pickedAmtToken), line, '', pickedAmtToken);
    if (amt === null) continue;

    // Description = everything between date token and last amount token (best-effort)
    const dateStr = dm[1];
    const dateIdx = line.toLowerCase().indexOf(dateStr.toLowerCase());
    const amtIdx = line.lastIndexOf(pickedAmtToken);
    const descSliceStart = dateIdx >= 0 ? dateIdx + dateStr.length : 0;
    const descSliceEnd = amtIdx > descSliceStart ? amtIdx : line.length;
    const desc = normalizeMerchantDescription(line.slice(descSliceStart, descSliceEnd).replace(/\s{2,}/g, ' ').trim());
    const date = normalizeDateLike(dateStr);

    // Avoid adding lines where "description" is empty or obviously just column labels
    if (!date) continue;
    if (!desc || /balance|total|statement|payment due/i.test(desc)) continue;
    if ((desc.match(/[A-Za-z]/g) || []).length < 3) continue;
    if (Math.abs(amt) < 0.01) continue;

    txns.push(withTxnConfidence({ date, description: desc, amount: amt }, line));
  }

  // De-dup by (date|desc|amount)
  const seen = new Set();
  const out = [];
  for (const t of txns) {
    const key = `${t.date}|${t.description}|${t.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }

  // Sort by date asc where possible
  out.sort((a, b) => (sanitizeDate(a.date) || '').localeCompare(sanitizeDate(b.date) || ''));
  return out;
}

function reconcileParsedTransactions(txns, rawText = '', bankKey = 'generic') {
  const items = [...(txns || [])];
  let correctedSign = 0;
  let filledYear = 0;
  const warnings = [];

  const endYearMatch = String(rawText || '').match(/\b(20\d{2})\b/g);
  const inferredYear = endYearMatch?.length ? Number(endYearMatch[endYearMatch.length - 1]) : new Date().getFullYear();

  const debitHint = /\b(withdrawal|payment|purchase|debit|autopay|pos|card payment|loan repayment)\b/i;
  const creditHint = /\b(deposit|dep\b|payroll|refund|credit|funds transfer cr)\b/i;

  for (let i = 0; i < items.length; i++) {
    const row = { ...items[i] };
    if (/^\d{2}\/\d{2}$/.test(String(row.date || ''))) {
      row.date = `${inferredYear}-${row.date.slice(0, 2)}-${row.date.slice(3, 5)}`;
      filledYear++;
    }
    if (debitHint.test(row.description || '') && Number(row.amount) > 0) {
      row.amount = -Math.abs(Number(row.amount) || 0);
      correctedSign++;
    } else if (creditHint.test(row.description || '') && Number(row.amount) < 0) {
      row.amount = Math.abs(Number(row.amount) || 0);
      correctedSign++;
    }
    items[i] = withTxnConfidence(row, `${row.date || ''} ${row.description || ''} ${row.amount ?? ''}`);
  }

  const raw = String(rawText || '');
  // Same-line balance patterns — allow spaces AND dashes between label and amount
  // (USAA format: "Ending Balance - - - - $539.26")
  const startBalMatch = raw.match(/(?:beginning|previous|starting)\s+balance[\s\-]*(-?\$?\d[\d,]*\.\d{2})/i);
  const endBalMatch = raw.match(/(?:ending|new|available|statement|closing)\s+balance[\s\-]*(-?\$?\d[\d,]*\.\d{2})/i);
  // Multi-line balance patterns: label on one line, amount on the very next line (column-layout PDFs)
  const startBalMatchML = !startBalMatch ? raw.match(/(?:beginning|previous|starting)\s+balance[^\n]*\n[^\S\n]*(-?\$?\d[\d,]*\.\d{2})/i) : null;
  const endBalMatchML = !endBalMatch ? raw.match(/(?:ending|new|available|statement|closing)\s+balance[^\n]*\n[^\S\n]*(-?\$?\d[\d,]*\.\d{2})/i) : null;
  const resolvedStartBal = startBalMatch || startBalMatchML;
  const resolvedEndBal = endBalMatch || endBalMatchML;
  let balanceDiff = null;
  let endBal = null;
  if (resolvedStartBal && resolvedEndBal) {
    const startBal = parseAmountLike(resolvedStartBal[1]);
    endBal = parseAmountLike(resolvedEndBal[1]);
    const txnDelta = items.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    if (startBal !== null && endBal !== null) {
      const expectedDelta = endBal - startBal;
      balanceDiff = Number((txnDelta - expectedDelta).toFixed(2));
      if (Math.abs(balanceDiff) > Math.max(25, Math.abs(expectedDelta) * 0.05)) {
        warnings.push(`Balance reconciliation variance ${fmt(Math.abs(balanceDiff))}`);
      }
    }
  } else {
    // Try standalone ending/available balance pattern even without start balance
    if (resolvedEndBal) endBal = parseAmountLike(resolvedEndBal[1]);
    if (!endBal) {
      const standaloneMatch = raw.match(/(?:available|current|ledger|account)\s+balance[:\s\n]*(-?\$?\d[\d,]*\.\d{2})/i);
      if (standaloneMatch) endBal = parseAmountLike(standaloneMatch[1]);
    }
    // Cash App: "Balance on Jan 1  Change this month  Balance on Jan 31\n$8.16  $17.51  $25.67"
    // The ending balance is the LAST of the three values on the amounts line
    if (!endBal && bankKey === 'cashapp') {
      const caBalBlock = raw.match(/balance on .+?\n(\$[\d,]+\.\d{2}\s+\$[\d,]+\.\d{2}\s+\$[\d,]+\.\d{2})/i);
      if (caBalBlock) {
        const vals = caBalBlock[1].match(/\$[\d,]+\.\d{2}/g);
        if (vals && vals.length >= 1) endBal = parseAmountLike(vals[vals.length - 1]);
      }
    }
    if (bankKey !== 'generic' && !endBal) {
      warnings.push('No statement balances detected for reconciliation');
    }
  }

  return {
    txns: items,
    summary: { correctedSign, filledYear, balanceDiff, endBal, warnings },
  };
}

// Detect whether a statement is for a credit card, savings, or checking account
function detectAccountType(rawText = '', bankKey = '') {
  // Certain banks are always credit-card issuers in this context
  if (/^(capitalone|citi)$/.test(bankKey)) return 'credit_card';
  // Cash App is always checking-equivalent (debit)
  if (bankKey === 'cashapp') return 'checking';
  const t = String(rawText || '').toLowerCase();
  const ccPatterns = /minimum payment due|credit limit|purchase apr|cash advance apr|statement balance|new balance due|payment due date|revolving credit|credit card account|credit account|capital one/i;
  const savingsPatterns = /savings account|high.?yield|money market|hysa|savings deposit/i;
  if (ccPatterns.test(t)) return 'credit_card';
  if (savingsPatterns.test(t)) return 'savings';
  return 'checking';
}

function txnsToPaymentLogCSV(txns) {
  const header = ['DATE', 'PAYEE', 'CATEGORY', 'AMOUNT', 'METHOD', 'NOTES'];
  const rows = (txns || []).map(t => {
    const payee = (t.description || '').replace(/\s+/g, ' ').trim();
    const category = (t.category && String(t.category).trim()) ? String(t.category).trim() : categorize(payee);
    const amount = (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount)) || 0;
    // Escape CSV
    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [esc(t.date || ''), esc(payee), esc(category), esc(amount.toFixed(2)), '', ''].join(',');
  });
  return header.join(',') + '\n' + rows.join('\n');
}

function transactionsToSnapshot(txns, bankName, { endBalance = null, accountType = 'checking' } = {}) {
  // Filter out likely transfers/refunds from income — only count genuine income
  const TRANSFER_PATTERNS = /transfer|xfer|tfr|payment from|zelle.*from|venmo.*from|paypal.*from|refund|reversal|credit adjustment|cashback|reward|rebate|returned|chargeback/i;
  const INCOME_PATTERNS = /payroll|direct dep|salary|wage|income|employer|irs.*refund|tax refund/i;

  const incomeTxns = txns.filter(t => {
    if (t.amount <= 0) return false;
    const desc = (t.description || '').toLowerCase();
    // Always count if it matches known income patterns
    if (INCOME_PATTERNS.test(desc)) return true;
    // Exclude if it matches transfer/refund patterns
    if (TRANSFER_PATTERNS.test(desc)) return false;
    // Flag unusually large single transactions (>$10K) as likely transfers unless income-patterned
    if (t.amount > 10000) return false;
    return true;
  });
  const income = incomeTxns.reduce((s, t) => s + t.amount, 0);
  const excludedIncome = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) - income;

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
  // Build recent transactions list (up to 40, newest first)
  const _recentTxns = [...txns]
    .sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    })
    .slice(0, 40)
    .map(t => ({
      date: t.date || '',
      description: (t.description || '').slice(0, 60),
      amount: t.amount || 0,
      category: categorize(t.description),
    }));
  // Build netWorth from ending balance if available
  const nwAssets = { checking: 0, savings: 0, eFund: 0, other: 0 };
  const nwLiabilities = {};
  const stmtDebts = [];

  if (endBalance !== null && endBalance > 0) {
    if (accountType === 'credit_card') {
      // Credit card ending balance = what you owe → liability
      const debtName = bankName || 'Credit Card';
      nwLiabilities[debtName] = endBalance;
      stmtDebts.push({
        name: debtName,
        balance: endBalance,
        apr: 0,
        minPayment: 0,
        type: 'REVOLVING',
        dueDate: '',
        _fromStatement: true,
      });
    } else if (accountType === 'savings') {
      nwAssets.savings = endBalance;
    } else {
      // checking (default)
      nwAssets.checking = endBalance;
    }
  }

  const nwTotal = (nwAssets.checking + nwAssets.savings + nwAssets.eFund + nwAssets.other)
    - Object.values(nwLiabilities).reduce((s, v) => s + v, 0);

  return {
    date: dates.length ? sanitizeDate(dates[dates.length - 1]) : new Date().toISOString().slice(0, 10),
    netWorth: { assets: nwAssets, liabilities: nwLiabilities, total: nwTotal },
    debts: stmtDebts,
    eFund: { balance: 0, monthlyExpenses: Math.round(totalExpense), phase: 1 },
    budget: { income: Math.round(income), categories: budgetCats },
    macro: { netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: 'Accumulation', fedWatchCut: 0, nextFomc: '', yieldCurve10Y2Y: 0, yieldTrend: 'flat', triggersActive: 0, activeTriggers: [] },
    protection: { lifeInsurance: { provider: '', type: 'TERM', deathBenefit: 0, monthlyPremium: 0, expirationDate: '', conversionDeadline: '', alertLeadTimeYears: 5 }, funeralBuffer: { target: 10000, current: 0 } },
    portfolio: { equities: [], options: [], crypto: [] },
    bills: [],
    payroll: { frequency: 'WEEKLY', weekday: 2 },
    _meta: { source: bankName, transactions: txns.length, income: Math.round(income), totalExpense: Math.round(totalExpense), uncategorized: Math.round(cats['Uncategorized'] || 0), excludedTransfers: Math.round(excludedIncome), endBalance, accountType },
    _recentTxns,
  };
}

// ═══════════════════════════════════════════════════
// DEFAULT DATA & HELPERS
// ═══════════════════════════════════════════════════
const DEFAULT_SNAPSHOT = {
  date: new Date().toISOString().slice(0, 10),
  netWorth: { assets: { checking: 0, savings: 0, eFund: 0, other: 0 }, liabilities: {}, total: 0 },
  debts: [], eFund: { balance: 0, monthlyExpenses: 0, phase: 1 },
  budget: {
    categories: [
      { name: 'Essential', budgeted: 2000, actual: 0 }, { name: 'Discretionary', budgeted: 300, actual: 0 },
      { name: 'Medical', budgeted: 300, actual: 0 }, { name: 'Debt Service', budgeted: 0, actual: 0 },
      { name: 'Savings', budgeted: 300, actual: 0 },
    ]
  },
  macro: { netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: 'Accumulation', fedWatchCut: 0, nextFomc: '2026-03-19', yieldCurve10Y2Y: 0, yieldTrend: 'flat', triggersActive: 0, activeTriggers: [], bennerPhase: '' },
  protection: {
    lifeInsurance: { provider: '', type: 'TERM', deathBenefit: 0, monthlyPremium: 0, expirationDate: '', conversionDeadline: '', alertLeadTimeYears: 5 },
    funeralBuffer: { target: 10000, current: 0 },
  },
  portfolio: { equities: [], options: [], crypto: [] },
  bills: [],
  payroll: { frequency: 'WEEKLY', weekday: 2 },
};
const DEFAULT_SETTINGS = { visibleModules: ['directive', 'netWorth', 'debt', 'planner', 'eFund', 'budget', 'knox', 'transactions', 'protection', 'portfolio', 'macro', 'market', 'macroBanner'], payFrequency: 'WEEKLY', _v: 10 };
const fmt = (n) => { if (n == null || isNaN(n)) return '$0'; return '$' + Math.abs(Math.round(Number(n))).toLocaleString('en-US'); };
const dailyInterest = (d) => d ? d.reduce((s, x) => s + ((x.balance || 0) * ((x.apr || 0) / 100)) / 365, 0) : 0;
const totalDebt = (d) => d ? d.reduce((s, x) => s + (x.balance || 0), 0) : 0;
const runwayDays = (ef) => (!ef || !ef.monthlyExpenses) ? 0 : Math.floor((ef.balance || 0) / (ef.monthlyExpenses / 30));
const totalBudgetSpent = (latest) => (latest?.budget?.categories || []).reduce((s, c) => s + (c.actual || 0), 0);
const monthlySpendBaseline = (latest) => {
  const spent = totalBudgetSpent(latest);
  if (spent > 0) return spent;
  const metaExpense = latest?._meta?.totalExpense || 0;
  if (metaExpense > 0) return metaExpense;
  const efMonthly = latest?.eFund?.monthlyExpenses || 0;
  return efMonthly > 0 ? efMonthly : 0;
};
const runwayDaysFromLatest = (latest) => {
  const bal = latest?.eFund?.balance || 0;
  const monthly = monthlySpendBaseline(latest);
  if (monthly <= 0) return 0;
  return Math.floor(bal / (monthly / 30));
};
const efundTargets = (m) => [1000, m, m * 3, m * 6];
const pctColor = (p, t) => p >= 100 ? t.danger : p >= 75 ? t.warn : t.accent;
const runwayColor = (d, t) => d < 30 ? t.danger : d < 60 ? t.warn : t.accent;
const weekdayName = (n) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Math.max(0, Math.min(6, Number(n) || 0))];
const nextWeekdayDates = (weekday = 2, count = 4) => {
  const out = [];
  const now = new Date();
  let d = new Date(now);
  d.setHours(0, 0, 0, 0);
  while (out.length < count) {
    if (d.getDay() === weekday && d >= now) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};
const payPeriodsPerMonth = (frequency = 'WEEKLY') => {
  const f = String(frequency || 'WEEKLY').toUpperCase();
  if (f === 'BIWEEKLY') return 26 / 12;
  return 52 / 12;
};
function buildProtectionFirstBudget(income = 0, categories = [], latest = {}) {
  const inc = Math.max(0, Number(income) || 0);
  const src = Array.isArray(categories) ? categories : [];
  if (inc <= 0 || src.length === 0) return src.map(c => ({ ...c }));

  const catMap = new Map(src.map(c => [c.name, { ...c, actual: Number(c.actual) || 0, budgeted: Number(c.budgeted) || 0 }]));
  const hasDebt = (latest?.debts || []).some(d => (Number(d?.balance) || 0) > 0);
  const efMonthly = monthlySpendBaseline(latest);
  const efBalance = Number(latest?.eFund?.balance) || 0;
  const needsEfundBuild = efBalance < Math.max(1000, efMonthly);

  const minByName = {
    Essential: Math.max((catMap.get('Essential')?.actual || 0), inc * 0.45),
    Medical: Math.max((catMap.get('Medical')?.actual || 0), inc * 0.08),
    'Debt Service': hasDebt ? Math.max((catMap.get('Debt Service')?.actual || 0), inc * 0.22) : Math.max((catMap.get('Debt Service')?.actual || 0), inc * 0.05),
    Savings: needsEfundBuild || hasDebt ? Math.max((catMap.get('Savings')?.actual || 0), inc * 0.2) : Math.max((catMap.get('Savings')?.actual || 0), inc * 0.15),
    Discretionary: Math.max((catMap.get('Discretionary')?.actual || 0), inc * 0.05),
  };

  // Keep priority strict: Essential -> Medical -> Debt Service -> Savings -> Discretionary.
  const order = ['Essential', 'Medical', 'Debt Service', 'Savings', 'Discretionary'];
  let remaining = inc;
  const allocated = {};
  for (const name of order) {
    const desired = Math.max(0, minByName[name] || 0);
    const take = Math.min(remaining, desired);
    allocated[name] = Math.round(take);
    remaining -= take;
  }
  if (remaining > 0) {
    allocated['Savings'] = (allocated['Savings'] || 0) + Math.round(remaining * 0.75);
    allocated['Debt Service'] = (allocated['Debt Service'] || 0) + Math.round(remaining * 0.2);
    allocated['Discretionary'] = (allocated['Discretionary'] || 0) + Math.round(remaining * 0.05);
  }

  return src.map((c) => {
    const currentBudgeted = Number(c?.budgeted) || 0;
    const fallbackBudgeted = allocated[c?.name] || 0;
    return { ...c, budgeted: currentBudgeted > 0 ? currentBudgeted : fallbackBudgeted };
  });
}
const nextPayrollDates = (payroll = {}, count = 4) => {
  const weekday = Number(payroll?.weekday ?? 2);
  const frequency = String(payroll?.frequency || 'WEEKLY').toUpperCase();
  if (frequency !== 'BIWEEKLY') return nextWeekdayDates(weekday, count);
  const first = nextWeekdayDates(weekday, 1)[0];
  if (!first) return [];
  const out = [new Date(first)];
  while (out.length < count) {
    const next = new Date(out[out.length - 1]);
    next.setDate(next.getDate() + 14);
    out.push(next);
  }
  return out;
};
const CURRENCY_SYMBOL = (() => { try { return (0).toLocaleString(undefined, { style: 'currency', currency: Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).resolvedOptions().currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d.,\s]/g, '').trim(); } catch { return '$'; } })();

// Stage calculation from live data
function calcStage(latest) {
  const debt = totalDebt(latest?.debts);
  const ef = latest?.eFund || {};
  const bal = ef.balance || 0;
  const monthly = monthlySpendBaseline(latest);
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = totalBudgetSpent(latest);

  // No meaningful data yet — stay at stage 0
  if (income === 0 && bal === 0 && debt === 0 && monthly === 0) return 0;

  // Stage 0: expenses exceed income or no buffer
  if (income > 0 && totalSpent > income) return 0;
  if (bal < 1000 && debt > 0) return 0;

  // Stage 1: $1K buffer exists
  if (bal >= 1000 && bal < monthly) return 1;

  // Stage 2: 6-month buffer (while debt exists)
  if (debt > 0 && bal >= monthly) return 2;

  // Stage 3: Debt Liberation — consumer debt = $0
  if (debt === 0 && bal < monthly * 6) return 3;
  if (debt === 0 && bal >= monthly * 6) return 4;

  // Default to 1 if we can't fully determine
  return 1;
}

const STAGE_META = [
  { name: 'Financial Chaos', mode: 'DEFENSE', color: 'danger' },
  { name: 'Financial Stability', mode: 'DEFENSE', color: 'warn' },
  { name: 'Financial Safety', mode: 'DEFENSE', color: 'warn' },
  { name: 'Debt Liberation', mode: 'LIBERATION', color: 'accent' },
  { name: 'Financial Security', mode: 'WEALTH', color: 'accent' },
  { name: 'Financial Independence', mode: 'WEALTH', color: 'accent' },
  { name: 'Financial Freedom', mode: 'WEALTH', color: 'accent' },
  { name: 'Legacy Wealth', mode: 'WEALTH', color: 'accent' },
];

// Velocity = (savings + debt principal paid) / income
function calcVelocity(latest) {
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  if (income <= 0) return 0;
  const savings = (latest?.budget?.categories || []).filter(c => c.name === 'Savings').reduce((s, c) => s + (c.actual || 0), 0);
  const debtPaid = (latest?.budget?.categories || []).filter(c => c.name === 'Debt Service').reduce((s, c) => s + (c.actual || 0), 0);
  return (savings + debtPaid) / income;
}

function deriveEnforcementState(latest) {
  const snapshot = latest || {};
  const stage = calcStage(snapshot);
  const velocity = calcVelocity(snapshot);
  const runway = runwayDaysFromLatest(snapshot);
  const income = snapshot?.budget?.income || snapshot?._meta?.income || 0;
  const debts = Array.isArray(snapshot?.debts) ? snapshot.debts : [];
  const hasConsumerDebt = debts.some((d) => (d?.balance || 0) > 0 && !(d?.totalTerms > 0));
  const hasPositions = (snapshot?.portfolio?.equities?.length || 0) > 0 || (snapshot?.portfolio?.crypto?.length || 0) > 0;
  const blownLifestyle = (snapshot?.budget?.categories || []).some((c) => c?.name === 'Discretionary' && (c?.budgeted || 0) > 0 && (c?.actual || 0) > (c?.budgeted || 0));

  if (hasConsumerDebt && hasPositions && stage <= 2) {
    return {
      code: 'DEBT_LIBERATION_PROTOCOL_ACTIVE',
      detail: 'STAGE_3_VERIFICATION_FAILED // INVESTMENT_LOGIC_LOCKED',
      summary: '[SYSTEM HALT] DEBT PRINCIPAL REMAINS UNVERIFIED. STAGE 3 GATE IS LOCKED.',
      action: 'ROUTE TO DEBT AVALANCHE',
      priority: 'critical',
    };
  }

  if (runway > 0 && runway < 30) {
    return {
      code: 'SYSTEM_RUNWAY_CRITICAL',
      detail: 'SURVIVAL_BUFFER_PROTECTION_ENABLED // NON_ESSENTIAL_OUTFLOW_GATED',
      summary: '[IMMUTABLE] EMERGENCY FUND IS MEASURED IN SURVIVAL DAYS. CURRENT RUNWAY IS BELOW 30 DAYS.',
      action: 'RETURN TO FORTRESS WALL',
      priority: 'danger',
    };
  }

  if (income > 0 && velocity < 0.10) {
    return {
      code: 'BUDGET_SLASH_ACTIVE',
      detail: 'VELOCITY_THRESHOLD_FAILED // LIFESTYLE_AUDIT_AUTHORIZED',
      summary: '[ALERT] FINANCIAL VELOCITY DROPPED BELOW 0.10. BUDGET SLASH PROTOCOL IS NOW ACTIVE.',
      action: 'EXECUTE BUDGET SLASH',
      priority: 'warning',
    };
  }

  if (blownLifestyle) {
    return {
      code: 'NON_ESSENTIAL_OUTFLOW_BLOCKED',
      detail: 'BUDGET_PERIMETER_BREACHED // DISCRETIONARY_OVERRUN',
      summary: '[WARNING] LIFESTYLE OUTFLOW EXCEEDED ITS ASSIGNED PERIMETER.',
      action: 'RETURN TO BUDGET HUD',
      priority: 'warning',
    };
  }

  return null;
}

function calcSavingsRate(latest) {
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  if (income <= 0) return 0;
  const totalSpent = totalBudgetSpent(latest);
  return ((income - totalSpent) / income) * 100;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

// Validate and sanitize date strings — reject garbage, default to today
function sanitizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString().slice(0, 10);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  // Reject dates more than 2 years old or in the future
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  if (d < twoYearsAgo || d > new Date(now.getTime() + 86400000)) return new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10);
}

function parseLooseJson(rawText) {
  let text = String(rawText || '').trim();
  if (!text) throw new Error('empty');

  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    text = text.slice(firstObj, lastObj + 1);
  } else if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    text = text.slice(firstArr, lastArr + 1);
  }

  // Allow common paste mistakes (trailing commas).
  text = text.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(text);
}

function nextAction(latest) {
  const debts = (latest?.debts || []).filter(d => !(d.totalTerms > 0)).sort((a, b) => (b.apr || 0) - (a.apr || 0));
  const ef = latest?.eFund || {};
  const bal = ef.balance || 0;
  const monthly = monthlySpendBaseline(latest);
  const di = dailyInterest(latest?.debts);

  // Priority 1: If daily burn > 0, call out the alpha target
  if (debts.length > 0 && di > 0) {
    return { type: 'debt', text: `Avalanche target: ${debts[0].name} (${debts[0].apr}% APR) — $${di.toFixed(2)}/day leaking`, color: 'danger' };
  }
  // Priority 2: E-fund milestones
  if (bal < 1000) {
    return { type: 'efund', text: `E-Fund Phase 1: ${fmt(1000 - bal)} to $1K starter fund`, color: 'warn' };
  }
  if (bal < monthly) {
    return { type: 'efund', text: `E-Fund Phase 2: ${fmt(monthly - bal)} to 1-month buffer`, color: 'warn' };
  }
  if (bal < monthly * 3) {
    return { type: 'efund', text: `E-Fund Phase 3: ${fmt(monthly * 3 - bal)} to 3-month buffer`, color: 'accent' };
  }
  return { type: 'ok', text: 'All primary targets on track — review weekly HUD', color: 'accent' };
}

// Monthly interest saved estimate (extra payments above minimums toward alpha target)
function interestSavedEstimate(debts) {
  if (!debts || debts.length === 0) return 0;
  const revolving = debts.filter(d => !(d.totalTerms > 0)).sort((a, b) => (b.apr || 0) - (a.apr || 0));
  if (revolving.length === 0) return 0;
  // Estimate: each $100 extra toward alpha target saves roughly (APR/100/12) * $100 per month in interest
  const alpha = revolving[0];
  const extraPayments = (alpha.minPayment || 0) * 0.3; // conservative estimate of extra contribution
  return extraPayments * ((alpha.apr || 0) / 100 / 12);
}

// ═══════════════════════════════════════════════════
// MACRO DATA — Delivered via morning brief, not dashboard
// ═══════════════════════════════════════════════════

function CurrencyInput({ value, onChange, placeholder, t, style = {} }) {
  const inp = { background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '8px 10px 8px 24px', width: '100%', outline: 'none', borderRadius: 2, boxSizing: 'border-box', ...style };
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: t.textDim, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>{CURRENCY_SYMBOL}</span>
      <input style={inp} value={value} onChange={onChange} placeholder={placeholder} type="text" inputMode="decimal"
        onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.borderDim} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════
// Primary: window.storage (if present in the host runtime)
// Fallback: localStorage (browser) with a Fortify namespace
const __hasWindowStorage = () => {
  try {
    return typeof window !== 'undefined' && window.storage &&
      typeof window.storage.get === 'function' &&
      typeof window.storage.set === 'function' &&
      (typeof window.storage.delete === 'function' || typeof window.storage.del === 'function');
  } catch { return false; }
};

const __lsKey = (k) => `fortify:${k}`;

const store = {
  async get(k) {
    try {
      if (__hasWindowStorage()) {
        const r = await window.storage.get(k);
        return r ? JSON.parse(r.value) : null;
      }
      const raw = localStorage.getItem(__lsKey(k));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  async set(k, v) {
    try {
      const s = JSON.stringify(v);
      if (__hasWindowStorage()) {
        await window.storage.set(k, s);
        return;
      }
      localStorage.setItem(__lsKey(k), s);
    } catch { }
  },
  async del(k) {
    try {
      if (__hasWindowStorage()) {
        const fn = window.storage.delete || window.storage.del;
        await fn.call(window.storage, k);
        return;
      }
      localStorage.removeItem(__lsKey(k));
    } catch { }
  },
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
    <div style={{ background: t.surface, border: `1px solid ${alert ? t.danger + '60' : t.borderDim}`, borderRadius: 4, padding: '16px 20px', animation: `fadeIn 0.4s ease-out ${delay}ms both`, borderLeft: alert ? `2px solid ${t.danger}` : `1px solid ${t.borderDim}`, transition: 'border-color 0.2s' }}
      onMouseEnter={e => { if (!alert) e.currentTarget.style.borderColor = t.borderMid; }}
      onMouseLeave={e => { if (!alert) e.currentTarget.style.borderColor = t.borderDim; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
        {alert && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.danger, boxShadow: `0 0 6px ${t.danger}` }} />}
      </div>
      {children}
    </div>
  );
}

const ChartTip = ({ active, payload, label, t }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: t.elevated, border: `1px solid ${t.borderMid}`, padding: '6px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: t.textPrimary }}>
    <div style={{ color: t.textSecondary, fontSize: 15, marginBottom: 2 }}>{label}</div><div>{fmt(payload[0].value)}</div>
  </div>);
};

function useMenuDismiss(menuOpen, setMenuOpen, menuRef) {
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, setMenuOpen, menuRef]);
}

function AppNavMenu({ t, isDark, menuOpen, setMenuOpen, menuRef, items, title = 'Menu' }) {
  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        title={title}
        aria-label={title}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X size={14} /> : <Menu size={14} />}
      </button>
      {menuOpen && (
        <div style={{
          position: 'absolute', left: 0, top: 42, zIndex: 120,
          minWidth: 200, padding: 8,
          background: isDark ? t.elevated : t.surface,
          border: `1px solid ${isDark ? t.borderMid : t.borderMid}`,
          borderRadius: 18,
          boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)' : '0 10px 24px rgba(0,0,0,0.16)',
        }}>
          {items.map((item) => {
            const Icon = item.icon;
            const isCurrent = !!item.current;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setMenuOpen(false);
                  item.onClick?.();
                }}
                disabled={!item.onClick}
                style={{
                  width: '100%',
                  background: isCurrent ? (isDark ? `${t.accent}18` : t.accentMuted) : 'none',
                  border: 'none',
                  color: isCurrent ? (item.color || t.accent) : (item.color || t.textSecondary),
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  padding: '10px 12px',
                  cursor: item.onClick ? 'pointer' : 'default',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 10,
                  opacity: item.onClick ? 1 : 0.8,
                }}
              >
                {Icon ? <Icon size={15} /> : <span style={{ fontSize: 16, lineHeight: 1 }}>₿</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefusalOverlay({ enforcement, onRoute }) {
  if (!enforcement) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'auto' }}>
      <div style={{ height: 34, background: 'repeating-linear-gradient(45deg, #ff0000, #ff0000 18px, #000000 18px, #000000 36px)' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px' }}>
        <div style={{ width: 'min(100%, 920px)', border: '1px solid rgba(255,0,0,0.55)', background: 'rgba(5,0,0,0.88)', padding: '22px 20px', boxShadow: '0 0 40px rgba(255,0,0,0.16)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#ff9a9a', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
            KNOX ENFORCEMENT // IMMUTABLE SAFETY RAIL
          </div>
          <div style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: 'clamp(74px, 15vw, 148px)', fontWeight: 700, lineHeight: 0.78, letterSpacing: '-0.09em', transform: 'scaleX(0.76)', transformOrigin: 'left center', color: '#ff0000', textTransform: 'uppercase', margin: '0 0 22px' }}>
            Refused
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: '#ff6767', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace" }}>
              Violation: {enforcement.code}
            </div>
            <div style={{ fontSize: 15, color: '#ffd9d9', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
              {enforcement.detail}
            </div>
            <div style={{ fontSize: 16, color: '#f5b4b4', lineHeight: 1.65, maxWidth: 760 }}>
              {enforcement.summary}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={onRoute}
              style={{ background: '#ff9900', color: '#000', border: '1px solid #ff9900', padding: '12px 18px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              {enforcement.action}
            </button>
            <span style={{ fontSize: 11, color: '#ff8080', textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: "'JetBrains Mono', monospace" }}>
              Operator override denied
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 34, background: 'repeating-linear-gradient(-45deg, #ff0000, #ff0000 18px, #000000 18px, #000000 36px)' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════
function LandingView({ t, onInitialize, onDocs, onToggleTheme, isDark, hasData, onDashboard, onMacroSentinel, onBitcoin, onSettings, latest }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const accent = t.accent;
  useMenuDismiss(menuOpen, setMenuOpen, menuRef);

  const currentStage = calcStage(latest || {});
  const stages = [
    { n: 0, name: 'Chaos' }, { n: 1, name: 'Stable' }, { n: 2, name: 'Safe' },
    { n: 3, name: 'Free' }, { n: 4, name: 'Secure' }, { n: 5, name: 'Independent' },
    { n: 6, name: 'Freedom' }, { n: 7, name: 'Legacy' },
  ];

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: null, current: true },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: onDashboard },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: onMacroSentinel },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: onDocs },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  const mono = "'JetBrains Mono', monospace";

  return (
    <div className="fo-home-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.void, color: t.textPrimary }}>
      <AppTopbar t={t} isDark={isDark} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} navItems={navItems} onToggleTheme={onToggleTheme} />

      {/* ═══ SECTION 01 — HERO ═══ */}
      <section className="fo-shared-section" style={{ padding: '72px 24px 64px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: t.panel, border: `1px solid ${t.borderDim}`, padding: '6px 12px', marginBottom: 28, fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.16em', fontFamily: mono }}>
            Local-first · Privacy-enforced · Debt-elimination protocol
          </div>
          <h1 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontWeight: 700, textTransform: 'uppercase', lineHeight: 0.88, letterSpacing: '-0.05em', marginBottom: 24, color: t.textPrimary, fontSize: 'clamp(44px, 9vw, 88px)' }}>
            Your finances.<br />Structured.<br /><span style={{ color: accent }}>Enforced.</span>
          </h1>
          <p style={{ fontSize: 17, color: t.textSecondary, maxWidth: 560, lineHeight: 1.75, marginBottom: 36, fontFamily: mono }}>
            Drop your bank statement. FORTIFY OS maps your debt, BNPL, bills, and cash flow — then tells you exactly what to do next. No accounts. No cloud sync. Your data stays on your machine.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {hasData ? (
              <>
                <button onClick={onDashboard} style={{ background: accent, color: isDark ? '#000' : '#fff', fontFamily: mono, fontWeight: 700, fontSize: 13, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Open Dashboard <ArrowRight size={15} />
                </button>
                <button onClick={onInitialize} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: mono, fontSize: 13, padding: '14px 28px', cursor: 'pointer', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Sync New Data
                </button>
              </>
            ) : (
              <>
                <button onClick={onInitialize} style={{ background: accent, color: isDark ? '#000' : '#fff', fontFamily: mono, fontWeight: 700, fontSize: 13, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Launch FORTIFY OS <ArrowRight size={15} />
                </button>
                <a href="https://github.com/fortifyos/fortifyos" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: 13, color: t.textSecondary, textDecoration: 'none', padding: '14px 0', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${t.borderDim}` }}>
                  Advanced? Download the repo →
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 02 — HOW IT WORKS ═══ */}
      <section className="fo-shared-section" style={{ padding: '64px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12, fontFamily: mono }}>How It Works</div>
          <h2 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, marginBottom: 36, color: t.textPrimary }}>Three steps. No setup required.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {[
              { num: '01', title: 'DROP YOUR CSV', desc: 'Export a statement from any bank. Drag it in. FORTIFY OS reads it — nothing is uploaded anywhere.', Icon: Upload },
              { num: '02', title: 'FILL THE GAPS', desc: 'Add debts, BNPL installments, and recurring bills manually. Takes five minutes. Full picture complete.', Icon: FileText },
              { num: '03', title: 'EXPORT YOUR SNAPSHOT', desc: 'Download your JSON snapshot. Lives on your machine. Bring it back any session. Nothing stored on our servers.', Icon: Lock },
            ].map((s, i) => (
              <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: accent }}>{s.num}</span>
                  <s.Icon size={15} style={{ color: t.textDim }} />
                </div>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, marginBottom: 8, color: t.textPrimary, letterSpacing: '0.06em' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: t.textDim, lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 03 — WHAT YOU GET ═══ */}
      <section className="fo-shared-section" style={{ padding: '64px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12, fontFamily: mono }}>What You Get</div>
          <h2 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, marginBottom: 36, color: t.textPrimary }}>Four outcomes. Not a feature list.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 2 }}>
            {[
              { label: 'CLARITY', desc: 'Every obligation visible in one place. Debt, BNPL countdowns, recurring bills, emergency runway — mapped and ranked.', Icon: LayoutGrid },
              { label: 'ENFORCEMENT', desc: "The system doesn't just track what happened. It tells you what should happen — and flags when you're off course.", Icon: ShieldAlert },
              { label: 'PRIVACY', desc: 'Your data never leaves your machine. No login. No account. No cloud sync. A JSON snapshot is the only thing that travels — and only when you export it.', Icon: Lock },
              { label: 'DIRECTION', desc: 'The 7 Stages framework shows exactly where you are in your financial journey and what actions are appropriate right now.', Icon: TrendingUp },
            ].map((c, i) => (
              <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 22, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <c.Icon size={18} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, marginBottom: 8, color: t.textPrimary, letterSpacing: '0.08em' }}>{c.label}</div>
                  <div style={{ fontSize: 14, color: t.textDim, lineHeight: 1.7 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 04 — TWO PATHS ═══ */}
      <section className="fo-shared-section" style={{ padding: '64px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12, fontFamily: mono }}>Two Paths</div>
          <h2 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, marginBottom: 36, color: t.textPrimary }}>Start now or go deep.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {/* Web User */}
            <div style={{ background: t.surface, border: `1px solid ${accent}40`, padding: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: accent, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>Web User — Start Now</div>
              <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.8, marginBottom: 24 }}>
                No setup. No install. No account.<br />
                Drop a CSV, fill in your data,<br />
                export your snapshot. Done.
              </div>
              <div style={{ fontSize: 12, color: t.textDim, fontFamily: mono, marginBottom: 24, borderLeft: `2px solid ${accent}`, paddingLeft: 12 }}>
                Your financial state lives in a JSON file on your machine. Nothing is stored here.
              </div>
              <button onClick={onInitialize} style={{ background: accent, color: isDark ? '#000' : '#fff', fontFamily: mono, fontWeight: 700, fontSize: 13, padding: '12px 24px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.1em', width: '100%', justifyContent: 'center' }}>
                Launch App <ArrowRight size={14} />
              </button>
            </div>
            {/* Advanced */}
            <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>Advanced — Self-Hosted</div>
              <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.8, marginBottom: 24 }}>
                Full local install. Persistent storage.<br />
                Complete KNOX protocol stack.<br />
                Private remote access via Tailscale.
              </div>
              <div style={{ fontSize: 12, color: t.textDim, fontFamily: mono, marginBottom: 24, borderLeft: `2px solid ${t.borderDim}`, paddingLeft: 12 }}>
                Clone the repo. Your data directory stays on your machine. Full Field Manual in the docs.
              </div>
              <a href="https://github.com/fortifyos/fortifyos" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: mono, fontSize: 13, padding: '12px 24px', cursor: 'pointer', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none', boxSizing: 'border-box' }}>
                View on GitHub <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 05 — FIELD MANUAL CTA ═══ */}
      <section style={{ padding: '64px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 16, fontFamily: mono }}>Field Manual</div>
          <h2 style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, marginBottom: 14, color: t.textPrimary }}>Want to understand the full system?</h2>
          <p style={{ fontSize: 15, color: t.textSecondary, lineHeight: 1.7, maxWidth: 480, marginBottom: 28 }}>
            The Field Manual covers every module, the 7 Stages framework, enforcement logic, privacy architecture, and the macro education layer.
          </p>
          <button onClick={onDocs} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: mono, fontWeight: 700, fontSize: 13, padding: '13px 28px', cursor: 'pointer', color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Read the Field Manual <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `1px solid ${t.borderDim}` }}>
        {[
          { label: 'Privacy', val: 'Local browser storage', Icon: Lock },
          { label: 'Daily time', val: '2–5 minutes', Icon: Clock },
          { label: 'Setup', val: 'Zero install required', Icon: Zap },
        ].map((s, i) => (
          <div key={i} style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderRight: i < 2 ? `1px solid ${t.borderDim}` : 'none' }}>
            <s.Icon size={18} style={{ color: accent, marginBottom: 4 }} />
            <span style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: mono }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, fontFamily: mono }}>{s.val}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DOCUMENTATION VIEW
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// DOCUMENTATION VIEW — TWO-TRACK FIELD MANUAL
// ═══════════════════════════════════════════════════
function DocsView({ t, isDark, onBack, onToggleTheme, onDashboard, onMacroSentinel, onBitcoin, onSettings }) {
  const [track, setTrack] = useState(() => localStorage.getItem('fm_track') || 'web');
  const [activeSection, setActiveSection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const accent = t.accent;
  useMenuDismiss(menuOpen, setMenuOpen, menuRef);

  const setTrackPersist = (v) => { setTrack(v); localStorage.setItem('fm_track', v); setActiveSection(null); };

  const mono = "'JetBrains Mono', monospace";

  const sty = {
    container: { maxWidth: 780, margin: '0 auto', padding: '32px 24px 80px' },
    h2: { fontFamily: mono, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: accent, marginTop: 48, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${t.borderDim}` },
    h3: { fontFamily: mono, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textPrimary, marginTop: 24, marginBottom: 8 },
    p: { fontSize: 15, color: t.textSecondary, marginBottom: 14, lineHeight: 1.75 },
    note: (c) => ({ borderLeft: `2px solid ${c || accent}`, padding: '10px 14px', color: t.textSecondary, margin: '16px 0', background: t.surface, fontSize: 14, lineHeight: 1.7 }),
    formula: { background: t.surface, border: `1px solid ${t.borderDim}`, padding: '14px 18px', margin: '14px 0', textAlign: 'center', fontSize: 14, color: accent, fontFamily: mono },
    th: { border: `1px solid ${t.borderDim}`, padding: '8px 12px', textAlign: 'left', fontSize: 13, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', background: t.surface, fontFamily: mono },
    td: { border: `1px solid ${t.borderDim}`, padding: '8px 12px', fontSize: 14, color: t.textSecondary },
    code: { background: t.surface, color: accent, padding: '2px 6px', border: `1px solid ${t.borderDim}`, fontSize: 13, fontFamily: mono },
    pre: { background: t.surface, padding: '14px 18px', border: `1px solid ${t.borderDim}`, overflow: 'auto', color: accent, fontSize: 13, lineHeight: 1.6, margin: '14px 0', fontFamily: mono },
  };

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onBack },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: onDashboard },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: onMacroSentinel },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: null, current: true },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  const Code = ({ children }) => <code style={sty.code}>{children}</code>;

  const WEB_SECTIONS = [
    {
      id: 'gs', num: '01', label: 'Getting Started',
      content: () => (
        <>
          <p style={sty.p}>FORTIFY OS requires no installation and no account. Everything runs in this browser session. Your data never leaves your machine — the only artifact you produce is a JSON snapshot you explicitly export.</p>
          <div style={sty.h3}>Step 1 — Import your CSV</div>
          <p style={sty.p}>Export a bank statement from your financial institution as a CSV file. Most major banks support this. Click <strong>Import Statements / Snapshots</strong> from the Settings panel or the sync button on the dashboard. FORTIFY OS auto-detects the bank format by reading the column headers.</p>
          <div style={sty.note(accent)}>Supported formats: Chase, BofA, Amex, Capital One, Wells Fargo, Citi. Any other CSV with date/description/amount columns will also parse.</div>
          <div style={sty.h3}>Step 2 — Fill in the gaps manually</div>
          <p style={sty.p}>CSV imports handle transactions. Debts, BNPL installments, and recurring bills need to be added manually. Navigate to each module on the dashboard and enter your current balances, APR, due dates, and payment amounts. This takes approximately five minutes for a typical financial picture.</p>
          <div style={sty.h3}>Step 3 — Export your snapshot</div>
          <p style={sty.p}>When your session is complete, use <strong>Export All Snapshots</strong> in Settings to download a JSON file. This file contains your complete financial state. On your next session, import it to restore everything exactly where you left it. The file lives on your machine — not on any server.</p>
          <div style={sty.note(t.warn)}>Privacy note: Your JSON snapshot contains real financial data. Store it in a secure location on your device. Do not upload it to cloud storage without reviewing its contents first.</div>
        </>
      )
    },
    {
      id: 'stages', num: '02', label: 'The 7 Stages',
      content: () => (
        <>
          <p style={sty.p}>FORTIFY OS maps your entire financial life onto a 7-stage journey — from chaos to generational wealth. Your current stage is calculated from live data, not assigned as a static label. The system gates what actions are available at each stage, which prevents the most common wealth-building mistake: investing while carrying high-interest debt.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead>
              <tr>
                <th style={sty.th}>Stage</th>
                <th style={sty.th}>Name</th>
                <th style={sty.th}>Gate — How You Advance</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['0', 'Financial Chaos', 'Expenses exceed income — stabilize cash flow'],
                ['1', 'Financial Stability', '1-month expense buffer built'],
                ['2', 'Financial Safety', '6-month buffer, fully liquid'],
                ['3', 'Debt Liberation', 'Consumer debt = $0 (investment strategies unlock here)'],
                ['4', 'Financial Security', 'Passive income covers basic needs'],
                ['5', 'Financial Independence', 'Passive income covers current lifestyle'],
                ['6', 'Financial Freedom', 'Passive income covers dream lifestyle'],
                ['7', 'Legacy Wealth', 'Generational impact / philanthropy'],
              ].map(([s, n, g]) => (
                <tr key={s}>
                  <td style={{ ...sty.td, fontFamily: mono, fontWeight: 700, color: Number(s) < 3 ? t.warn : accent }}>{s}</td>
                  <td style={{ ...sty.td, fontWeight: 700 }}>{n}</td>
                  <td style={sty.td}>{g}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={sty.note(t.danger)}>Defense Mode: Most users enter at Stage 0 or 1. The system enforces Defense Mode (Stages 0–3) — all investment logic is locked until Stage 3 is mathematically verified from your live data. This is a feature, not a limitation.</div>
        </>
      )
    },
    {
      id: 'dashboard', num: '03', label: 'Your Dashboard',
      content: () => (
        <>
          <p style={sty.p}>The dashboard is your financial command center. Every module is togglable from Settings — enable only what's relevant to your current situation. Modules feed each other: debt data informs the Daily Directive, emergency fund status informs runway, BNPL countdowns surface in the Bill Calendar.</p>
          <div style={sty.h3}>Daily Directive</div>
          <p style={sty.p}>Your single highest-priority action, calculated fresh each session from live data. Not a generic tip — a specific instruction based on your actual stage, velocity, and outstanding obligations.</p>
          <div style={sty.h3}>Agent KNOX Terminal</div>
          <p style={sty.p}>KNOX monitors your financial behavior against protocol rules. It generates a mission briefing each session, flags Never List violations, and issues enforcement alerts when your behavior drifts off-protocol. KNOX does not make decisions — it surfaces information and flags problems before they compound.</p>
          <div style={sty.h3}>Net Worth</div>
          <p style={sty.p}>Total assets minus total liabilities, tracked over time. The direction of movement matters more than the absolute number. A net worth trending toward zero is an emergency signal; a net worth trending upward — even slowly — confirms the system is working.</p>
          <div style={sty.h3}>Bills & Payday Planner</div>
          <p style={sty.p}>Every recurring obligation mapped against your pay cycle. Shows what is due before your next paycheck, what can wait, and what is at risk of being missed. Feeds into the monthly Bill Calendar view.</p>
        </>
      )
    },
    {
      id: 'debt', num: '04', label: 'Debt + BNPL',
      content: () => (
        <>
          <p style={sty.p}>Debt and BNPL (Buy Now Pay Later) are tracked separately because they behave differently. Traditional debt has APR and compounds. BNPL has installments and deadlines. Both create obligations — the system treats them with different logic.</p>
          <div style={sty.h3}>Debt Destruction module</div>
          <p style={sty.p}>All debts ranked by APR — highest first. This is the avalanche method: eliminate the highest-cost debt first to minimize total interest paid. The module shows daily interest burn on each debt so the cost of inaction is always visible.</p>
          <div style={sty.formula}>Daily Interest = (Balance × APR) / 365</div>
          <div style={sty.h3}>BNPL tracking</div>
          <p style={sty.p}>BNPL installments are entered manually with the remaining payment count and due dates. The system tracks countdown to payoff, total remaining obligation, and surfaces BNPL payments in the Bill Calendar so they don't get missed. BNPL used for consumables or depreciating assets is a Never List violation.</p>
          <div style={sty.note(t.danger)}>Never List violation: BNPL for consumables (food, gas, subscriptions) triggers an immediate enforcement alert. This is a hard stop, not a soft warning.</div>
        </>
      )
    },
    {
      id: 'efund', num: '05', label: 'Emergency Fund',
      content: () => (
        <>
          <p style={sty.p}>The emergency fund is measured in days of survival, not raw dollars. This forces evaluation through the lens of time: not "I have $3,000 saved" but "I have 30 days before system failure."</p>
          <div style={sty.formula}>Runway Days = (E-Fund Balance / Monthly Expenses) × 30</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Phase</th><th style={sty.th}>Target</th><th style={sty.th}>Purpose</th>
            </tr></thead>
            <tbody>
              {[
                ['1', '$1,000', 'Initial containment — prevents debt spiral from minor emergencies'],
                ['2', '1× Monthly', 'Baseline shield — one month of breathing room'],
                ['3', '3× Monthly', 'Stability buffer — covers job loss or medical event'],
                ['4', '6× Monthly', 'Full fortress — complete financial resilience'],
              ].map(([p, t2, d]) => (
                <tr key={p}><td style={{ ...sty.td, fontFamily: mono, fontWeight: 700 }}>{p}</td><td style={sty.td}>{t2}</td><td style={sty.td}>{d}</td></tr>
              ))}
            </tbody>
          </table>
          <p style={sty.p}>Runway color thresholds: Red (below 30 days) · Amber (30–59 days) · Green (60+ days). The dashboard E-Fund module displays your current runway status and phase progress.</p>
        </>
      )
    },
    {
      id: 'enforcement', num: '06', label: 'Enforcement Engine',
      content: () => (
        <>
          <p style={sty.p}>This is the core differentiator. Other tools track what happened. FORTIFY OS enforces what should happen — and blocks what shouldn't. Three enforcement layers work together to prevent financial mistakes before they occur.</p>
          <div style={sty.h3}>Financial Velocity</div>
          <div style={sty.formula}>V = (Monthly Savings + Debt Principal Paid) / Total Net Income</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Velocity</th><th style={sty.th}>Status</th><th style={sty.th}>System Response</th>
            </tr></thead>
            <tbody>
              {[
                ['V ≥ 0.25', 'On Track', '25+ cents of every dollar moving you forward'],
                ['V 0.10–0.20', 'Alert', 'Diagnosis before enforcement — identify root cause'],
                ['V < 0.10', 'Crisis', 'Emergency protocols activate, Budget Slash fires'],
              ].map(([v, s, r]) => (
                <tr key={v}><td style={{ ...sty.td, fontFamily: mono }}>{v}</td><td style={sty.td}>{s}</td><td style={sty.td}>{r}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={sty.h3}>The Never List</div>
          <p style={sty.p}>Hard stops. These trigger an immediate halt if detected:</p>
          {['BNPL used for consumables or depreciating assets', 'Minimum-only payments on high-APR debt', 'Subscriptions exceeding 2% of monthly net income', 'Purchases over $200 without 24-hour cooling-off period', 'Investment activity while consumer debt exists', 'Untracked Cash App outflow (categorized Lifestyle by default)'].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${t.borderDim}`, fontSize: 14, color: t.textSecondary }}>
              <span style={{ color: t.danger, fontFamily: mono, flexShrink: 0 }}>✗</span>
              <span>{item}</span>
            </div>
          ))}
          <div style={{ ...sty.note(t.warn), marginTop: 16 }}>Budget Slash targets Lifestyle spending only. Essential and Medical categories are permanently exempt. No override authority.</div>
        </>
      )
    },
    {
      id: 'privacy', num: '07', label: 'Privacy',
      content: () => (
        <>
          <p style={sty.p}>FORTIFY OS is built on a single privacy principle: your financial data never leaves your machine unless you explicitly export it. This is not a marketing claim — it is the architecture.</p>
          <div style={sty.h3}>What lives where</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Layer</th><th style={sty.th}>Location</th><th style={sty.th}>Contains</th>
            </tr></thead>
            <tbody>
              {[
                ['Layer 1', 'This web app (session)', 'Processing logic, enforcement rules — zero financial data stored'],
                ['Layer 2', 'Your browser session', 'Live data you input this session — cleared when session ends'],
                ['Layer 3', 'Your machine (exported)', 'JSON snapshot — only exists after you explicitly export it'],
              ].map(([l, loc, c]) => (
                <tr key={l}><td style={{ ...sty.td, fontFamily: mono, fontWeight: 700 }}>{l}</td><td style={sty.td}>{loc}</td><td style={sty.td}>{c}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={sty.h3}>Sentinel auto-redaction</div>
          <p style={sty.p}>All data processed through FORTIFY OS passes through the Sentinel filter first. Card numbers are masked to last 4 digits. SSNs are fully masked. Routing numbers are fully redacted. Physical addresses are fully redacted. This is automatic — you do not need to remember to redact anything.</p>
          <div style={sty.note(accent)}>Your JSON snapshot contains real financial data after export. Store it in a secure location on your device. Do not sync it to cloud storage without reviewing its contents.</div>
        </>
      )
    },
    {
      id: 'macro', num: '08', label: 'Macro Layer',
      content: () => (
        <>
          <p style={sty.p}>The Radar intelligence layer exists to connect your personal financial decisions to the broader economic environment. This is not entertainment. It is behavioral context — understanding why discipline matters more during certain market conditions.</p>
          <div style={sty.h3}>What the Radar market feed shows</div>
          <p style={sty.p}>Net Liquidity (WALCL − TGA − RRP), FedWatch rate cut probabilities, yield curve status, and real-time signal board with six macro indicators. Each indicator is scored and assigned a direction. The system synthesizes these into an Operator Posture: Defensive, Neutral, or Aggressive.</p>
          <div style={sty.h3}>Fed Flight School</div>
          <p style={sty.p}>An educational layer that explains how Federal Reserve balance sheet movements, liquidity cycles, and rate decisions affect asset prices and personal financial risk. Understanding why the system says "reduce duration exposure" requires understanding how the Fed operates. Fed Flight School provides that context without requiring a finance degree.</p>
          <div style={sty.note(t.warn)}>Macro data is for educational context only. FORTIFY OS is not providing investment, tax, or legal advice. All investment logic remains locked until Stage 3 regardless of macro conditions.</div>
        </>
      )
    },
  ];

  const ADVANCED_EXTRA_SECTIONS = [
    {
      id: 'install', num: '09', label: 'Installation',
      content: () => (
        <>
          <p style={sty.p}>The self-hosted installation runs FORTIFY OS locally as a Vite/React app. Today, the public repo is a frontend-first install: local browser storage, local static assets, and optional private access layered on later if you choose to add it.</p>
          <div style={sty.h3}>Prerequisites</div>
          {['Node.js (v18+)', 'Git'].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 14, color: t.textSecondary }}>
              <span style={{ color: accent, fontFamily: mono }}>→</span><span>{item}</span>
            </div>
          ))}
          <div style={sty.h3}>Setup (Mac / Linux)</div>
          <pre style={sty.pre}>{`# 1. Clone the repository
git clone https://github.com/fortifyos/fortifyos.git
cd fortifyos

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev

# 4. Build a production bundle (optional)
npm run build

# 5. Preview the production bundle locally (optional)
npm run preview`}</pre>
          <div style={sty.h3}>Setup (Windows)</div>
          <pre style={sty.pre}>{`# 1. Install Node.js from nodejs.org
# 2. Install Git
# 3. Open PowerShell

git clone https://github.com/fortifyos/fortifyos.git
cd fortifyos
npm install
npm run dev`}</pre>
          <div style={sty.note(t.warn)}>Reality check: the public repo does not currently require Python, Claude Code, or any custom machine-specific folder structure to boot. Private remote access such as Tailscale is optional deployment infrastructure, not part of the base install.</div>
          <div style={sty.note(accent)}>Advanced users can also run FORTIFY OS as the frontend shell on top of a separate local backend such as <span style={{ fontFamily: mono }}>treasury-system</span>. In that model, Fortify stays the UI while a local engine owns the database, data/ directories, imports, exports, and optional local LLM helpers.</div>
        </>
      )
    },
    {
      id: 'architecture', num: '10', label: 'File Architecture',
      content: () => (
        <>
          <p style={sty.p}>The public repo is currently organized as a web application plus supporting assets, docs, and scripts. The privacy boundary today is simpler than the older doctrine docs: source code lives in the repo, runtime state lives in the browser, and any future local data directories or backend services are optional layers you add deliberately.</p>
          <pre style={sty.pre}>{`fortifyos/
├── src/                     ← React application source
│   ├── App.jsx              ← Main shell, landing, dashboard, docs, routing
│   ├── pages/               ← Large top-level views (Bitcoin)
│   ├── components/          ← Shared UI components
│   ├── db/                  ← Local browser vault / state logic
│   ├── security/            ← Sovereign wrapper and access controls
│   ├── crypto/              ← Local crypto helpers
│   └── agents/              ← Agent-facing interfaces
├── public/                  ← Static assets and publishable data
│   ├── macro-intel/        ← Generated macro feed data used by Radar
│   ├── macro-sentinel/
│   ├── radar/
│   └── tessdata/
├── app/macro/               ← Macro engine content and jobs
├── docs/                    ← Product and support documents
├── scripts/                 ← Utility and maintenance scripts
├── FORTIFY/knox/            ← Limited Knox-related assets, not a full install layer
├── package.json             ← Install, dev, build, deploy commands
└── README.md                ← Generic setup and deployment guidance`}</pre>
          <div style={{ ...sty.note(accent), marginTop: 16 }}>
            <strong>Reality check:</strong> do not document a 20-file cloud KNOX package or 4 generated local CSV registries unless those files are actually shipped and supported in the repo a user clones.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Layer</th><th style={sty.th}>Location</th><th style={sty.th}>Contains</th>
            </tr></thead>
            <tbody>
              {[
                ['Layer 1', 'GitHub Repo / Local Clone', 'Application code, static assets, docs, scripts, and optional Knox-related assets.'],
                ['Layer 2', 'Browser Storage', 'Session state, local vault data, snapshots, and client-side settings.'],
                ['Layer 3', 'Optional Extensions', 'Private remote access, backend integrations, or future local data pipelines you choose to add.'],
              ].map(([l, loc, c]) => (
                <tr key={l}><td style={{ ...sty.td, fontFamily: mono, fontWeight: 700 }}>{l}</td><td style={sty.td}>{loc}</td><td style={sty.td}>{c}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={sty.h3}>Optional hybrid local stack</div>
          <pre style={sty.pre}>{`treasury-system/
├── data/
│   ├── raw/                 ← bank CSVs, credit card files, PDFs
│   ├── manual_snapshot/     ← seed finance snapshot
│   ├── manual_bnpl/         ← hand-maintained BNPL records
│   └── processed/           ← normalized transaction outputs
├── database/                ← local SQLite source of truth
├── exports/                 ← calendar, reports, sanitized outputs
└── llm/                     ← local-only AI helpers for categorization/explanations`}</pre>
          <div style={sty.note(t.warn)}>If you document the advanced setup, make it clear that this hybrid model is optional. A user can run the public Fortify frontend by itself, or pair it with a separate local finance engine that owns structured data folders, SQLite, and local LLM helpers.</div>
        </>
      )
    },
    {
      id: 'knox', num: '11', label: 'KNOX Protocol Stack',
      content: () => (
        <>
          <p style={sty.p}>KNOX (Knowledge Nexus Operations eXecution) is the 24-file skill package that gives the system a persistent financial identity, enforcement logic, and data processing capability. It runs inside the Claude AI environment through the Claude Project.</p>
          <div style={sty.h3}>How KNOX works</div>
          <p style={sty.p}>When you open the FORTIFY OS Claude Project, KNOX loads automatically from the 20 .md files you have uploaded. These files contain rules, formulas, enforcement protocols, and behavioral logic — but zero personal financial data. Your data is submitted per session through the CSV import or manual entry flows and processed in real time.</p>
          <div style={sty.h3}>Enforcement layers</div>
          {[
            ['Pre-execution validation', 'Stage check → alignment check → velocity check. All three must pass before any action proceeds.'],
            ['The Never List', 'Hard stops for six categories of financial behavior. Immediate halt on detection — no override.'],
            ['Budget Slash Protocol', 'Fires automatically when Velocity < 0.20 or cash flow projects a deficit. Targets Lifestyle only.'],
          ].map(([title, desc], i) => (
            <div key={i} style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 14, marginBottom: 14 }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 14, color: t.textSecondary }}>{desc}</div>
            </div>
          ))}
        </>
      )
    },
    {
      id: 'ingestion', num: '12', label: 'Data Ingestion',
      content: () => (
        <>
          <p style={sty.p}>The self-hosted installation supports three ingestion paths for financial data, prioritized by fidelity.</p>
          <div style={sty.h3}>CSV import (primary)</div>
          <p style={sty.p}>Drop a .csv bank export. FORTIFY OS auto-detects Chase, BofA, Amex, Capital One, Wells Fargo, and Citi via header fingerprinting. Any CSV with recognizable date/description/amount columns will parse. The fingerprinting matches column header patterns — no account numbers or routing data used for identification.</p>
          <div style={sty.h3}>Document risk tiers</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Document</th><th style={sty.th}>Sensitivity</th><th style={sty.th}>Recommended Method</th>
            </tr></thead>
            <tbody>
              {[
                ['Bank screenshots', 'Low', 'Browser or Claude Code'],
                ['Credit card statements', 'Medium', 'Claude Code recommended'],
                ['Pay stubs', 'High (contains SSN)', 'Claude Code only'],
                ['Tax documents (W-2, 1099)', 'Critical', 'Claude Code only — never cloud'],
              ].map(([d, s, r]) => (
                <tr key={d}><td style={sty.td}>{d}</td><td style={{ ...sty.td, color: s === 'Critical' ? t.danger : s === 'High (contains SSN)' ? t.warn : t.textSecondary }}>{s}</td><td style={sty.td}>{r}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )
    },
    {
      id: 'sentinel', num: '13', label: 'Sentinel Redaction',
      content: () => (
        <>
          <p style={sty.p}>All data ingested via CSV or file import passes through the Sentinel filter before processing. This is automatic — you do not need to remember to redact anything. Sentinel fires first, every time.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead><tr>
              <th style={sty.th}>Pattern</th><th style={sty.th}>Action</th><th style={sty.th}>Example</th>
            </tr></thead>
            <tbody>
              {[
                ['Card numbers', 'Mask to last 4', 'XXXX-XXXX-XXXX-1234'],
                ['SSNs', 'Full mask', 'XXX-XX-****'],
                ['Routing numbers', 'Full redact', '[REDACTED]'],
                ['Physical address', 'Full redact', '[REDACTED]'],
              ].map(([p, a, e]) => (
                <tr key={p}><td style={sty.td}>{p}</td><td style={{ ...sty.td, fontFamily: mono }}>{a}</td><td style={{ ...sty.td, fontFamily: mono, color: accent }}>{e}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )
    },
    {
      id: 'remote', num: '14', label: 'Remote Access',
      content: () => (
        <>
          <p style={sty.p}>The self-hosted installation can be accessed privately from your phone through a secure private networking layer such as Tailscale. This does not expose the system to the public internet — it creates an encrypted tunnel between your devices on a private network.</p>
          <div style={sty.h3}>What this enables</div>
          <p style={sty.p}>Full dashboard access from your phone. Morning Pulse checks without being at your desk. KNOX briefings on the go. Bill Calendar review at any time. Everything runs from your local machine — your phone is just a remote display.</p>
          <div style={sty.note(t.warn)}>Tailscale remote access is optional. The system operates fully without it. Setup instructions are in the GitHub repository README.</div>
        </>
      )
    },
    {
      id: 'bitcoin', num: '15', label: 'Bitcoin Layer',
      content: () => (
        <>
          <p style={sty.p}>Bitcoin is part of the FORTIFY OS long-term framework, but it is not the entry point. The system's philosophy explicitly rejects premature investing when the financial foundation is weak. Bitcoin belongs in the appropriate stage of the journey.</p>
          <div style={sty.note(t.danger)}>Bitcoin content and the Sovereign Standard are locked until Stage 3 (Debt Liberation). If you are carrying consumer debt, you are in the wrong section. Return when Stage 3 is mathematically verified.</div>
          <div style={sty.h3}>The Sovereign Standard</div>
          <p style={sty.p}>1 BTC = 1 / 21,000,000th of future global wealth. The Sovereign Standard module presents Bitcoin as a rules-based savings technology with a hard supply cap enforced by global consensus — not as speculation. The Conviction Engine within the module tracks cycle position using the 500-day halving window.</p>
          <div style={sty.h3}>Correct positioning</div>
          <p style={sty.p}>Bitcoin is not used to avoid debt cleanup. Bitcoin is not the first move. Bitcoin belongs in the advanced strategic layer after foundational stages are met. The Citadel Protocol covers exit counterparties, hardware vault setup, and independent verification — for operators who have earned the right to be here.</p>
        </>
      )
    },
  ];

  const allSections = track === 'web' ? WEB_SECTIONS : [...WEB_SECTIONS, ...ADVANCED_EXTRA_SECTIONS];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.void, color: t.textPrimary }}>
      <AppTopbar t={t} isDark={isDark} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} navItems={navItems} onToggleTheme={onToggleTheme} />

      {/* Track switcher */}
      <div className="docs-track-switcher fo-page-shell-panel" style={{ position: 'sticky', top: 0, zIndex: 40, background: isDark ? `linear-gradient(180deg, ${t.surface} 0%, ${t.panel} 100%)` : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`, border: `1px solid ${t.borderDim}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', maxWidth: 780, width: 'calc(100% - 48px)', margin: '0 auto' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.16em' }}>Field Manual</div>
        <div className="docs-track-buttons" style={{ display: 'flex', gap: 2 }}>
          {[{ key: 'web', label: 'Web User' }, { key: 'advanced', label: 'Advanced / Self-Hosted' }].map(opt => (
            <button key={opt.key} onClick={() => setTrackPersist(opt.key)} style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, padding: '7px 16px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', border: `1px solid ${track === opt.key ? accent : t.borderDim}`, background: track === opt.key ? `${accent}18` : 'none', color: track === opt.key ? accent : t.textDim, transition: 'all 0.18s' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fo-page-shell" style={sty.container}>
        {/* Header */}
        <div className="fo-page-hero" style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>
            {track === 'web' ? 'Web User Track — No setup required' : 'Advanced Track — Self-hosted installation'}
          </div>
          <h1 style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: t.textPrimary, marginBottom: 12 }}>FORTIFY OS Field Manual</h1>
          <p style={{ fontSize: 15, color: t.textSecondary, lineHeight: 1.7, maxWidth: 580 }}>
            {track === 'web'
              ? 'Everything you need to operate FORTIFY OS through the browser. No installation. No terminal commands. Drop your data, run the system, export your snapshot.'
              : 'Full technical documentation for the self-hosted installation. Covers the complete KNOX stack, file architecture, data ingestion, Sentinel redaction, and remote access setup.'}
          </p>
          {track === 'web' && (
            <div style={{ marginTop: 14, fontSize: 13, color: t.textDim, fontFamily: mono }}>
              Advanced user? <button onClick={() => setTrackPersist('advanced')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontFamily: mono, fontSize: 13, textDecoration: 'underline', padding: 0 }}>Switch to the Advanced track →</button>
            </div>
          )}
        </div>

        {/* Section list */}
        {allSections.map((section) => (
          <div key={section.id} id={`doc-${section.id}`} style={{ marginBottom: 10 }}>
            <button
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
              className="fo-page-section-toggle"
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: isDark ? `linear-gradient(180deg, ${t.surface} 0%, ${t.panel} 100%)` : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`, border: `1px solid ${activeSection === section.id ? accent : t.borderDim}`, cursor: 'pointer', textAlign: 'left', fontFamily: mono, transition: 'all 0.18s' }}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: accent, letterSpacing: '0.12em' }}>{section.num}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.label}</span>
              </div>
              <ChevronDown size={14} style={{ color: t.textDim, transform: activeSection === section.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>
            {activeSection === section.id && (
              <div className="fo-page-section-body" style={{ padding: '24px 18px 28px', background: isDark ? `linear-gradient(180deg, ${t.panel} 0%, ${t.surface} 100%)` : `linear-gradient(180deg, ${t.elevated} 0%, ${t.surface} 100%)`, border: `1px solid ${accent}`, borderTop: 'none' }}>
                {section.content()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UniversalSync({ open, onClose, onSync, t, isDark }) {
  const [tab, setTab] = useState('statement');
  const [logs, setLogs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const fileRef = useRef();

  // Statement upload state (PDF / screenshots)
  const [stmtFile, setStmtFile] = useState(null);
  const [stmtRawText, setStmtRawText] = useState('');
  const [stmtText, setStmtText] = useState('');
  const [stmtTxns, setStmtTxns] = useState([]);
  const [showLowConfidence, setShowLowConfidence] = useState(true);
  const [reviewLowConfidence, setReviewLowConfidence] = useState(false);
  const [reviewCursor, setReviewCursor] = useState(0);
  const [reviewedLowIndices, setReviewedLowIndices] = useState([]);
  const [stmtTemplateLabel, setStmtTemplateLabel] = useState('');
  const [stmtReconSummary, setStmtReconSummary] = useState(null);
  const [stmtPickMode, setStmtPickMode] = useState('replace');
  const [merchantRules, setMerchantRules] = useState([]);
  const [stmtBankName, setStmtBankName] = useState('Statement Upload');
  const [csvBlobUrl, setCsvBlobUrl] = useState('');
  const stmtFileRef = useRef();
  const ocrWorkerRef = useRef(null);
  const btn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: t.void,
    border: `1px solid ${t.accentDim}`,
    color: t.accent,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 15,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderRadius: 4,
  };
  const btnGhost = {
    background: 'none',
    border: `1px solid ${t.borderDim}`,
    color: t.textSecondary,
    cursor: 'pointer',
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
  };
  const link = {
    color: t.accent,
    textDecoration: 'none',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: `1px solid ${t.borderDim}`,
    padding: '8px 10px',
    borderRadius: 4,
    background: t.void,
  };
  const assetBase = import.meta.env.BASE_URL || '/';


  // JSON paste state
  const [json, setJson] = useState('');
  const [jsonValidating, setJsonValidating] = useState(false);

  // Guided state
  const [gCheck, setGCheck] = useState(''); const [gSavings, setGSavings] = useState(''); const [gEF, setGEF] = useState(''); const [gOther, setGOther] = useState('');
  const [gDebts, setGDebts] = useState([{ name: '', apr: '', balance: '', minPayment: '', type: 'REVOLVING', totalTerms: '', paymentsMade: '', monthlyPayment: '', dueDate: '' }]);
  const [gBills, setGBills] = useState([{ name: '', amount: '', dueDay: '', autopay: true }]);
  const [gPaydayWeekday, setGPaydayWeekday] = useState('2');
  const [gBudget, setGBudget] = useState([
    { name: 'Essential', budgeted: '', actual: '' },
    { name: 'Discretionary', budgeted: '', actual: '' },
    { name: 'Medical', budgeted: '', actual: '' },
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
  const [gCrypto, setGCrypto] = useState([{ coin: '', amount: '', avgCost: '', lastPrice: '' }]);
  const upEquity = (i, f, v) => { const e = [...gEquities]; e[i][f] = v; setGEquities(e); };
  const upOption = (i, f, v) => { const o = [...gOptions]; o[i][f] = v; setGOptions(o); };
  const upCrypto = (i, f, v) => { const c = [...gCrypto]; c[i][f] = v; setGCrypto(c); };
  const upBill = (i, f, v) => { const b = [...gBills]; b[i][f] = v; setGBills(b); };
  const addBill = () => setGBills([...gBills, { name: '', amount: '', dueDay: '', autopay: true }]);
  const addEquity = () => setGEquities([...gEquities, { ticker: '', shares: '', avgCost: '', lastPrice: '' }]);
  const addOption = () => setGOptions([...gOptions, { ticker: '', type: 'CALL', contracts: '', strikePrice: '', expDate: '', lastPrice: '' }]);
  const addCrypto = () => setGCrypto([...gCrypto, { coin: '', amount: '', avgCost: '', lastPrice: '' }]);

  // Income state
  const [gIncome, setGIncome] = useState('');

  // Macro state
  const [gBenner, setGBenner] = useState('B-Year (Sell)');

  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current?.terminate) {
        ocrWorkerRef.current.terminate().catch(() => { });
      }
      ocrWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await store.get('fortify-merchant-rules');
      if (!mounted || !Array.isArray(saved)) return;
      setMerchantRules(saved.filter(r => r?.key && r?.category));
    })();
    return () => { mounted = false; };
  }, []);

  const persistMerchantRules = useCallback(async (nextRules) => {
    setMerchantRules(nextRules);
    await store.set('fortify-merchant-rules', nextRules);
  }, []);

  const log = (msg) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 8));

  const identifyBank = (headers) => {
    for (const [key, sig] of Object.entries(BANK_SIGNATURES)) {
      if (sig.detect(headers)) return { key, ...sig };
    }
    return null;
  };

  const learnMerchantRule = useCallback(async (description, category) => {
    const nextCategory = String(category || '').trim();
    if (!nextCategory || nextCategory === 'Uncategorized') return;
    const key = merchantKeyFromDescription(description);
    if (!key) return;
    const existing = merchantRules.find(r => r.key === key);
    const now = Date.now();
    let nextRules;
    if (existing) {
      nextRules = merchantRules.map(r => r.key === key
        ? { ...r, category: nextCategory, hits: (r.hits || 0) + 1, updatedAt: now }
        : r);
    } else {
      nextRules = [...merchantRules, { key, category: nextCategory, hits: 1, updatedAt: now }];
    }
    await persistMerchantRules(nextRules);
  }, [merchantRules, persistMerchantRules]);


  // ───────────────────────────────────────────────
  // Statement parsing — pdf.js line reconstruction
  // Extracts all pages and rebuilds text rows from x/y glyph positions.
  // ───────────────────────────────────────────────
  const extractTextFromPDF = async (file) => {
    log('LOADING PDF BUFFER...');
    const data = new Uint8Array(await file.arrayBuffer());
    log(`PDF BINARY READ: ${(data.length / 1024).toFixed(1)}KB`);

    log('PDF MODE: RECONSTRUCTING PAGE LINES...');
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    log(`PDF LOADED: ${pdf.numPages} PAGE(S)`);

    const allLines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const text = await page.getTextContent();
      const buckets = new Map();

      for (const it of text.items || []) {
        const str = (it && it.str ? it.str : '').trim();
        if (!str) continue;
        const tx = Array.isArray(it.transform) ? it.transform[4] : 0;
        const ty = Array.isArray(it.transform) ? it.transform[5] : 0;
        const yKey = (Math.round(ty * 2) / 2).toFixed(1);
        if (!buckets.has(yKey)) buckets.set(yKey, []);
        buckets.get(yKey).push({ x: tx, str });
      }

      const yKeys = Array.from(buckets.keys()).map(Number).sort((a, b) => b - a);
      for (const y of yKeys) {
        const row = buckets.get(y.toFixed(1)) || [];
        row.sort((a, b) => a.x - b.x);
        const line = row.map(r => r.str).join(' ').replace(/[ \t]{2,}/g, ' ').trim();
        if (line) allLines.push(line);
      }
    }

    const clean = allLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    log(`TEXT EXTRACTED: ${clean.length} CHARS — SAMPLE: "${clean.slice(0, 80).replace(/\n/g, ' ')}"`);
    return clean;
  };

  const getOCRWorker = async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    log('OCR INIT: LOADING LOCAL WORKER...');
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: (m) => { if (m?.status) log(`OCR: ${m.status}${m.progress ? ` ${(m.progress * 100).toFixed(0)}%` : ''}`); },
      langPath: `${assetBase}tessdata`,
      gzip: false,
      cacheMethod: 'readOnly',
    });
    ocrWorkerRef.current = worker;
    return worker;
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('File read failed'));
    r.readAsDataURL(file);
  });

  const extractTextFromImage = async (file) => {
    const worker = await getOCRWorker();
    const dataUrl = await fileToDataUrl(file);
    const res = await worker.recognize(dataUrl);
    const txt = (res?.data?.text || '').trim();
    log(`OCR EXTRACT: ${txt.length} CHARS`);
    return txt;
  };

  const ocrFirstPageOfPDF = async (file) => {
    log('SCANNED PDF DETECTED — OCR FALLBACK (PAGE RENDER)...');
    const worker = await getOCRWorker();
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const maxPages = Math.min(pdf.numPages || 1, 2);
    let combined = '';
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      const res = await worker.recognize(dataUrl);
      const text = (res?.data?.text || '').trim();
      if (text) combined += `\n${text}`;
    }
    const cleaned = (combined || '').trim();
    log(`OCR FALLBACK EXTRACT: ${cleaned.length} CHARS`);
    return cleaned;
  };

  const parseStatementInput = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    log(`STATEMENT INGEST: ${file.name} (.${ext.toUpperCase()})`);
    log(`SIZE: ${(file.size / 1024).toFixed(1)}KB`);
    let rawText = '';
    if (ext === 'pdf') {
      log('PDF MODE: EXTRACTING TEXT...');
      rawText = await extractTextFromPDF(file);
      log(`RAW EXTRACT: ${(rawText || '').trim().length} CHARS — SAMPLE: ${(rawText || '').trim().slice(0, 60).replace(/\n/g, ' ')}`);
      if ((rawText || '').trim().length < 30) {
        log('PDF TEXT TOO SHORT — FALLBACK: OCR PAGE RENDER');
        const ocrText = await ocrFirstPageOfPDF(file);
        rawText = `${rawText || ''}\n${ocrText || ''}`.trim();
      }
    } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      log('IMAGE MODE: OCR');
      rawText = await extractTextFromImage(file);
    } else {
      throw new Error('Unsupported statement format');
    }
    const template = detectStatementTemplate(rawText || '', file.name || '');
    log(`TEMPLATE: ${template.label.toUpperCase()}`);
    const txnsRaw = parseStatementTextToTransactions(rawText || '', { bankKey: template.key });
    const reconciled = reconcileParsedTransactions(txnsRaw, rawText || '', template.key);
    if (reconciled.summary.correctedSign > 0) log(`RECON: SIGN FIXES ${reconciled.summary.correctedSign}`);
    if (reconciled.summary.filledYear > 0) log(`RECON: YEAR FILLS ${reconciled.summary.filledYear}`);
    if (reconciled.summary.warnings?.length) log(`RECON WARNING: ${reconciled.summary.warnings[0]}`);
    return { rawText, template, reconciled };
  };

  const handleStatementFiles = async (files, mode = 'replace') => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    const append = mode === 'append';
    setProcessing(true); setError(''); setParsedPreview(null); setSuccess(false);
    if (!append) {
      setLogs([]);
      setStmtFile(list[0]);
      setStmtRawText('');
      setStmtText('');
      setStmtTxns([]);
      setReviewLowConfidence(false);
      setReviewCursor(0);
      setReviewedLowIndices([]);
      setStmtReconSummary(null);
      setStmtTemplateLabel('');
      if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch (_) { } setCsvBlobUrl(''); }
    }
    log(`PIPELINE: PDF MODE ${append ? 'APPEND' : 'REPLACE'} (${list.length} FILE${list.length > 1 ? 'S' : ''})`);

    try {
      let mergedText = append ? (stmtText || '') : '';
      let mergedRaw = append ? (stmtRawText || '') : '';
      let mergedTxns = append ? [...stmtTxns] : [];
      let reconAgg = append && stmtReconSummary
        ? { ...stmtReconSummary, warnings: [...(stmtReconSummary.warnings || [])] }
        : { correctedSign: 0, filledYear: 0, balanceDiff: null, warnings: [] };
      let detectedTemplate = append ? stmtTemplateLabel : '';
      let detectedBankKey = 'generic';

      for (const file of list) {
        const { rawText, template, reconciled } = await parseStatementInput(file);
        detectedTemplate = detectedTemplate && detectedTemplate !== template.label ? 'Mixed Templates' : template.label;
        detectedBankKey = template.key || 'generic';
        mergedRaw = `${mergedRaw}${mergedRaw ? '\n\n--- NEXT FILE ---\n\n' : ''}${rawText || ''}`;
        mergedText = mergedRaw;
        mergedTxns = [...mergedTxns, ...reconciled.txns];
        reconAgg.correctedSign += reconciled.summary.correctedSign || 0;
        reconAgg.filledYear += reconciled.summary.filledYear || 0;
        if (typeof reconciled.summary.balanceDiff === 'number') reconAgg.balanceDiff = reconciled.summary.balanceDiff;
        // Carry forward the most recent ending balance found
        if (typeof reconciled.summary.endBal === 'number' && reconciled.summary.endBal > 0) {
          reconAgg.endBal = reconciled.summary.endBal;
        }
        reconAgg.warnings.push(...(reconciled.summary.warnings || []));
      }

      // Detect account type — pass bankKey so Capital One/Citi are always credit_card
      const accountType = detectAccountType(mergedRaw, detectedBankKey);

      const dedup = [];
      const seen = new Set();
      for (const t of mergedTxns) {
        const key = `${t.date}|${t.description}|${t.amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(t);
      }
      dedup.sort((a, b) => (sanitizeDate(a.date) || '').localeCompare(sanitizeDate(b.date) || ''));
      const txns = applyMerchantRules(dedup, merchantRules);

      setStmtRawText(mergedRaw || '');
      setStmtText(mergedText || '');
      setStmtTxns(txns);
      setStmtTemplateLabel(detectedTemplate || 'Generic');
      setStmtReconSummary(reconAgg);

      if (!txns.length) {
        log('WARNING: NO TRANSACTIONS FOUND (HEURISTIC PARSER)');
        setError('No transactions detected. Try a text-based PDF export or clearer screenshot. You can review extracted text and retry parse.');
      } else {
        log(`FOUND: ${txns.length} TRANSACTIONS`);
        if (merchantRules.length) {
          const learnedHits = txns.filter(tx => tx?.category && tx.category !== 'Uncategorized').length;
          if (learnedHits > 0) log(`MERCHANT LEARNING APPLIED: ${learnedHits} AUTO-CATEGORIZED`);
        }
        if (list.length > 1) log(`MERGED ${list.length} FILES INTO SINGLE MONTH VIEW`);
      }

      const endBalance = reconAgg.endBal ?? null;
      if (endBalance !== null) {
        log(`BALANCE DETECTED: ${fmt(endBalance)} (${accountType.toUpperCase().replace('_', ' ')})`);
      } else {
        log('BALANCE: not detected — NW assets will remain at prior values');
      }

      const snap = transactionsToSnapshot(txns, stmtBankName, { endBalance, accountType });
      setParsedPreview(snap);
      const csv = txnsToPaymentLogCSV(txns);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      setCsvBlobUrl(url);
      log('SYNC READY (EDIT BEFORE COMMIT)');
    } catch (e) {
      log('ERROR: STATEMENT PARSE FAILED');
      setError(e?.message || 'Statement parse failed');
    } finally { setProcessing(false); }
  };

  const updateStmtTxn = (i, field, val) => {
    const arr = [...stmtTxns];
    const wasLow = (arr[i]?.confidence || 'low') === 'low';
    const next = { ...arr[i], [field]: field === 'amount' ? (typeof val === 'number' ? val : (parseFloat(String(val).replace(/,/g, '')) || 0)) : val };
    if (field === 'category') {
      if (next.category) {
        learnMerchantRule(next.description, next.category);
      } else {
        const auto = learnedCategoryForDescription(next.description, merchantRules);
        if (auto) next.category = auto;
      }
    }
    arr[i] = withTxnConfidence(next, `${next.date || ''} ${next.description || ''} ${next.amount ?? ''}`);
    if (wasLow || (arr[i]?.confidence || 'low') === 'low') {
      setReviewedLowIndices(prev => (prev.includes(i) ? prev : [...prev, i]));
    }
    setStmtTxns(arr);
    // keep preview + export in sync
    const snap = transactionsToSnapshot(arr, stmtBankName);
    setParsedPreview(snap);
    const csv = txnsToPaymentLogCSV(arr);
    if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch (_) { } }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    setCsvBlobUrl(url);
  };

  const removeStmtTxn = (i) => {
    const arr = stmtTxns.filter((_, idx) => idx !== i);
    setReviewedLowIndices(prev => prev.filter(idx => idx !== i).map(idx => (idx > i ? idx - 1 : idx)));
    setStmtTxns(arr);
    const snap = transactionsToSnapshot(arr, stmtBankName);
    setParsedPreview(snap);
    const csv = txnsToPaymentLogCSV(arr);
    if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch (_) { } }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    setCsvBlobUrl(url);
  };

  const stmtRows = (stmtTxns || []).slice(0, 200).map((tx, idx) => {
    if (tx?.confidence && typeof tx?.confidenceScore === 'number') return { tx, idx };
    const hydrated = withTxnConfidence(tx || { date: '', description: '', amount: 0 });
    return { tx: hydrated, idx };
  });
  const confidenceCounts = stmtRows.reduce((acc, row) => {
    const label = row.tx?.confidence || 'low';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
  const lowConfidenceIndices = stmtRows.filter(row => (row.tx?.confidence || 'low') === 'low').map(row => row.idx);
  const reviewedLowSet = new Set(reviewedLowIndices);
  const reviewedLowCount = lowConfidenceIndices.filter(idx => reviewedLowSet.has(idx)).length;
  const lowReviewComplete = lowConfidenceIndices.length === 0 || reviewedLowCount >= lowConfidenceIndices.length;
  const lowConfidenceRows = stmtRows.filter(row => (row.tx?.confidence || 'low') === 'low');
  const reviewedRow = reviewLowConfidence ? (lowConfidenceRows[reviewCursor] ? [lowConfidenceRows[reviewCursor]] : []) : [];
  const visibleStmtRows = showLowConfidence ? stmtRows : stmtRows.filter(row => (row.tx?.confidence || 'low') !== 'low');
  const displayedStmtRows = reviewLowConfidence ? reviewedRow : visibleStmtRows;

  useEffect(() => {
    if (!reviewLowConfidence) return;
    if (!lowConfidenceRows.length) {
      setReviewLowConfidence(false);
      setReviewCursor(0);
      return;
    }
    if (reviewCursor >= lowConfidenceRows.length) {
      setReviewCursor(Math.max(0, lowConfidenceRows.length - 1));
    }
  }, [reviewLowConfidence, reviewCursor, lowConfidenceRows.length]);

  useEffect(() => {
    setReviewedLowIndices(prev => prev.filter(idx => lowConfidenceIndices.includes(idx)));
  }, [lowConfidenceIndices.join('|')]);

  useEffect(() => {
    if (!stmtTxns.length || !merchantRules.length) return;
    const learnedApplied = applyMerchantRules(stmtTxns, merchantRules);
    const changed = learnedApplied.some((tx, i) => (tx?.category || '') !== (stmtTxns[i]?.category || ''));
    if (!changed) return;
    setStmtTxns(learnedApplied);
    const snap = transactionsToSnapshot(learnedApplied, stmtBankName);
    setParsedPreview(snap);
    const csv = txnsToPaymentLogCSV(learnedApplied);
    if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch (_) { } }
    setCsvBlobUrl(URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })));
  }, [merchantRules, stmtTxns, stmtBankName, csvBlobUrl]);

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
    txns = applyMerchantRules(txns, merchantRules);

    log(`TRANSACTIONS EXTRACTED: ${txns.length}`);
    if (merchantRules.length) {
      const learnedHits = txns.filter(tx => tx?.category && tx.category !== 'Uncategorized').length;
      if (learnedHits > 0) log(`MERCHANT LEARNING APPLIED: ${learnedHits} AUTO-CATEGORIZED`);
    }
    log('MAPPING TO FORTIFY SCHEMA...');

    const snapshot = transactionsToSnapshot(txns, bank ? bank.name : 'Generic');
    log(`CATEGORIES: ${snapshot.budget.categories.filter(c => c.actual > 0).length} active`);
    if (snapshot._meta.uncategorized > 0) {
      log(`⚠ UNCATEGORIZED: ${fmt(snapshot._meta.uncategorized)}`);
    }
    if (snapshot._meta.excludedTransfers > 0) {
      log(`ℹ EXCLUDED: ${fmt(snapshot._meta.excludedTransfers)} (transfers/refunds)`);
    }
    if (snapshot._meta.totalExpense === 0 && snapshot._meta.income > 0) {
      log('⚠ ZERO EXPENSES — bank may use inverted signs');
    }
    if (snapshot._meta.income > 50000) {
      log(`⚠ HIGH INCOME: ${fmt(snapshot._meta.income)} — verify manually`);
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
      const p = parseLooseJson(text);
      const hasSnapshotShape = ['date', 'netWorth', 'debts', 'eFund'].every(k => k in p);
      if (hasSnapshotShape) {
        // Native Fortify snapshot JSON path
        p.date = sanitizeDate(p.date);
        log('SCHEMA VALID');
        log('RUNNING SENTINEL REDACTION FILTER...');
        log('SYNC READY');
        setParsedPreview(p);
        return;
      }

      // Statement-parser JSON path: { records: [{ date, description, amount, ...}] }
      const records = Array.isArray(p?.records) ? p.records : null;
      if (records && records.length > 0) {
        const txns = records
          .map(r => ({
            date: r?.date || r?.date_mmdd || '',
            description: r?.description || '',
            amount: typeof r?.amount === 'number' ? r.amount : parseFloat(r?.amount || 0),
            category: r?.category || autoCategory(r?.description || ''),
          }))
          .filter(r =>
            r.description &&
            Number.isFinite(r.amount) &&
            !/beginning balance|ending balance/i.test(r.description)
          );

        if (!txns.length) {
          log('ERROR: JSON RECORDS FOUND BUT NO TRANSACTION ROWS');
          setError('JSON contains records, but no usable transactions were found.');
          return;
        }

        const source = p?.source_pdf ? 'Statement JSON' : 'JSON Records';
        const snapshot = transactionsToSnapshot(txns, source);
        log(`JSON RECORDS DETECTED: ${records.length}`);
        log(`TRANSACTIONS EXTRACTED: ${txns.length}`);
        log('MAPPED TO FORTIFY SNAPSHOT');
        log('SYNC READY');
        setParsedPreview(snapshot);
        return;
      }

      const missing = ['date', 'netWorth', 'debts', 'eFund'].filter(k => !(k in p));
      log(`ERROR: MISSING KEYS — ${missing.join(', ')}`);
      setError(`Missing: ${missing.join(', ')} (or provide JSON with a records[] array)`);
    } catch (e) {
      log('ERROR: INVALID JSON SYNTAX');
      setError('Invalid JSON syntax. Tip: use FILE IMPORT with the full .json file.');
    }
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
        log('JSON IMPORT DISABLED FOR THIS FLOW');
        setError('JSON import disabled. Use File Import for CSV/PDF/screenshots.');
      } else if (['png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
        log('ROUTING TO STATEMENT PARSER...');
        setTab('statement');
        await handleStatementFiles([file], 'replace');
        return;
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
    if (stmtTxns.length > 0 && !lowReviewComplete) {
      setReviewLowConfidence(true);
      setError(`Warning: syncing before review (${reviewedLowCount}/${lowConfidenceIndices.length} low-confidence rows reviewed).`);
      log(`WARNING: SYNCING BEFORE REVIEW (${reviewedLowCount}/${lowConfidenceIndices.length})`);
    }
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

  const handleGuided = async () => {
    const checking = parseFloat(gCheck) || 0; const savings = parseFloat(gSavings) || 0; const efund = parseFloat(gEF) || 0; const other = parseFloat(gOther) || 0;
    const debts = gDebts.filter(d => d.name).map(d => {
      const isFixed = d.type === 'BNPL' || d.type === 'TERM';
      return {
        name: d.name, apr: parseFloat(d.apr) || 0, balance: parseFloat(d.balance) || 0,
        minPayment: parseFloat(d.minPayment) || 0, type: d.type || 'REVOLVING', dueDate: d.dueDate || '',
        ...(isFixed ? {
          totalTerms: parseInt(d.totalTerms) || 0,
          paymentsMade: parseInt(d.paymentsMade) || 0,
          monthlyPayment: parseFloat(d.monthlyPayment) || 0,
        } : {}),
      };
    });
    const tL = debts.reduce((s, d) => s + d.balance, 0);
    const debtServiceBudgeted = gDebts.filter(d => d.balance).reduce((s, d) => s + (parseFloat(d.minPayment) || 0), 0);
    const budgetCats = [
      ...gBudget.map(b => ({ name: b.name, budgeted: parseFloat(b.budgeted) || 0, actual: parseFloat(b.actual) || 0 })),
      { name: 'Debt Service', budgeted: debtServiceBudgeted, actual: 0 },
    ];
    const monthly = budgetCats.reduce((s, b) => s + b.budgeted, 0) || 0;
    const phase = (monthly > 0 && efund >= monthly * 6) ? 4 : (monthly > 0 && efund >= monthly * 3) ? 3 : (monthly > 0 && efund >= monthly) ? 2 : efund >= 1000 ? 1 : 0;
    const income = parseFloat(gIncome) || 0;
    const protection = {
      lifeInsurance: { provider: gProvider, type: gPolicyType, deathBenefit: parseFloat(gBenefit) || 0, monthlyPremium: parseFloat(gPremium) || 0, expirationDate: gPolicyExp, conversionDeadline: gConvDeadline, alertLeadTimeYears: parseInt(gLeadYears) || 5 },
      funeralBuffer: { target: parseFloat(gFuneralTarget) || 10000, current: parseFloat(gFuneralCurrent) || 0 },
    };
    const cryptoHoldings = gCrypto.filter(c => c.coin).map(c => ({ coin: c.coin.toUpperCase(), amount: parseFloat(c.amount) || 0, avgCost: parseFloat(c.avgCost) || 0, lastPrice: parseFloat(c.lastPrice) || 0 }));
    const cryptoVal = cryptoHoldings.reduce((s, c) => s + c.amount * c.lastPrice, 0);
    const portfolio = {
      equities: gEquities.filter(e => e.ticker).map(e => ({ ticker: e.ticker.toUpperCase(), shares: parseFloat(e.shares) || 0, avgCost: parseFloat(e.avgCost) || 0, lastPrice: parseFloat(e.lastPrice) || 0 })),
      options: gOptions.filter(o => o.ticker).map(o => ({ ticker: o.ticker.toUpperCase(), type: o.type, contracts: parseInt(o.contracts) || 0, strikePrice: parseFloat(o.strikePrice) || 0, expDate: o.expDate, lastPrice: parseFloat(o.lastPrice) || 0 })),
      crypto: cryptoHoldings,
    };
    const eqVal = portfolio.equities.reduce((s, e) => s + e.shares * e.lastPrice, 0);
    const totalAssets = checking + savings + efund + other + eqVal + cryptoVal;
    // Macro is scan-only from dashboard — only Benner phase set here
    const macro = {
      netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: '',
      fedWatchCut: 0, nextFomc: '', yieldCurve10Y2Y: 0, yieldTrend: 'flat',
      triggersActive: 0, activeTriggers: [],
      bennerPhase: gBenner || 'B-Year (Sell)',
    };
    const bills = gBills.filter(b => b.name).map(b => ({
      name: b.name,
      amount: parseFloat(b.amount) || 0,
      dueDay: Math.max(1, Math.min(31, parseInt(b.dueDay) || 1)),
      autopay: b.autopay !== false,
    }));
    const payroll = { frequency: 'WEEKLY', weekday: Number(gPaydayWeekday || 2) };
    const snap = { date: new Date().toISOString().slice(0, 10), netWorth: { assets: { checking, savings, eFund: efund, other }, liabilities: debts.reduce((o, d) => ({ ...o, [d.name]: d.balance }), {}), total: totalAssets - tL }, debts, bills, payroll, eFund: { balance: efund, monthlyExpenses: monthly, phase }, budget: { income, categories: budgetCats }, macro, protection, portfolio };
    // Sanity check: warn but don't block
    if (income > 50000) {
      if (!window.confirm(`Income entered: ${fmt(income)}. This seems unusually high for a monthly figure. Continue?`)) return;
    }
    onSync(snap); setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose(); }, 600);
  };

  const addDebt = () => setGDebts([...gDebts, { name: '', apr: '', balance: '', minPayment: '', type: 'REVOLVING', totalTerms: '', paymentsMade: '', monthlyPayment: '', dueDate: '' }]);
  const upDebt = (i, f, v) => { const d = [...gDebts]; d[i][f] = v; setGDebts(d); };
  const inp = { background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '8px 10px', width: '100%', outline: 'none', borderRadius: 2, boxSizing: 'border-box' };
  const lbl = { color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  if (!open) return null;

  return (
    <div className="sync-overlay" style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(18,18,18,0.18)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="sync-shell fo-panel-corner" style={{ background: isDark ? `linear-gradient(180deg, ${t.surface} 0%, ${t.panel} 100%)` : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`, border: `1px solid ${t.borderMid}`, maxWidth: 1100, width: 'min(98vw, 1100px)', maxHeight: '94vh', overflowY: 'auto', overflowX: 'hidden', borderRadius: 6, boxSizing: 'border-box', minWidth: 0, boxShadow: isDark ? `0 28px 72px rgba(0,0,0,0.55), inset 0 0 0 1px ${t.borderDim}` : `0 18px 42px rgba(0,0,0,0.12), inset 0 0 0 1px ${t.borderDim}`, position: 'relative' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sync-header" style={{ padding: '14px 16px', borderBottom: `1px solid ${t.borderDim}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? `linear-gradient(90deg, ${t.elevated} 0%, ${t.panel} 60%, ${t.purple || '#8b5cf6'}10 100%)` : `linear-gradient(90deg, ${t.elevated} 0%, ${t.surface} 100%)`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={14} style={{ color: t.accent }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textPrimary }}>Universal Sync Terminal</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}><X size={16} style={{ color: t.textDim }} /></button>
        </div>
        {/* Tabs */}
        <div className="sync-tabs" style={{ display: 'flex', borderBottom: `1px solid ${t.borderDim}`, position: 'relative', background: isDark ? `${t.panel}cc` : t.surface }}>
          {[{ k: 'statement', l: 'File Import' }, { k: 'guided', l: 'Manual' }].map(tb => (
            <button key={tb.k} onClick={() => { setTab(tb.k); setError(''); setParsedPreview(null); }} style={{
              flex: 1, padding: 10, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 14, textTransform: 'uppercase',
              color: tab === tb.k ? t.accent : t.textDim,
              borderBottom: tab === tb.k ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>{tb.l}</button>
          ))}
        </div>

        <div className="sync-content" style={{ padding: 16, minWidth: 0, overflow: 'hidden' }}>
          {/* ── STATEMENT TAB ── */}
          {tab === 'statement' && (<>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', textAlign: 'center' }}>
                  <FileText size={14} style={{ color: t.accent }} />
                  <span style={lbl}>Upload Files (CSV / PDF / Screenshots · Multi-file Merge)</span>
                </div>
                <input ref={stmtFileRef} type="file" accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg" multiple style={{ display: 'none' }}
                  onChange={(e) => {
                    const fs = Array.from(e.target.files || []);
                    if (!fs.length) return;
                    const ext = fs[0].name.split('.').pop().toLowerCase();
                    if (ext === 'csv' || ext === 'xlsx') {
                      handleFile(fs[0]);
                    } else {
                      handleStatementFiles(fs, stmtPickMode);
                    }
                    e.target.value = '';
                  }} />
              </div>
              <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel }}>
                <div style={{ display: 'grid', gap: 6, fontSize: 15, color: t.textDim, lineHeight: 1.35 }}>
                  <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: t.accent }}>Quality Tips</div>
                  <div>• Best: Download a <b>text-based PDF</b> from your bank portal (not scanned/image-only).</div>
                  <div>• Screenshots supported via local OCR. Keep captures sharp and include full transaction rows.</div>
                  <div>• Sentinel redaction runs before parsing; review the extracted table before sync.</div>
                </div>
              </div>

              {/* Drag/drop area */}
              <div
                className="sync-dropzone"
                onDrop={e => {
                  e.preventDefault(); setDragOver(false);
                  const fs = Array.from(e.dataTransfer.files || []);
                  if (!fs.length) return;
                  const ext = fs[0].name.split('.').pop().toLowerCase();
                  if (ext === 'csv' || ext === 'xlsx') {
                    handleFile(fs[0]);
                  } else {
                    handleStatementFiles(fs, stmtTxns.length ? 'append' : 'replace');
                  }
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => stmtFileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? t.accent : t.borderMid}`,
                  borderRadius: 8,
                  padding: 20,
                  background: dragOver
                    ? (isDark ? `linear-gradient(135deg, ${t.accent}18 0%, ${t.purple || '#8b5cf6'}10 100%)` : `${t.accent}12`)
                    : (isDark ? `linear-gradient(135deg, ${t.void} 0%, ${t.panel} 100%)` : `linear-gradient(135deg, ${t.surface} 0%, ${t.elevated} 100%)`),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, cursor: 'pointer', transition: 'all 0.2s', minHeight: 100,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {processing
                  ? <Zap size={24} style={{ color: t.accent, animation: 'blink 0.5s infinite' }} />
                  : <Upload size={22} style={{ color: dragOver ? t.accent : t.textDim }} />}
                <div style={{ fontSize: 15, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {processing ? 'Processing...' : 'Drag & drop one or more files'}
                </div>
                <div style={{ fontSize: 15, color: t.textGhost }}>CSV · PDF · PNG · JPG — parsed locally, merged into one timeline</div>
              </div>

              {/* Logs */}
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim }}>Parse Log</div>
                <div className="sync-log-panel" style={{
                  padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.input,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: t.textDim,
                  overflowX: 'hidden', width: '100%', boxSizing: 'border-box',
                }}>
                  {logs.length ? logs.map((l, i) => <div key={i} style={{ overflowWrap: 'break-word', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{l}</div>) : <div>Awaiting file…</div>}
                </div>
                {(stmtTemplateLabel || stmtReconSummary) && (
                  <div style={{ padding: 10, borderRadius: 12, border: `1px solid ${t.borderDim}`, background: t.panel, fontSize: 14, color: t.textSecondary }}>
                    <div><span style={{ color: t.textDim }}>Template:</span> <span style={{ color: t.accent }}>{stmtTemplateLabel || 'Generic'}</span></div>
                    {stmtReconSummary && (
                      <div style={{ marginTop: 4 }}>
                        <span>Reconciliation:</span>{' '}
                        <span style={{ color: t.textDim }}>sign fixes {stmtReconSummary.correctedSign || 0}, year fills {stmtReconSummary.filledYear || 0}</span>
                        {typeof stmtReconSummary.balanceDiff === 'number' && (
                          <span style={{ marginLeft: 6, color: Math.abs(stmtReconSummary.balanceDiff) <= 25 ? t.accent : t.warn }}>
                            Δ {stmtReconSummary.balanceDiff >= 0 ? '+' : ''}{stmtReconSummary.balanceDiff.toFixed(2)}
                          </span>
                        )}
                        {!!stmtReconSummary.warnings?.length && (
                          <div style={{ marginTop: 4, color: t.warn }}>{stmtReconSummary.warnings[0]}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {error && <div style={{ color: t.warn, fontSize: 15 }}><AlertCircle size={12} style={{ verticalAlign: 'middle' }} /> {error}</div>}
                {stmtText && (!stmtTxns || stmtTxns.length === 0) && (
                  <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel, marginTop: 10, minWidth: 0, overflow: 'hidden', boxSizing: 'border-box', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim }}>Extracted Text</div>
                      <button onClick={() => {
                        try {
                          const tpl = detectStatementTemplate(stmtRawText || stmtText, stmtFile?.name || '');
                          const parsed = parseStatementTextToTransactions(stmtRawText || stmtText, { bankKey: tpl.key });
                          const reconciled = reconcileParsedTransactions(parsed, stmtRawText || stmtText, tpl.key);
                          const tx = applyMerchantRules(reconciled.txns, merchantRules);
                          setStmtTxns(tx);
                          setReviewedLowIndices([]);
                          setStmtTemplateLabel(tpl.label || 'Generic');
                          setStmtReconSummary(reconciled.summary);
                          const snap2 = transactionsToSnapshot(tx, stmtBankName);
                          setParsedPreview(snap2);
                          if (tx.length) setError('');
                          log(`RE-PARSE: ${tx.length} transactions`);
                        } catch (e) {
                          setError(e?.message || 'Re-parse failed');
                        }
                      }} style={btn}>
                        <RefreshCw size={14} /> TRY PARSE AGAIN
                      </button>
                    </div>
                    <div style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: t.textDim, width: '100%', boxSizing: 'border-box' }}>
                      {stmtText}
                    </div>
                  </div>
                )}
              </div>

              {/* Editable transaction table */}
              {parsedPreview && (
                <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel, minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                  {/* Row 1: title + confidence stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: t.accent }}>Transactions Preview (Editable)</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
                      <span style={{ color: t.textDim }}>Rules {merchantRules.length}</span>
                      <span style={{ color: t.accent }}>High {confidenceCounts.high || 0}</span>
                      <span style={{ color: t.warn }}>Med {confidenceCounts.medium || 0}</span>
                      <span style={{ color: t.danger }}>Low {confidenceCounts.low || 0}</span>
                      <span style={{ color: lowReviewComplete ? t.accent : t.warn }}>Review {reviewedLowCount}/{lowConfidenceIndices.length || 0}</span>
                    </div>
                  </div>
                  {/* Row 2: action buttons — wraps freely */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                    <button onClick={() => setShowLowConfidence(v => !v)} style={{ ...btnGhost, padding: '6px 10px', fontSize: 14 }}>
                      {showLowConfidence ? 'Hide Low' : 'Show Low'}
                    </button>
                    <button
                      onClick={() => { if (!lowConfidenceRows.length) return; setReviewLowConfidence(v => !v); setReviewCursor(0); }}
                      disabled={!lowConfidenceRows.length}
                      style={{ ...btnGhost, padding: '6px 10px', fontSize: 14, opacity: lowConfidenceRows.length ? 1 : 0.5 }}
                    >
                      {reviewLowConfidence ? 'Exit Review' : `Review Low (${lowConfidenceRows.length})`}
                    </button>
                    <button
                      onClick={() => {
                        const all = lowConfidenceRows.map(r => r.idx).filter(idx => typeof idx === 'number');
                        setReviewedLowIndices(prev => Array.from(new Set([...prev, ...all])));
                        setError('');
                        log(`LOW-CONFIDENCE QUICK REVIEW: ${all.length} ROWS MARKED`);
                      }}
                      disabled={!lowConfidenceRows.length}
                      style={{ ...btnGhost, padding: '6px 10px', fontSize: 14, opacity: lowConfidenceRows.length ? 1 : 0.5 }}
                    >
                      Mark Reviewed
                    </button>
                    {csvBlobUrl && (
                      <a href={csvBlobUrl} download="payment-log.csv" style={{ ...link, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                        <Download size={12} /> CSV
                      </a>
                    )}
                    <button onClick={confirmSync} disabled={!parsedPreview} style={{ ...btn, padding: '6px 14px', fontSize: 14, opacity: (!parsedPreview) ? 0.6 : 1 }}>
                      <Shield size={12} /> Commit Sync
                    </button>
                  </div>
                  {reviewLowConfidence && lowConfidenceRows.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14, color: t.textDim }}>
                      <span>Reviewing low-confidence row {reviewCursor + 1} / {lowConfidenceRows.length}</span>
                      <button onClick={() => setReviewCursor(c => Math.max(0, c - 1))} style={{ ...btnGhost, padding: '6px 8px', fontSize: 14 }} disabled={reviewCursor === 0}>
                        PREV
                      </button>
                      <button onClick={() => setReviewCursor(c => Math.min(lowConfidenceRows.length - 1, c + 1))} style={{ ...btnGhost, padding: '6px 8px', fontSize: 14 }} disabled={reviewCursor >= lowConfidenceRows.length - 1}>
                        NEXT
                      </button>
                      <button
                        onClick={() => {
                          const idx = lowConfidenceRows[reviewCursor]?.idx;
                          if (typeof idx === 'number') setReviewedLowIndices(prev => (prev.includes(idx) ? prev : [...prev, idx]));
                        }}
                        style={{ ...btn, padding: '6px 8px', fontSize: 14 }}
                      >
                        MARK REVIEWED
                      </button>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto', marginTop: 10, WebkitOverflowScrolling: 'touch', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', fontSize: 15 }}>
                      <thead>
                        <tr style={{ color: t.textDim, textTransform: 'uppercase', fontSize: 14 }}>
                          <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Date</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Payee</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Confidence</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Category</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Amount</th>
                          <th style={{ width: 40, padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(displayedStmtRows.length ? displayedStmtRows : [{ tx: null, idx: -1 }]).map((row, i) => {
                          const tx = row?.tx;
                          if (!tx) {
                            const emptyMsg = reviewLowConfidence
                              ? 'No low-confidence rows left to review.'
                              : stmtRows.length
                                ? 'No rows visible with current confidence filter. Toggle "SHOW LOW-CONFIDENCE" to review hidden rows.'
                                : 'No transactions detected yet. If this is a scanned/image file, try a sharper image or text-based PDF export. You can still COMMIT SYNC to save a baseline snapshot.';
                            return (
                              <tr key="empty">
                                <td colSpan={6} style={{ padding: '10px 6px', color: t.textDim }}>
                                  {emptyMsg}
                                </td>
                              </tr>
                            );
                          }
                          const idx = row.idx;
                          const inferredCat = inferCategory(tx.description || '', merchantRules);
                          const confidenceColor = tx.confidence === 'high' ? t.accent : tx.confidence === 'medium' ? t.warn : t.danger;
                          return (
                            <tr key={`${idx}-${i}`} style={{ borderBottom: `1px solid ${t.borderDim}` }}>
                              <td style={{ padding: '8px 6px' }}>
                                <input value={tx.date || ''} onChange={e => updateStmtTxn(idx, 'date', e.target.value)} style={{
                                  width: 'clamp(88px, 16vw, 120px)', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                                  background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                                }} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input value={tx.description || ''} onChange={e => updateStmtTxn(idx, 'description', e.target.value)} style={{
                                  width: 'clamp(160px, 36vw, 420px)', maxWidth: '52vw', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                                  background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                                }} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  minWidth: 74, padding: '6px 8px', borderRadius: 999, border: `1px solid ${confidenceColor}`,
                                  color: confidenceColor, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em',
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                  {(tx.confidence || 'low').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <select value={(tx.category ?? '')} onChange={e => updateStmtTxn(idx, 'category', e.target.value)} style={{
                                  width: 'clamp(130px, 24vw, 220px)', maxWidth: '36vw', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                                  background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                                }}>
                                  <option value="">{`AUTO · ${inferredCat}`}</option>
                                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                <input value={typeof tx.amount === 'number' ? tx.amount : (parseFloat(tx.amount) || 0)}
                                  onChange={e => updateStmtTxn(idx, 'amount', e.target.value)} style={{
                                    width: 'clamp(92px, 16vw, 120px)', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                                    background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, textAlign: 'right',
                                  }} />
                              </td>
                              <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                <button onClick={() => removeStmtTxn(idx)} style={{ ...btnGhost, padding: '6px 8px' }} aria-label="Remove row">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!showLowConfidence && confidenceCounts.low > 0 && (
                      <div style={{ marginTop: 8, fontSize: 14, color: t.textDim }}>
                        {confidenceCounts.low} low-confidence rows hidden. Toggle "SHOW LOW-CONFIDENCE" to review/edit.
                      </div>
                    )}
                    {stmtTxns.length > 200 && <div style={{ marginTop: 8, fontSize: 14, color: t.textDim }}>Showing first 200 rows. Export includes all rows.</div>}
                  </div>
                </div>
              )}

              {/* Optional raw extracted text */}
              {stmtText && (
                <details style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel }}>
                  <summary style={{ cursor: 'pointer', color: t.textDim, fontSize: 15 }}>View extracted text</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: t.textDim, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                    {stmtText.slice(0, 20000)}{stmtText.length > 20000 ? '\\n…(truncated)…' : ''}
                  </pre>
                </details>
              )}

              {/* Privacy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 15, color: t.warn }}>
                <ShieldAlert size={11} />
                <span>Stored locally in this browser profile. Disable browser sync for single-device isolation.</span>
              </div>

              {/* Prominent Sync button — always visible once data is ready */}
              {parsedPreview ? (
                <button onClick={confirmSync} style={{
                  width: '100%', marginTop: 12, padding: '14px 0',
                  background: t.accent, color: '#000',
                  border: 'none', fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Shield size={16} /> CONFIRM & SYNC TO DASHBOARD
                </button>
              ) : (
                <div style={{
                  width: '100%', marginTop: 12, padding: '14px 0',
                  background: t.elevated, border: `1px solid ${t.borderDim}`,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                  color: t.textGhost, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  SYNC DISABLED — UPLOAD &amp; PARSE A STATEMENT FIRST
                </div>
              )}
            </div>
          </>)}

          {/* ── JSON TAB ── */}
          {tab === 'json' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={lbl}>Paste JSON Snapshot</span>
              <span style={{ fontSize: 15, color: t.textGhost }}>CLI / Any Tool or AI output</span>
            </div>
            <textarea value={json} onChange={e => setJson(e.target.value)}
              placeholder={'{\n  "date": "2026-02-21",\n  "netWorth": { ... },\n  "debts": [ ... ],\n  "eFund": { ... }\n}'}
              style={{ ...inp, height: 180, resize: 'vertical', marginBottom: 8, color: t.accent }}
              onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.borderDim} />
            {/* Log for JSON */}
            {logs.length > 0 && tab === 'json' && (
              <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 8, marginBottom: 8, borderRadius: 4, maxHeight: 80, overflow: 'hidden' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: t.accentDim }}>
                  {logs.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
            {parsedPreview && <button onClick={confirmSync} style={{ width: '100%', padding: 14, background: t.accent, color: t === THEMES.dark ? '#000' : '#FFF', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', marginBottom: 8 }}>CONFIRM & SYNC</button>}
            {!parsedPreview && <button onClick={handlePasteSync} disabled={jsonValidating || !json} style={{ width: '100%', padding: 14, background: jsonValidating ? t.elevated : t.accent, color: jsonValidating ? t.textDim : (t === THEMES.dark ? '#000' : '#FFF'), border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, cursor: jsonValidating ? 'wait' : 'pointer', textTransform: 'uppercase' }}>{jsonValidating ? 'VALIDATING...' : 'VALIDATE SCHEMA'}</button>}
            {error && <div style={{ color: t.danger, fontSize: 15, marginTop: 8 }}><AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{error}</div>}
          </>)}

          {/* ── GUIDED TAB ── */}
          {tab === 'guided' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Assets */}
              <div>
                <div style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Assets</div>
                <div className="sync-row-debt" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Checking</label><CurrencyInput t={t} value={gCheck} onChange={e => setGCheck(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Savings</label><CurrencyInput t={t} value={gSavings} onChange={e => setGSavings(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Emergency Fund</label><CurrencyInput t={t} value={gEF} onChange={e => setGEF(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Other Assets</label><CurrencyInput t={t} value={gOther} onChange={e => setGOther(e.target.value)} placeholder="0" /></div>
                </div>
              </div>
              {/* Debts */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debts</span><button onClick={addDebt} style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, fontSize: 15, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button></div>
                {gDebts.map((d, i) => (<div key={i} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${t.borderDim}` }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {['REVOLVING', 'BNPL', 'TERM'].map(tp => (
                      <button key={tp} onClick={() => upDebt(i, 'type', tp)} style={{
                        background: d.type === tp ? (tp === 'BNPL' ? t.warn + '20' : t.accentMuted) : 'none',
                        border: `1px solid ${d.type === tp ? (tp === 'BNPL' ? t.warn : t.accent) : t.borderDim}`,
                        color: d.type === tp ? (tp === 'BNPL' ? t.warn : t.accent) : t.textDim,
                        fontSize: 15, padding: '2px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
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
                  <div className="sync-row-3" style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                    <div><label style={lbl}>Due Date</label><input style={inp} type="date" value={d.dueDate || ''} onChange={e => upDebt(i, 'dueDate', e.target.value)} /></div>
                  </div>
                  {(d.type === 'BNPL' || d.type === 'TERM') && (
                    <div className="sync-row-3" style={{ display: 'grid', gap: 6 }}>
                      <div><label style={lbl}>Total Payments</label><input style={inp} placeholder="12" value={d.totalTerms} onChange={e => upDebt(i, 'totalTerms', e.target.value)} inputMode="numeric" /></div>
                      <div><label style={lbl}>Payments Made</label><input style={inp} placeholder="0" value={d.paymentsMade} onChange={e => upDebt(i, 'paymentsMade', e.target.value)} inputMode="numeric" /></div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                        {parseInt(d.totalTerms) > 0 && parseInt(d.paymentsMade) >= 0 && (
                          <span style={{ fontSize: 15, color: parseInt(d.totalTerms) - parseInt(d.paymentsMade || 0) <= 1 ? t.accent : t.textDim }}>
                            {parseInt(d.totalTerms) - parseInt(d.paymentsMade || 0)} remaining
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>))}
              </div>
              {/* Monthly burn rate + income */}
              <div>
                <div style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Income & Expenses</div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Monthly Income</label><CurrencyInput t={t} value={gIncome} onChange={e => setGIncome(e.target.value)} placeholder="3500" /></div>
                  <div><label style={lbl}>Payday (Weekly)</label>
                    <select style={{ ...inp, appearance: 'none' }} value={gPaydayWeekday} onChange={e => setGPaydayWeekday(e.target.value)}>
                      <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Bills */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bill Calendar</span>
                  <button onClick={addBill} style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, fontSize: 15, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button>
                </div>
                {gBills.map((b, i) => (
                  <div key={i} className="sync-row-3" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                    <div><label style={lbl}>Bill Name</label><input style={inp} placeholder="Rent" value={b.name} onChange={e => upBill(i, 'name', e.target.value)} /></div>
                    <div><label style={lbl}>Amount</label><CurrencyInput t={t} value={b.amount} onChange={e => upBill(i, 'amount', e.target.value)} placeholder="0" /></div>
                    <div><label style={lbl}>Due Day (1-31)</label><input style={inp} value={b.dueDay} onChange={e => upBill(i, 'dueDay', e.target.value)} placeholder="1" inputMode="numeric" /></div>
                  </div>
                ))}
              </div>
              {/* Budget categories */}
              <div>
                <div style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Budget Allocation</div>
                <div style={{ fontSize: 13, color: t.textGhost, marginBottom: 8 }}>Set monthly targets — actual spending is tracked automatically from synced statements.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>Category</span>
                  <span style={{ ...lbl, marginBottom: 0 }}>Monthly Budget</span>
                </div>
                {gBudget.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: t.textSecondary }}>{b.name}</span>
                    <CurrencyInput t={t} value={b.budgeted} onChange={e => upBudget(i, 'budgeted', e.target.value)} placeholder="0" />
                  </div>
                ))}
                {/* Debt Payments — auto-calculated from min payments in Debts section */}
                {(() => {
                  const dsAmt = gDebts.filter(d => d.balance).reduce((s, d) => s + (parseFloat(d.minPayment) || 0), 0);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: t.textSecondary }}>
                        Debt Payments
                        <span style={{ fontSize: 11, color: t.textGhost, marginLeft: 4 }}>(auto)</span>
                      </span>
                      <div style={{ ...inp, color: dsAmt > 0 ? t.textSecondary : t.textGhost, background: t.void, display: 'flex', alignItems: 'center', cursor: 'default', userSelect: 'none' }}>
                        {dsAmt > 0 ? `$${dsAmt.toFixed(0)}` : '$ 0'}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const dsAmt = gDebts.filter(d => d.balance).reduce((s, d) => s + (parseFloat(d.minPayment) || 0), 0);
                  const totalBudgeted = gBudget.reduce((s, b) => s + (parseFloat(b.budgeted) || 0), 0) + dsAmt;
                  if (totalBudgeted === 0) return null;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.borderDim}`, fontSize: 14 }}>
                      <span style={{ color: t.textDim }}>TOTAL</span>
                      <span style={{ color: t.textSecondary }}>{fmt(totalBudgeted)} / mo</span>
                    </div>
                  );
                })()}
              </div>
              {/* Protection */}
              <div>
                <div style={{ color: t.accent, fontSize: 14, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Protection Layer</div>
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

              {/* Live calculations */}
              {(() => {
                const a = (parseFloat(gCheck) || 0) + (parseFloat(gSavings) || 0) + (parseFloat(gEF) || 0) + (parseFloat(gOther) || 0);
                const dList = gDebts.filter(d => d.balance).map(d => ({ bal: parseFloat(d.balance) || 0, apr: parseFloat(d.apr) || 0 }));
                const dTotal = dList.reduce((s, d) => s + d.bal, 0);
                const totalAssets = a;
                const nw = totalAssets - dTotal;
                const di = dList.reduce((s, d) => s + (d.bal * d.apr / 100) / 365, 0);
                const ef = parseFloat(gEF) || 0;
                const debtServiceAmt = gDebts.filter(d => d.balance).reduce((s, d) => s + (parseFloat(d.minPayment) || 0), 0);
                const mo = gBudget.reduce((s, b) => s + (parseFloat(b.budgeted) || 0), 0) + debtServiceAmt;
                const inc = parseFloat(gIncome) || 0;
                const runway = mo > 0 ? Math.floor(ef / (mo / 30)) : 0;
                const totalBudgeted = mo;
                const totalSpent = gBudget.reduce((s, b) => s + (parseFloat(b.actual) || 0), 0);
                const benefit = parseFloat(gBenefit) || 0;
                const netToFamily = benefit > 0 ? benefit - dTotal : 0;
                const hasData = a > 0 || dTotal > 0 || totalBudgeted > 0 || benefit > 0 || inc > 0;
                if (!hasData) return null;
                return (
                  <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Live Calculation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                      <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>TOTAL ASSETS</span><span style={{ color: t.accent }}>{fmt(totalAssets)}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>TOTAL DEBT</span><span style={{ color: dTotal > 0 ? t.danger : t.textPrimary }}>{fmt(dTotal)}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>NET WORTH</span><span style={{ color: nw >= 0 ? t.accent : t.danger, fontWeight: 700, fontSize: 16 }}>{nw < 0 ? '-' : ''}{fmt(Math.abs(nw))}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>DAILY INTEREST BURN</span><span style={{ color: di > 0 ? t.danger : t.textPrimary }}>{fmt(di)}/day</span></div>
                      {ef > 0 && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>E-FUND RUNWAY</span><span style={{ color: runway >= 60 ? t.accent : runway >= 30 ? t.warn : t.danger }}>{runway} days</span><span style={{ color: t.textGhost, fontSize: 15, marginLeft: 6 }}>at {fmt(mo)}/mo burn</span></div>}
                      {totalBudgeted > 0 && <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>BUDGET USED</span><span style={{ color: totalSpent > totalBudgeted ? t.danger : t.accent }}>{Math.round((totalSpent / totalBudgeted) * 100)}%</span></div>}
                      {inc > 0 && totalSpent > 0 && <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>SAVINGS RATE</span><span style={{ color: (inc - totalSpent) > 0 ? t.accent : t.danger }}>{Math.round(((inc - totalSpent) / inc) * 100)}%</span></div>}
                      {netToFamily > 0 && <div><span style={{ color: t.textDim, fontSize: 15, display: 'block' }}>NET TO FAMILY</span><span style={{ color: netToFamily < mo * 12 ? t.warn : t.accent }}>{fmt(netToFamily)}</span></div>}
                    </div>
                  </div>
                );
              })()}
              {success && <div style={{ color: t.accent, fontSize: 15 }}>✓ SYNC COMMITTED</div>}
              <button onClick={handleGuided} style={{ width: '100%', padding: 14, background: t.accent, color: t === THEMES.dark ? '#000' : '#FFF', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>BUILD & SYNC</button>
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
function SettingsPanel({ open, settings, onToggle, onSetPayFrequency, onExport, onClear, onClose, onToggleTheme, isDark, t }) {
  const [confirm, setConfirm] = useState('');
  if (!open) return null;
  const mods = [{ key: 'macroBanner', label: 'Macro Banner (top strip)' }, { key: 'directive', label: 'Daily Directive' }, { key: 'netWorth', label: 'Net Worth' }, { key: 'debt', label: 'Debt Destruction' }, { key: 'planner', label: 'Bills & Payday Planner' }, { key: 'eFund', label: 'Emergency Fund' }, { key: 'budget', label: 'Budget Status' }, { key: 'transactions', label: 'Transactions' }, { key: 'protection', label: 'Protection Layer' }, { key: 'portfolio', label: 'Portfolio' }, { key: 'macro', label: 'Macro Signals' }, { key: 'market', label: 'Market Intelligence' }];
  const payFrequency = String(settings?.payFrequency || 'WEEKLY').toUpperCase();
  const payFrequencyOptions = [
    { key: 'WEEKLY', label: 'Weekly' },
    { key: 'BIWEEKLY', label: 'Bi-Weekly' },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 280, background: t.surface, borderLeft: `1px solid ${t.borderDim}`, height: '100%', padding: 20, overflow: 'auto', animation: 'slideIn 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}><X size={14} style={{ color: t.textSecondary }} /></button>
        </div>
        <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Theme</div>
        <div onClick={onToggleTheme} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: `1px solid ${t.borderDim}`, marginBottom: 16 }}>
          <span style={{ fontSize: 15, color: t.textPrimary }}>{isDark ? 'Noir (Dark)' : 'Tactical (Light)'}</span>
          {isDark ? <Moon size={14} style={{ color: t.accent }} /> : <Sun size={14} style={{ color: t.accent }} />}
        </div>
        <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Modules</div>
        {mods.map(m => {
          const on = settings.visibleModules.includes(m.key); return (
            <div key={m.key} onClick={() => onToggle(m.key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: `1px solid ${t.borderDim}` }}>
              <span style={{ fontSize: 15, color: on ? t.textPrimary : t.textDim }}>{m.label}</span>
              <div style={{ width: 28, height: 14, borderRadius: 7, background: on ? t.accentMuted : t.elevated, position: 'relative', transition: 'background 0.2s' }}><div style={{ width: 10, height: 10, borderRadius: '50%', position: 'absolute', top: 2, left: on ? 16 : 2, background: on ? t.accent : t.textDim, transition: 'left 0.2s' }} /></div>
            </div>);
        })}
        <div style={{ marginTop: 20, color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Pay Schedule</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          {payFrequencyOptions.map(opt => {
            const isActive = payFrequency === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onSetPayFrequency?.(opt.key)}
                style={{
                  width: '100%',
                  padding: '8px 6px',
                  background: isActive ? t.accentMuted : t.surface,
                  border: `1px solid ${isActive ? t.accent : t.borderDim}`,
                  color: isActive ? t.accent : t.textSecondary,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div style={{ color: t.textDim, fontSize: 15, marginBottom: 10 }}>Applies to payday timeline and ticker calculations.</div>
        <div style={{ marginTop: 20, color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Data</div>
        <button onClick={onExport} style={{ width: '100%', padding: 8, background: 'none', border: `1px solid ${t.borderDim}`, color: t.textSecondary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={12} /> Export All</button>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder='Type CONFIRM to clear' style={{ background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '6px 8px', width: '100%', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
        <button onClick={() => { if (confirm === 'CONFIRM') { onClear(); setConfirm(''); } }} disabled={confirm !== 'CONFIRM'} style={{ width: '100%', padding: 8, background: confirm === 'CONFIRM' ? t.danger + '20' : t.elevated, border: `1px solid ${confirm === 'CONFIRM' ? t.danger : t.borderDim}`, color: confirm === 'CONFIRM' ? t.danger : t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: confirm === 'CONFIRM' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Trash2 size={12} /> Clear History</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD MODULES
// ═══════════════════════════════════════════════════
function NetWorthMod({ snapshots, latest, visible, t }) {
  const [detailMode, setDetailMode] = useState('grouped');
  if (!visible) return null;
  const nw = latest?.netWorth || {};
  const assets = nw.assets || {};
  const cryptoVal = (latest?.portfolio?.crypto || []).reduce((s, c) => s + (Number(c.amount) || 0) * (Number(c.lastPrice) || 0), 0);
  const eqVal = (latest?.portfolio?.equities || []).reduce((s, e) => s + (Number(e.shares) || 0) * (Number(e.lastPrice) || 0), 0);
  const tCash = (assets.checking || 0) + (assets.savings || 0) + (assets.eFund || 0) + (assets.other || 0);
  const tA = tCash + eqVal + cryptoVal;
  const tL = Object.values(nw.liabilities || {}).reduce((s, v) => s + (v || 0), 0);

  const breakdown = [
    { label: 'Checking', value: assets.checking || 0, color: t.textPrimary },
    { label: 'Savings', value: assets.savings || 0, color: t.accent },
    { label: 'E-Fund', value: assets.eFund || 0, color: t.accent },
    { label: 'Equity', value: eqVal, color: t.accent },
    { label: 'Crypto', value: cryptoVal, color: t.crypto },
    { label: 'Other', value: assets.other || 0, color: t.textSecondary },
  ].filter(b => b.value > 0);

  const liabilitiesList = Object.entries(nw.liabilities || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter(l => l.value > 0)
    .sort((a, b) => b.value - a.value);
  const debtDetailsByName = new Map(
    (latest?.debts || []).map((debt) => [
      debt.name,
      {
        debtType: debt?.debtType || null,
        apr: Number(debt?.apr || 0),
        dueDate: debt?.dueDate || '',
      },
    ])
  );

  const bnplDebts = (latest?.debts || []).filter(d => d?.debtType === 'bnpl' && (Number(d?.balance) || 0) > 0);
  const bnplNames = new Set(bnplDebts.map(d => d.name));
  const bnplTotal = bnplDebts.reduce((sum, debt) => sum + (Number(debt.balance) || 0), 0);
  const revolvingLiabilities = liabilitiesList.filter(item => !bnplNames.has(item.name));
  const groupedLiabilities = [];

  if (revolvingLiabilities[0]) groupedLiabilities.push(revolvingLiabilities[0]);
  if (revolvingLiabilities[1]) groupedLiabilities.push(revolvingLiabilities[1]);
  if (revolvingLiabilities[2]) groupedLiabilities.push(revolvingLiabilities[2]);
  if (bnplTotal > 0) {
    groupedLiabilities.push({
      name: `BNPL Stack (${bnplDebts.length})`,
      value: bnplTotal,
      detail: `${bnplDebts.length} accounts`,
    });
  }
  const groupedNames = new Set(groupedLiabilities.map(item => item.name));
  const otherDebtTotal = liabilitiesList
    .filter(item => !groupedNames.has(item.name) && !bnplNames.has(item.name))
    .reduce((sum, item) => sum + item.value, 0);
  if (otherDebtTotal > 0) {
    groupedLiabilities.push({
      name: 'Other Debts',
      value: otherDebtTotal,
      detail: `${Math.max(0, liabilitiesList.length - groupedLiabilities.length - bnplDebts.length)} smaller debts`,
    });
  }

  const mapAssets = breakdown.map(b => ({ label: b.label, value: b.value, color: b.color }));
  const mapLiabs = groupedLiabilities.map(l => ({
    label: l.name,
    value: l.value,
    detail: l.detail || null,
  }));
  const mapTotal = [...mapAssets, ...mapLiabs].reduce((s, x) => s + (x.value || 0), 0) || 1;

  if (mapAssets.length === 0 && mapLiabs.length === 0) return null;

  return (
    <div style={{ border: `1px solid ${t.borderDim}`, background: t.surface, padding: '10px 14px', minWidth: 0, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Money Map</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <span><span style={{ color: t.textDim, fontSize: 14 }}>ASSETS </span><span style={{ color: t.accent }}>{fmt(tA)}</span></span>
            <span><span style={{ color: t.textDim, fontSize: 14 }}>LIABILITIES </span><span style={{ color: t.danger }}>{fmt(tL)}</span></span>
          </div>
          <div style={{ display: 'inline-flex', border: `1px solid ${t.borderDim}` }}>
            {['grouped', 'detailed'].map(mode => (
              <button
                key={mode}
                onClick={() => setDetailMode(mode)}
                style={{
                  background: detailMode === mode ? t.elevated : 'transparent',
                  color: detailMode === mode ? t.textPrimary : t.textDim,
                  border: 'none',
                  borderLeft: mode === 'detailed' ? `1px solid ${t.borderDim}` : 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Map tiles */}
      <div style={{ display: 'grid', gap: 3 }}>
        {mapAssets.length > 0 && (
          <div style={{ display: 'flex', gap: 3, minHeight: 44, minWidth: 0 }}>
            {mapAssets.map((a, i) => (
              <div key={`ma-${i}`} style={{
                flex: `${Math.max(1, a.value)} 1 0%`,
                flexBasis: `${Math.max(6, (a.value / mapTotal) * 100)}%`,
                minWidth: 0,
                background: t.accentMuted,
                border: `1px solid ${t.borderDim}`,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '5px 7px',
                overflow: 'hidden',
              }}>
                <span style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
                <span style={{ fontSize: 14, color: a.color, fontVariantNumeric: 'tabular-nums' }}>{fmt(a.value)}</span>
              </div>
            ))}
          </div>
        )}
        {mapLiabs.length > 0 && (
          <div style={{ display: 'flex', gap: 3, minHeight: 36, minWidth: 0 }}>
            {mapLiabs.map((l, i) => (
              <div key={`ml-${i}`} style={{
                flex: `${Math.max(1, l.value)} 1 0%`,
                flexBasis: `${Math.max(6, (l.value / mapTotal) * 100)}%`,
                minWidth: 0,
                background: `${t.danger}18`,
                border: `1px solid ${t.danger}40`,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '5px 7px',
                overflow: 'hidden',
              }}>
                <span style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.label}</span>
                <span style={{ fontSize: 14, color: t.danger, fontVariantNumeric: 'tabular-nums' }}>-{fmt(l.value)}</span>
                {l.detail && (
                  <span style={{ fontSize: 11, color: t.textGhost, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Legend */}
      {detailMode === 'grouped' && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13 }}>
          {bnplTotal > 0 && (
            <div style={{ color: t.textDim }}>
              <span style={{ color: t.danger }}>BNPL</span> {fmt(bnplTotal)} across {bnplDebts.length} accounts
            </div>
          )}
          {groupedLiabilities.some(item => item.name === 'Other Debts') && (
            <div style={{ color: t.textDim }}>
              Smaller liabilities are folded into <span style={{ color: t.textPrimary }}>Other Debts</span>.
            </div>
          )}
        </div>
      )}
      {breakdown.length > 1 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, background: b.color, opacity: 0.7, flexShrink: 0 }} />
              <span style={{ color: t.textDim }}>{b.label}</span>
              <span style={{ color: b.color }}>{fmt(b.value)}</span>
            </div>
          ))}
        </div>
      )}
      {detailMode === 'detailed' && liabilitiesList.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Liability Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {liabilitiesList.map((item, index) => {
              const meta = debtDetailsByName.get(item.name) || {};
              const debtType = meta.debtType === 'bnpl'
                ? 'BNPL'
                : meta.debtType === 'credit_card'
                  ? 'Credit Card'
                  : meta.debtType === 'loan'
                    ? 'Loan'
                    : meta.debtType || 'Debt';
              const dueText = meta.dueDate ? meta.dueDate : 'No due date';
              return (
                <div
                  key={`detail-${item.name}-${index}`}
                  style={{
                    border: `1px solid ${t.danger}30`,
                    background: `${t.danger}10`,
                    padding: '9px 10px',
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ color: t.textPrimary, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ color: t.danger, fontSize: 14, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      -{fmt(item.value)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                    <span style={{ color: t.textDim }}>{debtType}</span>
                    {meta.apr > 0 && <span style={{ color: t.warn }}>{meta.apr.toFixed(2)}% APR</span>}
                    <span style={{ color: t.textGhost }}>Due {dueText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DebtMod({ latest, visible, t, onUpdateDebt }) {
  const [extraMonthly, setExtraMonthly] = useState('');
  const [countdownDebtName, setCountdownDebtName] = useState('');
  const [panel, setPanel] = useState(null); // { name, mode: 'pay'|'balance', value }

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const openPanel = (debt, mode) => {
    const prefill = mode === 'pay'
      ? String(debt.minPayment || debt.monthlyPayment || '')
      : String(debt.balance || '');
    setPanel({ name: debt.name, mode, value: prefill });
  };

  const confirmPay = (debt) => {
    const amount = parseFloat(panel.value);
    if (!amount || amount <= 0) return;
    const isFixed = (debt.totalTerms || 0) > 0;
    let newBalance;
    const patch = {};
    if (isFixed) {
      newBalance = Math.max(0, (debt.balance || 0) - amount);
      patch.paymentsMade = newBalance <= 0
        ? (debt.totalTerms || 0)
        : Math.min((debt.totalTerms || 0), (debt.paymentsMade || 0) + 1);
    } else {
      const monthlyInterest = ((debt.balance || 0) * ((debt.apr || 0) / 100)) / 12;
      const principal = Math.max(0, amount - monthlyInterest);
      newBalance = Math.max(0, (debt.balance || 0) - principal);
    }
    const history = [...(debt._payHistory || []), { date: today, amount, type: 'payment' }].slice(-24);
    onUpdateDebt?.(debt.name, {
      ...patch,
      balance: +newBalance.toFixed(2),
      _paidCycle: thisMonth,
      _lastPaid: today,
      _lastPayAmt: amount,
      _payHistory: history,
      _paidOff: newBalance <= 0,
      _paidOffAt: newBalance <= 0 ? today : debt._paidOffAt,
    });
    setPanel(null);
  };

  const confirmBalance = (debt) => {
    const newBalance = parseFloat(panel.value);
    if (isNaN(newBalance) || newBalance < 0) return;
    const history = [...(debt._payHistory || []), { date: today, amount: newBalance, type: 'balance-update' }].slice(-24);
    onUpdateDebt?.(debt.name, {
      balance: +newBalance.toFixed(2),
      paymentsMade: (debt.totalTerms || 0) > 0 && newBalance <= 0 ? (debt.totalTerms || 0) : debt.paymentsMade,
      _balanceUpdated: today,
      _payHistory: history,
      _paidOff: newBalance <= 0,
      _paidOffAt: newBalance <= 0 ? today : debt._paidOffAt,
    });
    setPanel(null);
  };

  const debts = useMemo(() => {
    const isActiveDebt = (debt) => {
      const balance = Number(debt?.balance || 0);
      const totalTerms = Number(debt?.totalTerms || 0);
      const paymentsMade = Number(debt?.paymentsMade || 0);
      if (totalTerms > 0) return balance > 0 && paymentsMade < totalTerms;
      return balance > 0;
    };
    return [...(latest?.debts || [])].filter(isActiveDebt).sort((a, b) => {
      // Fixed-term debts sort by payments remaining (ascending), revolving by APR (descending)
      const aFixed = (a.totalTerms || 0) > 0;
      const bFixed = (b.totalTerms || 0) > 0;
      if (aFixed && !bFixed) return 1; // revolving first (higher priority for avalanche)
      if (!aFixed && bFixed) return -1;
      if (aFixed && bFixed) return ((a.totalTerms - (a.paymentsMade || 0)) - (b.totalTerms - (b.paymentsMade || 0)));
      return (b.apr || 0) - (a.apr || 0);
    });
  }, [latest?.debts]);
  const completedDebts = useMemo(
    () => (latest?.debts || []).filter(debt => !debts.some(activeDebt => activeDebt.name === debt.name) && (Number(debt?.balance || 0) <= 0)),
    [latest?.debts, debts]
  );
  const revolving = debts.filter(d => !(d.totalTerms > 0));
  const recommendedTarget = revolving[0] || debts[0] || null;

  useEffect(() => {
    if (!recommendedTarget) {
      if (countdownDebtName) setCountdownDebtName('');
      return;
    }
    if (!debts.some(debt => debt.name === countdownDebtName)) {
      setCountdownDebtName(recommendedTarget.name);
    }
  }, [countdownDebtName, debts, recommendedTarget]);

  const countdownDebt = debts.find(debt => debt.name === countdownDebtName) || recommendedTarget;
  const total = totalDebt(debts);
  const di = dailyInterest(debts);
  const maxB = debts.length ? Math.max(...debts.map(d => d.balance || 0)) : 1;

  // ── Projected Freedom Date (avalanche target debt) ──────────────────────
  const _income = latest?.budget?.income || latest?._meta?.income || 0;
  const _spent = totalBudgetSpent(latest);
  const _surplus = Math.max(0, _income - _spent);
  const calcPayoffProjection = (debt, extraMonthlyInput = 0) => {
    if (!debt || (debt.balance || 0) <= 0) return null;
    const basePayment = Math.max(0, debt.minPayment || debt.monthlyPayment || 0);
    const totalPayment = basePayment + _surplus + Math.max(0, extraMonthlyInput || 0);
    if (totalPayment <= 0) return null;
    const monthlyRate = (debt.apr || 0) / 100 / 12;
    const months = monthlyRate > 0 && totalPayment > monthlyRate * debt.balance
      ? Math.ceil(-Math.log(1 - (monthlyRate * debt.balance) / totalPayment) / Math.log(1 + monthlyRate))
      : Math.ceil(debt.balance / totalPayment);
    if (!isFinite(months) || months > 600) return null;
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    return {
      months,
      days: months * 30,
      dateLabel: payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      totalPayment,
    };
  };

  const calcFreedomDate = (debt) => {
    const projection = calcPayoffProjection(debt, 0);
    return projection?.dateLabel || null;
  };
  return (<Card title="Debt Destruction" visible={visible} delay={80} alert={debts.some(d => d.balance > 2000)} t={t}>
    <div style={{ marginBottom: 14 }}><div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><AnimNum value={total} /></div>
      {di > 0 && <div style={{ color: t.danger, fontSize: 14, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}><AnimNum value={di} decimals={2} style={{ color: t.danger }} />/day interest burn</div>}</div>
    {debts.length === 0 ? <div style={{ color: t.textDim, fontSize: 15 }}>No debts tracked</div> : debts.map((d, i) => {
      const isFixed = (d.totalTerms || 0) > 0;
      const pmtsMade = d.paymentsMade || 0;
      const remaining = isFixed ? d.totalTerms - pmtsMade : 0;
      const isLast = isFixed && remaining === 1;
      const isTarget = !isFixed && i === debts.indexOf(revolving[0]); // first revolving = avalanche target

      const paidThisCycle = d._paidCycle === thisMonth;
      const panelOpen = panel?.name === d.name;
      const monthlyInterestAmt = ((d.balance || 0) * ((d.apr || 0) / 100)) / 12;
      const btnStyle = (active) => ({
        background: 'none', border: `1px solid ${active ? t.accent : t.borderDim}`,
        color: active ? t.accent : t.textDim, fontSize: 15, padding: '2px 7px',
        cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.05em', textTransform: 'uppercase',
      });

      return (
        <div key={i} style={{ marginBottom: 12, borderLeft: isTarget ? `2px solid ${t.accent}` : 'none', paddingLeft: isTarget ? 8 : isFixed ? 0 : 10 }}>

          {/* ── Row header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: t.textSecondary }}>
                {d.name}
                {isFixed && <span style={{ fontSize: 15, color: t.textDim, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${t.borderDim}`, padding: '1px 4px' }}>{d.type === 'BNPL' ? 'BNPL' : 'TERM'}</span>}
                {!isFixed && <span style={{ color: t.textDim }}> ({d.apr}%)</span>}
              </span>
              {isTarget && (
                <span style={{ fontSize: 11, background: `${t.danger}22`, color: t.danger, border: `1px solid ${t.danger}`, padding: '1px 7px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", animation: 'radarFadeUp 0.3s ease-out', textTransform: 'uppercase' }}>
                  ⚡ ATTACK TARGET
                </span>
              )}
              {paidThisCycle && (
                <span style={{ fontSize: 15, background: t.accentMuted, color: t.accent, padding: '1px 6px', fontWeight: 700, letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace" }}>
                  ✓ PAID {d._lastPayAmt ? fmt(d._lastPayAmt) : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>
                {isFixed
                  ? <span style={{ color: isLast ? t.accent : t.textSecondary }}>{pmtsMade} of {d.totalTerms} PMTS</span>
                  : <span>{fmt(d.balance)} <span style={{ color: t.textDim, fontSize: 14 }}>min {fmt(d.minPayment)}/mo</span></span>
                }
              </span>
              {onUpdateDebt && <>
                <button style={btnStyle(panelOpen && panel.mode === 'pay')} onClick={() => panelOpen && panel.mode === 'pay' ? setPanel(null) : openPanel(d, 'pay')}>⚡ Pay</button>
                <button style={btnStyle(panelOpen && panel.mode === 'balance')} onClick={() => panelOpen && panel.mode === 'balance' ? setPanel(null) : openPanel(d, 'balance')}>✏ Bal</button>
              </>}
            </div>
          </div>
          {/* ── Projected Freedom Date (attack target only) ── */}
          {isTarget && (() => {
            const fd = calcFreedomDate(d); return fd ? (
              <div style={{ fontSize: 12, color: t.accent, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.07em', marginBottom: 4, textTransform: 'uppercase' }}>
                PROJECTED FREE: {fd}{_surplus > 0 && <span style={{ color: t.textGhost, marginLeft: 6 }}>({fmt(_surplus)}/mo surplus applied)</span>}
              </div>
            ) : null;
          })()}

          {/* ── Inline action panel ── */}
          {panelOpen && (
            <div style={{ margin: '6px 0 8px', padding: '10px 12px', background: t.elevated, border: `1px solid ${panel.mode === 'pay' ? t.accent : t.borderMid}`, animation: 'radarFadeUp 0.15s ease-out' }}>
              {panel.mode === 'pay' ? (<>
                <div style={{ fontSize: 15, color: t.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Mark Payment — {d.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: t.textDim }}>$</span>
                  <input
                    autoFocus
                    value={panel.value}
                    onChange={e => setPanel(p => ({ ...p, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') confirmPay(d); if (e.key === 'Escape') setPanel(null); }}
                    inputMode="decimal"
                    style={{ flex: 1, background: t.input, border: `1px solid ${t.accent}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '5px 8px' }}
                  />
                  <button onClick={() => confirmPay(d)} style={{ background: t.accent, border: 'none', color: t.void, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>CONFIRM</button>
                  <button onClick={() => setPanel(null)} style={{ background: 'none', border: `1px solid ${t.borderDim}`, color: t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
                </div>
                {!isFixed && parseFloat(panel.value) > 0 && (
                  <div style={{ fontSize: 15, color: t.textDim }}>
                    Interest: <span style={{ color: t.danger }}>{fmt(monthlyInterestAmt)}</span> · Principal: <span style={{ color: t.accent }}>{fmt(Math.max(0, parseFloat(panel.value) - monthlyInterestAmt))}</span> · New balance: <span style={{ color: t.textPrimary }}>{fmt(Math.max(0, (d.balance || 0) - Math.max(0, parseFloat(panel.value) - monthlyInterestAmt)))}</span>
                  </div>
                )}
              </>) : (<>
                <div style={{ fontSize: 15, color: t.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Update Balance — {d.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: t.textDim }}>$</span>
                  <input
                    autoFocus
                    value={panel.value}
                    onChange={e => setPanel(p => ({ ...p, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') confirmBalance(d); if (e.key === 'Escape') setPanel(null); }}
                    inputMode="decimal"
                    style={{ flex: 1, background: t.input, border: `1px solid ${t.borderMid}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '5px 8px' }}
                  />
                  <button onClick={() => confirmBalance(d)} style={{ background: t.elevated, border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>UPDATE</button>
                  <button onClick={() => setPanel(null)} style={{ background: 'none', border: `1px solid ${t.borderDim}`, color: t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: 15, color: t.textDim, marginTop: 6 }}>Type the actual balance from your bank app or statement.</div>
              </>)}
            </div>
          )}

          {/* ── Progress bars ── */}
          {isFixed ? (
            <div style={{ display: 'flex', gap: 2, height: 6, marginBottom: 4 }}>
              {Array.from({ length: d.totalTerms }).map((_, idx) => {
                const filled = idx < pmtsMade;
                const isNext = idx === pmtsMade;
                const isFinal = isLast && idx === d.totalTerms - 1;
                return (<div key={idx} style={{
                  flex: 1, background: filled ? t.accent : t.elevated,
                  border: isNext ? `1px solid ${t.accent}` : `1px solid ${t.borderMid}`,
                  animation: isFinal ? 'lastSeg 1.5s ease-in-out infinite' : 'none',
                  transition: 'background 0.3s',
                }} />);
              })}
            </div>
          ) : (
            <ProgressBar percent={maxB > 0 ? (d.balance / maxB) * 100 : 0} color={isTarget ? t.danger : t.accent} t={t} />
          )}

          {/* ── Subline ── */}
          {isFixed && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: t.textDim }}>
              <span>{fmt(d.balance)} remaining{d.monthlyPayment > 0 ? ` • ${fmt(d.monthlyPayment)}/mo` : ''}</span>
              <span style={{ color: isLast ? t.accent : t.textDim }}>
                {remaining > 0 ? `${remaining} left` : '✓ COMPLETE'}
                {isLast && ' → REALLOCATE'}
              </span>
            </div>
          )}
        </div>);
    })}
    {revolving.length > 0 && <div style={{ borderTop: `1px solid ${t.borderDim}`, paddingTop: 8, marginTop: 4, fontSize: 14, color: t.textSecondary }}>Avalanche target: <span style={{ color: t.accent }}>{revolving[0]?.name}</span> ({revolving[0]?.apr}% APR)</div>}
    {completedDebts.length > 0 && (
      <div style={{ borderTop: `1px solid ${t.borderDim}`, paddingTop: 8, marginTop: 6, fontSize: 14, color: t.textDim }}>
        Cleared from active queue: <span style={{ color: t.accent }}>{completedDebts.map(d => d.name).join(', ')}</span>
      </div>
    )}
    {debts.length > 0 && di > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.borderDim}`, fontSize: 15, color: t.textDim }}>
      <span>Monthly interest: <span style={{ color: t.danger }}>{fmt(Math.round(di * 30))}</span></span>
      <span>Annual if unchanged: <span style={{ color: t.danger }}>{fmt(Math.round(di * 365))}</span></span>
    </div>}

    {/* Liberation Countdown */}
    {(() => {
      if (!countdownDebt) return null;
      const extra = Math.max(0, parseFloat(extraMonthly) || 0);
      const currentProjection = calcPayoffProjection(countdownDebt, 0);
      const acceleratedProjection = calcPayoffProjection(countdownDebt, extra);
      const accelerated50 = calcPayoffProjection(countdownDebt, 50);
      const accelerated100 = calcPayoffProjection(countdownDebt, 100);
      if (!currentProjection) return null;
      const isRecommendedTarget = countdownDebt?.name === recommendedTarget?.name;
      return (
        <div style={{ marginTop: 8, padding: '10px 12px', background: t.elevated, border: `1px solid ${t.accent}30`, borderLeft: `3px solid ${t.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 15, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>🔓 Liberation Countdown</span>
            <span style={{ fontSize: 15, color: t.textDim }}>{currentProjection.dateLabel}</span>
          </div>
          <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 8 }}>
            System priority: <span style={{ color: t.accent }}>{recommendedTarget?.name || 'None'}</span>
            {recommendedTarget?.apr > 0 && <span style={{ color: t.textGhost }}> ({recommendedTarget.apr}% APR)</span>}
          </div>
          <div style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <div style={{ fontSize: 13, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Countdown Debt</div>
            <select
              value={countdownDebt?.name || ''}
              onChange={e => setCountdownDebtName(e.target.value)}
              style={{ width: '100%', background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 8px' }}
            >
              {debts.map(debt => (
                <option key={debt.name} value={debt.name}>
                  {debt.name}{debt.apr ? ` (${debt.apr}% APR)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 14, color: isRecommendedTarget ? t.accent : t.warn, marginBottom: 8 }}>
            {isRecommendedTarget ? 'Following recommended attack target.' : `Manual target override. Redirecting pressure to ${countdownDebt.name}.`}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: t.accent }}>{currentProjection.days}</span>
            <span style={{ fontSize: 14, color: t.textSecondary }}>days to clear {countdownDebt.name} at current pace</span>
          </div>
          <div style={{ fontSize: 14, color: t.textDim, marginBottom: 8 }}>
            Attack budget now: <span style={{ color: t.textPrimary }}>{fmt(currentProjection.totalPayment)}/mo</span>
            {_surplus > 0 && <span style={{ color: t.textGhost }}> including {fmt(_surplus)}/mo free cash flow</span>}
          </div>
          <div style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Extra Payment / Month</div>
              <input value={extraMonthly} onChange={e => setExtraMonthly(e.target.value)} placeholder="100" inputMode="decimal" style={{ width: '100%', background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '6px 8px' }} />
            </div>
            {extra > 0 && acceleratedProjection && (
              <div style={{ fontSize: 15, color: t.textSecondary }}>
                With {fmt(extra)} extra: <span style={{ color: t.accent }}>{acceleratedProjection.days}d</span>
                <span style={{ color: t.textGhost }}> ({Math.max(0, currentProjection.months - acceleratedProjection.months)} mo saved, done by {acceleratedProjection.dateLabel})</span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
            <div style={{ color: t.textDim }}>
              +{fmt(50)}/mo: <span style={{ color: t.accent }}>{accelerated50?.days || currentProjection.days}d</span>
              {accelerated50 && <span style={{ color: t.textGhost }}> ({Math.max(0, currentProjection.months - accelerated50.months)} mo saved, {accelerated50.dateLabel})</span>}
            </div>
            <div style={{ color: t.textDim }}>
              +{fmt(100)}/mo: <span style={{ color: t.accent }}>{accelerated100?.days || currentProjection.days}d</span>
              {accelerated100 && <span style={{ color: t.textGhost }}> ({Math.max(0, currentProjection.months - accelerated100.months)} mo saved, {accelerated100.dateLabel})</span>}
            </div>
          </div>
        </div>
      );
    })()}
  </Card>);
}

// ═══════════════════════════════════════════════════
// BILL CALENDAR — Monthly grid with due-date markers
// ═══════════════════════════════════════════════════
function BillCalendarMod({ latest, visible, t, payFrequencyOverride }) {
  if (!visible) return null;
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const bills = latest?.bills || [];
  const debts = (latest?.debts || []).filter(d => (d.balance || 0) > 0);
  const freq = String(payFrequencyOverride || latest?.payroll?.frequency || 'WEEKLY').toUpperCase();
  const weekday = Number(latest?.payroll?.weekday ?? 5);

  // Build day → events map
  const byDay = {};
  const addEvent = (day, item) => {
    const d = Number(day);
    if (d >= 1 && d <= daysInMonth) {
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(item);
    }
  };

  bills.forEach(b => {
    if (b.dueDay) addEvent(b.dueDay, { name: b.name || 'Bill', amount: b.amount || 0, kind: 'bill' });
  });

  debts.forEach(d => {
    if (!d.dueDate) return;
    const parsed = new Date(d.dueDate);
    if (!isNaN(parsed)) addEvent(parsed.getDate(), { name: d.name || 'Debt', amount: d.monthlyPayment || d.minPayment || 0, kind: 'debt' });
  });

  // Generate paydays for this specific month
  const paydayDays = new Set();
  if (freq === 'WEEKLY') {
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month, d).getDay() === weekday) paydayDays.add(d);
    }
  } else if (freq === 'BIWEEKLY') {
    let first = null;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month, d).getDay() === weekday) { first = d; break; }
    }
    if (first) for (let d = first; d <= daysInMonth; d += 14) paydayDays.add(d);
  } else if (freq === 'SEMIMONTHLY') {
    paydayDays.add(1); paydayDays.add(15);
  } else if (freq === 'MONTHLY') {
    paydayDays.add(1);
  }

  // Build flat cells array (nulls for empty prefix/suffix)
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ border: `1px solid ${t.borderDim}`, background: t.surface, padding: '12px 14px' }}>
      {/* Nav header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 6px' }}
        >‹</button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{monthLabel}</div>
          <div style={{ fontSize: 15, color: t.textGhost, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bill Calendar</div>
        </div>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 6px' }}
        >›</button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 3 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ fontSize: 14, color: t.textGhost, textAlign: 'center', fontWeight: 700, letterSpacing: '0.06em', paddingBottom: 2 }}>{d}</div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
          {week.map((day, di) => {
            if (day === null) return <div key={di} style={{ minHeight: 36 }} />;
            const isToday = isCurrentMonth && day === todayDay;
            const events = byDay[day] || [];
            const isPay = paydayDays.has(day);
            const isPast = isCurrentMonth && day < todayDay;
            const dayTotal = events.reduce((s, e) => s + (e.amount || 0), 0);
            const heatAlpha = dayTotal >= 1000 ? '80' : dayTotal >= 500 ? '55' : dayTotal >= 100 ? '35' : dayTotal >= 1 ? '18' : '00';
            const heatBg = heatAlpha !== '00' ? `${t.danger}${heatAlpha}` : 'transparent';

            return (
              <div key={di} style={{
                minHeight: 36,
                padding: '3px 2px 2px',
                textAlign: 'center',
                background: isToday ? `${t.accent}22` : heatBg,
                border: `1px solid ${isToday ? t.accent + '55' : dayTotal >= 500 ? t.danger + '55' : t.borderDim + '44'}`,
                overflow: 'hidden',
                opacity: isPast ? 0.45 : 1,
              }}>
                <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? t.accent : t.textPrimary, lineHeight: 1, marginBottom: 2 }}>
                  {day}
                </div>
                {isPay && (
                  <div title="Payday" style={{ width: 4, height: 4, borderRadius: '50%', background: t.accent, margin: '0 auto 1px', opacity: 0.95 }} />
                )}
                {events.slice(0, 3).map((e, ei) => (
                  <div key={ei} title={`${e.name}: ${fmt(e.amount)}`} style={{
                    width: '100%', height: 2, background: e.kind === 'debt' ? t.warn : t.danger,
                    marginBottom: 1, opacity: 0.85,
                  }} />
                ))}
                {events.length > 3 && <div style={{ fontSize: 14, color: t.textGhost }}>+{events.length - 3}</div>}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${t.borderDim}`, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 2, background: t.danger, opacity: 0.85 }} />
          <span style={{ fontSize: 14, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bill</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 2, background: t.warn, opacity: 0.85 }} />
          <span style={{ fontSize: 14, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debt Payment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: t.accent, opacity: 0.95 }} />
          <span style={{ fontSize: 14, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payday</span>
        </div>
      </div>
    </div>
  );
}

function PlannerMod({ latest, visible, t, payFrequencyOverride }) {
  if (!visible) return null;
  const bills = latest?.bills || [];
  const debts = latest?.debts || [];
  const payroll = { ...(latest?.payroll || { frequency: 'WEEKLY', weekday: 2 }), frequency: String(payFrequencyOverride || latest?.payroll?.frequency || 'WEEKLY').toUpperCase() };
  const today = new Date();
  const nextMonthlyDate = (day) => {
    const d = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(31, day)));
    if (d < today) d.setMonth(d.getMonth() + 1);
    return d;
  };
  const billEvents = bills.map(b => ({
    label: b.name || 'Bill',
    date: nextMonthlyDate(Number(b.dueDay || 1)),
    amount: Number(b.amount || 0),
    type: 'bill',
  }));
  const debtEvents = debts
    .filter(d => d.dueDate && (d.balance || 0) > 0)
    .map(d => ({
      label: d.name || 'Debt',
      date: new Date(d.dueDate),
      amount: Number(d.monthlyPayment || d.minPayment || 0),
      type: 'debt',
    }));
  const paydayEvents = nextPayrollDates(payroll, 4).map(d => ({
    label: `Payday (${payroll.frequency === 'BIWEEKLY' ? 'Bi-Weekly' : 'Weekly'})`,
    date: d,
    amount: Number(latest?.budget?.income || latest?._meta?.income || 0) / payPeriodsPerMonth(payroll.frequency),
    type: 'payday',
  }));
  const timeline = [...billEvents, ...debtEvents, ...paydayEvents]
    .filter(e => e.date && !Number.isNaN(e.date.getTime()))
    .sort((a, b) => a.date - b.date)
    .slice(0, 8);

  return (
    <Card title="Bills & Payday Planner" visible={visible} delay={120} t={t}>
      <div style={{ display: 'grid', gap: 8 }}>
        {timeline.length === 0 && <div style={{ color: t.textDim, fontSize: 15 }}>No bill or payday events tracked yet. Add in Manual Sync.</div>}
        {timeline.map((e, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.borderDim}`, paddingBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, color: e.type === 'payday' ? t.accent : e.type === 'debt' ? t.warn : t.textPrimary }}>{e.label}</div>
              <div style={{ fontSize: 15, color: t.textDim }}>{e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
            <div style={{ fontSize: 14, color: e.type === 'payday' ? t.accent : t.textSecondary }}>
              {e.amount > 0 ? `${e.type === 'payday' ? '+' : '-'}${fmt(e.amount)}` : '—'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EFundMod({ latest, visible, t }) {
  const ef = latest?.eFund || {}; const bal = ef.balance || 0; const monthly = monthlySpendBaseline(latest);
  const targets = efundTargets(monthly); const days = runwayDaysFromLatest(latest);
  const phase = (monthly > 0 && bal >= targets[3]) ? 4 : (monthly > 0 && bal >= targets[2]) ? 3 : (monthly > 0 && bal >= targets[1]) ? 2 : bal >= targets[0] ? 1 : 0;
  const labels = ['$1K Starter', '1 Month', '3 Months', '6 Months'];
  const maxTarget = targets[3] || 6000;
  const wallBlocks = 12;
  // Wall scales to current phase goal: Phase 0 → $1K starter, otherwise full 6-month target
  const wallTarget = phase === 0 ? (targets[0] || 1000) : maxTarget;
  const perBlock = wallTarget / wallBlocks;
  const filledBlocks = Math.min(wallBlocks, Math.floor((bal / wallTarget) * wallBlocks));
  const stageClear = filledBlocks === wallBlocks;
  const rColor = runwayColor(days, t);

  // ── Projected runway gain from next paycheck ──
  const payroll = latest?.payroll || {};
  const nextDates = nextPayrollDates(payroll, 1);
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const freq = String(payroll?.frequency || 'WEEKLY').toUpperCase();
  const periodsPerMonth = freq === 'BIWEEKLY' ? 2 : 4;
  const perPeriod = income > 0 ? income / periodsPerMonth : 0;
  const runwayGain = (monthly > 0 && perPeriod > 0) ? Math.floor(perPeriod / (monthly / 30)) : 0;
  const nextPayday = nextDates[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToPayday = nextPayday ? Math.ceil((nextPayday - today) / (1000 * 60 * 60 * 24)) : null;

  return (<Card title="Emergency Fund" visible={visible} delay={160} t={t}>

    {/* ── Runway Counter — centrepiece ── */}
    <div style={{ textAlign: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${t.borderDim}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 10 }}>
        <div style={{ fontSize: 52, fontWeight: 900, color: rColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1, textShadow: days >= 90 ? `0 0 20px ${rColor}` : 'none', transition: 'color 0.5s, text-shadow 0.5s' }}>
          {days}
        </div>
        {runwayGain > 0 && daysToPayday !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingTop: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.accent, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>+{runwayGain}d</span>
            <span style={{ fontSize: 10, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>payday in {daysToPayday}d</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: rColor, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
        {days === 0 ? '⚠ DAYS OF RUNWAY — BUILD NOW' : days < 30 ? `⚠ DAYS OF RUNWAY — FRAGILE` : days < 90 ? '↑ DAYS OF RUNWAY — BUILDING' : '✓ DAYS OF RUNWAY — SECURE'}
      </div>
    </div>

    {/* ── Fortress Wall ── */}
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: stageClear ? t.accent : t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", fontWeight: stageClear ? 700 : 400, textShadow: stageClear ? `0 0 10px ${t.accent}` : 'none' }}>
          FORTRESS WALL — {filledBlocks}/{wallBlocks} LAYERS
        </span>
        {stageClear
          ? <span style={{ fontSize: 10, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, animation: 'radarFadeUp 0.4s ease-out', letterSpacing: '0.1em' }}>⬤ STAGE CLEAR</span>
          : <span style={{ fontSize: 10, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(perBlock)}/block · {fmt(wallTarget)} target</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 2, boxShadow: stageClear ? `0 0 12px ${t.accent}40` : 'none', transition: 'box-shadow 0.6s' }}>
        {Array.from({ length: wallBlocks }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 18, borderRadius: 1,
            background: i < filledBlocks ? t.accent : 'transparent',
            border: i < filledBlocks ? `1px solid ${t.accent}` : `1px dashed ${t.borderDim}80`,
            transition: `background 0.4s ease ${i * 0.06}s, border-color 0.4s ease ${i * 0.06}s`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: t.void, userSelect: 'none',
          }}>
            {i < filledBlocks ? '🛡' : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textGhost, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        <span>$0</span><span>{fmt(wallTarget / 2)}</span><span>{fmt(wallTarget)}</span>
      </div>
    </div>

    {/* ── Compact data row ── */}
    <div className="efund-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
      <div><div style={{ color: t.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Balance</div><div style={{ fontSize: 15, fontWeight: 700 }}><AnimNum value={bal} /></div></div>
      <div>
        <div style={{ color: t.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Monthly</span>
          <InfoTip t={t} align="right" direction="down" text="Your current monthly spending baseline used for runway. It prioritizes actual budget spending, then synced statement spending, then your saved monthly expense fallback." />
        </div>
        <div style={{ fontSize: 15, color: t.textSecondary }}>{fmt(monthly)}</div>
      </div>
      <div><div style={{ color: t.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Phase</div><div style={{ fontSize: 15, color: t.textSecondary }}>{phase}/4</div></div>
      <div><div style={{ color: t.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Next</div><div style={{ fontSize: 11, color: t.accentDim }}>{labels[Math.min(phase, 3)]}</div></div>
    </div>
  </Card>);
}

function FortressOfCashHero({ latest, t }) {
  const balance = Number(latest?.eFund?.balance || 0);
  const monthly = monthlySpendBaseline(latest);
  const runway = runwayDaysFromLatest(latest);
  const targets = efundTargets(monthly);
  const phase = (monthly > 0 && balance >= targets[3]) ? 4 : (monthly > 0 && balance >= targets[2]) ? 3 : (monthly > 0 && balance >= targets[1]) ? 2 : balance >= (targets[0] || 1000) ? 1 : 0;
  const nextTarget = targets[Math.min(phase, 3)] || 1000;
  const tone = runway >= 90 ? t.accent : runway >= 30 ? t.warn : t.danger;
  const elevatedSurface = (t.void || '#ffffff').replace('#', '').slice(0, 2).toLowerCase() === '00' ? t.elevated : t.surface;
  const toneSoft = runway >= 90 ? `${t.accent}14` : runway >= 30 ? `${t.warn}12` : `${t.danger}12`;
  const accentAlt = runway >= 90 ? t.purple : t.accent;
  const targetPct = nextTarget > 0 ? Math.max(0, Math.min(100, (balance / nextTarget) * 100)) : 0;
  const directive = runway >= 90
    ? 'Optionality is alive. Protect it.'
    : runway >= 30
      ? 'Cash is forming, but not yet fortress-grade.'
      : 'Every spare dollar should strengthen this wall.';

  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${tone}55`,
        background: `linear-gradient(135deg, ${t.panel} 0%, ${toneSoft} 55%, ${t.panel} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px 18px',
        boxShadow: `inset 0 0 0 1px ${t.borderDim}, 0 0 0 1px ${tone}12`,
      }}
    >
      <div style={{ position: 'absolute', inset: '0 auto auto 0', width: '100%', height: 2, background: tone, opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 180, height: 180, background: `radial-gradient(circle, ${accentAlt}18 0%, transparent 72%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.28, backgroundImage: `linear-gradient(${t.borderDim}55 1px, transparent 1px), linear-gradient(90deg, ${t.borderDim}33 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <div className="fortress-hero-shell" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="fortress-hero-copy" style={{ minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px', border: `1px solid ${tone}55`, color: tone, background: toneSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
            <span style={{ color: accentAlt }}>SECTOR-03</span>
            <span>Fortress of Cash</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 34, lineHeight: 1.02, color: t.textPrimary, fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
            {directive}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: accentAlt, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
            Liquidity Architecture // Reserve Integrity // Optionality Retention
          </div>
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: t.textSecondary, maxWidth: 760 }}>
            Emergency liquidity is what buys time when policy, income, or markets turn against you. This is the capital reserve that keeps one bad month from becoming a structural mistake.
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Wall Integrity</span>
              <div style={{ flex: '1 1 220px', minWidth: 140, height: 8, border: `1px solid ${t.borderDim}`, background: elevatedSurface, position: 'relative' }}>
                <div style={{ height: '100%', width: `${targetPct}%`, background: `linear-gradient(90deg, ${tone}, ${accentAlt})`, boxShadow: `0 0 12px ${tone}55` }} />
              </div>
              <span style={{ fontSize: 11, color: tone, fontWeight: 700, minWidth: 48, textAlign: 'right' }}>{Math.round(targetPct)}%</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textGhost }}>
              <span>Current Phase P{phase}</span>
              <span style={{ color: tone }}>Target {fmt(nextTarget)}</span>
              <span>{fmt(balance)} deployed</span>
            </div>
          </div>
        </div>
        <div className="fortress-hero-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(112px, 1fr))', gap: 10, minWidth: 'min(100%, 360px)', flex: '1 1 360px' }}>
          <div style={{ border: `1px solid ${tone}55`, background: elevatedSurface, padding: '11px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: tone }} />
            <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Runway</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: tone }}>{runway}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: t.textDim }}>days protected</div>
          </div>
          <div style={{ border: `1px solid ${accentAlt}55`, background: elevatedSurface, padding: '11px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accentAlt }} />
            <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Balance</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: t.textPrimary }}>{fmt(balance)}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: t.textDim }}>monthly burn {fmt(monthly)}</div>
          </div>
          <div style={{ border: `1px solid ${t.accent}55`, background: elevatedSurface, padding: '11px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.accent }} />
            <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Next Wall</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: t.accent }}>P{phase + 1 > 4 ? 4 : phase + 1}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: t.textDim }}>{fmt(nextTarget)} target</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KnoxTerminalMod({ latest, visible, t }) {
  // Reliable dark mode detection via red-channel hex parsing
  const voidHex = (t.void || '#ffffff').replace('#', '');
  const isDarkKnox = parseInt(voidHex.slice(0, 2), 16) < 20;

  const cats = buildProtectionFirstBudget(
    latest?.budget?.income || latest?._meta?.income || 0,
    latest?.budget?.categories || [],
    latest
  );
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const velocity = calcVelocity(latest || {});
  const stage = calcStage(latest || {});
  const debts = latest?.debts || [];
  const days = runwayDaysFromLatest(latest);
  const di = dailyInterest(debts);

  // ── Tier 1: Medical / Health Shield ────────────────────────────
  const medCat = cats.find(c => c.name === 'Medical');
  const medAllocated = (medCat?.budgeted || 0) > 0;
  const medCovered = medAllocated && (medCat?.actual || 0) <= (medCat?.budgeted || 0);
  const medStatus = medCovered
    ? `DEFENSE ACTIVE — ${fmt(medCat?.actual || 0)} / ${fmt(medCat?.budgeted || 0)}`
    : medAllocated
      ? `BREACH — ${fmt(medCat?.actual || 0)} vs ${fmt(medCat?.budgeted || 0)}`
      : 'VITAL DEFENSE OFFLINE';

  // ── Tier 1: Essentials ─────────────────────────────────────────
  const essCat = cats.find(c => c.name === 'Essentials');
  const essCovered = (essCat?.budgeted || 0) > 0 && (essCat?.actual || 0) <= (essCat?.budgeted || 0);
  const essStatus = essCat
    ? `${fmt(essCat.actual || 0)} / ${fmt(essCat.budgeted || 0)}`
    : 'NOT FOUND';

  // ── Tier 2: Fortress Wall Phase 1 ─────────────────────────────
  const ef = latest?.emergencyFund || {};
  const efBal = ef.balance || 0;
  const efPhase1Target = 1000;
  const efPhase1Done = efBal >= efPhase1Target;
  const efStatus = efPhase1Done
    ? `PERIMETER SECURED — ${fmt(efBal)} deployed`
    : `${fmt(efBal)} / ${fmt(efPhase1Target)} (${Math.round((efBal / efPhase1Target) * 100)}% complete)`;

  // ── Tier 2: NL violations ─────────────────────────────────────
  const discCat = cats.find(c => c.name === 'Discretionary');
  const subPct = income > 0 && discCat ? ((discCat.actual || 0) / income) * 100 : 0;
  const redirectAmt = (!efPhase1Done && discCat) ? (discCat.actual || 0) : 0;
  const blownCats = cats.filter(c => c.budgeted > 0 && c.actual > c.budgeted && c.name !== 'Medical');

  // ── Tier 3: Debt / Liberation ──────────────────────────────────
  const hasConsumerDebt = debts.some(d => (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const highApr = debts.filter(d => (d.apr || 0) >= 20 && (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const totalMins = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
  const debtService = cats.find(c => c.name === 'Debt Service');
  const minOnlyOnHighApr = highApr.length > 0 && debtService && totalMins > 0
    && debtService.actual > 0 && debtService.actual <= totalMins * 1.05;
  const hasPositions = (latest?.portfolio?.equities?.length || 0) > 0
    || (latest?.portfolio?.crypto?.length || 0) > 0;
  const isFinancialChaos = hasConsumerDebt && hasPositions && stage <= 2;
  const totalDebt = debts.reduce((s, d) => s + (d.balance || 0), 0);

  // ── Velocity ───────────────────────────────────────────────────
  const velPct = Math.round(velocity * 100);
  const velOk = velocity >= 0.20 || income === 0;
  const velCritical = velocity < 0.10 && income > 0;

  // ── Build scan lines ───────────────────────────────────────────
  const lines = [];

  lines.push({ sep: 'TIER 1 ◈ VITAL INTEGRITY' });
  if (medAllocated || (medCat?.actual || 0) > 0) {
    lines.push({
      tag: !medAllocated ? 'WARNING' : !medCovered ? 'WARNING' : 'VERIFIED',
      label: !medAllocated ? 'Vital Defense Unallocated' : !medCovered ? 'Vital Defense Breached' : 'Vital Defense Active',
      status: medStatus,
      ok: medCovered && medAllocated,
      rec: !medAllocated
        ? 'Allocate Medical budget. System vulnerability: ELEVATED.'
        : !medCovered ? 'Medical perimeter breached — freeze all non-Medical outflow until defense is restored.' : null,
    });
  }
  lines.push({
    tag: !essCat ? 'WARNING' : !essCovered ? 'WARNING' : 'VERIFIED',
    label: !essCovered ? 'Supply Lines Compromised' : 'Supply Lines Secured',
    status: essStatus,
    ok: essCovered,
    rec: !essCovered && essCat
      ? `Supply lines over capacity by ${fmt((essCat.actual || 0) - (essCat.budgeted || 0))}. Cut fixed costs — the perimeter must hold.`
      : null,
  });

  lines.push({ sep: 'TIER 2 ◈ STRUCTURAL INTEGRITY' });
  lines.push({
    tag: efPhase1Done ? 'VERIFIED' : efBal > 0 ? 'WARNING' : 'DANGER',
    label: efPhase1Done ? 'Perimeter Secured — Fortress Wall Phase 1' : 'Secure the Perimeter — Fortress Wall Phase 1',
    status: efStatus,
    ok: efPhase1Done,
    rec: !efPhase1Done ? 'First $1,000 is the minimum viable barrier. Deploy all surplus to Fortress Wall.' : null,
  });
  if (subPct > 2 && income > 0) {
    lines.push({
      tag: 'WARNING',
      label: `Resource Seepage — ${subPct.toFixed(1)}% income bleed detected`,
      status: `${fmt(discCat?.actual || 0)} outflow — threshold 2%`,
      ok: false,
      rec: 'Tighten the valve. Terminate discretionary outflow until Fortress Wall Phase 1 is sealed.',
    });
    if (redirectAmt > 0) {
      lines.push({
        tag: 'ACTION',
        label: `Redirect ${fmt(redirectAmt)} Discretionary → Fortress Wall`,
        status: null,
        ok: true,
      });
    }
  }
  blownCats.forEach(c => {
    lines.push({
      tag: 'DANGER',
      label: `Budget Breach — ${c.name} perimeter exceeded`,
      status: `${fmt(c.actual)} vs ${fmt(c.budgeted)} (+${Math.round((c.actual / c.budgeted - 1) * 100)}%)`,
      ok: false,
      rec: `Freeze ${c.name} operations immediately. Hold all outflow until next cycle reset.`,
    });
  });
  if (di > 10) {
    lines.push({
      tag: di > 25 ? 'DANGER' : 'WARNING',
      label: 'Counterparty Siege — Capital Erosion Active',
      status: `${fmt(di)}/day — ${fmt(Math.round(di * 30))}/mo surrendered`,
      ok: false,
      rec: `Engage avalanche protocol. Attack highest APR counterparty — every day of delay costs ${fmt(di)}.`,
    });
  }
  if (days < 30) {
    lines.push({
      tag: days < 7 ? 'DANGER' : 'WARNING',
      label: days < 7 ? 'Engine Stall Imminent' : 'Fuel Reserves Critical',
      status: `${days}-day reserve — all non-essential outflow must stop`,
      ok: false,
      rec: days < 7
        ? 'All non-essential outflow terminated. Every dollar to E-Fund — survival protocol active.'
        : 'Direct next paycheck entirely to E-Fund. Restore fuel reserves before any other objective.',
    });
  }

  lines.push({ sep: 'TIER 3 ◈ LIBERATION PROGRESS' });
  if (minOnlyOnHighApr) {
    lines.push({
      tag: 'DANGER',
      label: `Counterparty Siege — ${highApr[0].name} at ${highApr[0].apr}% APR`,
      status: 'Minimum-only — avalanche protocol offline',
      ok: false,
      rec: `Deploy all surplus above minimums to ${highApr[0].name}. Minimum-only payments are slow surrender.`,
    });
  }
  if (isFinancialChaos) {
    lines.push({
      tag: 'DANGER',
      label: 'Tactical Conflict — Positions Active in Defense Mode',
      status: `Stage ${stage} — Stage 3 gate not cleared`,
      ok: false,
      rec: 'Liquidate non-essential positions. Redirect all proceeds to the avalanche — liberation requires all resources.',
    });
  }
  if (stage >= 3) {
    lines.push({
      tag: 'VERIFIED',
      label: `Stage ${stage} Active — Investment Gates Unlocked`,
      status: 'PROMOTED: Defense → Wealth Building',
      ok: true,
    });
  }
  if (!minOnlyOnHighApr && !isFinancialChaos) {
    lines.push({
      tag: totalDebt === 0 ? 'VERIFIED' : 'SCANNING',
      label: totalDebt === 0 ? 'Debt Liberated — All Counterparties Eliminated' : 'Debt Liberation Campaign',
      status: totalDebt === 0
        ? 'LIBERATION COMPLETE'
        : `${fmt(totalDebt)} outstanding — avalanche engaged`,
      ok: totalDebt === 0,
    });
  }
  lines.push({
    tag: velCritical ? 'DANGER' : !velOk ? 'WARNING' : 'SCANNING',
    label: velCritical ? 'Velocity Crisis — Budget Slash Protocol Active' : !velOk ? 'Velocity Sub-Optimal' : 'Velocity Nominal',
    status: `${velPct}% — ${velCritical ? 'CRISIS: engine failure' : !velOk ? 'INSUFFICIENT THRUST' : 'NOMINAL THRUST'}`,
    ok: velOk,
    rec: velCritical
      ? 'Execute Budget Slash Protocol immediately. Terminate all non-essential outflow.'
      : !velOk && income > 0
        ? `Re-route ${fmt(Math.round(income * 0.05))}/mo in Discretionary to restore momentum. Target: 25% velocity.`
        : null,
  });

  const criticalCount = lines.filter(l => l.tag === 'DANGER').length;
  const warnCount = lines.filter(l => l.tag === 'WARNING').length;

  const tagColor = tag => {
    if (tag === 'DANGER') return t.danger;
    if (tag === 'WARNING') return t.warn;
    if (tag === 'VERIFIED') return t.accent;
    if (tag === 'ACTION') return t.accent;
    return t.textSecondary;
  };
  const tagBg = tag => {
    if (tag === 'DANGER') return `${t.danger}18`;
    if (tag === 'WARNING') return `${t.warn}14`;
    if (tag === 'VERIFIED') return `${t.accent}10`;
    if (tag === 'ACTION') return `${t.accent}08`;
    return 'transparent';
  };

  return (
    <Card title="Agent KNOX" visible={visible} delay={280} alert={criticalCount > 0} t={t}>
      <div style={{
        background: isDarkKnox ? 'rgba(2,10,4,0.97)' : 'rgba(240,247,240,0.97)',
        border: `1px solid ${t.accent}40`,
        boxShadow: `0 0 8px ${t.accent}20, inset 0 0 20px ${t.accent}05`,
        padding: '12px 14px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, borderBottom: `1px solid ${t.accent}30`, paddingBottom: 8 }}>
          <span style={{ color: t.accent, fontWeight: 700, letterSpacing: '0.08em', fontSize: 13 }}>
            {'>'} MISSION BRIEFING
          </span>
          <span style={{ color: t.accent, animation: 'pulse 1s step-end infinite', fontSize: 14, lineHeight: 1 }}>▋</span>
          <span style={{ marginLeft: 'auto', color: t.textGhost, fontSize: 11 }}>
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        {/* Knox Pulse — Primary Directive */}
        {(() => {
          const directive = lines.find(l => !l.sep && l.tag === 'DANGER') || lines.find(l => !l.sep && l.tag === 'WARNING');
          const dirColor = directive?.tag === 'DANGER' ? t.danger : directive?.tag === 'WARNING' ? t.warn : t.accent;
          const dirText = directive
            ? `${directive.label}${directive.rec ? ' — ' + directive.rec : ''}`
            : 'All systems nominal. Sovereign Blueprint on track.';
          return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, padding: '6px 8px', background: directive ? `${dirColor}10` : `${t.accent}08`, borderLeft: `3px solid ${dirColor}`, border: `1px solid ${dirColor}28`, borderLeftWidth: 3, minWidth: 0 }}>
              <span style={{ color: dirColor, fontWeight: 700, fontSize: 10, flexShrink: 0, letterSpacing: '0.1em', paddingTop: 1 }}>DIRECTIVE</span>
              <span style={{ color: dirColor, fontSize: 11, lineHeight: 1.4, opacity: 0.9, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{dirText}</span>
            </div>
          );
        })()}

        {/* Tiered scan lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lines.map((line, i) => {
            if (line.sep) {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 4px', opacity: 0.55 }}>
                  <div style={{ flex: 1, height: 1, background: t.borderMid }} />
                  <span style={{ color: t.textGhost, fontSize: 10, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
                    {line.sep}
                  </span>
                  <div style={{ flex: 1, height: 1, background: t.borderMid }} />
                </div>
              );
            }
            return (
              <div key={i} style={{ animation: `radarFadeUp 0.3s ease-out ${i * 0.04}s both` }}>
                <div
                  className="knox-line"
                  style={{
                    background: tagBg(line.tag),
                    borderLeft: `2px solid ${tagColor(line.tag)}40`,
                  }}
                >
                  <span style={{ color: tagColor(line.tag), fontWeight: 700, fontSize: 11, flexShrink: 0, letterSpacing: '0.04em' }}>
                    [{line.tag}]
                  </span>
                  <span className="knox-line-label" style={{ color: line.ok ? t.textSecondary : tagColor(line.tag), lineHeight: 1.4 }}>
                    {line.label}
                  </span>
                  {line.status && (
                    <span className="knox-line-status" style={{ color: line.ok ? t.textDim : tagColor(line.tag), fontSize: 11, opacity: 0.85, lineHeight: 1.3 }}>
                      {line.status}
                    </span>
                  )}
                </div>
                {line.rec && (
                  <div style={{ display: 'flex', gap: 6, padding: '2px 6px 4px 20px' }}>
                    <span style={{ color: t.accent, fontSize: 10, flexShrink: 0, opacity: 0.7 }}>{'↳'} REC:</span>
                    <span className="knox-line-rec" style={{ color: t.accent, fontSize: 10, opacity: 0.75, lineHeight: 1.4 }}>{line.rec}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="knox-footer" style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.accent}20`, fontSize: 11, color: t.textGhost }}>
          <span>KNOX v2.0 | {criticalCount > 0 ? `${criticalCount} CRITICAL` : warnCount > 0 ? `${warnCount} WARNING` : '0 ALERTS'} | Stage {stage} / 7</span>
          <span style={{ color: criticalCount > 0 ? t.danger : warnCount > 0 ? t.warn : t.accent }}>
            {criticalCount > 0 ? '⬤ CRITICAL' : warnCount > 0 ? '⬤ WARNING' : '⬤ NOMINAL'}
          </span>
        </div>
      </div>
    </Card>
  );
}


function BudgetMod({ latest, visible, t }) {
  const cats = buildProtectionFirstBudget(
    latest?.budget?.income || latest?._meta?.income || 0,
    latest?.budget?.categories || [],
    latest
  );
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = totalBudgetSpent(latest);
  const surplus = income - totalSpent;
  const savingsRate = income > 0 ? ((income - totalSpent) / income) * 100 : 0;
  const velocity = calcVelocity(latest || {});

  // Daily discretionary remaining
  const disc = cats.find(c => c.name === 'Discretionary');
  const discRemaining = disc ? (disc.budgeted || 0) - (disc.actual || 0) : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const dailyDisc = daysLeft > 0 ? Math.max(0, discRemaining / daysLeft) : 0;

  const srColor = savingsRate >= 20 ? t.accent : savingsRate >= 10 ? t.warn : savingsRate > 0 ? t.warn : t.danger;

  // ═══ NEVER LIST VIOLATION DETECTION ═══
  const violations = [];
  const stage = calcStage(latest || {});
  const debts = latest?.debts || [];
  const hasConsumerDebt = debts.some(d => (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const discCat = cats.find(c => c.name === 'Discretionary');
  const subPct = income > 0 && discCat ? ((discCat.actual || 0) / income) * 100 : 0;

  // NL-1: Subscriptions > 2% of net income
  if (subPct > 2 && income > 0) violations.push({ code: 'NL-1', text: `Discretionary at ${subPct.toFixed(1)}% of income (limit: 2%)`, severity: 'warn' });
  // NL-2: Minimum-only on high-APR debt (detect if debt service = sum of minimums exactly)
  const highApr = debts.filter(d => (d.apr || 0) >= 20 && (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const totalMins = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
  const debtService = cats.find(c => c.name === 'Debt Service');
  if (highApr.length > 0 && debtService && totalMins > 0 && debtService.actual > 0 && debtService.actual <= totalMins * 1.05) {
    violations.push({ code: 'NL-2', text: `Minimum-only on ${highApr[0].name} (${highApr[0].apr}% APR) — avalanche extra payments needed`, severity: 'danger' });
  }
  // NL-3: Investment activity while consumer debt exists (check portfolio)
  const hasPositions = (latest?.portfolio?.equities?.length || 0) > 0 || (latest?.portfolio?.crypto?.length || 0) > 0;
  if (hasConsumerDebt && hasPositions && stage <= 2) {
    violations.push({ code: 'NL-3', text: 'Active positions detected during Defense Mode — Stage 3 gate not cleared', severity: 'danger' });
  }
  // NL-4: Budget blown
  const blownCats = cats.filter(c => c.budgeted > 0 && c.actual > c.budgeted && c.name !== 'Medical');
  blownCats.forEach(c => {
    violations.push({ code: 'NL-4', text: `${c.name} blown: ${fmt(c.actual)} / ${fmt(c.budgeted)} (${Math.round((c.actual / c.budgeted) * 100)}%)`, severity: 'danger' });
  });

  // ═══ BUDGET SLASH PROTOCOL ═══
  const slashActive = velocity < 0.20 && income > 0;
  const slashCrisis = velocity < 0.10 && income > 0;

  // Determine slash diagnosis
  let slashDiagnosis = '';
  const lifestyleOverspend = discCat && discCat.budgeted > 0 && discCat.actual > discCat.budgeted;
  const debtConsuming = debtService && income > 0 && (debtService.actual / income) > 0.4;
  if (lifestyleOverspend && debtConsuming) slashDiagnosis = 'DUAL: Lifestyle slashed first, then debt restructure';
  else if (lifestyleOverspend) slashDiagnosis = 'Lifestyle overspend detected — slash targeting Discretionary';
  else if (debtConsuming) slashDiagnosis = 'Debt minimums consuming wealth allocation — restructure audit needed';
  else if (slashActive) slashDiagnosis = 'Low velocity — audit all non-Essential recurring charges';

  return (<Card title="Budget Allocation" visible={visible} delay={240} alert={violations.some(v => v.severity === 'danger')} t={t}>
    {/* ═══ ENFORCEMENT ALERTS ═══ */}
    {(violations.length > 0 || slashActive) && (
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${t.borderDim}` }}>
        {/* Budget Slash Protocol Banner */}
        {slashActive && (
          <div style={{
            padding: '8px 12px', marginBottom: violations.length > 0 ? 8 : 0,
            background: slashCrisis ? t.danger + '12' : t.warn + '12',
            border: `1px solid ${slashCrisis ? t.danger : t.warn}40`,
            borderLeft: `3px solid ${slashCrisis ? t.danger : t.warn}`,
            animation: slashCrisis ? 'pulse 2s ease infinite' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertCircle size={12} style={{ color: slashCrisis ? t.danger : t.warn, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: slashCrisis ? t.danger : t.warn, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {slashCrisis ? '🚨 BUDGET SLASH — CRISIS PROTOCOL' : '⚠ BUDGET SLASH — ACTIVE'}
              </span>
              <span style={{ fontSize: 15, color: t.textDim, marginLeft: 'auto' }}>V={Math.round(velocity * 100)}% / 25% target</span>
            </div>
            <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.5 }}>{slashDiagnosis}</div>
            {slashCrisis && <div style={{ fontSize: 15, color: t.danger, marginTop: 4, textTransform: 'uppercase' }}>⬤ Lifestyle frozen — audit all non-Essential recurring charges</div>}
          </div>
        )}

        {/* Never List Violations */}
        {violations.map((v, i) => (
          <div key={i} style={{
            padding: '6px 10px', marginBottom: i < violations.length - 1 ? 4 : 0,
            background: v.severity === 'danger' ? t.danger + '08' : t.warn + '08',
            border: `1px solid ${v.severity === 'danger' ? t.danger : t.warn}30`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
          }}>
            <span style={{ color: v.severity === 'danger' ? t.danger : t.warn, fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{v.code}</span>
            <span style={{ color: t.textSecondary }}>{v.text}</span>
          </div>
        ))}
      </div>
    )}
    {/* Income / Expense / Surplus summary row */}
    {income > 0 && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${t.borderDim}` }}>
        <div>
          <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Income</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>{fmt(income)}</div>
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Spent</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fmt(totalSpent)}</div>
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Surplus</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: surplus >= 0 ? t.accent : t.danger }}>{surplus < 0 ? '-' : ''}{fmt(Math.abs(surplus))}</div>
        </div>
      </div>
    )}

    {/* Savings rate + daily discretionary */}
    {(income > 0 || discRemaining > 0) && (
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${t.borderDim}` }}>
        {income > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Savings Rate</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}%</span>
            <span style={{ fontSize: 15, color: t.textDim, marginLeft: 4 }}>/ 25% target</span>
          </div>
        )}
        {disc && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Daily Discretionary</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: dailyDisc > 5 ? t.textPrimary : t.danger }}>${dailyDisc.toFixed(2)}</span>
            <span style={{ fontSize: 15, color: t.textDim, marginLeft: 4 }}>/day • {daysLeft}d left</span>
          </div>
        )}
      </div>
    )}

    {/* Category rows */}
    {cats.length === 0 ? <div style={{ color: t.textDim, fontSize: 15 }}>No budget data</div> : <>
      {income > 0 && totalSpent === 0 && (
        <div style={{ padding: '8px 12px', marginBottom: 10, background: t.warn + '12', border: `1px solid ${t.warn}40`, borderLeft: `3px solid ${t.warn}`, fontSize: 14, color: t.warn, lineHeight: 1.5 }}>
          ⚠ Income detected ({fmt(income)}) but $0 across all categories. Re-sync via Guided tab with actual spend, or your bank CSV may need sign correction.
        </div>
      )}
      {cats.map((c, i) => {
        const pct = c.budgeted > 0 ? (c.actual / c.budgeted) * 100 : (c.actual > 0 ? 100 : 0); const isFixed = c.name === 'Essential' || c.name === 'Medical'; return (<div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14, marginBottom: 3 }}><span style={{ color: isFixed ? t.textPrimary : t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{isFixed && <Lock size={9} style={{ color: c.name === 'Medical' ? t.danger : t.accent, flexShrink: 0, marginBottom: 1 }} />}{c.name}{isFixed && <span style={{ fontSize: 9, color: c.name === 'Medical' ? t.danger : t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>FIXED</span>}</span><span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ color: t.textPrimary, fontSize: 15 }}>{fmt(c.actual)}</span>{c.budgeted > 0 && <span style={{ color: t.textDim }}>/ {fmt(c.budgeted)}</span>}<span style={{ color: pctColor(pct, t), fontSize: 15, minWidth: 32, textAlign: 'right' }}>{c.budgeted > 0 ? Math.round(pct) + '%' : ''}</span></span></div>
          {c.budgeted > 0 && <ProgressBar percent={pct} t={t} />}
          {c.budgeted === 0 && c.actual > 0 && <div style={{ height: 6, background: t.accent, marginBottom: 4, opacity: 0.5 }} />}
        </div>);
      })}
    </>}
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
  const monthly = latest?.eFund?.monthlyExpenses || monthlySpendBaseline(latest);
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
    {!hasData ? <div style={{ color: t.textDim, fontSize: 15 }}>No protection data — sync via Guided tab</div> : <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Death Benefit</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}><AnimNum value={li.deathBenefit || 0} /></div>
          {li.provider && <div style={{ fontSize: 15, color: t.textDim, marginTop: 2 }}>{li.type || 'TERM'} • {li.provider}{li.monthlyPremium > 0 ? ` • ${fmt(li.monthlyPremium)}/mo` : ''}</div>}
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Net to Family</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: coverageColor }}><AnimNum value={netToFamily} /></div>
          <div style={{ fontSize: 15, color: coverageColor, marginTop: 2 }}>{coverageMonths > 0 ? `${coverageMonths} months coverage` : 'COVERAGE GAP'}{debtTotal > 0 ? ` (−${fmt(debtTotal)} debt)` : ''}</div>
        </div>
      </div>

      {/* Funeral Buffer */}
      {fb.target > 0 && <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 3 }}>
          <span style={{ color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Funeral Buffer</span>
          <span><span style={{ color: t.textPrimary }}>{fmt(fb.current)}</span> <span style={{ color: t.textDim }}>/ {fmt(fb.target)}</span> <span style={{ color: pctColor(fbPct, t), fontSize: 14 }}>{Math.round(fbPct)}%</span></span>
        </div>
        <ProgressBar percent={fbPct} color={fb.current === 0 ? t.danger : undefined} t={t} />
      </div>}

      {/* Conversion Alert */}
      {convAlert && <div style={{ padding: '8px 10px', fontSize: 14, marginTop: 4, background: convUrgent ? t.warn + '12' : t.surface, border: `1px solid ${convUrgent ? t.warn : t.borderDim}`, color: convUrgent ? t.warn : t.textDim }}>
        {convUrgent ? '⌛ ' : '🔒 '}{convAlert}
        {li.conversionDeadline && <span style={{ color: t.textGhost, marginLeft: 8, fontSize: 14 }}>Deadline: {li.conversionDeadline}</span>}
      </div>}

      {/* Expiration */}
      {li.expirationDate && <div style={{ fontSize: 15, color: t.textGhost, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Policy expires: {li.expirationDate}</div>}
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
  const crypto = port.crypto || [];
  const now = new Date();

  const totalEquityValue = equities.reduce((s, e) => s + (e.shares || 0) * (e.lastPrice || 0), 0);
  const totalEquityCost = equities.reduce((s, e) => s + (e.shares || 0) * (e.avgCost || 0), 0);
  const equityPL = totalEquityValue - totalEquityCost;
  const totalOptionsValue = options.reduce((s, o) => s + (o.contracts || 0) * 100 * (o.lastPrice || 0), 0);
  const totalCryptoValue = crypto.reduce((s, c) => s + (Number(c.amount) || 0) * (Number(c.lastPrice) || 0), 0);
  const totalCryptoCost = crypto.reduce((s, c) => s + (Number(c.amount) || 0) * (Number(c.avgCost) || 0), 0);
  const cryptoPL = totalCryptoValue - totalCryptoCost;
  const hasData = equities.length > 0 || options.length > 0 || crypto.length > 0;

  return (<Card title="Portfolio" visible={visible} delay={360} t={t}>
    {!hasData ? <div style={{ color: t.textDim, fontSize: 15 }}>No positions tracked — sync via Guided tab</div> : <>
      {/* Summary row */}
      {(() => {
        const cols = [];
        if (equities.length > 0) cols.push('equity');
        if (options.length > 0) cols.push('options');
        if (crypto.length > 0) cols.push('crypto');
        if (cols.length === 0) cols.push('equity'); // fallback
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: 12, marginBottom: 14 }}>
            {cols.includes('equity') && (
              <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 8 }}>
                <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Equity</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}><AnimNum value={totalEquityValue} /></div>
                {totalEquityCost > 0 && <div style={{ fontSize: 15, color: equityPL >= 0 ? t.accent : t.danger, marginTop: 2 }}>{equityPL >= 0 ? '↑' : '↓'} {fmt(Math.abs(equityPL))} P&L</div>}
              </div>
            )}
            {cols.includes('options') && (
              <div style={{ borderLeft: `2px solid ${t.purple}`, paddingLeft: 8 }}>
                <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Options</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.purple }}><AnimNum value={totalOptionsValue} /></div>
                <div style={{ fontSize: 15, color: t.purpleDim, marginTop: 2 }}>{options.length} contract{options.length !== 1 ? 's' : ''}</div>
              </div>
            )}
            {cols.includes('crypto') && (
              <div style={{ borderLeft: `2px solid ${t.crypto}`, paddingLeft: 8 }}>
                <div style={{ color: t.textDim, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Crypto</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.crypto }}><AnimNum value={totalCryptoValue} /></div>
                {totalCryptoCost > 0 && <div style={{ fontSize: 15, color: cryptoPL >= 0 ? t.crypto : t.danger, marginTop: 2 }}>{cryptoPL >= 0 ? '↑' : '↓'} {fmt(Math.abs(cryptoPL))} P&L</div>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Equity positions */}
      {equities.length > 0 && equities.map((e, i) => {
        const mv = (e.shares || 0) * (e.lastPrice || 0);
        const cost = (e.shares || 0) * (e.avgCost || 0);
        const pl = mv - cost;
        return (<div key={`eq-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${t.borderDim}`, fontSize: 15 }}>
          <div>
            <span style={{ color: t.accent, fontWeight: 700 }}>{e.ticker || '???'}</span>
            <span style={{ color: t.textDim, fontSize: 15, marginLeft: 6 }}>{e.shares} shares @ {fmt(e.avgCost)}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span>{fmt(mv)}</span>
            {cost > 0 && <span style={{ color: pl >= 0 ? t.accent : t.danger, fontSize: 15, marginLeft: 6 }}>{pl >= 0 ? '+' : ''}{fmt(pl)}</span>}
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
            <span style={{ color: t.purple, fontWeight: 700, fontSize: 15 }}>{o.ticker || '???'} {o.type || 'CALL'}</span>
            {o.strikePrice > 0 && <span style={{ color: t.textDim, fontSize: 15, marginLeft: 4 }}>${o.strikePrice}</span>}
            <div style={{ fontSize: 15, color: isUrgent ? t.purple : t.textDim }}>{o.contracts} contract{o.contracts !== 1 ? 's' : ''} • Exp: {o.expDate || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{fmt(mv)}</div>
            <div style={{ fontSize: 15, color: isExpired ? t.danger : isUrgent ? t.purple : t.textDim, textTransform: 'uppercase' }}>
              {isExpired ? 'EXPIRED' : isUrgent ? '⚡ EXPIRING' : `${daysToExp}d left`}
            </div>
          </div>
        </div>);
      })}

      {/* Crypto positions */}
      {crypto.length > 0 && (<>
        {(equities.length > 0 || options.length > 0) && <div style={{ borderTop: `1px solid ${t.borderDim}`, marginTop: 10, paddingTop: 8 }} />}
        {crypto.map((c, i) => {
          const amt = Number(c.amount) || 0;
          const price = Number(c.lastPrice) || 0;
          const cost = Number(c.avgCost) || 0;
          const mv = amt * price;
          const basis = amt * cost;
          const pl = mv - basis;
          const plPct = basis > 0 ? ((pl / basis) * 100).toFixed(1) : 0;
          return (<div key={`cr-${i}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', marginTop: 4,
            border: `1px solid ${t.crypto}30`,
            background: t.cryptoMuted,
          }}>
            <div>
              <span style={{ color: t.crypto, fontWeight: 700, fontSize: 15 }}>{c.coin || '???'}</span>
              <span style={{ color: t.textDim, fontSize: 15, marginLeft: 6 }}>{amt} @ {fmt(cost)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.crypto }}>{fmt(mv)}</div>
              {basis > 0 && <div style={{ fontSize: 15, color: pl >= 0 ? t.crypto : t.danger }}>
                {pl >= 0 ? '+' : ''}{fmt(pl)} ({pl >= 0 ? '+' : ''}{plPct}%)
              </div>}
            </div>
          </div>);
        })}
      </>)}
    </>}
  </Card>);
}

function MacroSignalsMod({ latest, visible, t, fredMacro }) {
  if (!visible) return null;
  const btcPrice = Number(fredMacro?.btc?.value || latest?.macro?.btcPrice || 0) || null;

  const msDay = 86400000;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Halving anchors ──────────────────────────────────────────────
  // Last halving: block 840,000 — April 20, 2024
  const lastHalvingUTC = Date.UTC(2024, 3, 20);
  // Next halving: block 1,050,000 — estimated ~April 18, 2028
  const nextHalvingUTC = Date.UTC(2028, 3, 18);

  // ── Position in current cycle ─────────────────────────────────
  const daysPost = Math.floor((todayUTC - lastHalvingUTC) / msDay);   // days since last halving
  const window500Closed = daysPost > 500;
  const window500EndUTC = lastHalvingUTC + 500 * msDay;

  // ── Next cycle signals ─────────────────────────────────────────
  const nextBuyUTC = nextHalvingUTC - 500 * msDay;            // 500 days pre-halving = buy zone
  const daysToNextBuy = Math.floor((nextBuyUTC - todayUTC) / msDay);
  const daysToNextHalving = Math.floor((nextHalvingUTC - todayUTC) / msDay);
  const buyZoneOpen = daysToNextBuy <= 0;

  // ── Phase (relative to last halving) ──────────────────────────
  let phase, phaseColor, phaseDesc;
  if (daysPost < 0) { phase = 'Pre-Halving'; phaseColor = t.textSecondary; phaseDesc = 'Before the April 2024 halving.'; }
  else if (daysPost <= 200) { phase = 'Early Expansion'; phaseColor = t.accent; phaseDesc = 'Post-halving. Supply shock narrative building, demand rising.'; }
  else if (daysPost <= 350) { phase = 'Mid Expansion'; phaseColor = t.accent; phaseDesc = 'Historically the strongest upside zone of the cycle.'; }
  else if (daysPost <= 500) { phase = 'Distribution'; phaseColor = t.warn; phaseDesc = 'Late expansion — near historical cycle top zone. Exercise caution.'; }
  else { phase = 'Past Peak / Wait'; phaseColor = t.danger; phaseDesc = '500-day window closed Aug 2025. Accumulation watch for next cycle.'; }

  // ── Timeline bar: position marker within −500 → +500 window ──
  // Full bar = 1000 days. Left edge = −500d (pre-halving buy zone). Centre = halving. Right = +500d.
  const posInWindow = Math.max(0, Math.min(100, ((daysPost + 500) / 1000) * 100));

  const fmtD = (utc) => new Date(utc).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <Card title="BTC 500-Day Halving Cycle" visible={visible} delay={240} t={t}>

      {/* ── Row 1: key KPIs ── */}
      <div className="fo-halving-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>BTC Price</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: t.crypto }}>{btcPrice ? fmt(btcPrice) : '—'}</div>
        </div>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Days Post-Halving</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: phaseColor, lineHeight: 1 }}>{daysPost}</div>
          <div style={{ fontSize: 15, color: t.textDim, marginTop: 2 }}>of 500-day window</div>
        </div>
        <div style={{ border: `1px solid ${t.borderDim}`, borderLeft: `2px solid ${phaseColor}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phase</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: phaseColor }}>{phase}</div>
        </div>
      </div>

      {/* ── Timeline bar: −500 ··· HALVING ··· +500 ── */}
      <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '10px 10px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          <span>−500d  Buy Zone</span>
          <span>Halving  Apr 2024</span>
          <span>+500d  Peak</span>
        </div>
        <div style={{ position: 'relative', height: 10, background: t.elevated, border: `1px solid ${t.borderDim}`, marginBottom: 6 }}>
          {/* Accumulation zone: left half (pre-halving) */}
          <div style={{ position: 'absolute', left: 0, width: '50%', height: '100%', background: `${t.accent}15` }} />
          {/* Expansion zone: 50–85% (0–350d post) */}
          <div style={{ position: 'absolute', left: '50%', width: '35%', height: '100%', background: `${t.accent}25` }} />
          {/* Distribution zone: 85–100% (350–500d post) */}
          <div style={{ position: 'absolute', left: '85%', width: '15%', height: '100%', background: `${t.warn}35` }} />
          {/* Halving marker */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: '100%', background: t.crypto, transform: 'translateX(-50%)' }} />
          {/* Current position indicator */}
          <div style={{ position: 'absolute', left: `${posInWindow}%`, top: -3, width: 4, height: 16, background: phaseColor, transform: 'translateX(-50%)', zIndex: 2 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: t.textDim, letterSpacing: '0.04em' }}>
          <span style={{ color: t.accent }}>Accumulate</span>
          <span style={{ color: t.accent }}>Expand</span>
          <span style={{ color: t.warn }}>Distribute</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: t.textSecondary, lineHeight: 1.5 }}>
          {phaseDesc}
        </div>
      </div>

      {/* ── Row 2: Last cycle window + Next cycle ── */}
      <div className="fo-halving-window-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <div style={{ borderLeft: `2px solid ${t.crypto}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last Halving</div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: t.textPrimary }}>Apr 20, 2024</div>
        </div>
        <div style={{ borderLeft: `2px solid ${window500Closed ? t.textDim : t.warn}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>+500d Window</div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: window500Closed ? t.textDim : t.warn }}>
            {fmtD(window500EndUTC)}{window500Closed ? ' ✓' : ''}
          </div>
        </div>
        <div style={{ borderLeft: `2px solid ${buyZoneOpen ? t.accent : t.purple}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {buyZoneOpen ? 'Buy Zone' : 'Next Buy Zone'}
          </div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: buyZoneOpen ? t.accent : t.purple }}>
            {buyZoneOpen ? `Open (${Math.abs(daysToNextBuy)}d in)` : `in ${daysToNextBuy}d`}
          </div>
        </div>
      </div>

      {/* ── Row 3: Next cycle countdown ── */}
      <div className="fo-halving-next-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Halving (est.)</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: t.purple }}>~Apr 18, 2028</div>
          <div style={{ fontSize: 15, color: t.textDim, marginTop: 2 }}>in {daysToNextHalving} days</div>
        </div>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Buy Window (est.)</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: buyZoneOpen ? t.accent : t.purple }}>
            ~{fmtD(nextBuyUTC)}
          </div>
          <div style={{ fontSize: 15, color: buyZoneOpen ? t.accent : t.textDim, marginTop: 2 }}>
            {buyZoneOpen ? 'Open now' : `in ${daysToNextBuy} days`}
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div style={{ marginTop: 10, fontSize: 15, color: t.textGhost, lineHeight: 1.5, borderTop: `1px solid ${t.borderDim}`, paddingTop: 8 }}>
        Pattern fit to 3 historical cycles — not a protocol rule. Ignores macro, regulation, ETF flows, and liquidity. Use as a loose timing framework only, not a mechanical trading rule.
      </div>
    </Card>
  );
}

function MarketIntelligenceMod({ latest, visible, t, isDark, fredMacro }) {
  if (!visible) return null;

  // ── Derived macro signals from FRED data ─────────────────────────
  const walcl = fredMacro?.walcl?.value ?? null;
  const tga = fredMacro?.tga?.value ?? null;
  const rrp = fredMacro?.rrp?.value ?? null;
  const netLiq = (walcl != null && tga != null && rrp != null) ? walcl - tga - rrp : null;
  const qtqe = walcl == null ? null : walcl > 6600000 ? 'QE' : walcl > 6200000 ? 'NEUTRAL' : 'QT';

  // ── Auto Narrative Engine ─────────────────────────────────────────
  const debtList = Array.isArray(latest?.debts) ? latest.debts : [];
  const stage = latest ? (debtList.some(d => (d?.balance || 0) > 0) ? ((latest?.eFund?.balance || 0) >= 1000 ? 2 : 1) : 3) : 0;
  const buildNarrative = () => {
    const parts = [];
    // Liquidity signal
    if (netLiq != null) {
      if (netLiq > 5500000) parts.push(`Fed net liquidity is elevated at $${(netLiq / 1000).toFixed(2)}T — historically supportive of risk assets.`);
      else if (netLiq > 4500000) parts.push(`Fed net liquidity at $${(netLiq / 1000).toFixed(2)}T is neutral — watch for directional shift.`);
      else parts.push(`Fed net liquidity is compressed at $${(netLiq / 1000).toFixed(2)}T — risk-off environment, defense posture justified.`);
    }
    // QT/QE
    if (qtqe === 'QT') parts.push('Balance sheet is in QT. Liquidity is draining — elevated caution on risk exposure.');
    else if (qtqe === 'QE') parts.push('Balance sheet expansion (QE) supports asset prices — monitor for reversal signals.');
    // RRP near zero = bullish signal
    if (rrp != null && rrp < 1000) parts.push('RRP near zero means excess cash has left the overnight facility — historically a bullish liquidity signal.');
    // Stage-specific posture
    if (stage <= 2) parts.push('Your current stage is Defense Mode. Macro data is context only — no investment action permitted until Stage 3+.');
    return parts.length > 0 ? parts.join(' ') : 'Run a live scan to generate your macro narrative.';
  };

  // ── Styles ────────────────────────────────────────────────────────
  const card = { background: t.surface, border: `1px solid ${t.borderDim}`, borderRadius: 4, padding: 14, marginBottom: 0 };
  const lbl = { fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };
  const metricBox = (borderColor) => ({
    padding: '10px 12px',
    borderRadius: 4,
    border: `1px solid ${borderColor || t.borderDim}`,
    background: t.panel,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minWidth: 0,
    overflow: 'hidden',
  });
  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} style={{ color: t.accent }} />
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Intelligence</div>
            <div style={{ fontSize: 15, color: t.textDim }}>{fredMacro?.asOf ? `FRED as of ${fredMacro.asOf}` : 'FRED Macro Narrative'}</div>
          </div>
        </div>
      </div>

      {/* Row 1 — Fed cycle metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
        <div style={metricBox()}>
          <div style={lbl}>Fed Cycle</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: qtqe === 'QT' ? t.danger : qtqe === 'QE' ? t.accent : t.warn }}>{qtqe ?? '—'}</div>
          <div style={{ fontSize: 15, color: t.textDim }}>{walcl ? `WALCL $${(walcl / 1000).toFixed(2)}T` : 'no FRED data'}</div>
        </div>
        <div style={metricBox()}>
          <div style={{ ...lbl, color: t.accent }}>Net Liquidity</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: netLiq != null && netLiq > 5000000 ? t.accent : netLiq != null ? t.warn : t.textDim }}>{netLiq != null ? `$${(netLiq / 1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 15, color: t.textDim }}>WALCL − TGA − RRP</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>RRP</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.warn }}>{rrp != null ? `$${(rrp / 1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 15, color: t.textDim }}>overnight reverse repo</div>
        </div>
      </div>

      {/* Row 2 — WALCL | TGA | As-Of */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
        <div style={metricBox()}>
          <div style={lbl}>WALCL</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary }}>{walcl != null ? `$${(walcl / 1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 15, color: t.textDim }}>Fed balance sheet</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>TGA</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.warn }}>{tga != null ? `$${(tga / 1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 15, color: t.textDim }}>Treasury General Account</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>As Of</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, lineHeight: 1.15, wordBreak: 'break-word', overflowWrap: 'anywhere', textAlign: 'center', maxWidth: '100%' }}>
            {fredMacro?.asOf || '—'}
          </div>
          <div style={{ fontSize: 15, color: t.textDim }}>FRED data timestamp</div>
        </div>
      </div>

      {/* Narrative Engine */}
      <div style={{ padding: '10px 14px', border: `1px solid ${t.accent}20`, background: t.accentMuted, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Eye size={10} style={{ color: t.accent }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Macro Narrative</span>
        </div>
        <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>{buildNarrative()}</div>
      </div>

      <div style={{ marginTop: 8, fontSize: 15, color: t.textGhost, lineHeight: 1.35 }}>
        Informational only. Defense Mode (Stages 0–3): no investment action permitted.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DAILY DIRECTIVE ENGINE
// ═══════════════════════════════════════════════════
// THE SOVEREIGNTY BLUEPRINT — Daily Law System
// Source: The Sovereignty Blueprint (From Ground Zero
// to Generational Wealth). 12 monthly pillars, 8 laws
// each. Rotates by day of month.
// ═══════════════════════════════════════════════════
const MONTHLY_THEMES = [
  { month: 'JAN', theme: 'Zero-Based Sovereignty', objective: 'Assign every dollar a job before the month begins' },
  { month: 'FEB', theme: 'The Avalanche Protocol', objective: 'Eliminate debt systematically — highest rate first' },
  { month: 'MAR', theme: 'Fortress of Cash', objective: 'Build liquidity architecture that buys optionality' },
  { month: 'APR', theme: 'The Defensive Moat', objective: 'Protect what you have built — insurance is infrastructure' },
  { month: 'MAY', theme: 'Asset Architecture', objective: 'Core 80%, satellite 20% — discipline before speculation' },
  { month: 'JUN', theme: 'Real Estate: Cash Flow Lens', objective: 'Cash flow is the metric of sovereignty, not appreciation' },
  { month: 'JUL', theme: 'Tax: The Hidden Returns', objective: 'A dollar saved from tax compounds identically to a dollar earned' },
  { month: 'AUG', theme: 'Income Velocity', objective: 'Savings rate is the throttle — maximize it without mercy' },
  { month: 'SEP', theme: 'Retirement Architecture', objective: 'Define your Freedom Number and engineer the path to it' },
  { month: 'OCT', theme: 'Dynasty Design', objective: 'Wealth not transferred is wealth not built' },
  { month: 'NOV', theme: 'The Discipline of Wealth', objective: 'Wealth is not a destination. It is a discipline.' },
  { month: 'DEC', theme: 'The Annual Audit', objective: 'What you measure in December determines what you achieve in January' },
];

const PILLARS = ['Foundation', 'The Moat', 'The Engine', 'The Summit'];

const DIRECTIVES = {
  JAN: [
    { pillar: 'Foundation', title: 'The Law of the Clean Slate', tactical: 'January is the most powerful financial month. What you establish now sets the trajectory for the year. Run the full audit: income, expenses, every account balance. The system starts with truth.' },
    { pillar: 'Foundation', title: 'The Law of the First Dollar', tactical: 'Pay yourself first. Move your savings target before discretionary spending reaches your hands. Automation is not laziness — it is the discipline that survives willpower failures.' },
    { pillar: 'Foundation', title: 'The Law of 50-30-20', tactical: 'Needs first. Goals second. Lifestyle last. This sequence is the architecture of control. Reverse it and you are funding someone else\'s freedom with your own.' },
    { pillar: 'Foundation', title: 'The Law of the Hidden Tax', tactical: 'Total every subscription — annually, not monthly. The sum will surface $1,000+ you did not consciously choose to spend. Every ghost charge is a vote against your freedom.' },
    { pillar: 'Foundation', title: 'The Law of the Annual Target', tactical: 'Set one financial number to hit by December 31st. A net worth floor. A debt ceiling. A savings milestone. One number. Written. Posted. Defended.' },
    { pillar: 'Foundation', title: 'The Law of the Budget Slash', tactical: 'When velocity drops below 20%, the only response is compression. Audit discretionary. Cut without negotiation. Discipline is not a feeling — it is a protocol.' },
    { pillar: 'Foundation', title: 'The Law of Inventory', tactical: 'An untracked asset is an unmanaged asset. Update your net worth snapshot with every account you own. What you cannot see, you cannot optimize.' },
    { pillar: 'Foundation', title: 'The Law of the Baseline', tactical: 'You cannot improve what you have not measured. Verify every balance against raw bank records. The dashboard reflects reality only as accurately as your inputs.' },
  ],
  FEB: [
    { pillar: 'Foundation', title: 'The Law of the Compounding Enemy', tactical: 'Interest does not negotiate. It compounds in silence while you sleep. Every minimum payment is a subscription to financial servitude — engineered to keep you paying, not to free you.' },
    { pillar: 'Foundation', title: 'The Law of Velocity', tactical: 'Adding $100/month to your avalanche target moves freedom 4 years closer. The gap between minimum payments and aggressive payoff is measured in years and thousands of dollars surrendered.' },
    { pillar: 'Foundation', title: 'The Law of the Target', tactical: 'Identify your highest APR. Direct every freed dollar there first. Mathematics is merciless and does not reward sentiment. The avalanche method is optimization, not choice.' },
    { pillar: 'Foundation', title: 'The Law of the Rate Call', tactical: 'Call your creditor. State your payment history. Request a lower APR. The worst outcome is no. The best outcome compounds for years. This call takes 10 minutes.' },
    { pillar: 'Foundation', title: 'The Law of the Minimum', tactical: 'A minimum payment was designed by your creditor, not for you. It was engineered to maximize interest extraction. Pay it and you are funding their quarter, not your freedom.' },
    { pillar: 'Foundation', title: 'The Law of Principal', tactical: 'Until the interest portion costs less than your payment, you are renting the privilege of your own balance. Every dollar above the minimum is a dollar reclaiming your future cash flow.' },
    { pillar: 'Foundation', title: 'The Law of Liberation', tactical: 'Every debt account closed is a cash flow event. Money that was captive becomes capital. The moment a balance hits zero, redirect that payment immediately to the next target.' },
    { pillar: 'Foundation', title: 'The Law of the Balance Transfer', tactical: 'A 0% APR balance transfer does not eliminate debt — it buys time. Calculate the savings against the transfer fee. Used with discipline, it is a legitimate weapon in the avalanche arsenal.' },
  ],
  MAR: [
    { pillar: 'Foundation', title: 'The Law of Liquidity', tactical: 'Liquidity is not laziness. It is optionality. Cash buys choices that leverage cannot. The person with 6 months of reserves negotiates from strength. The person without negotiates from fear.' },
    { pillar: 'Foundation', title: 'The Law of the Three Tiers', tactical: 'Tier 1 is immediate access — checking and physical cash. Tier 2 is high-yield savings — 30-day access. Tier 3 is CDs and bonds — 90-day access. Layer your fortress by access time, not by amount alone.' },
    { pillar: 'Foundation', title: 'The Law of the Fortress', tactical: 'A fortress cannot be built under siege. Build your cash reserve before the emergency arrives, not during it. The time to dig a well is not when you are thirsty.' },
    { pillar: 'Foundation', title: 'The Law of Runway', tactical: 'Six months of essential burn rate is not paranoia — it is the minimum viable moat between you and a decision made under duress. Calculate your exact runway in days. Know the number.' },
    { pillar: 'Foundation', title: 'The Law of the Opportunity Fund', tactical: 'The Sovereignty Blueprint names cash set aside for asymmetric investment bets the Opportunity Fund. It is not idle money. It is loaded capital waiting for the right target.' },
    { pillar: 'Foundation', title: 'The Law of the Rate', tactical: 'Your emergency fund should be earning. A high-yield savings account at current rates is free alpha. Idle cash in a checking account earning 0.01% is a silent, permanent loss.' },
    { pillar: 'Foundation', title: 'The Law of the Refill', tactical: 'Once the fortress fund is deployed, refilling it becomes the first financial priority — ahead of investing, ahead of lifestyle. The moat must be restored before the next siege.' },
    { pillar: 'Foundation', title: 'The Law of the Siege', tactical: 'When income stops, the fortress buys time. Time is the resource that converts crisis into strategy. Every month of reserves is a month in which you can think, not just react.' },
  ],
  APR: [
    { pillar: 'The Moat', title: 'The Law of the Unprotected Asset', tactical: 'You cannot accumulate what you cannot protect. Insurance is not an expense — it is the infrastructure that keeps the accumulation engine running after a catastrophic event.' },
    { pillar: 'The Moat', title: 'The Law of Income Replacement', tactical: '10x annual income in life coverage is the institutional minimum. Below that threshold, you are not insured — you are underinsured, which is a category of uninsured that feels safe but is not.' },
    { pillar: 'The Moat', title: 'The Law of the Coverage Gap', tactical: 'Audit your coverage polygon: life, disability, property, health, liability. One unexamined gap can terminate decades of wealth accumulation in a single event. The audit protocol runs annually.' },
    { pillar: 'The Moat', title: 'The Law of Term vs. Whole', tactical: 'Buy term. Invest the difference. Whole life is a financial product designed for the seller\'s margin, not your wealth. The institutional framework is clear: pure protection through term, pure growth through index funds.' },
    { pillar: 'The Moat', title: 'The Law of the Umbrella', tactical: 'An umbrella policy covers what home and auto cannot. At $1M coverage for $200-400 per year, it is the highest leverage protection product available. Above your net worth threshold, it is mandatory.' },
    { pillar: 'The Moat', title: 'The Law of Disability', tactical: 'You are three times more likely to become disabled than to die before retirement. Is your income insured? Short-term disability. Long-term disability. Without it, one accident dissolves the plan.' },
    { pillar: 'The Moat', title: 'The Law of the Annual Audit Protocol', tactical: 'Coverage bought 5 years ago may not match the assets you have built since. The audit protocol runs annually: review every policy, verify every beneficiary, confirm every coverage limit.' },
    { pillar: 'The Moat', title: 'The Law of the Dependent', tactical: 'Every dependent creates a coverage obligation. The calculation is specific: what do they need if you disappear today, for how many years, at what monthly cost? Run the number. Then buy the coverage.' },
  ],
  MAY: [
    { pillar: 'The Engine', title: 'The Law of the Core', tactical: '80% of your portfolio should be boring. Total market index funds. International exposure. Bonds. Boring built every institutional fortune that ever existed. Excitement is a fee, not a feature.' },
    { pillar: 'The Engine', title: 'The Law of Time in the Market', tactical: 'The market rewards patience without exception. Time in the market, not timing the market. The investor who misses the 10 best days in a decade loses most of the decade\'s return.' },
    { pillar: 'The Engine', title: 'The Law of the Satellite', tactical: 'Speculation belongs in the 20%. Never the 80%. The satellite allocation is where asymmetric bets live — sector ETFs, individual stocks, crypto. The boundary between core and satellite must be enforced.' },
    { pillar: 'The Engine', title: 'The Law of Drift', tactical: 'Rebalance when allocation drifts 5%, not on a calendar. The market decides timing. You decide structure. A portfolio that is never rebalanced is a portfolio that slowly becomes something you never chose.' },
    { pillar: 'The Engine', title: 'The Law of the Low-Cost Vehicle', tactical: 'Every basis point of management fees is permanent, compounding drag on your final number. The institutional vehicle is the low-cost index ETF. The fee is the only guaranteed return in investing.' },
    { pillar: 'The Engine', title: 'The Law of Global Exposure', tactical: 'Home-country bias is a hidden concentration risk masquerading as patriotism. The Sovereignty Blueprint requires international allocation. Diversification is engineering, not caution.' },
    { pillar: 'The Engine', title: 'The Law of Compounding', tactical: 'At 8% annual return, money doubles every 9 years. The first decade of investing is the most structurally important. Starting at 25 instead of 35 does not add 10 years — it adds entire doublings.' },
    { pillar: 'The Engine', title: 'The Law of the Noise', tactical: 'Daily market fluctuations are noise. Your allocation is the signal. The investor who watches prices daily is training themselves to make decisions on noise. Never confuse the two.' },
  ],
  JUN: [
    { pillar: 'The Engine', title: 'The Law of the Cap Rate', tactical: 'Cash flow, not appreciation, is the metric of sovereignty in real estate. If the cap rate does not work, no story makes it work. NOI divided by purchase price. Know this number before everything else.' },
    { pillar: 'The Engine', title: 'The Law of the Deal Analyzer', tactical: 'Three numbers precede every real estate acquisition: cap rate, cash-on-cash return, and break-even month. If you cannot calculate all three before closing, you are not analyzing — you are guessing.' },
    { pillar: 'The Engine', title: 'The Law of Cash Flow First', tactical: 'Appreciation is a bonus. Cash flow is the objective. Buying for appreciation is speculation. Buying for cash flow is investment. The institutional investor does not speculate with primary capital.' },
    { pillar: 'The Engine', title: 'The Law of REIT vs. Direct', tactical: 'Direct ownership offers control, tax benefits, and high effort. REITs offer liquidity, diversification, and low effort. Neither is superior. Stage, capital, and bandwidth determine the correct vehicle.' },
    { pillar: 'The Engine', title: 'The Law of the Management Layer', tactical: 'A rental property without a management plan is a second job with unpredictable hours. Price the labor before you buy. Property management at 8-10% of rent is not overhead — it is the cost of passive income.' },
    { pillar: 'The Engine', title: 'The Law of Carry Cost', tactical: 'Every month of vacancy is a negative cash flow event with a fixed mortgage. Know your carrying cost before closing. The deal that looks good at 100% occupancy may destroy you at 80%.' },
    { pillar: 'The Engine', title: 'The Law of Break-Even', tactical: 'Every deal has a break-even month. If you do not know yours, you do not know your risk horizon. Break-even is the month when cumulative cash flow turns positive. Calculate it before you wire the down payment.' },
    { pillar: 'The Engine', title: 'The Law of the Market Cycle', tactical: 'Real estate rewards patience and punishes leverage at the wrong point in the cycle. The Benner Cycle and the real estate cycle are related. Stage determines strategy. Never buy at peak leverage into a peak market.' },
  ],
  JUL: [
    { pillar: 'The Engine', title: 'The Law of the Hidden Return', tactical: 'Tax optimization is the highest guaranteed return available. It requires no market risk, no additional capital, and no luck. It requires only knowledge of the rules and the discipline to apply them.' },
    { pillar: 'The Engine', title: 'The Law of the Bracket', tactical: 'Defer income to manage marginal rates. Every dollar kept out of a higher bracket is pure, riskless alpha. Income timing is a tax lever most people never pull. Institutional investors pull it quarterly.' },
    { pillar: 'The Engine', title: 'The Law of Asset Location', tactical: 'High-yield assets belong in sheltered accounts. Tax-inefficient assets in tax-free wrappers. Tax-efficient assets in taxable accounts. Asset location is the silent multiplier of lifetime portfolio returns.' },
    { pillar: 'The Engine', title: 'The Law of the HSA', tactical: 'The Health Savings Account is the only triple-tax weapon in the code: pre-tax contribution, tax-free growth, tax-free withdrawal for qualified expenses. Max it before every other account. No exceptions.' },
    { pillar: 'The Engine', title: 'The Law of Loss Harvesting', tactical: 'Offset realized gains with strategic losses. The IRS does not penalize for discipline. Tax-loss harvesting is not a trick — it is a tool written into the code for those who read it.' },
    { pillar: 'The Engine', title: 'The Law of the Roth Conversion Window', tactical: 'A low-income year is a Roth conversion window that most people fail to use. Convert traditional IRA balances at lower bracket rates. Pay tax now at a discount. Grow tax-free forever.' },
    { pillar: 'The Engine', title: 'The Law of the 401k', tactical: 'Every dollar contributed pre-tax is a dollar that compounds without the government\'s share for decades. Max your 401k contribution before any other investment vehicle. The math is not subtle.' },
    { pillar: 'The Engine', title: 'The Law of the December 31 Deadline', tactical: 'Tax decisions not executed by midnight on December 31st are one full calendar year late. The window closes without ceremony. The tax code rewards the prepared and ignores the intentions of the unprepared.' },
  ],
  AUG: [
    { pillar: 'The Engine', title: 'The Law of the Throttle', tactical: 'Savings rate is the throttle. Income is the engine. A 25% savings rate in any income tier builds freedom. A 5% savings rate on a high income builds nothing but a comfortable waiting room.' },
    { pillar: 'The Engine', title: 'The Law of Burn Rate', tactical: 'Burn rate is the ceiling on your runway. Audit it without mercy, then compress it. Every dollar removed from monthly expenses permanently extends your freedom horizon and accelerates your Freedom Number.' },
    { pillar: 'The Engine', title: 'The Law of the Surplus', tactical: 'Income minus expenses equals velocity. If the delta is shrinking, something is leaking. Find it before the monthly close. A declining surplus is not a trend — it is a decision that has not been made yet.' },
    { pillar: 'The Engine', title: 'The Law of the Side Harvest', tactical: 'Side income is seed capital. The first dollar earned outside your primary income stream is the most strategically important. It proves the model. Apply 50% to debt or investment. Keep 50% as fuel.' },
    { pillar: 'The Engine', title: 'The Law of the Negotiation', tactical: 'Your salary is a negotiation, not a given. A single 10-minute conversation that yields a $5,000 raise compounds into six figures over a career. The negotiation gap is the largest single income lever available.' },
    { pillar: 'The Engine', title: 'The Law of the Rate Call', tactical: 'Call every service provider annually. Request better rates. Savings compound identically to earnings. The difference is that savings require only a phone call, while earnings require a year of performance.' },
    { pillar: 'The Engine', title: 'The Law of the Subscription Audit', tactical: 'Every recurring charge not delivering measurable value is a permanent drag on velocity. Terminate without mercy. The subscription economy is engineered to survive your inattention. Audit it.' },
    { pillar: 'The Engine', title: 'The Law of the Parallel Income', tactical: 'A single income source is a single point of failure. The Sovereignty Blueprint requires income diversification, not just asset diversification. A second income stream is not a luxury — it is a resilience protocol.' },
  ],
  SEP: [
    { pillar: 'The Summit', title: 'The Law of the Freedom Number', tactical: 'Your Freedom Number is 25 times your annual spending. It is the only long-term financial number that matters. Below it, you are working. Above it, you are choosing. Calculate it. Then engineer the path.' },
    { pillar: 'The Summit', title: 'The Law of Three Buckets', tactical: 'Taxable. Tax-deferred. Tax-free. All three buckets working in concert is retirement architecture. A single 401k is not a retirement plan — it is a single point of failure in a tax bracket you cannot predict.' },
    { pillar: 'The Summit', title: 'The Law of Safe Withdrawal', tactical: 'The 3-4% dynamic withdrawal rule is the institutional standard for sustainable retirement income. A portfolio that survives 30 years of distribution is not assumed — it is engineered before you stop working.' },
    { pillar: 'The Summit', title: 'The Law of Social Security Delay', tactical: 'Delaying Social Security to age 70 is the highest guaranteed return available to most Americans. Every year of delay increases the benefit by 8%. No market investment guarantees that return with that certainty.' },
    { pillar: 'The Summit', title: 'The Law of the Bridge Account', tactical: 'A taxable bridge account funds the gap between early retirement and age 59½ without penalty. Without it, early retirement forces you into 10% penalty territory. Build the bridge before you need to cross it.' },
    { pillar: 'The Summit', title: 'The Law of Inflation in Distribution', tactical: 'A retirement plan that ignores inflation is a plan that fails on a long enough timeline. Equities allocation must be maintained in distribution — not as a growth play, but as an inflation hedge.' },
    { pillar: 'The Summit', title: 'The Law of Compounding Time', tactical: 'Wealth is not linear. It is exponential. A 25-year-old investor has a weapon a 45-year-old cannot purchase at any price: time. The first decade of investing compounds into the majority of the final portfolio value.' },
    { pillar: 'The Summit', title: 'The Law of the Contribution Ceiling', tactical: 'Max Roth IRA. Max 401k. Max HSA. In that order of long-term tax efficiency at most income levels. These contribution limits are institutional tools available to individuals. Use the full ceiling every year.' },
  ],
  OCT: [
    { pillar: 'The Summit', title: 'The Law of the Transfer', tactical: 'Wealth not transferred is wealth not built. An empire that dies with its builder was never truly an empire — it was a successful career. The architecture of transfer must be designed while the builder is alive.' },
    { pillar: 'The Summit', title: 'The Law of the Trust', tactical: 'The revocable living trust bypasses probate — public, expensive, and slow. The trust is private, instant, and controllable. It is not a luxury for the wealthy. It is the standard for anyone with assets to protect.' },
    { pillar: 'The Summit', title: 'The Law of the Letter of Intent', tactical: 'A letter of intent is not a legal document. It is a message to your heirs about your values, your wishes, and the principles behind the wealth. The law governs what you leave. The letter governs how it is remembered.' },
    { pillar: 'The Summit', title: 'The Law of Beneficiary Alignment', tactical: 'An outdated beneficiary designation overrides a will. Verify every designation on every account, every year. One stale form filed before a divorce or remarriage can redirect an entire estate to the wrong person.' },
    { pillar: 'The Summit', title: 'The Law of the Digital Estate', tactical: 'Crypto keys, passwords, and digital account access are estate assets. Without documented access, they are permanently inaccessible. Store them in a secured, documented vault accessible to your executor.' },
    { pillar: 'The Summit', title: 'The Law of Generation-Skipping', tactical: 'A generation-skipping trust passes wealth directly to grandchildren, bypassing one full layer of estate taxation. The structure is legal, institutional, and used by every family that has successfully transferred generational wealth.' },
    { pillar: 'The Summit', title: 'The Law of the 529', tactical: 'A 529 plan with 18 years of compounding and state tax deductions is the institutional approach to education funding. Open it at birth. Fund it consistently. Superfund it if tax law permits. Education compounds the same way capital does.' },
    { pillar: 'The Summit', title: 'The Law of the Dynasty', tactical: 'Generational wealth is built once and lost in one generation of financial ignorance. The Sovereignty Blueprint is not just a system for you — it is a system to be taught. Wealth without financial education in the next generation is a countdown.' },
  ],
  NOV: [
    { pillar: 'The Summit', title: 'The Law of Discipline', tactical: 'Wealth is not a destination. It is a discipline. Measure what matters. Execute without emotion. The investor who checks the portfolio daily will underperform the investor who checks it quarterly by a predictable margin.' },
    { pillar: 'The Summit', title: 'The Law of Exponential Growth', tactical: 'Wealth is not linear. It is exponential. The compounding curve is ruthless to those who start late and generous to those who start now. The time to plant this tree was 10 years ago. The second-best time is today.' },
    { pillar: 'The Summit', title: 'The Law of Sequential Execution', tactical: 'Build from the ground up. Foundation before engine. Engine before summit. The hierarchy of financial needs is sequential, not optional. Skipping stages is how fortunes collapse — built on foundation that was never laid.' },
    { pillar: 'The Summit', title: 'The Law of the Emotional Override', tactical: 'The market will generate fear and greed in equal measure, by design. The sovereign investor executes the plan regardless of sentiment. Panic selling and euphoric buying are the only two ways to guarantee underperformance.' },
    { pillar: 'The Summit', title: 'The Law of the Hierarchy', tactical: 'Level 1: Foundation before Level 2: The Moat. The Moat before Level 3: The Engine. The Engine before Level 4: The Accelerator. The Accelerator before Level 5: The Summit. The sequence is the strategy.' },
    { pillar: 'The Summit', title: 'The Law of the System', tactical: 'A plan remembered is not a plan. A system executed consistently is the only mechanism that generates wealth at scale. The difference between intention and outcome is automation, measurement, and accountability.' },
    { pillar: 'The Summit', title: 'The Law of Patient Capital', tactical: 'The greatest financial advantage available to any individual is time. Compound interest is the only force that creates wealth without extraordinary risk. It requires only patience — the rarest financial asset.' },
    { pillar: 'The Summit', title: 'The Law of the Monday Review', tactical: 'What you measure weekly, you can adjust monthly. What you ignore monthly becomes annual regret. The Monday Morning Review from The Sovereignty Blueprint is not a ritual — it is a control loop for your financial system.' },
  ],
  DEC: [
    { pillar: 'The Summit', title: 'The Law of the Year-End Close', tactical: 'What you measure in December determines what you achieve in January. Close the books with precision. The year-end financial review is not accounting — it is accountability for every decision made since January 1st.' },
    { pillar: 'The Summit', title: 'The Law of the Net Worth Delta', tactical: 'One number summarizes the year: net worth delta. Is it positive? By how much? Against what trajectory? The single most honest measure of financial progress is whether your number moved in the right direction.' },
    { pillar: 'The Summit', title: 'The Law of Tax Harvest', tactical: 'December 31st is a hard deadline. Tax decisions not executed by midnight are exactly one full year late. The window closes without warning and without extensions. Execute before the calendar turns.' },
    { pillar: 'The Summit', title: 'The Law of the Beneficiary Audit', tactical: 'Verify all beneficiary designations before the year ends. One stale designation on a retirement account can override every estate planning document. It takes 10 minutes to verify. It takes decades to recover from not doing it.' },
    { pillar: 'The Summit', title: 'The Law of the Next Phase', tactical: 'Review your wealth stage. Have you earned a level promotion in the hierarchy of financial needs? The Blueprint is sequential. Claim your next floor deliberately. Enter the new year knowing exactly which level you are executing.' },
    { pillar: 'The Summit', title: 'The Law of the Compound Year', tactical: 'Total the debt you destroyed. Total the equity you built. Total the income you grew. Every number in that delta was a decision made under constraint. Honor the discipline it required. Then raise the standard for next year.' },
    { pillar: 'The Summit', title: 'The Law of the Blueprint Review', tactical: 'The Sovereignty Blueprint is not read once. It is a living framework reviewed annually. Which level are you on? Which protocol is active? What changed in your financial architecture this year that changes the execution next year?' },
    { pillar: 'The Summit', title: 'The Law of the Clean Slate', tactical: 'Enter the new year with minimal financial complexity. Close idle accounts. Simplify the system. Complexity is the enemy of execution. The financial system that can be reviewed in one hour is the one that will actually be reviewed.' },
  ],
};

// ═══════════════════════════════════════════════════
// DAILY LAW HERO — Front-and-center financial wisdom
// ═══════════════════════════════════════════════════
function DailyLawHero({ t }) {
  const now = new Date();
  const monthIdx = now.getMonth();
  const theme = MONTHLY_THEMES[monthIdx];

  // Day-of-year counter: Jan 1 = Day 1, resets every Jan 1.
  // March 1 2026 = Day 60. Used for both law rotation and display.
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - yearStart) / (1000 * 60 * 60 * 24)) + 1;

  const pool = DIRECTIVES[theme.month] || DIRECTIVES.JAN;
  const directive = pool[(dayOfYear - 1) % pool.length];
  const caution = t.warn || '#ffb800';
  const support = t.purple || '#8b5cf6';
  const darkMode = (t.void || '#ffffff').toLowerCase() === '#000000';

  return (
    <div style={{
      border: `1px solid ${t.accent}55`,
      background: `linear-gradient(135deg, ${t.surface} 0%, ${t.accent}10 38%, ${support}08 100%)`,
      padding: '24px 28px 22px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: darkMode
        ? `0 18px 42px rgba(0,0,0,0.34), inset 0 0 0 1px ${t.borderDim}`
        : `0 18px 34px rgba(0,0,0,0.06), inset 0 0 0 1px ${t.borderDim}`,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${t.accent}, ${support} 62%, transparent)` }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 240, height: 240, background: `radial-gradient(circle, ${support}20 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -36, top: 42, transform: 'rotate(-90deg)', transformOrigin: 'left top', fontSize: 10, color: caution, textTransform: 'uppercase', letterSpacing: '0.32em', fontWeight: 700, opacity: 0.85 }}>
        Cash Reserve Command
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: darkMode ? 0.24 : 0.16, backgroundImage: `linear-gradient(${t.borderDim}55 1px, transparent 1px), linear-gradient(90deg, ${t.borderDim}33 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.18em', background: `${t.accent}18`, padding: '4px 9px', border: `1px solid ${t.accent}40`, alignSelf: 'flex-start' }}>
            <span style={{ color: caution }}>SECTOR</span>
            <span>{directive.pillar}</span>
          </div>
          <div style={{ fontSize: 13, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {theme.theme}
          </div>
        </div>
        <div style={{ fontSize: 15, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          The Sovereignty Blueprint · Day {dayOfYear}
        </div>
      </div>

      <div style={{
        fontSize: 34,
        fontWeight: 900,
        color: t.textPrimary,
        letterSpacing: '-0.04em',
        lineHeight: 1.04,
        marginBottom: 14,
        textTransform: 'uppercase',
        maxWidth: 820,
      }}>
        {directive.title}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '4px 1fr',
        gap: 14,
        alignItems: 'start',
        marginBottom: 16,
      }}>
        <div style={{ width: 4, alignSelf: 'stretch', background: `linear-gradient(180deg, ${t.accent}, ${support})`, boxShadow: `0 0 16px ${t.accent}55` }} />
        <div style={{
        fontSize: 18,
        color: t.textSecondary,
        lineHeight: 1.7,
        fontStyle: 'italic',
      }}>
          {directive.tactical}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Monthly Objective · {theme.objective}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: caution, textTransform: 'uppercase', letterSpacing: '0.14em', border: `1px solid ${caution}55`, padding: '4px 8px', background: `${caution}0f` }}>
          <span>Alert State</span>
          <span style={{ color: t.textPrimary }}>Discipline Required</span>
        </div>
      </div>
    </div>
  );
}

function InfoTip({ text, t, align = 'center', direction = 'up' }) {
  const [show, setShow] = useState(false);
  const tooltipPos = align === 'right'
    ? { right: 0 }
    : align === 'left'
      ? { left: 0 }
      : { left: '50%', transform: 'translateX(-50%)' };
  const tooltipDir = direction === 'down' ? { top: '130%' } : { bottom: '130%' };
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4, verticalAlign: 'middle' }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={(e) => { e.stopPropagation(); setShow(v => !v); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: '50%',
          border: `1px solid ${t.borderMid}`, color: t.textGhost,
          fontSize: 10, cursor: 'pointer', userSelect: 'none', fontWeight: 700, lineHeight: 1,
        }}
      >?</span>
      {show && (
        <div style={{
          position: 'absolute', ...tooltipDir, ...tooltipPos,
          background: t.surface, border: `1px solid ${t.borderMid}`,
          padding: '8px 10px', width: 210, zIndex: 9999,
          fontSize: 13, color: t.textSecondary, lineHeight: 1.45,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          textTransform: 'none', letterSpacing: 'normal', fontWeight: 400,
          textAlign: 'left', pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

function DirectiveMod({ visible, latest, t }) {
  const now = new Date();

  // Stage + meta
  const stage = calcStage(latest || {});
  const meta = STAGE_META[stage] || STAGE_META[0];
  const stageColor = t[meta.color] || t.accent;
  const isDefense = stage <= 2;

  // Metrics (formerly StatusStrip)
  const velocity = calcVelocity(latest || {});
  const monthlyBurn = monthlySpendBaseline(latest);
  const dailyBurn = monthlyBurn / 30;
  const savingsRate = calcSavingsRate(latest || {});
  const days = runwayDaysFromLatest(latest);
  const velColor = velocity >= 0.25 ? t.accent : velocity >= 0.10 ? t.warn : t.danger;
  const srColor = savingsRate >= 20 ? t.accent : savingsRate >= 10 ? t.warn : savingsRate > 0 ? t.warn : t.danger;

  // Interest drain + alerts
  const di = dailyInterest(latest?.debts);
  const cats = latest?.budget?.categories || [];
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const blownCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 1);
  const warnCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 0.75 && (c.actual / c.budgeted) < 1);
  const action = nextAction(latest);

  // Bills due within 48 hrs
  const debts = latest?.debts || [];
  const soon = debts.filter(d => {
    if (!d.dueDate) return false;
    const due = new Date(d.dueDate);
    const diff = (due - now) / (1000 * 60 * 60);
    return diff >= 0 && diff <= 48;
  });

  return (<Card title="CFO Daily Pulse" visible={visible} delay={20} t={t}>

    {/* ═══ 4-METRIC ROW ═══ */}
    <div className="status-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginBottom: 2 }}>

      {/* Wealth Building (formerly Velocity) */}
      <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Wealth Building<InfoTip t={t} direction="down" text="How much of your income is actively working toward financial progress — debt paydown, savings, and investing. Target: 25%+" /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: velColor }}>{(velocity * 100).toFixed(0)}<span style={{ fontSize: 14, fontWeight: 400 }}>%</span></div>
        <div style={{ fontSize: 15, color: velColor, fontWeight: 700, textTransform: 'uppercase' }}>{velocity >= 0.25 ? '✓ On Track' : velocity >= 0.10 ? '⚠ Low' : '✕ Critical'}</div>
      </div>

      {/* Daily Spending (formerly Daily Burn) */}
      <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Daily Spending<InfoTip t={t} align="right" direction="down" text="Your average spend per day based on monthly expenses. Sync a bank statement to populate with real data." /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: dailyBurn > 0 ? t.warn : t.textDim }}>${dailyBurn.toFixed(2)}</div>
        <div style={{ fontSize: 15, color: dailyBurn > 0 ? t.warn : t.textGhost, fontWeight: 700, textTransform: 'uppercase' }}>{dailyBurn > 0 ? 'Spending' : '— No Data'}</div>
        {(() => {
          const txns = latest?._recentTxns || [];
          if (!txns.length) return null;
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const days7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - 6 + i); return d.toISOString().slice(0, 10); });
          const byDay7 = {};
          txns.forEach(tx => { if (tx.amount < 0 && days7.includes(tx.date)) byDay7[tx.date] = (byDay7[tx.date] || 0) + Math.abs(tx.amount); });
          const vals = days7.map(d => byDay7[d] || 0);
          const maxV = Math.max(...vals, 1);
          const W = 60, H = 20, pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - (v / maxV) * (H - 2) - 1}`).join(' ');
          return (
            <svg width={W} height={H} style={{ marginTop: 3, overflow: 'visible' }}>
              <polyline points={pts} fill="none" stroke={t.warn} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
              {vals.map((v, i) => v > 0 && <circle key={i} cx={(i / (vals.length - 1)) * W} cy={H - (v / maxV) * (H - 2) - 1} r="1.5" fill={t.warn} />)}
            </svg>
          );
        })()}
      </div>

      {/* Money Saved (formerly Savings Rate) */}
      <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Money Saved<InfoTip t={t} direction="down" text="How much of every dollar earned you're keeping — includes e-fund contributions, investments, and unspent income. Target: 20%+" /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}<span style={{ fontSize: 14, fontWeight: 400 }}>%</span></div>
        <div style={{ fontSize: 15, color: srColor, fontWeight: 700, textTransform: 'uppercase' }}>{savingsRate >= 20 ? '✓ Healthy' : savingsRate > 0 ? '⚠ Low' : '— No Data'}</div>
      </div>

      {/* Emergency Fund (formerly Runway) */}
      <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Emergency Fund<InfoTip t={t} align="right" direction="down" text="How many days your emergency fund would cover you if income stopped today. Target: 90 days." /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: runwayColor(days, t) }}>{days}<span style={{ fontSize: 14, fontWeight: 400 }}> days</span></div>
        <div style={{ fontSize: 15, color: runwayColor(days, t), fontWeight: 700, textTransform: 'uppercase' }}>{days === 0 ? '✕ None' : days < 30 ? '⚠ Fragile' : days < 90 ? '↑ Building' : '✓ Secure'}</div>
      </div>

    </div>

    {/* ═══ STAGE RAIL ═══ */}
    <div style={{ background: t.elevated, border: `1px solid ${t.borderDim}`, borderLeft: `3px solid ${stageColor}`, display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
      {/* Name row — full width, always truly centered regardless of stage name length */}
      <div style={{ textAlign: 'center', padding: '8px 16px 4px', fontSize: 15, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{meta.name}</div>
      {/* Stage number + mode + dots row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 16px 8px', borderBottom: `1px solid ${t.borderDim}`, columnGap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: stageColor, justifySelf: 'start' }}>{stage}</span>
        <div style={{ fontSize: 12, color: stageColor, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', textAlign: 'center' }}>{isDefense ? '🛡 Protecting basics' : stage === 3 ? '🔓 Paying off debt' : '📈 Growing wealth'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, justifySelf: 'end' }}>
          <span style={{ fontSize: 11, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>{stage} / 7</span>
          <div style={{ width: 80, height: 6, background: t.borderDim, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(stage / 7) * 100}%`, background: `linear-gradient(90deg, ${t.warn} 0%, ${t.accent} 100%)`, borderRadius: 3, transition: 'width 0.8s ease-out' }} />
          </div>
        </div>
      </div>
      {/* Row 2: next action — centered, full width */}
      <div style={{ textAlign: 'center', padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Zap size={12} style={{ color: t[action.color] || t.accent }} />
        <span style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.35 }}>{action.text}</span>
      </div>
    </div>

    {/* ═══ INTEREST DRAIN + BILLS SOON (inline alert row) ═══ */}
    {(di > 0 || soon.length > 0) && (
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.borderDim}` }}>
        {di > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, color: t.danger, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>⚡ Leaking</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.danger }}>${di.toFixed(2)}/day</span>
            <span style={{ fontSize: 15, color: t.textGhost }}>in interest</span>
          </div>
        )}
        {soon.length > 0 && (
          <div style={{ fontSize: 15, color: t.warn, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>⏰</span>
            <span>Due &lt;48hrs: {soon.map(d => `${d.name} (${fmt(d.minPayment || d.monthlyPayment || 0)})`).join(', ')}</span>
          </div>
        )}
      </div>
    )}

    {/* ═══ WEALTH JOURNEY ═══ */}
    {(() => {
      const steps = ['Stable', 'Safe', 'Debt Free', 'Invested', 'Protected', 'Independent', 'Legacy'];
      const [guideOpen, setGuideOpen] = useState(false);
      return (
        <div style={{ marginBottom: (blownCats.length > 0 || warnCats.length > 0) ? 12 : 0 }}>

          {/* Title */}
          <div style={{ textAlign: 'center', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Your Wealth Journey</div>

          {/* Numbered bar segments */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
            {steps.map((_, i) => {
              const active = i === stage;
              const done = i < stage;
              const color = done ? t.accent : active ? t[STAGE_META[i]?.color] || t.accent : t.textDim;
              const bg = done ? t.accent : active ? t[STAGE_META[i]?.color] || t.accent : t.borderDim;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color, opacity: done ? 0.7 : active ? 1 : 0.35, fontWeight: active ? 700 : 400 }}>{i + 1}</div>
                  <div style={{ width: '100%', height: 4, background: bg, opacity: done ? 0.7 : active ? 1 : 0.15, borderRadius: 2, transition: 'background 0.3s' }} />
                </div>
              );
            })}
          </div>

          {/* Stage guide toggle — full width */}
          <button
            onClick={() => setGuideOpen(v => !v)}
            style={{ width: '100%', background: 'none', border: `1px solid ${t.borderDim}`, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '6px 0', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: guideOpen ? 8 : 0 }}
          >{guideOpen ? '▲ Hide Guide' : '▼ Stage Guide'}</button>

          {/* Collapsible stage guide card */}
          {guideOpen && (
            <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((label, i) => {
                const active = i === stage;
                const done = i < stage;
                const color = active ? t[STAGE_META[i]?.color] || t.accent : done ? t.textSecondary : t.textDim;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done ? 0.6 : 1 }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: t.textGhost, flexShrink: 0, width: 14, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, height: 1, background: done ? t.accent : active ? t[STAGE_META[i]?.color] || t.accent : t.borderDim, opacity: done ? 0.5 : active ? 1 : 0.2 }} />
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color, fontWeight: active ? 700 : 400, flexShrink: 0 }}>
                      {done ? '✓ ' : active ? '▶ ' : ''}{label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      );
    })()}

    {/* ═══ BUDGET ALERTS ═══ */}
    {(blownCats.length > 0 || warnCats.length > 0) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Budget Alerts</div>
        {blownCats.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <span style={{ color: t.danger, fontWeight: 700, fontSize: 14 }}>✕ BLOWN</span>
            <span style={{ color: t.textSecondary }}>{c.name} — ${c.actual.toLocaleString()} / ${c.budgeted.toLocaleString()}</span>
          </div>
        ))}
        {warnCats.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <span style={{ color: t.warn, fontWeight: 700, fontSize: 14 }}>⚠ WARN</span>
            <span style={{ color: t.textSecondary }}>{c.name} — ${c.actual.toLocaleString()} / ${c.budgeted.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )}

  </Card>);
}

// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// MARKET STRIP — top-line risk/market indicators
// ═══════════════════════════════════════════════════
function MacroBanner({ fredMacro, visible, t, refreshNonce = 0, rotating = false }) {
  const [marketLive, setMarketLive] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      // ── CoinGecko: native CORS, no proxy needed ──────────────────────────
      const fetchCoinGecko = async () => {
        try {
          const r = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
            { headers: { 'Accept': 'application/json' } }
          );
          if (!r.ok) return {};
          const j = await r.json();
          const parse = (coin) => {
            const price = j?.[coin]?.usd;
            const chgPct = j?.[coin]?.usd_24h_change;
            return (price != null) ? { price: +price, chgPct: chgPct != null ? +chgPct : null } : null;
          };
          return { btc: parse('bitcoin'), eth: parse('ethereum') };
        } catch (_) { return {}; }
      };

      // ── Yahoo Finance via CORS proxies (try each in sequence) ─────────────
      const PROXIES = [
        (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      ];

      const fetchYahoo = async (symbol) => {
        const target = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
        let j = null;
        for (const proxy of PROXIES) {
          try {
            const r = await fetch(proxy(target), { headers: { 'Accept': 'application/json' } });
            if (r.ok) { j = await r.json(); break; }
          } catch (_) { /* try next proxy */ }
        }
        if (!j) return null;
        const result = j?.chart?.result?.[0];
        if (!result) return null;
        const meta = result.meta || {};
        let price = Number(meta.regularMarketPrice);
        let prev = Number(meta.chartPreviousClose ?? meta.previousClose);
        if (!Number.isFinite(price)) {
          const vals = (result.indicators?.quote?.[0]?.close ?? []).filter(v => Number.isFinite(v));
          if (vals.length) price = vals[vals.length - 1];
          if (vals.length > 1) prev = vals[vals.length - 2];
        }
        if (!Number.isFinite(price)) return null;
        const chgPct = Number.isFinite(prev) && prev !== 0 ? ((price - prev) / prev) * 100 : null;
        return { price, chgPct };
      };

      // Fetch crypto (no proxy needed) and stocks (proxy needed) in parallel
      const [cgResult, oilY, vixY, spxY, nasY, goldY, silverY] = await Promise.allSettled([
        fetchCoinGecko(),
        fetchYahoo('CL=F'),
        fetchYahoo('^VIX'),
        fetchYahoo('^GSPC'),
        fetchYahoo('^IXIC'),
        fetchYahoo('GC=F'),
        fetchYahoo('SI=F'),
      ]);

      const ok = (r) => r.status === 'fulfilled' ? r.value : null;
      const cg = ok(cgResult) || {};
      const next = {
        btc: cg.btc ?? null,
        eth: cg.eth ?? null,
        oil: ok(oilY),
        vix: ok(vixY),
        sp500: ok(spxY),
        nasdaq: ok(nasY),
        gold: ok(goldY),
        silver: ok(silverY),
      };
      next.spy = next.sp500 ? { ...next.sp500 } : null;
      if (!cancelled) setMarketLive(next);
    })();

    return () => { cancelled = true; };
  }, [visible, refreshNonce]);

  if (!visible) return null;

  const rrp = fredMacro?.rrp?.value ?? null;
  // Live feeds preferred for all; fall back to FRED macro.json
  const gold = marketLive?.gold?.price ?? fredMacro?.gold?.value ?? null;
  const goldChg = marketLive?.gold?.chgPct ?? fredMacro?.gold?.change ?? null;
  const silver = marketLive?.silver?.price ?? fredMacro?.silver?.value ?? null;
  const silverChg = marketLive?.silver?.chgPct ?? fredMacro?.silver?.change ?? null;
  // Live feeds preferred; fall back to FRED macro.json
  const oil = marketLive?.oil ? { price: marketLive.oil.price, chgPct: marketLive.oil.chgPct } : (fredMacro?.oil ? { price: fredMacro.oil.value, chgPct: fredMacro.oil.change } : null);
  const spy = marketLive?.spy ? { price: marketLive.spy.price, chgPct: marketLive.spy.chgPct } : (fredMacro?.spy ? { price: fredMacro.spy.value, chgPct: fredMacro.spy.change } : null);
  const vix = marketLive?.vix ? { price: marketLive.vix.price, chgPct: marketLive.vix.chgPct } : (fredMacro?.vix ? { price: fredMacro.vix.value, chgPct: fredMacro.vix.change } : null);
  const sp500 = marketLive?.sp500 ? { price: marketLive.sp500.price, chgPct: marketLive.sp500.chgPct } : (fredMacro?.sp500 ? { price: fredMacro.sp500.value, chgPct: fredMacro.sp500.change } : null);
  const nasdaq = marketLive?.nasdaq ? { price: marketLive.nasdaq.price, chgPct: marketLive.nasdaq.chgPct } : (fredMacro?.nasdaq ? { price: fredMacro.nasdaq.value, chgPct: fredMacro.nasdaq.change } : null);
  const asOf = marketLive ? null : (fredMacro?.asOf ?? null); // hide stale label when live data is shown

  const fmtP = (n, dec = 0) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  const lbl = { fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 };

  const cell = { flex: '1 1 0', minWidth: 90, padding: '6px 10px', borderRight: `1px solid ${t.borderDim}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };
  const lastCell = { flex: '1 1 0', minWidth: 90, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };

  const PriceCell = ({ label, value, chg, color, isLast = false, dec = 0 }) => (
    <div style={isLast ? lastCell : cell}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || t.textPrimary, whiteSpace: 'nowrap' }}>{fmtP(value, dec)}</div>
      {chg != null && (
        <div style={{ fontSize: 15, color: chg >= 0 ? t.accent : t.danger, marginTop: 1 }}>
          {`${chg >= 0 ? '+' : ''}${Number(chg).toFixed(2)}%`}
        </div>
      )}
    </div>
  );

  const stripSequence = (
    <>
      <PriceCell label="Bitcoin" value={marketLive?.btc?.price ?? fredMacro?.btc?.value ?? null} chg={marketLive?.btc?.chgPct ?? fredMacro?.btc?.change ?? null} color={t.crypto} />
      <PriceCell label="ETH" value={marketLive?.eth?.price ?? fredMacro?.eth?.value ?? null} chg={marketLive?.eth?.chgPct ?? fredMacro?.eth?.change ?? null} color={t.purple} />
      <PriceCell label="Gold" value={gold} chg={goldChg} color="#FFD700" />
      <PriceCell label="Silver" value={silver} chg={silverChg} color="#C0C0C0" dec={2} />
      <PriceCell label="Oil" value={oil?.price ?? null} chg={oil?.chgPct ?? null} color={t.warn} dec={2} />
      <PriceCell label="SPY" value={spy?.price ?? null} chg={spy?.chgPct ?? null} color={t.accent} dec={2} />
      <PriceCell label="VIX" value={vix?.price ?? null} chg={vix?.chgPct ?? null} color={t.danger} dec={2} />
      <PriceCell label="S&P 500" value={sp500?.price ?? null} chg={sp500?.chgPct ?? null} color={t.textPrimary} />
      <PriceCell label="NASDAQ" value={nasdaq?.price ?? null} chg={nasdaq?.chgPct ?? null} color={t.textPrimary} isLast={!asOf} />
    </>
  );

  return (
    <div style={{ marginBottom: 8, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderTop: `2px solid ${t.accent}30`, padding: '0', display: 'flex', alignItems: 'stretch', width: '100%', overflowX: rotating ? 'hidden' : 'auto' }}>
        {rotating ? (
          <div className="fo-ticker-track" style={{ display: 'inline-flex', alignItems: 'stretch', whiteSpace: 'nowrap', minWidth: 'max-content' }}>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', flexShrink: 0 }}>
              {stripSequence}
              {asOf && <div style={{ paddingRight: 12, paddingLeft: 8, flexShrink: 0, display: 'flex', alignItems: 'center', borderRight: `1px solid ${t.borderDim}` }}><div style={{ fontSize: 15, color: t.textGhost, whiteSpace: 'nowrap' }}>FRED · {asOf}</div></div>}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', flexShrink: 0 }}>
              {stripSequence}
              {asOf && <div style={{ paddingRight: 12, paddingLeft: 8, flexShrink: 0, display: 'flex', alignItems: 'center', borderRight: `1px solid ${t.borderDim}` }}><div style={{ fontSize: 15, color: t.textGhost, whiteSpace: 'nowrap' }}>FRED · {asOf}</div></div>}
            </div>
          </div>
        ) : (
          <>
            {stripSequence}
            {asOf && <div style={{ marginLeft: 'auto', paddingRight: 12, paddingLeft: 8, flexShrink: 0, display: 'flex', alignItems: 'center' }}><div style={{ fontSize: 15, color: t.textGhost, whiteSpace: 'nowrap' }}>FRED · {asOf}</div></div>}
          </>
        )}
      </div>
    </div>
  );
}

// STATUS STRIP — Stage + Velocity + Daily Burn + Savings Rate
// ═══════════════════════════════════════════════════
function StatusStrip({ latest, t }) {
  const stage = calcStage(latest);
  const meta = STAGE_META[stage] || STAGE_META[0];
  const velocity = calcVelocity(latest);
  const monthlyBurn = monthlySpendBaseline(latest);
  const dailyBurn = monthlyBurn / 30;
  const savingsRate = calcSavingsRate(latest);
  const action = nextAction(latest);
  const stageColor = t[meta.color] || t.accent;
  const isDefense = stage <= 2;

  const velColor = velocity >= 0.25 ? t.accent : velocity >= 0.10 ? t.warn : t.danger;
  const srColor = savingsRate >= 20 ? t.accent : savingsRate >= 10 ? t.warn : savingsRate > 0 ? t.warn : t.danger;

  return (
    <div style={{ marginBottom: 12, animation: 'fadeIn 0.4s ease-out' }}>
      {/* Metrics row */}
      <div className="status-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginBottom: 2 }}>
        {/* Velocity */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Velocity</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: velColor }}>{(velocity * 100).toFixed(0)}<span style={{ fontSize: 14, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 15, color: velColor, textTransform: 'uppercase' }}>{velocity >= 0.25 ? 'ON TRACK' : velocity >= 0.10 ? 'ALERT' : 'CRISIS'}<span style={{ color: t.textDim }}> / 25% target</span></div>
        </div>
        {/* Daily Burn */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Daily Burn</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: dailyBurn > 0 ? t.warn : t.textDim }}>${dailyBurn.toFixed(2)}</div>
          <div style={{ fontSize: 15, color: dailyBurn > 0 ? t.warn : t.textGhost, textTransform: 'uppercase' }}>{dailyBurn > 0 ? `${fmt(Math.round(monthlyBurn))}/mo spend` : '— NO DATA'}</div>
        </div>
        {/* Savings Rate */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Savings Rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}<span style={{ fontSize: 14, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase' }}>{savingsRate >= 20 ? 'HEALTHY' : savingsRate > 0 ? 'LOW' : 'NO DATA'}</div>
        </div>
        {/* Runway */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Runway</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: runwayColor(runwayDaysFromLatest(latest), t) }}>{runwayDaysFromLatest(latest)}<span style={{ fontSize: 14, fontWeight: 400 }}> days</span></div>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase' }}>E-Fund Phase {latest?.eFund?.phase || 1}/4</div>
        </div>
      </div>

      {/* Combined info strip — Stage | Next Action */}
      <div className="status-rail" style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderLeft: `3px solid ${stageColor}`, display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {/* Stage */}
        <div className="status-rail-stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px', borderRight: `1px solid ${t.borderDim}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: stageColor }}>{stage}</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{meta.name}</div>
            <div style={{ fontSize: 15, color: stageColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{isDefense ? '🛡 Defense' : stage === 3 ? '🔓 Liberation' : '📈 Wealth'}</div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 8 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} style={{ width: i === stage ? 14 : 6, height: 5, background: i <= stage ? stageColor : t.elevated, opacity: i <= stage ? 1 : 0.3 }} />
            ))}
          </div>
        </div>

        {/* Next Action */}
        <div className="status-rail-next" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', flex: 1, minWidth: 0 }}>
          <Zap size={12} style={{ color: t[action.color] || t.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{action.text}</span>
        </div>
      </div>
    </div>
  );
}

function timeGreeting(now = new Date()) {
  const hour = now instanceof Date ? now.getHours() : new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

function PulseTicker({ latest, t, now, payFrequencyOverride }) {
  const stage = calcStage(latest);
  const stageMeta = STAGE_META[stage] || STAGE_META[0];
  const runway = runwayDaysFromLatest(latest);
  const savingsRate = calcSavingsRate(latest);
  const leak = dailyInterest(latest?.debts);
  const nextActionText = nextAction(latest)?.text || 'System ready';
  const payroll = { ...(latest?.payroll || { frequency: 'WEEKLY', weekday: 2 }), frequency: String(payFrequencyOverride || latest?.payroll?.frequency || 'WEEKLY').toUpperCase() };
  const nextPayday = nextPayrollDates(payroll, 1)[0];
  const bills = (latest?.bills || []).slice(0, 3).map(b => `${b.name} due ${b.dueDay}`);
  const tickItems = [
    `Stage ${stage} ${stageMeta.name}`,
    `Runway ${runway} days`,
    `Savings rate ${savingsRate.toFixed(0)}%`,
    leak > 0 ? `Leak $${leak.toFixed(2)}/day` : 'No daily leak detected',
    nextPayday ? `Next payday ${nextPayday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Payday schedule unset',
    ...bills,
    nextActionText,
    now?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || '',
  ].filter(Boolean);

  const repeated = [...tickItems, ...tickItems];
  return (
    <div style={{ marginBottom: 8, border: `1px solid ${t.borderDim}`, background: t.surface, overflow: 'hidden' }}>
      <div className="fo-ticker-track" style={{ display: 'inline-flex', whiteSpace: 'nowrap', gap: 12, padding: '7px 10px', minWidth: '100%' }}>
        {repeated.map((item, idx) => (
          <span key={`${item}-${idx}`} style={{ fontSize: 14, color: idx % 3 === 0 ? t.accent : t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {item}{idx < repeated.length - 1 ? ' •' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TRANSACTIONS MODULE
// ═══════════════════════════════════════════════════
const CAT_COLORS = {
  Essential: '#4a8fff',
  Medical: '#a8e06e',
  'Debt Service': '#ff4a4a',
  Savings: '#3effc4',
  Discretionary: '#ffb340',
  Income: '#3eff8b',
  Uncategorized: '#888',
};
function TransactionsMod({ latest, visible, t, onImport }) {
  const [showAll, setShowAll] = useState(false);
  const txns = latest?._recentTxns || [];
  const meta = latest?._meta || {};
  if (!visible) return null;

  const isEmpty = txns.length === 0 && !meta.transactions;
  if (isEmpty) {
    return (
      <Card title="Transactions" visible={visible} delay={280} t={t}>
        <div style={{ color: t.textDim, fontSize: 14, padding: '18px 0', textAlign: 'center' }}>
          No transactions — sync a bank statement via{" "}
          <button
            onClick={onImport}
            style={{ background: "none", border: "none", padding: 0, color: t.accent, cursor: "pointer", font: "inherit", fontWeight: 700 }}
          >
            Import
          </button>
        </div>
      </Card>
    );
  }

  const income = meta.income || 0;
  const totalExpense = meta.totalExpense || 0;
  const source = meta.source || 'Statement';
  const count = meta.transactions || txns.length;

  // Category expense totals for breakdown bar
  const catTotals = {};
  txns.forEach(tx => {
    if (tx.amount < 0) {
      catTotals[tx.category] = (catTotals[tx.category] || 0) + Math.abs(tx.amount);
    }
  });
  const totalSpend = Object.values(catTotals).reduce((s, v) => s + v, 0) || Math.max(totalExpense, 1);
  const catColor = (cat) => CAT_COLORS[cat] || '#888';
  const displayTxns = showAll ? txns : txns.slice(0, 12);

  return (
    <Card title="Transactions" visible={visible} delay={280} t={t}>
      {/* Scan Summary Row */}
      <div className="tx-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <div style={{ background: t.elevated, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Source</div>
          <div style={{ fontSize: 15, color: t.textSecondary, fontWeight: 600, wordBreak: 'break-word' }}>{source}</div>
        </div>
        <div style={{ background: t.elevated, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Parsed</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, lineHeight: 1 }}>{count}<span style={{ fontSize: 15, fontWeight: 400, color: t.textDim }}> txns</span></div>
        </div>
        <div style={{ background: t.elevated, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Net</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: income - totalExpense >= 0 ? t.accent : t.danger, lineHeight: 1 }}>{fmt(Math.abs(income - totalExpense))}<span style={{ fontSize: 15, color: income - totalExpense >= 0 ? t.accent : t.danger }}> {income - totalExpense >= 0 ? 'surplus' : 'deficit'}</span></div>
        </div>
      </div>

      {/* Income vs Spend */}
      <div className="tx-income-row" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: t.elevated, padding: '7px 10px', borderLeft: `2px solid ${t.accent}` }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Income</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, marginTop: 2 }}>{fmt(income)}</div>
        </div>
        <div style={{ flex: 1, background: t.elevated, padding: '7px 10px', borderLeft: `2px solid ${t.danger}` }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Spend</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.danger, marginTop: 2 }}>{fmt(totalExpense)}</div>
        </div>
        {meta.uncategorized > 0 && (
          <div style={{ flex: 1, background: t.elevated, padding: '7px 10px', borderLeft: `2px solid #888` }}>
            <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Uncategorized</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginTop: 2 }}>{fmt(meta.uncategorized)}</div>
          </div>
        )}
      </div>

      {/* Category Breakdown Bar */}
      {Object.keys(catTotals).length > 0 && (
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${t.borderDim}` }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Expense Breakdown</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
            {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
              <div key={cat} style={{ width: `${(val / totalSpend * 100).toFixed(1)}%`, background: catColor(cat), minWidth: 2 }} title={`${cat}: ${fmt(val)}`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, background: catColor(cat), flexShrink: 0 }} />
                <span style={{ fontSize: 15, color: t.textDim }}>{cat} <span style={{ color: t.textSecondary, fontWeight: 600 }}>{fmt(val)}</span> <span style={{ color: t.textGhost }}>({(val / totalSpend * 100).toFixed(0)}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction List */}
      {txns.length > 0 ? (
        <>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Recent Transactions — {txns.length} total
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {displayTxns.map((tx, i) => (
              <div key={i} style={{ padding: '5px 8px', background: i % 2 === 0 ? t.elevated : 'transparent', fontSize: 14 }}>
                {/* Row 1: date + description + amount */}
                <div className="tx-row-main" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: t.textGhost, flexShrink: 0, width: 44, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{tx.date ? tx.date.slice(5) : '—'}</span>
                  <span style={{ color: t.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</span>
                  <span style={{ flexShrink: 0, fontWeight: 700, color: tx.amount >= 0 ? t.accent : t.danger, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 60 }}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
                {/* Row 2: category badge */}
                <div style={{ paddingLeft: 52, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', background: catColor(tx.category) + '22', color: catColor(tx.category), padding: '1px 5px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tx.category || 'Uncategorized'}</span>
                </div>
              </div>
            ))}
          </div>
          {txns.length > 12 && (
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ width: '100%', background: 'none', border: `1px solid ${t.borderMid}`, color: t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, padding: '7px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8 }}
            >{showAll ? '▲ Collapse' : `▼ Show All ${txns.length} Transactions`}</button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 15, color: t.textGhost, textAlign: 'center', padding: '14px 0' }}>
          Scan a bank statement to view transaction history
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════
function DashboardView({ snapshots, latest, settings, t, isDark, onSync, onToggle, onSetPayFrequency, onExport, onClear, onToggleTheme, syncFlash, onHome, onMacroSentinel, onBitcoin, onSettings, onDocs, fredMacro, onRefreshIntel, intelRefreshing = false, intelRefreshNonce = 0, onUpdateDebt }) {
  const [syncOpen, setSyncOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const quickMenuRef = useRef(null);
  useMenuDismiss(quickMenuOpen, setQuickMenuOpen, quickMenuRef);
  const vis = settings.visibleModules;
  const ac = { red: 0, amber: 0, green: 0 };
  const debts = Array.isArray(latest?.debts) ? latest.debts : [];
  if (debts.some(d => (d?.balance || 0) > 2000)) ac.red++;
  if ((latest.macro?.triggersActive || 0) >= 2) ac.red++;
  ac.amber += (latest.budget?.categories || []).filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 0.75 && (c.actual / c.budgeted) < 1).length;
  if (runwayDays(latest.eFund) >= 60) ac.green++;
  // Enforcement alerts
  const _vel = calcVelocity(latest || {});
  if (_vel < 0.10 && (latest?.budget?.income || 0) > 0) ac.red++;
  else if (_vel < 0.20 && (latest?.budget?.income || 0) > 0) ac.amber++;
  // Budget blown = Never List violations
  const _blownBudget = (latest.budget?.categories || []).filter(c => c.budgeted > 0 && c.actual > c.budgeted && c.name !== 'Medical');
  ac.red += _blownBudget.length;
  if (_vel >= 0.25) ac.green++;
  // Protection alerts
  const _pli = latest.protection?.lifeInsurance;
  if (_pli?.conversionDeadline) { const _cd = new Date(_pli.conversionDeadline); const _al = new Date(_cd); _al.setFullYear(_al.getFullYear() - (_pli.alertLeadTimeYears || 5)); if (new Date() >= _al) ac.amber++; }
  if (_pli?.deathBenefit > 0) { const _ntf = _pli.deathBenefit - totalDebt(latest.debts); const _mo = latest.eFund?.monthlyExpenses || monthlySpendBaseline(latest); if (_mo > 0 && _ntf < _mo * 12) ac.amber++; else if (_ntf > 0) ac.green++; }
  // Portfolio alerts
  const _opts = latest.portfolio?.options || [];
  const _urgentOpts = _opts.filter(o => { if (!o.expDate) return false; const d = Math.floor((new Date(o.expDate) - new Date()) / 86400000); return d >= 0 && d <= 7; });
  if (_urgentOpts.length > 0) ac.red += _urgentOpts.length;

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onHome },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: null, current: true },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: onMacroSentinel },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: onDocs },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  const dashboardSectionStyle = {
    gridColumn: '1 / -1',
    position: 'relative',
    border: `1px solid ${t.borderDim}`,
    background: isDark
      ? `linear-gradient(180deg, ${t.panel2} 0%, ${t.panel} 72%, ${t.surface} 100%)`
      : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`,
    padding: '16px 16px 18px',
    overflow: 'hidden',
    boxShadow: isDark ? `0 14px 36px rgba(0,0,0,0.32)` : `0 10px 24px rgba(0,0,0,0.06)`,
  };

  const dashboardSectionAccent = (color) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 2,
    background: color,
    opacity: 0.9,
  });

  const DashboardSection = ({ title, subtitle, tone = t.borderBright, children, compact = false }) => (
    <section style={{ ...dashboardSectionStyle, padding: compact ? '10px 10px 12px' : dashboardSectionStyle.padding }}>
      <div style={dashboardSectionAccent(tone)} />
      <div style={{ position: 'absolute', top: 12, right: -42, transform: 'rotate(90deg)', transformOrigin: 'right top', fontSize: 9, color: `${tone}cc`, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 800, pointerEvents: 'none' }}>
        Fortify Section
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: isDark ? 0.16 : 0.09, backgroundImage: `linear-gradient(${t.borderDim}40 1px, transparent 1px), linear-gradient(90deg, ${t.borderDim}22 1px, transparent 1px)`, backgroundSize: '56px 56px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: compact ? 10 : 14 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: tone, textTransform: 'uppercase', letterSpacing: '0.16em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 7, padding: '4px 8px', border: `1px solid ${tone}55`, background: `${tone}10`, fontWeight: 800 }}>
            <span style={{ color: isDark ? t.warn : t.textDim }}>//</span>
            <span>{title}</span>
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: t.textGhost, maxWidth: 720, lineHeight: 1.6 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );

  return (<div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", paddingBottom: 40 }}>
    <AppTopbar t={t} isDark={isDark} menuOpen={quickMenuOpen} setMenuOpen={setQuickMenuOpen} menuRef={quickMenuRef} navItems={navItems} onToggleTheme={onToggleTheme} />
    <main className="dashboard-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 20px 64px' }}>
      {/* ═══ DAILY LAW HERO — Right below greeting, above all modules ═══ */}
      <div style={{ marginBottom: 16 }}>
        <DailyLawHero t={t} />
      </div>

      <div className="main-grid" style={{ display: 'grid', gap: 14 }}>

        {/* Row 1 — CFO Daily Pulse: full width */}
        {vis.includes('directive') && (
          <DashboardSection
            title="Command Pulse"
            subtitle="Start here. This is the dashboard’s operating brief: pressure, posture, and what deserves attention first."
            tone={t.accent}
          >
            <DirectiveMod visible latest={latest} t={t} />
          </DashboardSection>
        )}

        {/* Row 2 — Money Map strip: full width, compact */}
        {vis.includes('netWorth') && (
          <DashboardSection
            title="Balance Map"
            subtitle="See where cash is protected, where liabilities are concentrated, and how the system is actually shaped."
            tone={t.textSecondary}
            compact
          >
            <NetWorthMod snapshots={snapshots} latest={latest} visible t={t} />
          </DashboardSection>
        )}

        {/* Row 3 — Budget: full width, checked near-daily "Am I on track this month?" */}
        {vis.includes('budget') && (
          <DashboardSection
            title="Budget Reality"
            subtitle="Not a plan on paper. This is the live read on whether spending is obeying the system."
            tone={t.warn}
          >
            <BudgetMod latest={latest} visible t={t} />
          </DashboardSection>
        )}

        {/* Row 3b — KNOX Terminal: policy enforcement AI */}
        {vis.includes('knox') && (
          <DashboardSection
            title="Protocol Enforcement"
            subtitle="KNOX is here to challenge drift, catch violations, and force clarity before small mistakes compound."
            tone={t.danger}
          >
            <KnoxTerminalMod latest={latest} visible t={t} />
          </DashboardSection>
        )}

        {/* Row 4 — Calendar · Bills · E-Fund: time-sensitive triple */}
        {(vis.includes('planner') || vis.includes('eFund')) && (
          <DashboardSection
            title="Near-Term Pressure"
            subtitle="Calendar, bills, and emergency coverage belong together because this is where short-term mistakes usually begin."
            tone={t.purple}
          >
            {vis.includes('eFund') && <FortressOfCashHero latest={latest} t={t} />}
            <div className="bill-cal-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
              <BillCalendarMod latest={latest} visible={vis.includes('planner')} t={t} payFrequencyOverride={settings?.payFrequency} />
              <PlannerMod latest={latest} visible={vis.includes('planner')} t={t} payFrequencyOverride={settings?.payFrequency} />
              <EFundMod latest={latest} visible={vis.includes('eFund')} t={t} />
            </div>
          </DashboardSection>
        )}

        {/* Row 4 — Debt: full width, strategic/monthly "What's my payoff plan?" */}
        {vis.includes('debt') && (
          <DashboardSection
            title="Debt Battlefield"
            subtitle="Interest drag, payoff order, and liability concentration should read like a campaign board, not a passive list."
            tone={t.danger}
          >
            <DebtMod latest={latest} visible t={t} onUpdateDebt={onUpdateDebt} />
          </DashboardSection>
        )}

        {/* Row 5 — Review + Coverage: historical lookup and protection check */}
        {vis.includes('transactions') && (
          <section style={{ ...dashboardSectionStyle, gridColumn: 'span 1' }}>
            <div style={dashboardSectionAccent(t.textSecondary)} />
            <div style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
              Historical Review
            </div>
            <TransactionsMod latest={latest} visible={vis.includes('transactions')} t={t} onImport={() => setSyncOpen(true)} />
          </section>
        )}
        {vis.includes('protection') && (
          <section style={{ ...dashboardSectionStyle, gridColumn: 'span 1' }}>
            <div style={dashboardSectionAccent(t.purple)} />
            <div style={{ fontSize: 11, color: t.purple, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
              Coverage & Protection
            </div>
            <ProtectionMod latest={latest} visible={vis.includes('protection')} t={t} />
          </section>
        )}

      </div>
    </main>
    <footer style={{ position: 'fixed', bottom: 0, width: '100%', height: 32, background: t.surface, borderTop: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 12, zIndex: 50 }}>
      {/* Left — sync status */}
      <button
        onClick={() => setSyncOpen(true)}
        title="Import new statement to update"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
      >
        <span style={{ color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Synced</span>
        <span style={{ color: daysSince(latest.date) >= 7 ? t.danger : daysSince(latest.date) >= 3 ? t.warn : t.accent, fontWeight: 700 }}>
          {daysSince(latest.date) === 0 ? 'Today' : daysSince(latest.date) === 1 ? 'Yesterday' : daysSince(latest.date) >= 999 ? 'Never' : `${daysSince(latest.date)}d ago`}
        </span>
        {daysSince(latest.date) >= 7 && <span style={{ color: t.danger }}>· Update</span>}
      </button>
      {/* Center — daily interest burn */}
      {dailyInterest(latest?.debts) > 0 && (
        <span style={{ color: t.danger, fontWeight: 700, letterSpacing: '0.04em' }}>
          ${dailyInterest(latest?.debts).toFixed(2)}/day
        </span>
      )}
      {/* Right — alert dots */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {ac.red > 0 && <span style={{ color: t.danger, fontSize: 11 }}>{ac.red}●</span>}
        {ac.amber > 0 && <span style={{ color: t.warn, fontSize: 11 }}>{ac.amber}●</span>}
        {ac.green > 0 && <span style={{ color: t.accent, fontSize: 11 }}>{ac.green}●</span>}
      </div>
    </footer>
    <UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={onSync} t={t} />
  </div>);
}

const RADAR_MONTHLY_THEMES = [
  { month: 'JAN', theme: 'Policy Reset Window', objective: 'Start the year by defining the Fed posture, liquidity base, and risk regime.' },
  { month: 'FEB', theme: 'Credit Sensitivity Check', objective: 'Track whether tighter policy is flowing into credit spreads, employment, and stress.' },
  { month: 'MAR', theme: 'Liquidity Command Center', objective: 'Measure balance-sheet flow, Treasury drain, and whether reserves are loosening or tightening.' },
  { month: 'APR', theme: 'Posture Versus Promise', objective: 'Separate what the Fed says from what rates, liquidity, and markets are actually doing.' },
  { month: 'MAY', theme: 'Price Stability Friction', objective: 'Watch where inflation persistence collides with growth and forces policy hesitation.' },
  { month: 'JUN', theme: 'Summer Funding Watch', objective: 'Focus on reserves, auctions, and Treasury financing pressure during thinner liquidity.' },
  { month: 'JUL', theme: 'Reaction Function Audit', objective: 'Test whether the Fed is responding more to inflation, labor, or market stress.' },
  { month: 'AUG', theme: 'Risk Appetite Gauge', objective: 'Monitor whether easy liquidity is feeding speculation faster than the real economy.' },
  { month: 'SEP', theme: 'Autumn Stress Mapping', objective: 'Map where tightening pressure could show up first across credit, duration, and volatility.' },
  { month: 'OCT', theme: 'Financial Conditions Trap', objective: 'Check whether markets are easing the Fed’s job by themselves or fighting it.' },
  { month: 'NOV', theme: 'Narrative Versus Data', objective: 'Force every policy narrative to prove itself against hard macro data.' },
  { month: 'DEC', theme: 'Year-End Liquidity Close', objective: 'Close the year by judging what policy actually changed, not what was projected.' },
];

const FED_DAILY_BRIEFS = [
  { headline: 'Policy moves first. The economy answers later.', brief: 'The Fed changes the cost of money immediately, but households and businesses respond on delay. Today’s market tone is reacting to old policy as much as current headlines.', lens: 'Delay Effect' },
  { headline: 'When rates stay high, time becomes a weapon.', brief: 'Restrictive policy does its work by extending pressure across refinancing, hiring, and credit demand. The longer the stance holds, the more the lagged damage accumulates.', lens: 'Higher for Longer' },
  { headline: 'Liquidity can ease even when the Fed sounds tough.', brief: 'Balance-sheet flow, Treasury cash drawdowns, and reserve conditions can soften financial conditions beneath hawkish language. Watch the plumbing, not just the press conference.', lens: 'Liquidity Versus Rhetoric' },
  { headline: 'Easy money rarely lands evenly.', brief: 'When liquidity expands, asset owners usually feel relief before wage earners do. Risk assets can celebrate while the real economy is still digesting prior tightening.', lens: 'Wealth Effect' },
  { headline: 'The market trades the next cut long before the cut arrives.', brief: 'Forward guidance and Fed-watch probabilities change behavior before policy does. That reflex can loosen conditions early and complicate the Fed’s job.', lens: 'Reflexivity' },
  { headline: 'A low policy rate is not the same as a low-risk market.', brief: 'When cash yields fall, capital gets pushed outward on the risk curve. Speculation often returns faster than durable growth.', lens: 'Yield Trap' },
  { headline: 'Treasury issuance can tighten the field without a rate hike.', brief: 'If the Treasury rebuilds cash aggressively, reserves can be absorbed even while the Fed stands still. Funding pressure sometimes comes from issuance more than the policy rate.', lens: 'Treasury Drain' },
  { headline: 'Markets weaken first at the margin.', brief: 'The Fed does not need every borrower to break. It only needs enough marginal stress in housing, hiring, and financing to cool demand.', lens: 'Transmission' },
  { headline: 'The zero bound solved panic and invited distortion.', brief: 'Emergency accommodation can stop collapse, but staying too easy for too long distorts price signals and encourages leverage to fill the yield vacuum.', lens: 'Zero Bound' },
  { headline: 'Cut probabilities are not relief until liquidity confirms them.', brief: 'A dovish path matters less if reserves are still tight or Treasury pressure is rising. The signal only improves when policy expectations and liquidity align.', lens: 'Confirmation' },
  { headline: 'The bond market still matters, even when the Fed dominates the room.', brief: 'Curve shape, term premiums, and credit spreads remain warning systems. If those are strained, the policy message is not as clean as headlines suggest.', lens: 'Market Signal' },
  { headline: 'Tight money punishes the weakest balance sheets first.', brief: 'Highly levered borrowers, refinancing windows, and speculative assets feel policy pressure before strong incumbents do. Stress begins on the edges and moves inward.', lens: 'Fragility' },
  { headline: 'Net liquidity is the battlefield map.', brief: 'Fed assets, Treasury cash, and reverse repo balances together explain how much fuel is left for risk-taking. This is the terrain capital is fighting on.', lens: 'Liquidity Map' },
  { headline: 'A patient Fed can still break a fast market.', brief: 'Financial conditions can reverse sharply if traders get ahead of easing that never arrives. Markets often front-run relief more confidently than policymakers deliver it.', lens: 'Expectation Risk' },
  { headline: 'Inflation cooling is not the same thing as victory.', brief: 'The Fed needs enough evidence that price pressure is broken, not merely easing. One soft print changes sentiment; a trend changes policy.', lens: 'Disinflation Test' },
  { headline: 'If volatility stays calm, liquidity tends to lead.', brief: 'When stress is low, reserves and policy expectations drive the tape. When volatility spikes, posture matters more than liquidity optimism.', lens: 'Stress Filter' },
  { headline: 'The real question is not cut or hike. It is whether conditions are loosening.', brief: 'Markets care about the full transmission channel: yields, spreads, reserves, and confidence. Fed policy is the trigger, but conditions are the outcome.', lens: 'Financial Conditions' },
  { headline: 'Emergency tools are easiest to start and hardest to unwind.', brief: 'Asset purchases and crisis backstops can stabilize panic quickly, but removing them without market tantrums is far more difficult. Exit risk is part of the original intervention.', lens: 'Exit Problem' },
  { headline: 'A strong market can work against the Fed.', brief: 'If risk assets rally too hard, wealth effects and easier financing can re-stimulate demand. The market can partially undo the intended restraint.', lens: 'Policy Friction' },
  { headline: 'The Fed is always choosing a trade-off.', brief: 'Price stability, labor resilience, and financial stability rarely peak together. Each meeting is a decision about which risk deserves priority.', lens: 'Trade-Offs' },
  { headline: 'The lag is where policy hides its consequences.', brief: 'The most dangerous mistake is assuming calm conditions mean policy is harmless. Often the full effect has simply not arrived yet.', lens: 'Long and Variable Lags' },
  { headline: 'When reserve conditions improve, risk appetite usually notices quickly.', brief: 'Equities and crypto tend to respond faster than the real economy when liquidity loosens. Markets are often the first screen where easier conditions appear.', lens: 'Risk Response' },
  { headline: 'Tighter policy is also a test of market addiction.', brief: 'If every hint of reduced accommodation produces disorder, that reveals how dependent asset prices became on central-bank support.', lens: 'Addiction Test' },
  { headline: 'The cleanest policy signal is one confirmed by multiple channels.', brief: 'When the rate path, the curve, reserves, and volatility all point the same way, the regime is clearer. Mixed signals deserve patience, not conviction.', lens: 'Confluence' },
];

// MACRO SENTINEL — PRE-MARKET RADAR (React Dashboard)
// ═══════════════════════════════════════════════════
function MacroSentinelView({ t, isDark, onBack, onToggleTheme, latest, fredMacro, settings, onHome, onBitcoin, onSettings, onDocs }) {
  const [macro, setMacro] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [warFocus, setWarFocus] = useState('policy');
  const [schoolTab, setSchoolTab] = useState('learn');
  const [lessonFocus, setLessonFocus] = useState('net-liquidity');
  const [quizChoice, setQuizChoice] = useState(null);
  const [simState, setSimState] = useState({ fedFunds: null, treasury: null, volatility: null, liquidity: null });
  const [blackBoxLog, setBlackBoxLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fortify_blackbox') || '[]'); } catch { return []; }
  });
  const menuRef = useRef(null);
  useMenuDismiss(menuOpen, setMenuOpen, menuRef);

  const load = useCallback(async () => {
    try {
      const bust = Date.now();
      const base = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${base}macro.json?v=${bust}`, { cache: 'no-store' });
      setMacro(response.ok ? await response.json() : null);
    } catch (_) {
      setMacro(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Black Box recorder — fires when FRED data loads ───────────────────────
  useEffect(() => {
    const w = (macro || fredMacro)?.walcl?.value ?? null;
    const tg = (macro || fredMacro)?.tga?.value ?? null;
    if (w == null || tg == null) return;
    const nl = w - tg;
    const dph = Math.floor((Date.now() - new Date('2024-04-20').getTime()) / 86400000);
    let s = 0;
    if (nl > 5500) s += 40; else if (nl > 5000) s += 20;
    if (dph <= 500) s += 40; else if (dph < 800) s += 10;
    if (tg < 800) s += 20;
    const now = new Date();
    const ts = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const stat = s >= 75 ? 'LOCKED' : s >= 40 ? 'SCANNING' : 'JAMMED';
    setBlackBoxLog(prev => {
      if (prev.length > 0 && prev[prev.length - 1].ts === ts) return prev;
      const updated = [...prev, { ts, score: s, status: stat, netLiq: nl, tga: tg, dph }].slice(-20);
      try { localStorage.setItem('fortify_blackbox', JSON.stringify(updated)); } catch { }
      return updated;
    });
  }, [macro, fredMacro]);

  // ── Derived values ────────────────────────────────────────────────────────
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const fedBrief = FED_DAILY_BRIEFS[dayOfYear % FED_DAILY_BRIEFS.length];
  const radarTheme = RADAR_MONTHLY_THEMES[new Date().getMonth()] || RADAR_MONTHLY_THEMES[0];

  const _fm = macro || fredMacro;
  const walcl = _fm?.walcl?.value ?? null;
  const tga = _fm?.tga?.value ?? null;
  const rrp = _fm?.rrp?.value ?? null;
  const fedFundsRate = _fm?.fedFundsRate?.value ?? latest?.macro?.fedFundsRate ?? null;
  const yieldCurve = _fm?.yieldCurve10Y2Y?.value ?? _fm?.yieldCurve?.value ?? latest?.macro?.yieldCurve10Y2Y ?? latest?.macro?.yieldCurve ?? null;
  const fedWatchCut = latest?.macro?.fedWatchCut ?? _fm?.fedWatchCut?.value ?? null;
  const vix = _fm?.vix?.value ?? null;
  const netLiq = walcl != null && tga != null && rrp != null ? walcl - tga - rrp : null;
  const netLiqColor = netLiq == null ? t.textDim : netLiq > 5000 ? t.accent : netLiq > 3000 ? t.warn : t.danger;
  const clampRadar = (value, min, max) => Math.max(min, Math.min(max, value));
  const rateLevel = fedFundsRate == null ? null : clampRadar(fedFundsRate, 0, 5);
  const heatPct = rateLevel == null ? null : (rateLevel / 5) * 100;
  const reactorIntensity = rateLevel == null ? 0.45 : 0.2 + (1 - rateLevel / 5) * 0.8;
  const reactorColor = rateLevel == null ? t.textDim : rateLevel < 1.5 ? '#00fbff' : rateLevel < 3.5 ? '#f0b429' : '#f85149';
  const reactorStatus = rateLevel == null ? 'DATA PENDING' : rateLevel < 1.5 ? 'ACCOMMODATIVE' : rateLevel < 3.5 ? 'NEUTRAL' : 'TIGHTENING';
  const reactorDesc = rateLevel == null
    ? 'Awaiting FRED Fed Funds series.'
    : rateLevel < 1.5 ? 'Zero bound — Asset bubble risk rising'
      : rateLevel < 3.5 ? 'Neutral territory — Balanced stance'
        : 'Tightening cycle — Liquidity contracting';
  const liquidityPulseDur = netLiq == null ? '2.8s' : netLiq > 5500000 ? '1.8s' : netLiq > 4500000 ? '2.4s' : '3.2s';
  const liquidityFlowOpacity = netLiq == null ? 0.45 : clampRadar(((netLiq - 3500000) / 2500000), 0.25, 1);
  const pumpLabel = netLiq == null ? 'LIVE NET LIQUIDITY' : netLiq > 5500000 ? 'LIQUIDITY FLOOD' : netLiq > 4500000 ? 'LIQUIDITY OPEN' : 'LIQUIDITY TIGHT';

  // ── Signal Confluence Engine ───────────────────────────────────────────────
  const confNetLiq = walcl != null && tga != null ? walcl - tga : null;
  const halvingDate = new Date('2024-04-20');
  const daysPostHalving = Math.floor((Date.now() - halvingDate.getTime()) / 86400000);
  let liqPts = 0, cyclePts = 0, tgaPts = 0;
  if (confNetLiq != null) {
    if (confNetLiq > 5500) liqPts = 40;
    else if (confNetLiq > 5000) liqPts = 20;
  }
  if (daysPostHalving <= 500) cyclePts = 40;
  else if (daysPostHalving < 800) cyclePts = 10;
  if (tga != null && tga < 800) tgaPts = 20;
  const confScore = liqPts + cyclePts + tgaPts;
  const confColor = confScore >= 75 ? t.accent : confScore >= 40 ? t.warn : t.danger;
  const confStatus = confScore >= 75 ? 'TARGET ACQUIRED // CONFLUENCE HIGH'
    : confScore >= 40 ? 'SCANNING // SEARCHING FOR SIGNAL'
      : 'SIGNAL JAMMED // DEFENSIVE POSITION';
  const theater = confScore >= 75 ? 'RISK-ON' : confScore >= 40 ? 'NEUTRAL' : 'RISK-OFF';
  const posture = confScore >= 75 ? 'ATTACK' : confScore >= 40 ? 'WAIT' : 'DEFEND';
  const policyPressure = fedFundsRate == null ? 35 : clampRadar((fedFundsRate / 5) * 100, 0, 100);
  const treasuryPressure = tga == null ? 25 : clampRadar((tga / 1200000) * 100, 0, 100);
  const cyclePressure = daysPostHalving <= 500 ? 25 : daysPostHalving < 800 ? 55 : 85;
  const volatilityPressure = vix == null ? 30 : clampRadar(((vix - 12) / 28) * 100, 0, 100);
  const warPressures = [
    {
      key: 'policy',
      label: 'Policy',
      score: policyPressure,
      tone: policyPressure >= 65 ? t.danger : policyPressure >= 40 ? t.warn : t.accent,
      summary: fedFundsRate == null ? 'Waiting on Fed Funds series.' : `Fed Funds at ${fedFundsRate.toFixed(2)}% is the current policy drag.`,
      why: fedFundsRate == null ? 'Once DFF updates, System Heat and War Game will auto-align.' : fedFundsRate >= 3.5 ? 'Policy is still restrictive. Cuts are the cleanest way to unlock a more aggressive posture.' : fedFundsRate >= 1.5 ? 'Policy is no longer crushing liquidity, but it is not fully accommodative either.' : 'Policy is loose enough that other pressures matter more than rates.',
      flips: [
        fedFundsRate == null ? 'Load DFF series into macro feed' : fedFundsRate > 3.5 ? `Below 3.50% shifts policy from restrictive to neutral` : `Above 3.50% reopens restrictive policy pressure`,
        fedWatchCut == null ? 'FedWatch unavailable' : `Cut probability above 50% improves posture odds`,
      ],
    },
    {
      key: 'treasury',
      label: 'Treasury',
      score: treasuryPressure,
      tone: treasuryPressure >= 65 ? t.danger : treasuryPressure >= 40 ? t.warn : t.accent,
      summary: tga == null ? 'No TGA data.' : `TGA at $${(tga / 1000).toFixed(2)}T is the Treasury drain on liquidity.`,
      why: tga == null ? 'Treasury pressure cannot be scored without TGA.' : tga >= 900 ? 'Treasury is absorbing liquidity instead of releasing it. This is a brake on risk assets.' : tga >= 800 ? 'Treasury pressure is active but not yet dominant.' : 'Treasury pressure is light. Falling TGA is usually a tailwind for liquidity.',
      flips: [
        tga == null ? 'Load TGA series' : `Below $0.80T upgrades Treasury pressure from drag to tailwind`,
        tga == null ? 'No data' : `Above $0.95T pushes Treasury pressure into high-risk territory`,
      ],
    },
    {
      key: 'cycle',
      label: 'Cycle',
      score: cyclePressure,
      tone: cyclePressure >= 65 ? t.danger : cyclePressure >= 40 ? t.warn : t.accent,
      summary: `${daysPostHalving} days post-halving defines the cycle tailwind.`,
      why: daysPostHalving <= 500 ? 'Cycle support is still active. Time is on the side of upside reflexivity.' : daysPostHalving < 800 ? 'Cycle tailwind is fading. Macro matters more from here.' : 'Cycle support is largely spent. New upside needs policy or liquidity help.',
      flips: [
        daysPostHalving <= 500 ? 'After day 500, cycle support fades from strong to moderate' : 'Cycle support already faded below strong',
        daysPostHalving < 800 ? 'After day 800, cycle becomes a structural drag' : 'Cycle is already beyond the core tailwind window',
      ],
    },
    {
      key: 'volatility',
      label: 'Volatility',
      score: volatilityPressure,
      tone: volatilityPressure >= 65 ? t.danger : volatilityPressure >= 40 ? t.warn : t.accent,
      summary: vix == null ? 'No VIX data.' : `VIX at ${vix.toFixed(2)} measures stress in the theater.`,
      why: vix == null ? 'Without VIX, volatility pressure is only estimated.' : vix >= 25 ? 'Stress is high. Defensive posture deserves respect even if liquidity is improving.' : vix >= 18 ? 'Stress is elevated but not broken. Wait for cleaner confirmation.' : 'Stress is low enough that liquidity and policy can lead the theater.',
      flips: [
        vix == null ? 'Load VIX feed' : 'Below 18 reduces stress pressure meaningfully',
        vix == null ? 'No data' : 'Above 25 forces volatility into the primary threat slot',
      ],
    },
  ];
  const primaryPressure = warPressures.reduce((top, item) => item.score > top.score ? item : top, warPressures[0]);
  const focusPressure = warPressures.find((item) => item.key === warFocus) || primaryPressure;
  const warHeadline = theater === 'RISK-ON'
    ? 'Liquidity and cycle conditions support offensive positioning.'
    : theater === 'NEUTRAL'
      ? 'The theater is mixed. Capital should stay patient and selective.'
      : 'Defensive conditions dominate. Survival matters more than speed.';
  const warThresholds = [
    { label: 'Risk-On Trigger', value: netLiq == null ? 'Need live net liquidity' : netLiq > 5500000 ? 'Active now' : 'Net liquidity above $5.50T', tone: t.accent },
    { label: 'Treasury Flip', value: tga == null ? 'Need TGA data' : tga < 800 ? 'Active now' : 'TGA below $0.80T', tone: t.warn },
    { label: 'Policy Relief', value: fedFundsRate == null ? 'Need DFF data' : fedFundsRate < 3.5 ? 'Active now' : 'Fed Funds below 3.50%', tone: reactorColor },
    { label: 'Stress Exit', value: vix == null ? 'Need VIX data' : vix < 18 ? 'Active now' : 'VIX below 18', tone: t.textSecondary },
  ];
  const confComponents = [
    {
      label: 'NET LIQUIDITY (WALCL − TGA)', score: liqPts, max: 40,
      note: confNetLiq != null ? `$${(confNetLiq / 1000).toFixed(2)}T` : 'no data'
    },
    {
      label: 'HALVING CYCLE MATURITY', score: cyclePts, max: 40,
      note: `${daysPostHalving}d post-halving`
    },
    {
      label: 'TREASURY PRESSURE (TGA)', score: tgaPts, max: 20,
      note: tga != null ? `$${(tga / 1000).toFixed(2)}T TGA` : 'no data'
    },
  ];
  const schoolSignals = [
    {
      key: 'net-liquidity',
      label: 'Net Liquidity',
      current: netLiq == null ? 'Need WALCL, TGA, and RRP' : `${netLiq >= 0 ? '+' : ''}$${Math.abs(netLiq / 1000).toFixed(2)}T`,
      explain: 'Net liquidity is the fuel available to financial markets after Treasury cash and reverse repo balances are removed from the Fed balance sheet.',
      bullish: 'When it rises, risk assets usually get more oxygen.',
      bearish: 'When it falls, markets lose fuel even if headlines sound dovish.',
      connects: 'Fed balance sheet -> Treasury cash drain -> reserves -> risk appetite',
      color: netLiqColor,
    },
    {
      key: 'fed-funds',
      label: 'Fed Funds',
      current: fedFundsRate == null ? 'Need DFF series' : `${fedFundsRate.toFixed(2)}%`,
      explain: 'This is the policy rate. It sets the price of short-term money and influences borrowing costs across the economy.',
      bullish: 'Cuts reduce policy drag and can improve posture if liquidity confirms.',
      bearish: 'High rates hold pressure on refinancing, hiring, and credit creation.',
      connects: 'Fed policy -> loan pricing -> demand -> growth and stress',
      color: reactorColor,
    },
    {
      key: 'tga',
      label: 'TGA',
      current: tga == null ? 'Need Treasury data' : `$${(tga / 1000).toFixed(2)}T`,
      explain: 'The Treasury General Account is the government cash pile at the Fed. When it rises, cash can be pulled out of the system.',
      bullish: 'A falling TGA usually releases liquidity back toward markets.',
      bearish: 'A rising TGA can drain reserves even without a rate hike.',
      connects: 'Treasury issuance -> cash balance -> reserves -> liquidity pressure',
      color: t.warn,
    },
    {
      key: 'curve',
      label: '10Y-2Y Curve',
      current: yieldCurve == null ? 'Need yield curve' : `${yieldCurve.toFixed(2)}%`,
      explain: 'The curve compares long-term and short-term yields. It is a fast read on growth expectations and policy tightness.',
      bullish: 'A healthier curve can signal less stress in the system.',
      bearish: 'An inverted curve often means policy is too tight for growth.',
      connects: 'Rate path -> bond market -> recession probability -> posture',
      color: yieldCurve != null && yieldCurve < 0 ? t.danger : t.accent,
    },
    {
      key: 'vix',
      label: 'VIX',
      current: vix == null ? 'Need volatility feed' : vix.toFixed(2),
      explain: 'VIX is the market’s stress meter. It shows how much fear is being priced into options.',
      bullish: 'A calm VIX lets liquidity and policy improvements matter more.',
      bearish: 'A spike in VIX can override otherwise supportive macro signals.',
      connects: 'Stress -> positioning -> forced selling -> defensive posture',
      color: volatilityPressure >= 65 ? t.danger : volatilityPressure >= 40 ? t.warn : t.accent,
    },
  ];
  const activeLesson = schoolSignals.find((item) => item.key === lessonFocus) || schoolSignals[0];
  const simulateWarGame = ({ fedFunds = fedFundsRate, treasury = tga, volatility = vix, liquidity = netLiq }) => {
    const simPolicy = fedFunds == null ? 35 : clampRadar((fedFunds / 5) * 100, 0, 100);
    const simTreasury = treasury == null ? 25 : clampRadar((treasury / 1200000) * 100, 0, 100);
    const simVol = volatility == null ? 30 : clampRadar(((volatility - 12) / 28) * 100, 0, 100);
    const simLiqPts = liquidity == null ? 0 : liquidity > 5500000 ? 40 : liquidity > 5000000 ? 20 : 0;
    const simScore = simLiqPts + cyclePts + (treasury != null && treasury < 800 ? 20 : 0);
    return {
      score: simScore,
      theater: simScore >= 75 ? 'RISK-ON' : simScore >= 40 ? 'NEUTRAL' : 'RISK-OFF',
      posture: simScore >= 75 ? 'ATTACK' : simScore >= 40 ? 'WAIT' : 'DEFEND',
      primary: [
        { label: 'Policy', score: simPolicy },
        { label: 'Treasury', score: simTreasury },
        { label: 'Volatility', score: simVol },
        { label: 'Cycle', score: cyclePressure },
      ].reduce((top, item) => item.score > top.score ? item : top, { label: 'Policy', score: simPolicy }),
    };
  };
  const simSnapshot = simulateWarGame({
    fedFunds: simState.fedFunds ?? fedFundsRate,
    treasury: simState.treasury ?? tga,
    volatility: simState.volatility ?? vix,
    liquidity: simState.liquidity ?? netLiq,
  });
  const flightScenarios = [
    {
      key: 'cut-50',
      label: 'Fed cuts 50 bps',
      detail: 'Policy relief arrives before a full easing cycle is priced in.',
      snapshot: simulateWarGame({ fedFunds: fedFundsRate == null ? null : Math.max(0, fedFundsRate - 0.5) }),
    },
    {
      key: 'tga-draw',
      label: 'Treasury drains $100B',
      detail: 'Treasury cash leaves the account and reserves loosen.',
      snapshot: simulateWarGame({ treasury: tga == null ? null : Math.max(0, tga - 100) }),
    },
    {
      key: 'stress-spike',
      label: 'VIX spikes to 28',
      detail: 'Stress jumps and defensive posture starts to dominate.',
      snapshot: simulateWarGame({ volatility: 28 }),
    },
    {
      key: 'liq-boost',
      label: 'Net liquidity rises $250B',
      detail: 'Fuel improves and the war-game score climbs quickly.',
      snapshot: simulateWarGame({ liquidity: netLiq == null ? null : netLiq + 250000 }),
    },
  ];
  const simControls = [
    {
      key: 'fedFunds',
      label: 'Fed Funds',
      unit: '%',
      step: 0.25,
      min: 0,
      max: 6,
      base: fedFundsRate,
      accent: reactorColor,
      description: 'Change the policy rate and watch policy pressure move.',
      format: (value) => `${value.toFixed(2)}%`,
    },
    {
      key: 'treasury',
      label: 'TGA',
      unit: 'T',
      step: 25,
      min: 0,
      max: 1200,
      base: tga,
      accent: t.warn,
      description: 'Treasury cash drains or releases reserves into the system.',
      format: (value) => `$${(value / 1000).toFixed(2)}T`,
    },
    {
      key: 'liquidity',
      label: 'Net Liquidity',
      unit: 'T',
      step: 100,
      min: 3500,
      max: 6500,
      base: netLiq,
      accent: netLiqColor,
      description: 'This is the market fuel line for the war game.',
      format: (value) => `$${(value / 1000).toFixed(2)}T`,
    },
    {
      key: 'volatility',
      label: 'VIX',
      unit: '',
      step: 1,
      min: 10,
      max: 40,
      base: vix,
      accent: volatilityPressure >= 65 ? t.danger : volatilityPressure >= 40 ? t.warn : t.accent,
      description: 'Stress can overpower otherwise supportive macro signals.',
      format: (value) => value.toFixed(0),
    },
  ];
  const simSummary = [
    { label: 'Theater', value: simSnapshot.theater, tone: simSnapshot.score >= 75 ? t.accent : simSnapshot.score >= 40 ? t.warn : t.danger },
    { label: 'Posture', value: simSnapshot.posture, tone: simSnapshot.posture === 'ATTACK' ? t.accent : simSnapshot.posture === 'WAIT' ? t.warn : t.danger },
    { label: 'Primary Pressure', value: simSnapshot.primary.label, tone: t.textPrimary },
    { label: 'Signal Score', value: `${simSnapshot.score}/100`, tone: simSnapshot.score >= 75 ? t.accent : simSnapshot.score >= 40 ? t.warn : t.danger },
  ];

  useEffect(() => {
    setSimState({
      fedFunds: fedFundsRate,
      treasury: tga,
      volatility: vix,
      liquidity: netLiq,
    });
  }, [fedFundsRate, tga, vix, netLiq]);
  const drillQuestionBank = useMemo(() => {
    const improveSetups = [
      {
        prompt: 'What would most directly improve the current macro theater from here?',
        correct: 'b',
        options: [
          { key: 'a', text: 'Higher TGA with the same rate path', why: 'That pulls more liquidity out of the system and usually tightens conditions.' },
          { key: 'b', text: 'Lower Fed Funds with net liquidity staying firm', why: 'Policy relief plus stable liquidity is the cleanest path to a better theater.' },
          { key: 'c', text: 'Higher VIX with the same liquidity backdrop', why: 'Stress rising makes the field harder to operate in even if other signals hold up.' },
        ],
      },
      {
        prompt: 'Which change would most likely push the war game toward ATTACK?',
        correct: 'c',
        options: [
          { key: 'a', text: 'TGA rising above $0.95T', why: 'A larger Treasury cash pile is usually a liquidity drain, not a tailwind.' },
          { key: 'b', text: 'VIX jumping above 25', why: 'That adds stress pressure and usually supports a more defensive stance.' },
          { key: 'c', text: 'Net liquidity moving above $5.50T', why: 'That is one of the clearest conditions for shifting the theater into a stronger risk-on posture.' },
        ],
      },
      {
        prompt: 'Which signal improvement would best reduce policy pressure?',
        correct: 'a',
        options: [
          { key: 'a', text: 'Fed Funds drifting below 3.50%', why: 'That is the clean threshold in this model for policy moving from restrictive toward neutral.' },
          { key: 'b', text: 'TGA rising while rates stay unchanged', why: 'That affects Treasury pressure, not policy pressure, and it usually hurts liquidity.' },
          { key: 'c', text: 'VIX staying elevated above 25', why: 'That measures stress, not policy relief.' },
        ],
      },
    ];
    const signalSetups = schoolSignals.map((signal, index) => {
      const wrongA = schoolSignals[(index + 1) % schoolSignals.length];
      const wrongB = schoolSignals[(index + 2) % schoolSignals.length];
      return {
        prompt: `Which signal does this best describe: ${signal.explain}`,
        correct: 'a',
        options: [
          { key: 'a', text: signal.label, why: `${signal.label} is the right answer because it directly matches this function in the system.` },
          { key: 'b', text: wrongA.label, why: `${wrongA.label} matters, but it is not the signal being defined here.` },
          { key: 'c', text: wrongB.label, why: `${wrongB.label} affects the macro picture, but the definition points to ${signal.label}.` },
        ],
      };
    });
    const thresholdSetups = warThresholds.map((threshold, index) => {
      const next = warThresholds[(index + 1) % warThresholds.length];
      return {
        prompt: `What threshold is the page watching here: ${threshold.label}?`,
        correct: 'a',
        options: [
          { key: 'a', text: threshold.value, why: `${threshold.label} flips when ${threshold.value}. That is the exact trigger shown on the page.` },
          { key: 'b', text: next.value, why: `That belongs to ${next.label}, not ${threshold.label}.` },
          { key: 'c', text: 'No specific threshold matters here', why: `${threshold.label} is built around a concrete trigger, so there is a specific line to watch.` },
        ],
      };
    });
    const scenarioSetups = flightScenarios.map((scenario) => ({
      prompt: `If this happens, what posture follows: ${scenario.label}?`,
      correct: 'b',
      options: [
        { key: 'a', text: `Primary pressure disappears immediately`, why: 'One change can help or hurt, but it does not erase all pressure in the system.' },
        { key: 'b', text: `${scenario.snapshot.posture} posture with ${scenario.snapshot.primary.label} still leading pressure`, why: `That matches the live simulation for this scenario.` },
        { key: 'c', text: 'The war game becomes irrelevant', why: 'The simulator is designed to show how one variable shifts the same framework, not replace it.' },
      ],
    }));

    const baseQuestions = [...improveSetups, ...signalSetups, ...thresholdSetups, ...scenarioSetups];
    return Array.from({ length: 365 }, (_, index) => {
      const template = baseQuestions[index % baseQuestions.length];
      return {
        ...template,
        day: index + 1,
        missionCode: `FED-${String(index + 1).padStart(3, '0')}`,
      };
    });
  }, [flightScenarios, schoolSignals, warThresholds]);
  const drillQuestion = drillQuestionBank[(dayOfYear - 1) % drillQuestionBank.length];
  const quizResult = drillQuestion.options.find((item) => item.key === quizChoice) || null;
  const recentEntries = [...blackBoxLog].reverse();
  const latestEntry = recentEntries[0] || null;
  const oldestEntry = recentEntries[recentEntries.length - 1] || null;
  const debriefShift = latestEntry && oldestEntry ? latestEntry.score - oldestEntry.score : 0;
  const debriefHeadline = latestEntry == null
    ? 'No recorded regime changes yet.'
    : debriefShift > 0
      ? `Signal strength improved ${debriefShift} points across the recent campaign log.`
      : debriefShift < 0
        ? `Signal strength weakened ${Math.abs(debriefShift)} points across the recent campaign log.`
        : 'Signal strength has been stable across the recent campaign log.';
  const debriefGuidance = latestEntry == null
    ? 'Once macro data refreshes, the system will start logging regime snapshots automatically.'
    : latestEntry.status === 'LOCKED'
      ? 'Conditions are aligned enough to justify offensive monitoring, but you still want confirmation from stress and policy.'
      : latestEntry.status === 'SCANNING'
        ? 'The system is in observation mode. Wait for a cleaner trigger instead of forcing conviction.'
        : 'The environment is still hostile. Defense and patience matter more than speed.';

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onHome },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: onBack },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: null, current: true },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: onDocs },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary }}>
      <AppTopbar t={t} isDark={isDark} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} navItems={navItems} onToggleTheme={onToggleTheme} />

      <div
        className={`ms2-wrap ${confScore >= 75 ? 'state-locked' : confScore >= 40 ? 'state-scanning' : 'state-jammed'}`}
        style={{ maxWidth: 1180, margin: '0 auto', padding: '6px 20px 32px', '--primary': confColor }}
      >

        {/* ── TACTICAL HUD BAR ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: isDark ? '#060c06' : '#f0f7f0', border: `1px solid ${confColor}44`, marginBottom: 8, flexWrap: 'wrap', gap: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ fontSize: 11, color: confColor, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>STATUS: {confStatus}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: t.textGhost, letterSpacing: '0.08em' }}>FUEL</span>
              <progress className="hud-bar" value={Math.min(100, ((confNetLiq || 0) / 6000) * 100)} max="100" />
              {confNetLiq != null && <span style={{ fontSize: 10, color: t.textGhost }}>${(confNetLiq / 1000).toFixed(1)}T</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: t.textGhost, letterSpacing: '0.08em' }}>HEAT</span>
              <progress className="hud-bar hud-heat" value={Math.min(100, ((tga || 0) / 1000) * 100)} max="100" />
              {tga != null && <span style={{ fontSize: 10, color: t.textGhost }}>${(tga / 1000).toFixed(2)}T</span>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: confColor, border: `1px solid ${confColor}`, padding: '1px 7px', letterSpacing: '0.06em' }}>{confScore}/100</span>
          </div>
        </div>

        <MacroBanner fredMacro={macro || fredMacro} visible={!settings?.visibleModules || settings.visibleModules.includes('macroBanner')} t={t} refreshNonce={0} rotating={true} />

        <div style={{ marginTop: 14, border: `1px solid ${confColor}55`, background: t.panel, padding: '24px 28px', position: 'relative', overflow: 'hidden', animation: 'radarFadeUp 0.35s ease-out 0.2s both' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: confColor, opacity: 0.55 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${confColor}55`, background: isDark ? `${confColor}10` : `${confColor}08`, fontSize: 12, color: confColor, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                Daily Macro Analysis
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
                {radarTheme.theme}
              </div>
            </div>
            <div className="radar-brief-meta" style={{ fontSize: 13, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
              Fed Command Brief · Day {dayOfYear}
            </div>
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.1, color: t.textPrimary, fontWeight: 800, marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
            {fedBrief.headline}
          </div>
          <div style={{ borderLeft: `3px solid ${confColor}`, paddingLeft: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 16, color: confColor, lineHeight: 1.65 }}>
              {fedBrief.brief}
            </div>
          </div>
          <div style={{ fontSize: 15, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
            Fed Lens · {fedBrief.lens} · Objective · {radarTheme.objective}
          </div>
        </div>

        <MacroRadarPanels isDark={isDark} />

        <div style={{ marginTop: 12, border: `2px solid ${primaryPressure.tone}`, background: t.panel, padding: '18px 20px', animation: 'radarFadeUp 0.35s ease-out 0.35s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>Macro War Game</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 46, fontWeight: 900, color: primaryPressure.tone, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{theater}</span>
                <span style={{ fontSize: 13, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace" }}>Current Theater</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 16, color: t.textPrimary, fontWeight: 600 }}>{warHeadline}</div>
            </div>
            <div className="radar-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 8, minWidth: 'min(100%, 420px)', flex: '1 1 320px' }}>
              <div style={{ border: `1px solid ${t.borderDim}`, padding: '10px 12px', background: isDark ? t.elevated : t.surface }}>
                <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Best Posture</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: posture === 'ATTACK' ? t.accent : posture === 'WAIT' ? t.warn : t.danger, fontFamily: "'JetBrains Mono', monospace" }}>{posture}</div>
              </div>
              <div style={{ border: `1px solid ${t.borderDim}`, padding: '10px 12px', background: isDark ? t.elevated : t.surface }}>
                <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Primary Pressure</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: primaryPressure.tone, fontFamily: "'JetBrains Mono', monospace" }}>{primaryPressure.label}</div>
              </div>
              <div style={{ border: `1px solid ${t.borderDim}`, padding: '10px 12px', background: isDark ? t.elevated : t.surface }}>
                <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signal Score</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: confColor, fontFamily: "'JetBrains Mono', monospace" }}>{confScore}/100</div>
              </div>
            </div>
          </div>

          <div className="radar-war-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(260px, 0.9fr)', gap: 12 }}>
            <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Choose the Pressure to Study</div>
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {warPressures.map((item) => (
                  <button
                    className="radar-pressure-btn"
                    key={item.key}
                    onClick={() => setWarFocus(item.key)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                      background: warFocus === item.key ? (isDark ? `${item.tone}12` : `${item.tone}10`) : 'transparent',
                      border: `1px solid ${warFocus === item.key ? item.tone : t.borderDim}`,
                      color: t.textPrimary,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: warFocus === item.key ? item.tone : t.textSecondary }}>{item.label}</span>
                    <div style={{ height: 6, background: t.borderDim, position: 'relative' }}>
                      <div style={{ height: '100%', width: `${item.score}%`, background: item.tone, boxShadow: `0 0 8px ${item.tone}66` }} />
                    </div>
                    <span style={{ fontSize: 12, color: item.tone, fontWeight: 700 }}>{Math.round(item.score)}</span>
                  </button>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${t.borderDim}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Why It Matters</div>
                <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.65, marginBottom: 8 }}>{focusPressure.why}</div>
                <div style={{ fontSize: 14, color: focusPressure.tone }}>{focusPressure.summary}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 14 }}>
                <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>What Flips the Signal</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {warThresholds.map((item) => (
                    <div key={item.label} style={{ borderLeft: `2px solid ${item.tone}`, paddingLeft: 10 }}>
                      <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</div>
                      <div style={{ fontSize: 14, color: item.tone, fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 14 }}>
                <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Operational Readout</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {confComponents.map(({ label, score, max, note }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textGhost, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        <span>{label}</span>
                        <span style={{ color: score > 0 ? confColor : t.textGhost }}>{score}/{max} · {note}</span>
                      </div>
                      <div style={{ height: 3, background: t.borderDim, borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${(score / max) * 100}%`, background: score > 0 ? confColor : t.borderDim, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, border: `1px solid ${t.borderMid}`, background: t.panel, padding: 16, animation: 'radarFadeUp 0.4s ease-out 0.6s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>Fed Flight School</div>
              <div style={{ marginTop: 6, fontSize: 15, color: t.textGhost, maxWidth: 680 }}>Learn the Fed by interacting with the live signals already driving this page. No headlines, just cause, effect, and signal training.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'learn', label: 'Learn' },
                { key: 'simulate', label: 'Simulate' },
                { key: 'drill', label: 'Drill' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setSchoolTab(tab.key); if (tab.key !== 'drill') setQuizChoice(null); }}
                  style={{
                    background: schoolTab === tab.key ? (isDark ? `${confColor}16` : `${confColor}10`) : 'transparent',
                    color: schoolTab === tab.key ? confColor : t.textDim,
                    border: `1px solid ${schoolTab === tab.key ? confColor : t.borderDim}`,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          {schoolTab === 'learn' && (
            <div className="radar-school-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 0.9fr) minmax(280px, 1.1fr)', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {schoolSignals.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setLessonFocus(item.key)}
                    style={{
                      border: `1px solid ${lessonFocus === item.key ? item.color : t.borderDim}`,
                      background: lessonFocus === item.key ? (isDark ? `${item.color}12` : `${item.color}10`) : (isDark ? t.elevated : t.surface),
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: lessonFocus === item.key ? item.color : t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>{item.label}</span>
                      <span style={{ fontSize: 13, color: item.color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{item.current}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ border: `1px solid ${activeLesson.color}`, background: isDark ? t.elevated : t.surface, padding: 16 }}>
                <div style={{ fontSize: 12, color: activeLesson.color, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>{activeLesson.label}</div>
                <div style={{ fontSize: 16, color: t.textPrimary, lineHeight: 1.65, marginBottom: 12 }}>{activeLesson.explain}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bullish Read</div>
                    <div style={{ fontSize: 14, color: t.textPrimary }}>{activeLesson.bullish}</div>
                  </div>
                  <div style={{ borderLeft: `2px solid ${t.danger}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bearish Read</div>
                    <div style={{ fontSize: 14, color: t.textPrimary }}>{activeLesson.bearish}</div>
                  </div>
                  <div style={{ borderLeft: `2px solid ${activeLesson.color}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signal Chain</div>
                    <div style={{ fontSize: 14, color: t.textPrimary }}>{activeLesson.connects}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {schoolTab === 'simulate' && (
            <div className="radar-sim-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.05fr) minmax(260px, 0.95fr)', gap: 12 }}>
              <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: confColor, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>Fed Scenario Lab</div>
                    <div style={{ fontSize: 14, color: t.textGhost, lineHeight: 1.6, maxWidth: 500 }}>
                      Move one lever at a time and watch the regime shift. This is the closest thing to a policy sandbox on the page.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimState({ fedFunds: fedFundsRate, treasury: tga, volatility: vix, liquidity: netLiq })}
                    style={{
                      border: `1px solid ${t.borderDim}`,
                      background: 'transparent',
                      color: t.textSecondary,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Reset To Live
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                  {simControls.map((control) => {
                    const value = simState[control.key] ?? control.base;
                    const pct = value == null ? 0 : ((value - control.min) / (control.max - control.min)) * 100;
                    return (
                      <div key={control.key} style={{ border: `1px solid ${t.borderDim}`, padding: 12, background: isDark ? t.panel : t.surface }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 11, color: control.accent, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>{control.label}</div>
                            <div style={{ marginTop: 4, fontSize: 13, color: t.textGhost }}>{control.description}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16, color: control.accent, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                              {value == null ? '—' : control.format(value)}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              live {control.base == null ? '—' : control.format(control.base)}
                            </div>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={value ?? control.min}
                          onChange={(event) => setSimState((prev) => ({ ...prev, [control.key]: Number(event.target.value) }))}
                          style={{ width: '100%', accentColor: control.accent }}
                        />
                        <div className="radar-sim-scale" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          <span>{control.min}{control.unit}</span>
                          <span>{Math.round(pct)}% of simulation range</span>
                          <span>{control.max}{control.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 16 }}>
                  <div style={{ fontSize: 12, color: confColor, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>Simulated Outcome</div>
                  <div className="radar-sim-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: 8 }}>
                    {simSummary.map((item) => (
                      <div key={item.label} style={{ border: `1px solid ${t.borderDim}`, padding: '10px 12px', background: isDark ? t.panel : t.surface }}>
                        <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</div>
                        <div style={{ marginTop: 6, fontSize: 19, color: item.tone, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, borderTop: `1px solid ${t.borderDim}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Interpretation</div>
                    <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.65 }}>
                      {simSnapshot.theater === 'RISK-ON'
                        ? 'The sandbox now favors offensive positioning. Policy, liquidity, and stress are aligned well enough to support ATTACK.'
                        : simSnapshot.theater === 'NEUTRAL'
                          ? 'The sandbox is mixed. One or two conditions improved, but the system still prefers WAIT over aggression.'
                          : 'The sandbox stays defensive. One lever alone is not enough to overpower the current drag profile.'}
                    </div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 16 }}>
                  <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Preset Actions</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {flightScenarios.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          if (item.key === 'cut-50') setSimState((prev) => ({ ...prev, fedFunds: fedFundsRate == null ? prev.fedFunds : Math.max(0, fedFundsRate - 0.5) }));
                          if (item.key === 'tga-draw') setSimState((prev) => ({ ...prev, treasury: tga == null ? prev.treasury : Math.max(0, tga - 100) }));
                          if (item.key === 'stress-spike') setSimState((prev) => ({ ...prev, volatility: 28 }));
                          if (item.key === 'liq-boost') setSimState((prev) => ({ ...prev, liquidity: netLiq == null ? prev.liquidity : netLiq + 250000 }));
                        }}
                        style={{
                          textAlign: 'left',
                          border: `1px solid ${t.borderDim}`,
                          background: 'transparent',
                          color: t.textPrimary,
                          padding: '10px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 12, color: confColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: t.textGhost, lineHeight: 1.55 }}>{item.detail}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {schoolTab === 'drill' && (
            <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: confColor, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>Command Drill</div>
                  <div style={{ marginTop: 6, fontSize: 14, color: t.textGhost, lineHeight: 1.6 }}>
                    One question per day. Build Fed fluency by repeating one clean concept instead of grinding through a full quiz bank.
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 170 }}>
                  <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
                    Daily Mission
                  </div>
                  <div style={{ marginTop: 4, fontSize: 15, color: confColor, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    Day {drillQuestion.day} / 365
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace" }}>
                    {drillQuestion.missionCode}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 18, color: t.textPrimary, marginBottom: 14 }}>{drillQuestion.prompt}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {drillQuestion.options.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setQuizChoice(option.key)}
                    style={{
                      border: `1px solid ${quizChoice === option.key ? (option.correct ? t.accent : t.warn) : t.borderDim}`,
                      background: quizChoice === option.key ? (isDark ? `${option.correct ? t.accent : t.warn}14` : `${option.correct ? t.accent : t.warn}10`) : 'transparent',
                      color: t.textPrimary,
                      textAlign: 'left',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >{option.text}</button>
                ))}
              </div>
              {quizResult && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${t.borderDim}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 12, color: quizResult.correct ? t.accent : t.warn, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                    {quizResult.correct ? 'Correct' : 'Not quite'}
                  </div>
                  <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.65 }}>{quizResult.why}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, border: `1px solid ${t.borderMid}`, background: t.panel, padding: 16, animation: 'radarFadeUp 0.4s ease-out 0.7s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>Signal Debrief</div>
              <div style={{ marginTop: 6, fontSize: 15, color: t.textGhost, maxWidth: 720 }}>{debriefHeadline}</div>
            </div>
            <button onClick={() => { setBlackBoxLog([]); try { localStorage.removeItem('fortify_blackbox'); } catch { } }} style={{ background: 'none', border: `1px solid ${t.borderDim}`, color: t.textGhost, fontSize: 10, padding: '4px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flexShrink: 0 }}>CLEAR HISTORY</button>
          </div>
          <div className="radar-debrief-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.95fr) minmax(280px, 1.05fr)', gap: 12 }}>
            <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Why It Matters Now</div>
              <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.65, marginBottom: 12 }}>{debriefGuidance}</div>
              <div className="radar-debrief-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(70px, 1fr))', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase' }}>Latest</div>
                  <div style={{ fontSize: 16, color: latestEntry?.status === 'LOCKED' ? t.accent : latestEntry?.status === 'SCANNING' ? t.warn : t.danger, fontWeight: 700 }}>{latestEntry?.status || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase' }}>Shift</div>
                  <div style={{ fontSize: 16, color: debriefShift >= 0 ? t.accent : t.danger, fontWeight: 700 }}>{latestEntry ? `${debriefShift >= 0 ? '+' : ''}${debriefShift}` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.textGhost, textTransform: 'uppercase' }}>Next Watch</div>
                  <div style={{ fontSize: 16, color: primaryPressure.tone, fontWeight: 700 }}>{primaryPressure.label}</div>
                </div>
              </div>
            </div>
            <div style={{ border: `1px solid ${t.borderDim}`, background: isDark ? t.elevated : t.surface, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.textGhost, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Campaign Log</div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {recentEntries.length === 0 ? (
                  <div style={{ fontSize: 14, color: t.textDim }}>Awaiting enough macro refreshes to build a campaign history.</div>
                ) : recentEntries.slice(0, 6).map((entry, i) => (
                  <div key={entry.ts + i} style={{ borderLeft: `2px solid ${entry.status === 'LOCKED' ? t.accent : entry.status === 'SCANNING' ? t.warn : t.danger}`, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: t.textGhost, fontFamily: "'JetBrains Mono', monospace" }}>[ {entry.ts} ]</span>
                      <span style={{ fontSize: 11, color: entry.status === 'LOCKED' ? t.accent : entry.status === 'SCANNING' ? t.warn : t.danger, fontWeight: 700, letterSpacing: '0.08em' }}>{entry.score}/100</span>
                    </div>
                    <div style={{ fontSize: 14, color: t.textPrimary, lineHeight: 1.55 }}>
                      Status {entry.status} with liquidity at ${(entry.netLiq / 1000).toFixed(2)}T, TGA at ${(entry.tga / 1000).toFixed(2)}T, and cycle age {entry.dph} days.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes radarFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes radarBarIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes reactorPulse { 0%, 100% { transform: scale(0.88); opacity: 0.55; } 50% { transform: scale(1.12); opacity: 1; } }
          @keyframes reactorRing1 { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.06); } }
          @keyframes reactorRing2 { 0%, 100% { opacity: 0.18; transform: scale(1); } 50% { opacity: 0.65; transform: scale(1.04); } }
          @keyframes moneyFlow { from { left: -40px; } to { left: calc(100% + 40px); } }
          @keyframes jitter { 0% { transform: translate(0,0); } 50% { transform: translate(1px,-1px); } 100% { transform: translate(-1px,1px); } }
          @keyframes bracket-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

          /* ── DISTORTION HUB GRID ──────────────────────────────────────── */
          @keyframes glow-pulse { from { transform: scale(0.9); box-shadow: 0 0 30px rgba(0,251,255,0.3); } to { transform: scale(1.1); box-shadow: 0 0 60px rgba(0,251,255,0.6); } }
          .ms2-wrap .distortion-hub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
          .ms2-wrap .hub-card { background: ${isDark ? t.elevated : t.surface}; border: 1px solid ${isDark ? t.borderMid : t.borderDim}; padding: 20px; position: relative; overflow: hidden; }
          .ms2-wrap .hub-card-title { font-size: 11px; letter-spacing: 0.12em; color: var(--primary); text-transform: uppercase; font-family: 'JetBrains Mono','Courier New',monospace; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid ${isDark ? t.borderMid : t.borderDim}; padding-bottom: 8px; }
          .ms2-wrap .reactor-core { width: 100px; height: 100px; margin: 16px auto; border-radius: 50%; background: radial-gradient(circle, #00fbff 0%, transparent 70%); box-shadow: 0 0 30px rgba(0,251,255,0.3); animation: glow-pulse 4s ease-in-out infinite alternate; }
          .ms2-wrap .quote-section { grid-column: 1 / -1; }
          .ms2-wrap .quote-section .tag { font-size: 10px; letter-spacing: 2px; color: ${isDark ? t.textSecondary : t.textDim}; border-bottom: 1px solid ${isDark ? t.borderMid : t.borderDim}; padding-bottom: 10px; margin-bottom: 14px; text-transform: uppercase; font-family: 'JetBrains Mono','Courier New',monospace; display: block; }
          .ms2-wrap .quote-section h2 { font-style: italic; color: var(--primary); line-height: 1.55; font-size: 1.05rem; margin: 0 0 8px 0; font-weight: 400; }
          .ms2-wrap .quote-section .concept { font-size: 11px; color: var(--primary); opacity: 0.65; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono','Courier New',monospace; margin: 0; }
          .ms2-wrap .metric-overlay { text-align: center; margin-top: 8px; }
          .ms2-wrap .metric-overlay small { font-size: 10px; letter-spacing: 2px; color: ${isDark ? t.textSecondary : t.textDim}; display: block; margin-bottom: 4px; font-family: 'JetBrains Mono','Courier New',monospace; text-transform: uppercase; }
          .ms2-wrap .ticker-value { font-size: 1.05rem; font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono','Courier New',monospace; }
          @media (max-width: 640px) { .ms2-wrap .distortion-hub-grid { grid-template-columns: 1fr; } }

          /* ── STATE CLASSES ─────────────────────────────────────────────── */
          .ms2-wrap { position: relative; }
          .ms2-wrap.state-jammed { animation: jitter 0.18s infinite; }
          .ms2-wrap .radar-sweep { transform-box: view-box; transform-origin: 50% 50%; animation: rotate 3s linear infinite; }
          .ms2-wrap.state-locked .radar-sweep { animation: rotate 0.8s linear infinite; }
          .ms2-wrap.state-locked .bracket { animation: bracket-pulse 0.4s ease-in-out infinite; }

          /* ── HUD PROGRESS BARS ─────────────────────────────────────────── */
          .ms2-wrap progress.hud-bar { appearance: none; -webkit-appearance: none; width: 72px; height: 5px; border: none; background: transparent; vertical-align: middle; }
          .ms2-wrap progress.hud-bar::-webkit-progress-bar { background: ${isDark ? t.input : t.input}; border-radius: 1px; }
          .ms2-wrap progress.hud-bar::-webkit-progress-value { background: var(--primary); box-shadow: 0 0 8px var(--primary), 0 0 3px var(--primary); border-radius: 1px; transition: width 1.2s ease; }
          .ms2-wrap progress.hud-bar::-moz-progress-bar { background: var(--primary); box-shadow: 0 0 8px var(--primary); border-radius: 1px; }
          .ms2-wrap progress.hud-heat::-webkit-progress-value { background: #f0b429; box-shadow: 0 0 8px #f0b429aa, 0 0 3px #f0b429; }
          .ms2-wrap progress.hud-heat::-moz-progress-bar { background: #f0b429; box-shadow: 0 0 8px #f0b429; }

          @media (max-width: 980px) {
            .ms2-wrap { padding: 64px 10px 22px !important; }
            .ms2-top { flex-direction: column; align-items: stretch !important; gap: 10px !important; }
            .ms2-grid { grid-template-columns: 1fr !important; }
            .ms2-grid-3 { grid-template-columns: 1fr !important; }
            .ms2-market-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .ms2-kpi { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 640px) {
            .ms2-market-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// SETTINGS VIEW — Full-page, consistent with Docs/Radar
// ═══════════════════════════════════════════════════
function SettingsView({ t, isDark, onBack, onToggleTheme, settings, onToggle, onSetPayFrequency, onExport, onClear, onImport, onHome, onMacroSentinel, onBitcoin, onDocs }) {
  const [confirm, setConfirm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useMenuDismiss(menuOpen, setMenuOpen, menuRef);

  const dashMods = [
    { key: 'directive', label: 'Daily Directive', desc: 'Your single most important action right now — calculated from live data, not guesswork.' },
    { key: 'netWorth', label: 'Net Worth', desc: 'Total assets minus total liabilities. Tracks direction, not just balance. Updated each session.' },
    { key: 'debt', label: 'Debt Destruction', desc: 'Debts ranked by interest cost. Shows daily burn rate. Enforces avalanche payoff sequence.' },
    { key: 'planner', label: 'Bills & Payday Planner', desc: 'Every recurring obligation mapped to your pay cycle. Nothing due should surprise you.' },
    { key: 'eFund', label: 'Emergency Fund', desc: 'Measured in days of survival, not dollars. Phases 1–4 from starter buffer to full fortress.' },
    { key: 'budget', label: 'Budget Status', desc: 'Category utilization with enforcement thresholds. Blown categories flagged in your Morning Pulse.' },
    { key: 'knox', label: 'Agent KNOX Terminal', desc: 'KNOX monitors your financial behavior against protocol rules and flags violations before they compound.' },
    { key: 'transactions', label: 'Transactions', desc: 'Imported and categorized transaction ledger. Untracked outflow flagged as Lifestyle by default.' },
    { key: 'protection', label: 'Protection Layer', desc: 'Coverage status for life insurance and final expense protection. Flags gaps in your financial defense perimeter.' },
  ];
  const radarMods = [
    { key: 'macroBanner', label: 'Price Banner', desc: 'Scrolling live prices strip' },
    { key: 'macro', label: 'Macro Signals', desc: 'BTC halving cycle and market signals' },
    { key: 'market', label: 'Market Intelligence', desc: 'FRED data: WALCL, TGA, RRP' },
    { key: 'portfolio', label: 'Portfolio', desc: 'Your positions shown on Radar page' },
  ];

  const payFrequency = String(settings?.payFrequency || 'WEEKLY').toUpperCase();
  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onHome },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: onBack },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: onMacroSentinel },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: onDocs },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: null, current: true },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
      <AppTopbar t={t} isDark={isDark} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} navItems={navItems} onToggleTheme={onToggleTheme} />

      {/* Page content */}
      <main className="fo-page-shell" style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* ── THEME ── */}
        <section className="fo-page-section" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Theme</div>
          <div onClick={onToggleTheme} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: t.surface, border: `1px solid ${t.borderDim}`, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.borderDim}>
            <span style={{ fontSize: 14, color: t.textPrimary }}>{isDark ? 'Noir (Dark)' : 'Tactical (Light)'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.accent }}>
              {isDark ? <Moon size={14} /> : <Sun size={14} />}
              <span style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase' }}>Click to toggle</span>
            </div>
          </div>
        </section>

        {/* ── DASHBOARD MODULES ── */}
        {(() => {
          const renderModList = (modList) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {modList.map(m => {
                const on = (settings?.visibleModules || []).includes(m.key);
                return (
                  <div key={m.key} onClick={() => onToggle(m.key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: t.surface, border: `1px solid ${on ? t.borderDim : t.elevated}`, cursor: 'pointer', opacity: on ? 1 : 0.55, transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
                    onMouseLeave={e => e.currentTarget.style.borderColor = on ? t.borderDim : t.elevated}>
                    <div>
                      <div style={{ fontSize: 15, color: on ? t.textPrimary : t.textDim, fontWeight: on ? 600 : 400 }}>{m.label}</div>
                      <div style={{ fontSize: 15, color: t.textGhost, marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <div style={{ width: 32, height: 16, borderRadius: 8, background: on ? t.accentMuted : t.elevated, position: 'relative', flexShrink: 0, transition: 'background 0.2s', border: `1px solid ${on ? t.accent + '60' : t.borderDim}` }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', position: 'absolute', top: 1, left: on ? 17 : 1, background: on ? t.accent : t.textDim, transition: 'left 0.2s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
          return (
            <>
              <section style={{ marginBottom: 32 }}>
                <div className="fo-page-section" style={{ padding: '18px 18px 20px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
                <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Dashboard Modules</div>
                <div style={{ fontSize: 15, color: t.textGhost, marginBottom: 12 }}>Personal finance sections on your Dashboard</div>
                {renderModList(dashMods)}
                </div>
              </section>
              <section style={{ marginBottom: 32 }}>
                <div className="fo-page-section" style={{ padding: '18px 18px 20px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
                <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Radar Modules</div>
                <div style={{ fontSize: 15, color: t.textGhost, marginBottom: 12 }}>Sections visible on the Pre-Market Radar page</div>
                {renderModList(radarMods)}
                </div>
              </section>
            </>
          );
        })()}

        {/* ── PAY SCHEDULE ── */}
        <section className="fo-page-section" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pay Schedule</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {['WEEKLY', 'BIWEEKLY'].map(opt => {
              const isActive = payFrequency === opt;
              return (
                <button key={opt} onClick={() => onSetPayFrequency?.(opt)} style={{ padding: '10px', background: isActive ? t.accentMuted : t.surface, border: `1px solid ${isActive ? t.accent : t.borderDim}`, color: isActive ? t.accent : t.textSecondary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {opt === 'BIWEEKLY' ? 'Bi-Weekly' : 'Weekly'}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 15, color: t.textGhost }}>Applies to payday timeline and planner calculations.</div>
        </section>

        {/* ── DATA ── */}
        <section className="fo-page-section">
          <div style={{ fontSize: 15, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Data</div>
          <button onClick={onImport} style={{ width: '100%', padding: '10px 16px', background: 'none', border: `1px solid ${t.borderDim}`, color: t.textSecondary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.borderDim}>
            <Upload size={12} /> Import Statements / Snapshots
          </button>
          <div style={{ fontSize: 15, color: t.textGhost, marginBottom: 16 }}>Open the sync/import flow for CSVs, PDFs, screenshots, or JSON snapshots.</div>
          <button onClick={onExport} style={{ width: '100%', padding: '10px 16px', background: 'none', border: `1px solid ${t.borderDim}`, color: t.textSecondary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.borderDim}>
            <Download size={12} /> Export All Snapshots
          </button>
          <div style={{ fontSize: 15, color: t.textGhost, marginBottom: 16 }}>Downloads all snapshots and settings as a JSON backup file.</div>
          <div style={{ border: `1px solid ${t.danger}30`, padding: '16px', background: t.danger + '08' }}>
            <div style={{ fontSize: 15, color: t.danger, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>⚠ Danger Zone</div>
            <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder='Type CONFIRM to clear all data' style={{ background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '8px 10px', width: '100%', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
            <button onClick={() => { if (confirm === 'CONFIRM') { onClear(); setConfirm(''); } }} disabled={confirm !== 'CONFIRM'} style={{ width: '100%', padding: '10px', background: confirm === 'CONFIRM' ? t.danger + '20' : t.elevated, border: `1px solid ${confirm === 'CONFIRM' ? t.danger : t.borderDim}`, color: confirm === 'CONFIRM' ? t.danger : t.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, cursor: confirm === 'CONFIRM' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', textTransform: 'uppercase' }}>
              <Trash2 size={12} /> Clear All History
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function FortifyOSApp() {
  const [view, setView] = useState('loading');
  const [isDark, setIsDark] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [latest, setLatest] = useState(DEFAULT_SNAPSHOT);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [syncFlash, setSyncFlash] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [fredMacro, setFredMacro] = useState(null);
  const [intelRefreshing, setIntelRefreshing] = useState(false);
  const [intelRefreshNonce, setIntelRefreshNonce] = useState(0);
  const t = isDark ? THEMES.dark : THEMES.light;
  const enforcement = deriveEnforcementState(latest);
  const enforcementActive = !!enforcement && (view === 'landing' || view === 'macroSentinel' || view === 'bitcoin');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const refreshIntel = useCallback(async () => {
    setIntelRefreshing(true);
    try {
      const bust = Date.now();
      const r = await fetch(`${import.meta.env.BASE_URL}macro.json?v=${bust}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d) setFredMacro(d);
      setIntelRefreshNonce(n => n + 1);
      setSyncFlash(true);
      setTimeout(() => setSyncFlash(false), 600);
    } catch (_) {
      // Keep last known macro state on refresh failures.
    } finally {
      setIntelRefreshing(false);
    }
  }, []);

  // Initial macro load
  useEffect(() => {
    refreshIntel();
  }, [refreshIntel]);

  useEffect(() => {
    (async () => {
      const sn = await store.get('fortify-snapshots');
      const lt = await store.get('fortify-latest');
      const st = await store.get('fortify-settings');
      const th = await store.get('fortify-theme');
      if (sn?.length) {
        // Migrate old snapshots: ensure portfolio.crypto, netWorth.assets.savings exist, sanitize dates
        const migrated = sn.map(s => ({
          ...s,
          date: sanitizeDate(s.date),
          netWorth: { ...s.netWorth, assets: { savings: 0, ...((s.netWorth || {}).assets || {}) } },
          portfolio: { equities: [], options: [], crypto: [], ...((s || {}).portfolio || {}) },
          macro: { ...DEFAULT_SNAPSHOT.macro, ...((s || {}).macro || {}) },
          bills: Array.isArray(s?.bills) ? s.bills : [],
          payroll: { ...DEFAULT_SNAPSHOT.payroll, ...((s || {}).payroll || {}) },
        }));
        const migratedLatest = lt ? {
          ...lt,
          date: sanitizeDate(lt.date),
          netWorth: { ...lt.netWorth, assets: { savings: 0, ...((lt.netWorth || {}).assets || {}) } },
          portfolio: { equities: [], options: [], crypto: [], ...((lt || {}).portfolio || {}) },
          macro: { ...DEFAULT_SNAPSHOT.macro, ...((lt || {}).macro || {}) },
          bills: Array.isArray(lt?.bills) ? lt.bills : [],
          payroll: { ...DEFAULT_SNAPSHOT.payroll, ...((lt || {}).payroll || {}) },
        } : migrated[migrated.length - 1];
        setSnapshots(migrated);
        setLatest(migratedLatest);
      }
      // Always start at landing — user navigates to dashboard manually
      setView('landing');
      if (st) {
        // Always heal missing module keys so old/local configs do not hide new dashboard modules.
        const savedMods = st.visibleModules || [];
        const newMods = DEFAULT_SETTINGS.visibleModules.filter(m => !savedMods.includes(m));
        const mergedVisible = [...savedMods, ...newMods];
        const needsVersionBump = (st._v || 0) < DEFAULT_SETTINGS._v;
        const needsModuleMerge = newMods.length > 0;
        const mergedSettings = { ...DEFAULT_SETTINGS, ...st, visibleModules: mergedVisible, payFrequency: String(st.payFrequency || DEFAULT_SETTINGS.payFrequency).toUpperCase() === 'BIWEEKLY' ? 'BIWEEKLY' : 'WEEKLY', _v: DEFAULT_SETTINGS._v };
        if (needsVersionBump || needsModuleMerge) {
          setSettings(mergedSettings);
          await store.set('fortify-settings', mergedSettings);
        } else {
          setSettings(mergedSettings);
        }
      }
      if (th !== null) setIsDark(typeof th === 'boolean' ? th : th === 'true');
    })();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeName = isDark ? 'theme-dark' : 'theme-light';
    const oppositeTheme = isDark ? 'theme-light' : 'theme-dark';
    const themeColor = isDark ? THEMES.dark.void : THEMES.light.void;
    const statusBarStyle = isDark ? 'black-translucent' : 'default';

    root.classList.add(themeName);
    root.classList.remove(oppositeTheme);
    body.classList.add(themeName);
    body.classList.remove(oppositeTheme);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    body.style.backgroundColor = themeColor;
    body.style.color = isDark ? THEMES.dark.textPrimary : THEMES.light.textPrimary;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', themeColor);
    }

    const statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusMeta) {
      statusMeta.setAttribute('content', statusBarStyle);
    }
  }, [isDark]);

  const handleSync = useCallback(async (data) => {
    // Merge against latest snapshot (not defaults) so sequential account ingests can aggregate.
    const base = latest || DEFAULT_SNAPSHOT;
    const merged = { ...base, ...data };
    // Sanitize date — reject garbage, stale, or future dates
    merged.date = sanitizeDate(data.date);
    // Ensure nested portfolio/protection/macro objects merge with defaults
    merged.portfolio = { ...DEFAULT_SNAPSHOT.portfolio, ...(base.portfolio || {}), ...(data.portfolio || {}) };
    merged.macro = { ...DEFAULT_SNAPSHOT.macro, ...(base.macro || {}), ...(data.macro || {}) };
    merged.protection = { ...DEFAULT_SNAPSHOT.protection, ...(base.protection || {}), ...(data.protection || {}) };
    merged.bills = Array.isArray(data.bills) ? data.bills : (Array.isArray(base.bills) ? base.bills : []);
    merged.payroll = { ...DEFAULT_SNAPSHOT.payroll, ...(base.payroll || {}), ...(data.payroll || {}) };
    merged.payroll.frequency = String(settings?.payFrequency || merged.payroll.frequency || 'WEEKLY').toUpperCase() === 'BIWEEKLY' ? 'BIWEEKLY' : 'WEEKLY';
    merged.netWorth = { ...DEFAULT_SNAPSHOT.netWorth, ...(base.netWorth || {}), ...(data.netWorth || {}) };
    merged.netWorth.assets = { ...DEFAULT_SNAPSHOT.netWorth.assets, ...(base.netWorth?.assets || {}), ...(data.netWorth?.assets || {}) };

    // Ingest snapshots (CSV/PDF/statement parsers) should aggregate across accounts.
    const isIngestSync = !!data?._meta?.source;
    if (isIngestSync) {
      const byName = new Map();
      for (const c of (base.budget?.categories || [])) byName.set(c.name, { ...c });
      for (const c of (data.budget?.categories || [])) {
        const prev = byName.get(c.name) || { name: c.name, budgeted: 0, actual: 0 };
        byName.set(c.name, {
          name: c.name,
          budgeted: Math.max(prev.budgeted || 0, c.budgeted || 0),
          actual: (prev.actual || 0) + (c.actual || 0),
        });
      }
      merged.budget = {
        ...(base.budget || {}),
        ...(data.budget || {}),
        income: (base.budget?.income || 0) + (data.budget?.income || 0),
        categories: Array.from(byName.values()),
      };
      merged.budget.categories = buildProtectionFirstBudget(merged.budget.income || 0, merged.budget.categories || [], merged);

      const baseMeta = base._meta || {};
      const nextMeta = data._meta || {};
      const src = [baseMeta.source, nextMeta.source].filter(Boolean).join(' + ');
      merged._meta = {
        ...baseMeta,
        ...nextMeta,
        source: src || nextMeta.source || baseMeta.source || 'Combined',
        transactions: (baseMeta.transactions || 0) + (nextMeta.transactions || 0),
        income: (baseMeta.income || 0) + (nextMeta.income || 0),
        totalExpense: (baseMeta.totalExpense || 0) + (nextMeta.totalExpense || 0),
        uncategorized: (baseMeta.uncategorized || 0) + (nextMeta.uncategorized || 0),
        excludedTransfers: (baseMeta.excludedTransfers || 0) + (nextMeta.excludedTransfers || 0),
      };

      // Keep e-fund monthly expense aligned with combined spending stream.
      const combinedSpent = (merged.budget.categories || []).reduce((s, c) => s + (c.actual || 0), 0);
      merged.eFund = {
        ...(base.eFund || {}),
        ...(data.eFund || {}),
        monthlyExpenses: Math.round(combinedSpent || merged.eFund?.monthlyExpenses || 0),
      };

      // Merge _recentTxns across all synced accounts — combine, dedup, sort newest-first, keep 100
      const baseTxns = Array.isArray(base._recentTxns) ? base._recentTxns : [];
      const incomingTxns = Array.isArray(data._recentTxns) ? data._recentTxns : [];
      const seen = new Set();
      const allTxns = [];
      for (const tx of [...baseTxns, ...incomingTxns]) {
        const key = `${tx.date}|${tx.description}|${tx.amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allTxns.push(tx);
      }
      allTxns.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      merged._recentTxns = allTxns.slice(0, 100);
    }
    // Recalculate net worth total to include crypto + equity + savings
    const assets = merged.netWorth.assets;
    const cashTotal = (assets.checking || 0) + (assets.savings || 0) + (assets.eFund || 0) + (assets.other || 0);
    const eqVal = (merged.portfolio.equities || []).reduce((s, e) => s + (e.shares || 0) * (e.lastPrice || 0), 0);
    const cryptoVal = (merged.portfolio.crypto || []).reduce((s, c) => s + (c.amount || 0) * (c.lastPrice || 0), 0);
    const liabilities = Object.values(merged.netWorth.liabilities || {}).reduce((s, v) => s + (v || 0), 0);
    merged.netWorth.total = cashTotal + eqVal + cryptoVal - liabilities;
    let nextSnapshots = null;
    setSnapshots(prev => {
      nextSnapshots = [...(prev || []), merged];
      return nextSnapshots;
    });
    setLatest(merged);
    try {
      await store.set('fortify-snapshots', nextSnapshots || [merged]);
      await store.set('fortify-latest', merged);
    } catch (_) { }
    setSyncFlash(true); setTimeout(() => setSyncFlash(false), 600);
    setView('dashboard'); setSyncOpen(false);
  }, [latest, settings?.payFrequency]);

  const toggleTheme = useCallback(async () => { const n = !isDark; setIsDark(n); await store.set('fortify-theme', n); }, [isDark]);
  const toggleModule = useCallback(async (k) => {
    const m = settings.visibleModules.includes(k) ? settings.visibleModules.filter(x => x !== k) : [...settings.visibleModules, k];
    const ns = { ...settings, visibleModules: m }; setSettings(ns); await store.set('fortify-settings', ns);
  }, [settings]);
  const setPayFrequency = useCallback(async (frequency) => {
    const normalized = String(frequency || 'WEEKLY').toUpperCase() === 'BIWEEKLY' ? 'BIWEEKLY' : 'WEEKLY';
    const ns = { ...settings, payFrequency: normalized };
    setSettings(ns);
    await store.set('fortify-settings', ns);

    setLatest((prev) => {
      const nextLatest = { ...prev, payroll: { ...DEFAULT_SNAPSHOT.payroll, ...(prev?.payroll || {}), frequency: normalized } };
      store.set('fortify-latest', nextLatest);
      return nextLatest;
    });
    setSnapshots((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1] || {};
      next[next.length - 1] = { ...last, payroll: { ...DEFAULT_SNAPSHOT.payroll, ...(last.payroll || {}), frequency: normalized } };
      store.set('fortify-snapshots', next);
      return next;
    });
  }, [settings]);
  const handleUpdateDebt = useCallback(async (debtName, patch) => {
    const applyDebtPatch = (snapshot) => {
      if (!snapshot) return snapshot;
      const debts = (snapshot.debts || []).map(d =>
        d.name === debtName ? { ...d, ...patch } : d
      );
      const matchedDebt = debts.find(d => d.name === debtName);
      const nextBalance = Math.max(0, Number(matchedDebt?.balance || 0));
      const nextLiabilities = {
        ...(snapshot.netWorth?.liabilities || {}),
        [debtName]: nextBalance,
      };
      const nextAssets = snapshot.netWorth?.assets || {};
      const nextNetWorth = {
        ...(snapshot.netWorth || {}),
        assets: nextAssets,
        liabilities: nextLiabilities,
        total: ((nextAssets.checking || 0) + (nextAssets.savings || 0) + (nextAssets.eFund || 0) + (nextAssets.other || 0))
          - Object.values(nextLiabilities).reduce((sum, value) => sum + (Number(value) || 0), 0),
      };
      return { ...snapshot, debts, netWorth: nextNetWorth };
    };

    setLatest(prev => {
      const nextLatest = applyDebtPatch(prev);
      store.set('fortify-latest', nextLatest);
      return nextLatest;
    });
    setSnapshots(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const nextSnapshots = [...prev];
      nextSnapshots[nextSnapshots.length - 1] = applyDebtPatch(nextSnapshots[nextSnapshots.length - 1]);
      store.set('fortify-snapshots', nextSnapshots);
      return nextSnapshots;
    });
  }, []);

  const handleExport = useCallback(() => {
    const b = new Blob([JSON.stringify({ snapshots, latest, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fortify-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [snapshots, latest, settings]);
  const handleClear = useCallback(async () => {
    setSnapshots([]);
    setLatest(DEFAULT_SNAPSHOT);
    setView('landing');
    await store.del('fortify-snapshots');
    await store.del('fortify-latest');
  }, []);

  return (
    <div className={`fo-os-shell ${isDark ? 'fo-os-dark' : 'fo-os-light'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; }
        html {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: none;
          background: ${t.void};
        }
        body {
          min-height: 100%;
          min-height: 100dvh;
          width: 100%;
          overflow-x: hidden;
          font-family: 'JetBrains Mono', 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
          background: ${t.void};
          color: ${t.textPrimary};
        }
        #root {
          min-height: 100%;
          min-height: 100dvh;
          width: 100%;
          overflow-x: hidden;
          background: ${t.void};
        }
        button, input, select, textarea, option { font-family: 'JetBrains Mono', 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; }
        .fo-os-shell {
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          background: ${t.void};
          color: ${t.textPrimary};
        }
        .fo-panel-corner { position: relative; }
        .fo-panel-corner::before, .fo-panel-corner::after {
          content: '+'; position: absolute; font-size: 10px; line-height: 1; color: ${isDark ? 'rgba(255,153,0,0.42)' : 'rgba(232,133,15,0.48)'}; font-family: 'JetBrains Mono', monospace;
        }
        .fo-panel-corner::before { top: 6px; left: 6px; }
        .fo-panel-corner::after { right: 6px; bottom: 6px; }
        .fo-terror-head { font-size: clamp(44px, 8vw, 110px); transform: scaleX(0.82); transform-origin: left center; }
        .fo-home-shell section { position: relative; }
        .fo-home-shell section::before {
          content: ''; position: absolute; left: 12px; top: 12px; bottom: 12px; width: 1px; opacity: 0.38;
          background: repeating-linear-gradient(to bottom, ${t.borderMid}, ${t.borderMid} 6px, transparent 6px, transparent 14px);
        }
        .fo-command-grid { position: relative; }
        .fo-command-grid::before {
          content: ''; position: absolute; inset: -12px; pointer-events: none; opacity: ${isDark ? 0.12 : 0.08};
          background-image:
            linear-gradient(${isDark ? 'rgba(255,153,0,0.22)' : 'rgba(232,133,15,0.18)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDark ? 'rgba(255,153,0,0.18)' : 'rgba(232,133,15,0.14)'} 1px, transparent 1px);
          background-size: 96px 96px, 96px 96px;
        }
        .fo-os-shell .fortify-ref-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 9996; opacity: ${isDark ? 0.16 : 0.08};
          background-image:
            linear-gradient(${isDark ? 'rgba(255,153,0,0.14)' : 'rgba(232,133,15,0.10)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDark ? 'rgba(255,153,0,0.10)' : 'rgba(232,133,15,0.08)'} 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, ${isDark ? 'rgba(0,255,255,0.05)' : 'rgba(0,180,180,0.04)'} 0, transparent 48%);
          background-size: 84px 84px, 84px 84px, 100% 100%;
        }
        .fo-os-shell .fortify-edge-rulers {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
        }
        .fo-os-shell .fortify-edge-rulers::before,
        .fo-os-shell .fortify-edge-rulers::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 18px; opacity: ${isDark ? 0.28 : 0.15};
          background: repeating-linear-gradient(to bottom, ${isDark ? '#ff9900' : '#d48a00'} 0 2px, transparent 2px 14px);
        }
        .fo-os-shell .fortify-edge-rulers::before { left: 0; }
        .fo-os-shell .fortify-edge-rulers::after { right: 0; }
        .fo-os-shell .fortify-corner-cross {
          position: fixed; width: 18px; height: 18px; pointer-events: none; z-index: 9997; opacity: ${isDark ? 0.4 : 0.24};
          border-top: 1px solid ${isDark ? '#00ffff' : '#0d8f8f'}; border-left: 1px solid ${isDark ? '#00ffff' : '#0d8f8f'};
        }
        .fo-os-shell .fortify-corner-cross.tr { right: 8px; top: 8px; transform: rotate(90deg); }
        .fo-os-shell .fortify-corner-cross.tl { left: 8px; top: 8px; }
        .fo-os-shell .fortify-corner-cross.br { right: 8px; bottom: 8px; transform: rotate(180deg); }
        .fo-os-shell .fortify-corner-cross.bl { left: 8px; bottom: 8px; transform: rotate(-90deg); }
        .fo-pagebar {
          position: relative;
        }
        .fo-page-shell {
          position: relative;
        }
        .fo-page-shell::before {
          content: '';
          position: absolute;
          inset: 8px 0 auto 0;
          height: 1px;
          opacity: ${isDark ? 0.28 : 0.16};
          background: linear-gradient(90deg, transparent, ${t.purple || '#8b5cf6'} 25%, ${t.accent} 58%, transparent);
          pointer-events: none;
        }
        .fo-page-hero,
        .fo-page-section,
        .fo-shared-section {
          position: relative;
          overflow: hidden;
        }
        .fo-page-hero::after,
        .fo-page-section::after,
        .fo-shared-section::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: ${isDark ? 0.11 : 0.05};
          background-image:
            linear-gradient(${t.borderDim}40 1px, transparent 1px),
            linear-gradient(90deg, ${t.borderDim}22 1px, transparent 1px);
          background-size: 64px 64px;
        }
        .fo-shared-section {
          background:
            linear-gradient(180deg, ${isDark ? `${t.surface}55` : `${t.surface}dd`} 0%, transparent 100%);
          box-shadow: ${isDark ? `inset 0 1px 0 ${t.borderDim}, 0 12px 32px rgba(0,0,0,0.18)` : `inset 0 1px 0 ${t.borderDim}, 0 8px 20px rgba(0,0,0,0.04)`};
        }
        .fo-page-hero {
          padding: 24px 24px 22px;
          border: 1px solid ${t.borderDim};
          background: ${isDark ? `linear-gradient(135deg, ${t.surface} 0%, ${t.panel} 55%, ${t.purple || '#8b5cf6'}10 100%)` : `linear-gradient(135deg, ${t.surface} 0%, ${t.elevated} 72%, ${t.warn}08 100%)`};
          box-shadow: ${isDark ? `0 16px 36px rgba(0,0,0,0.24)` : `0 10px 22px rgba(0,0,0,0.05)`};
        }
        .fo-page-hero::before,
        .fo-page-section::before,
        .fo-shared-section::before,
        .docs-track-switcher::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, ${t.accent}, ${isDark ? '#ff9900' : '#d48a00'} 54%, transparent);
          opacity: 0.9;
          pointer-events: none;
        }
        .fo-page-section {
          padding: 18px 18px 20px;
          border: 1px solid ${t.borderDim};
          background: ${isDark ? `linear-gradient(180deg, ${t.surface} 0%, ${t.panel} 100%)` : `linear-gradient(180deg, ${t.surface} 0%, ${t.elevated} 100%)`};
          box-shadow: ${isDark ? `0 14px 32px rgba(0,0,0,0.18)` : `0 8px 18px rgba(0,0,0,0.04)`};
        }
        .fo-page-shell-panel {
          box-shadow: ${isDark ? `0 12px 28px rgba(0,0,0,0.24)` : `0 8px 18px rgba(0,0,0,0.04)`};
          position: relative;
          overflow: hidden;
        }
        .fo-page-section-toggle {
          position: relative;
          overflow: hidden;
          box-shadow: ${isDark ? `0 10px 24px rgba(0,0,0,0.16)` : `0 6px 14px rgba(0,0,0,0.03)`};
        }
        .fo-page-section-body {
          position: relative;
          overflow: hidden;
          box-shadow: ${isDark ? `0 14px 32px rgba(0,0,0,0.18)` : `0 8px 18px rgba(0,0,0,0.04)`};
        }
        .sync-shell::before,
        .sync-header::before,
        .sync-tabs::before,
        .sync-dropzone::before,
        .sync-log-panel::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, ${t.accent}, ${isDark ? '#ff9900' : '#d48a00'} 54%, ${t.purple || '#8b5cf6'} 100%);
          opacity: 0.88;
          pointer-events: none;
        }
        .sync-shell::after,
        .sync-dropzone::after,
        .sync-log-panel::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: ${isDark ? 0.12 : 0.05};
          background-image:
            linear-gradient(${t.borderDim}38 1px, transparent 1px),
            linear-gradient(90deg, ${t.borderDim}22 1px, transparent 1px);
          background-size: 56px 56px;
        }

/* Responsive layout */
.fo-main { padding-left: 14px; padding-right: 14px; }
@media (max-width: 980px) {
  .fo-topgrid { grid-template-columns: 1fr !important; }
  .fo-modgrid { grid-template-columns: 1fr !important; }
  .fo-command-grid { grid-template-columns: minmax(0, 1fr) !important; }
  .fo-hero-shell { grid-template-columns: minmax(0, 1fr) !important; }
  .fo-hero-telemetry { grid-template-columns: minmax(0, 1fr) !important; }
  .fo-blueprint-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .fo-blueprint-meta { grid-template-columns: 1fr !important; }
}
@media (max-width: 520px) {
  .fo-main { padding-left: 10px; padding-right: 10px; }
  .fo-hero-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .fo-blueprint-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}

.fo-pagebar-left,
.fo-pagebar-right,
.fo-pagebar-title { min-width: 0; }
.fo-pagebar-left { grid-column: 1; }
.fo-pagebar-title { grid-column: 2; justify-self: center; text-align: center; }
.fo-pagebar-right { grid-column: 3; justify-self: end; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pulse { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 0 1px ${t.accent}60; } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 4px ${t.purple}40; border-color: ${t.purple}60; } 50% { box-shadow: 0 0 12px ${t.purple}80; border-color: ${t.purple}; } }
        @keyframes lastSeg { 0%,100% { box-shadow: 0 0 3px ${t.accent}40; } 50% { box-shadow: 0 0 8px ${t.accent}; } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::selection { background: ${t.accentMuted}; color: ${t.accent}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${t.void}; } ::-webkit-scrollbar-thumb { background: ${t.borderMid}; }
        /* ── FORTIFY NAV POPUP ──────────────────────────────────── */
        @keyframes navRadarPing {
          0%   { transform: scale(1);    opacity: 1; }
          60%  { transform: scale(1.2);  opacity: 0.65; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes navPopIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .fortify-nav-pop { animation: navPopIn 0.14s ease-out both; overflow: hidden; }
        .fortify-nav-item {
          background: none; border: none;
          border-left: 2px solid transparent;
          color: ${t.textSecondary};
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; padding: 11px 18px 11px 14px;
          cursor: pointer; text-transform: uppercase;
          letter-spacing: 0.08em; white-space: nowrap;
          display: flex; align-items: center; gap: 10px; width: 100%;
          transition: color 0.15s, border-left-color 0.15s, background 0.15s;
        }
        .fortify-nav-item:hover { color: ${t.accent}; border-left-color: ${t.accent}; background: ${t.accent}0D; }
        .fortify-nav-item.nav-bitcoin { color: ${t.crypto}; }
        .fortify-nav-item.nav-bitcoin:hover { color: ${t.crypto}; border-left-color: ${t.crypto}; background: ${t.crypto}0D; }
        .fortify-nav-item.nav-data { font-size: 11px; padding: 7px 18px 7px 14px; opacity: 0.65; }
        .fortify-nav-item.nav-data:hover { opacity: 1; }
        .fortify-nav-item.nav-radar .nav-icon { animation: navRadarPing 2.2s ease-in-out infinite; transform-origin: center; }
        .nav-btc-glyph { font-size: 15px; font-weight: 700; transition: filter 0.2s; }
        .fortify-nav-item.nav-bitcoin:hover .nav-btc-glyph { filter: drop-shadow(0 0 6px ${t.crypto}); }
        .fortify-nav-item.nav-settings .nav-icon { transition: transform 0.3s ease; }
        .fortify-nav-item.nav-settings:hover .nav-icon { transform: rotate(30deg); }
        .fortify-nav-divider { height: 1px; margin: 5px 0; background: ${t.borderDim}; opacity: 0.5; }
        .fortify-nav-section-label { padding: 4px 16px 3px; font-size: 9px; color: ${t.textGhost}; letter-spacing: 0.14em; text-transform: uppercase; font-family: 'JetBrains Mono', monospace; }
        .phase-label,.footer-label { display: block; }
        .main-grid { grid-template-columns: repeat(2, 1fr); align-items: start; }
        .sync-row-3 { grid-template-columns: repeat(3, 1fr); }
        .status-metrics { grid-template-columns: repeat(4, 1fr); }
        .sync-row-debt { grid-template-columns: 2fr 1fr 1.5fr 1fr; }
        .fo-ticker-track { animation: tickerScroll 38s linear infinite; }
        .hero-title { font-size: 56px; }
        .hero-sub { font-size: 15px; }
        .hero-buttons { flex-direction: row; }
        .footer-stats { grid-template-columns: repeat(3, 1fr); }
        .footer-stat-cell { border-right: 1px solid ${t.borderDim}; }
        .footer-stat-cell:last-child { border-right: none; }
        input, select, textarea { max-width: 100%; }
@media (max-width: 768px) {
          .dash-menu-pop { width: 180px; }
          .docs-track-switcher {
            padding: 10px 12px !important;
            width: calc(100% - 20px) !important;
          }
          .docs-track-buttons {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }
          .dashboard-main {
            padding: 12px 8px 48px !important;
          }
          .fo-page-shell {
            padding-top: 10px !important;
          }
          .ms2-wrap {
            padding: 4px 8px 24px !important;
          }
          .fortress-hero-shell {
            flex-direction: column !important;
          }
          .fortress-hero-copy,
          .fortress-hero-metrics {
            width: 100% !important;
            min-width: 0 !important;
          }
          .fortress-hero-metrics {
            grid-template-columns: 1fr !important;
          }
          .efund-stats-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .radar-brief-meta {
            white-space: normal !important;
            line-height: 1.35;
          }
          .status-rail {
            flex-direction: column !important;
          }
          .status-rail-stage {
            border-right: none !important;
            border-bottom: 1px solid ${t.borderDim} !important;
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }
          .status-rail-next {
            justify-content: flex-start !important;
          }
          .sync-shell {
            width: calc(100vw - 16px) !important;
            max-width: calc(100vw - 16px) !important;
            height: auto !important;
            max-height: calc(100vh - 18px - env(safe-area-inset-top, 0px)) !important;
            margin-top: calc(8px + env(safe-area-inset-top, 0px)) !important;
            border-radius: 8px !important;
            border-left: none !important;
            border-right: none !important;
          }
          .sync-content { padding: 14px !important; }
          .sync-overlay {
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
            align-items: flex-start !important;
          }
          input, select, textarea { font-size: 16px !important; }
          button { min-height: 40px; }
          .phase-label,.footer-label { display: none !important; }
          .main-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .main-grid > * { min-width: 0 !important; width: 100% !important; }
          .bill-cal-row { grid-template-columns: 1fr !important; }
          .sync-row-3 { grid-template-columns: 1fr !important; }
          .status-metrics { grid-template-columns: 1fr 1fr !important; }
          .sync-row-debt { grid-template-columns: 1fr !important; }
          .fo-ticker-track { animation-duration: 52s !important; }
          .hero-title { font-size: 36px !important; }
          .hero-sub { font-size: 15px !important; }
          .hero-buttons { flex-direction: column !important; }
          .footer-stats { grid-template-columns: 1fr !important; }
          .footer-stat-cell { border-right: none !important; border-bottom: 1px solid ${t.borderDim}; }
          .footer-stat-cell:last-child { border-bottom: none; }
          .stage-labels span { font-size: 14px !important; }
          .fo-main { overflow-x: hidden !important; }
          .dashboard-main { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
          .fo-pagebar {
            height: auto !important;
            min-height: 48px;
            display: grid !important;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 8px;
            padding: 8px 12px !important;
          }
          .fo-pagebar-title {
            white-space: normal !important;
            overflow-wrap: anywhere;
            font-size: 13px !important;
            line-height: 1.2;
            letter-spacing: 0.08em !important;
          }
          .fo-home-shell section::before { display: none; }
          .radar-summary-grid,
          .radar-sim-summary,
          .radar-debrief-stats {
            grid-template-columns: minmax(0, 1fr) !important;
            min-width: 0 !important;
          }
          .radar-pressure-btn {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .radar-sim-scale {
            flex-wrap: wrap;
          }
          .tx-summary-grid,
          .fo-halving-kpi-grid,
          .fo-halving-window-grid,
          .fo-halving-next-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .tx-income-row,
          .tx-row-main {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .tx-row-main > span:last-child {
            min-width: 0 !important;
            text-align: left !important;
          }
        }
        @media (max-width: 900px) {
          .radar-war-grid,
          .radar-school-grid,
          .radar-sim-grid,
          .radar-debrief-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <div className="fortify-ref-grid" />
      <div className="fortify-edge-rulers" />
      <div className="fortify-corner-cross tl" />
      <div className="fortify-corner-cross tr" />
      <div className="fortify-corner-cross bl" />
      <div className="fortify-corner-cross br" />
      {/* Global CRT scanline overlay — applied to all pages */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, opacity: isDark ? 1 : 0.35, background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.18) 50%), linear-gradient(90deg, rgba(255,0,0,0.04), rgba(0,255,0,0.015), rgba(0,0,255,0.04))', backgroundSize: '100% 2px, 3px 100%' }} />
      {view === 'loading' && <div style={{ background: t.void, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, textShadow: isDark ? `0 0 10px ${t.accent}40` : 'none' }}>FORTIFY OS initializing...</div></div>}
      {view === 'landing' && <LandingView t={t} isDark={isDark} latest={latest} onToggleTheme={toggleTheme} onInitialize={() => setSyncOpen(true)} onDocs={() => setView('docs')} hasData={snapshots.length > 0} onDashboard={() => setView('dashboard')} onMacroSentinel={() => setView('macroSentinel')} onBitcoin={() => setView('bitcoin')} onSettings={() => setView('settings')} />}
      {view === 'docs' && <DocsView t={t} isDark={isDark} onBack={() => setView('landing')} onToggleTheme={toggleTheme} onDashboard={() => setView('dashboard')} onMacroSentinel={() => setView('macroSentinel')} onBitcoin={() => setView('bitcoin')} onSettings={() => setView('settings')} />}
      {view === 'macroSentinel' && <MacroSentinelView t={t} isDark={isDark} onBack={() => setView('dashboard')} onToggleTheme={toggleTheme} latest={latest} fredMacro={fredMacro} settings={settings} onHome={() => setView('landing')} onBitcoin={() => setView('bitcoin')} onSettings={() => setView('settings')} onDocs={() => setView('docs')} />}
      {view === 'dashboard' && <DashboardView snapshots={snapshots} latest={latest} settings={settings} t={t} isDark={isDark} onSync={handleSync} onToggle={toggleModule} onSetPayFrequency={setPayFrequency} onExport={handleExport} onClear={handleClear} onToggleTheme={toggleTheme} syncFlash={syncFlash} onHome={() => setView('landing')} onMacroSentinel={() => setView('macroSentinel')} onBitcoin={() => setView('bitcoin')} fredMacro={fredMacro} onRefreshIntel={refreshIntel} intelRefreshing={intelRefreshing} intelRefreshNonce={intelRefreshNonce} onSettings={() => setView('settings')} onDocs={() => setView('docs')} onUpdateDebt={handleUpdateDebt} />}
      {view === 'settings' && <SettingsView t={t} isDark={isDark} onBack={() => setView('dashboard')} onToggleTheme={toggleTheme} settings={settings} onToggle={toggleModule} onSetPayFrequency={setPayFrequency} onExport={handleExport} onClear={handleClear} onImport={() => setSyncOpen(true)} onHome={() => setView('landing')} onMacroSentinel={() => setView('macroSentinel')} onBitcoin={() => setView('bitcoin')} onDocs={() => setView('docs')} />}
      {view === 'bitcoin' && <BitcoinMastery onBack={() => setView('dashboard')} onDashboard={() => setView('dashboard')} onHome={() => setView('landing')} onMacroSentinel={() => setView('macroSentinel')} onSettings={() => setView('settings')} onDocs={() => setView('docs')} isDark={isDark} onToggleTheme={toggleTheme} />}
      {enforcementActive && <RefusalOverlay enforcement={enforcement} onRoute={() => setView('dashboard')} />}
      <UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={handleSync} t={t} isDark={isDark} />
    </div>
  );
}

export default function FortifyOS() {
  return (
    <AppErrorBoundary>
      <FortifyOSApp />
    </AppErrorBoundary>
  );
}
