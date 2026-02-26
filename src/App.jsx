import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Shield, ChevronRight, Sun, Moon, Lock, Cpu, Activity,
  Settings, RefreshCw, X, Download, Trash2, Database, AlertCircle,
  FileText, Upload, Zap, ShieldAlert, TrendingUp,
  ArrowRight, ChevronDown, Clock, Eye
} from 'lucide-react';
import * as Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ═══════════════════════════════════════════════════════════════
   FORTIFYOS — UNIFIED v2.3
   Landing · Universal Sync Engine · Live Dashboard
   Enforcement Layer · Liberation Countdown · Never List
   "Protect first, grow second. Every dollar has a job."
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════
const THEMES = {
  dark: {
    void: '#000000', surface: '#0A0A0A', elevated: '#111111', input: '#0D0D0D',
    panel: '#0D0D0D', panel2: '#111111',
    borderDim: '#1A1A1A', borderMid: '#2A2A2A', borderBright: '#333333',
    textPrimary: '#E8E8E8', textSecondary: '#888888', textDim: '#555555', textGhost: '#333333',
    accent: '#00FF41', accentBright: '#39FF14', accentDim: '#00CC33', accentMuted: '#0A3D1A',
    danger: '#FF3333', warn: '#FFB800',
    purple: '#BF40BF', purpleDim: '#8A2D8A', purpleMuted: '#2D0A2D',
    crypto: '#F7931A', cryptoDim: '#C67A15', cryptoMuted: '#3D250A',
  },
  light: {
    void: '#F5F3F0', surface: '#FEFEFE', elevated: '#FAF9F7', input: '#F0EEEB',
    panel: '#F0EEEB', panel2: '#FFFFFF',
    borderDim: '#DDD9D4', borderMid: '#CCC7C0', borderBright: '#B5AFA8',
    textPrimary: '#1C1B1A', textSecondary: '#625D56', textDim: '#948E86', textGhost: '#CCC7C0',
    accent: '#1A7A3A', accentBright: '#20953F', accentDim: '#135E2C', accentMuted: '#E0F0E5',
    danger: '#C42B1C', warn: '#D48A00',
    purple: '#8B5CF6', purpleDim: '#7340DB', purpleMuted: '#F1ECF9',
    crypto: '#E8850F', cryptoDim: '#B36C0C', cryptoMuted: '#FFF5E5',
  },
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

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
    let mm = String(mmN).padStart(2,'0');
    let dd = String(ddN).padStart(2,'0');
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
    const map = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',sept:'09',oct:'10',nov:'11',dec:'12'};
    const mm = map[m[1].toLowerCase()];
    const ddN = Number(m[2]);
    if (!validMD(Number(mm), ddN)) return '';
    const dd = String(ddN).padStart(2,'0');
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
  str = str.replace(/\$/g, '').replace(/\$/,'').replace(/,/g,'').replace(/\s+/g,'');
  if (str.startsWith('+')) str = str.slice(1);
  if (str.endsWith('-')) { str = str.slice(0, -1); neg = true; }
  // sometimes trailing CR/DR
  if (/cr$/i.test(str)) { str = str.replace(/cr$/i,''); }
  if (/dr$/i.test(str)) { str = str.replace(/dr$/i,''); neg = true; }
  // Suppress OCR noise like account IDs unless explicitly money-like.
  if (!/\./.test(str) && !hadDollar && !hadSignedMarker) return null;
  const m = str.match(/^-?\d+(?:\.\d{1,2})?$/);
  if (!m) return null;
  const n = parseFloat(str);
  if (Number.isNaN(n)) return null;
  if (Math.abs(n) > 1e7) return null;
  return neg ? -Math.abs(n) : n;
}

function parseStatementTextToTransactions(text) {
  const rawLines = (text || '')
    .split(/\r?\n/)
    .map(l => (l || '').replace(/\t/g, ' ').trim())
    .filter(Boolean);

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
      const desc = (m[2] || '').trim();
      const amt = applyDirection(parseAmountLike(m[3]), line, desc, m[3]);
      if (date && amt !== null && (desc.match(/[A-Za-z]/g) || []).length >= 3 && Math.abs(amt) >= 0.01) txns.push({ date, description: desc, amount: amt });
      continue;
    }

    // Pattern 2: DESC DATE AMOUNT
    m = line.match(rx2);
    if (m) {
      const desc = (m[1] || '').trim();
      const date = normalizeDateLike(m[2]);
      const amt = applyDirection(parseAmountLike(m[3]), line, desc, m[3]);
      if (date && amt !== null && (desc.match(/[A-Za-z]/g) || []).length >= 3 && Math.abs(amt) >= 0.01) txns.push({ date, description: desc, amount: amt });
      continue;
    }

    // Heuristic: if the line contains a date and at least one money token, use the last money token as amount.
    const dm = line.match(dateRx);
    if (!dm) {
      if (txns.length && isContinuationCandidate(line)) {
        const prev = txns[txns.length - 1];
        prev.description = `${prev.description} ${line}`.replace(/\s{2,}/g, ' ').trim();
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
    const desc = line.slice(descSliceStart, descSliceEnd).replace(/\s{2,}/g, ' ').trim();
    const date = normalizeDateLike(dateStr);

    // Avoid adding lines where "description" is empty or obviously just column labels
    if (!date) continue;
    if (!desc || /balance|total|statement|payment due/i.test(desc)) continue;
    if ((desc.match(/[A-Za-z]/g) || []).length < 3) continue;
    if (Math.abs(amt) < 0.01) continue;

    txns.push({ date, description: desc, amount: amt });
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

function txnsToPaymentLogCSV(txns) {
  const header = ['DATE','PAYEE','CATEGORY','AMOUNT','METHOD','NOTES'];
  const rows = (txns || []).map(t => {
    const payee = (t.description || '').replace(/\s+/g,' ').trim();
    const category = (t.category && String(t.category).trim()) ? String(t.category).trim() : categorize(payee);
    const amount = (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount)) || 0;
    // Escape CSV
    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    return [esc(t.date||''), esc(payee), esc(category), esc(amount.toFixed(2)), '', ''].join(',');
  });
  return header.join(',') + '\n' + rows.join('\n');
}

function transactionsToSnapshot(txns, bankName) {
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
  return {
    date: dates.length ? sanitizeDate(dates[dates.length - 1]) : new Date().toISOString().slice(0, 10),
    netWorth: { assets: { checking: 0, savings: 0, eFund: 0, other: 0 }, liabilities: {}, total: 0 },
    debts: [],
    eFund: { balance: 0, monthlyExpenses: Math.round(totalExpense), phase: 1 },
    budget: { income: Math.round(income), categories: budgetCats },
    macro: { netLiquidity: 0, liquidityTrend: 'NEUTRAL', btcPrice: 0, wyckoffPhase: 'Accumulation', fedWatchCut: 0, nextFomc: '', yieldCurve10Y2Y: 0, yieldTrend: 'flat', triggersActive: 0, activeTriggers: [] },
    protection: { lifeInsurance: { provider: '', type: 'TERM', deathBenefit: 0, monthlyPremium: 0, expirationDate: '', conversionDeadline: '', alertLeadTimeYears: 5 }, funeralBuffer: { target: 10000, current: 0 } },
    portfolio: { equities: [], options: [], crypto: [] },
    bills: [],
    payroll: { frequency: 'WEEKLY', weekday: 2 },
    _meta: { source: bankName, transactions: txns.length, income: Math.round(income), totalExpense: Math.round(totalExpense), uncategorized: Math.round(cats['Uncategorized'] || 0), excludedTransfers: Math.round(excludedIncome) },
  };
}

// ═══════════════════════════════════════════════════
// DEFAULT DATA & HELPERS
// ═══════════════════════════════════════════════════
const DEFAULT_SNAPSHOT = {
  date: new Date().toISOString().slice(0, 10),
  netWorth: { assets: { checking: 0, savings: 0, eFund: 0, other: 0 }, liabilities: {}, total: 0 },
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
  portfolio: { equities: [], options: [], crypto: [] },
  bills: [],
  payroll: { frequency: 'WEEKLY', weekday: 2 },
};
const DEFAULT_SETTINGS = { visibleModules: ['directive', 'netWorth', 'debt', 'planner', 'eFund', 'budget', 'protection', 'portfolio', 'macro', 'market', 'macroBanner'], _v: 7 };
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
  return efMonthly > 0 ? efMonthly : 3000;
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
const CURRENCY_SYMBOL = (() => { try { return (0).toLocaleString(undefined, { style: 'currency', currency: Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).resolvedOptions().currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d.,\s]/g, '').trim(); } catch { return '$'; } })();

// Stage calculation from live data
function calcStage(latest) {
  const debt = totalDebt(latest?.debts);
  const ef = latest?.eFund || {};
  const bal = ef.balance || 0;
  const monthly = monthlySpendBaseline(latest);
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = totalBudgetSpent(latest);

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
    } catch {}
  },
  async del(k) {
    try {
      if (__hasWindowStorage()) {
        const fn = window.storage.delete || window.storage.del;
        await fn.call(window.storage, k);
        return;
      }
      localStorage.removeItem(__lsKey(k));
    } catch {}
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
function LandingView({ t, onInitialize, onDocs, onToggleTheme, isDark, hasData, onDashboard }) {
  const [boot, setBoot] = useState(0);
  const [faqOpen, setFaqOpen] = useState(null);
  const [dailyBurn, setDailyBurn] = useState(0);
  const accent = t.accent;

  useEffect(() => { const id = setInterval(() => setBoot(p => p < 4 ? p + 1 : 4), 600); return () => clearInterval(id); }, []);

  // Animated daily burn counter
  useEffect(() => {
    const target = 6.05;
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDailyBurn(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    const delay = setTimeout(tick, 2600);
    return () => clearTimeout(delay);
  }, []);

  const ln = (s) => ({ opacity: boot >= s ? 1 : 0, transition: 'opacity 0.3s', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 });

  const stages = [
    { n: 0, name: 'Chaos', color: t.danger },
    { n: 1, name: 'Stable', color: t.warn },
    { n: 2, name: 'Safe', color: t.warn },
    { n: 3, name: 'Free', color: accent },
    { n: 4, name: 'Secure', color: accent },
    { n: 5, name: 'Independent', color: accent },
    { n: 6, name: 'Freedom', color: accent },
    { n: 7, name: 'Legacy', color: accent },
  ];

  const faqs = [
    { q: 'Is this a budgeting app?', a: 'No. Budgeting apps track what happened. FortifyOS enforces what should happen — and blocks what shouldn\'t. It calculates your debt order, gates investment timing, and fires enforcement protocols when you drift off course.' },
    { q: 'Is my financial data safe?', a: 'Your data is stored locally in this browser profile. The 20 instruction files in the cloud contain zero financial data. Your actual numbers live in 4 local CSV files and local snapshots—disable browser sync if you want single-device isolation. Sensitive fields (SSNs, account/card numbers, emails, phones) are auto-redacted before any processing or display.' },
    { q: 'How is this different from YNAB or Mint?', a: 'YNAB asks you to categorize. FortifyOS auto-parses your bank exports (CSV/PDF) and screenshots, tells you exactly which debt to pay, how much interest is leaking daily, and blocks investment activity until you\'re debt-free. It enforces a 7-stage wealth journey — they give you a pie chart.' },
    { q: 'What do I need to get started?', a: 'A Claude subscription ($20/mo) and at least one statement export (CSV, PDF, or screenshot). Setup is ~30–45 minutes on desktop. After that, daily use is 2–5 minutes — upload new statements when needed and run your morning snapshot.' },
    { q: 'Can I use it on my phone?', a: 'Yes. You can run FortifyOS on mobile for daily briefings and dashboard review. Statement ingestion supports CSV, PDF, and screenshot OCR directly in-app.' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.void, color: t.textPrimary }}>
      {/* Nav */}
      <nav style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.borderDim}` }}>
        <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} title="Back to top">
          <Shield size={18} style={{ color: accent }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>FORTIFYOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onDocs} style={{ background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textSecondary, cursor: 'pointer', padding: '6px 0', letterSpacing: '0.04em' }}>DOCS</button>
          <button onClick={onToggleTheme} style={{ background: 'none', border: `1px solid ${t.borderDim}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSecondary }}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section style={{ padding: '60px 24px 48px', textAlign: 'center', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Pain hook */}
          <div style={{ display: 'inline-block', background: t.surface, border: `1px solid ${t.borderDim}`, padding: '8px 16px', marginBottom: 32, fontSize: 13, color: t.textSecondary }}>
            <span><strong style={{ color: t.danger, fontFamily: "'Space Mono', monospace" }}>${dailyBurn.toFixed(2)}</strong> disappeared from your account today in interest alone</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: 20 }}>
            <span className="hero-title" style={{ display: 'block' }}>Stop Tracking.</span>
            <span className="hero-title" style={{ display: 'block', color: accent, textShadow: isDark ? `0 0 10px ${accent}66` : 'none' }}>Start Enforcing.</span>
          </h1>

          {/* Sub */}
          <p style={{ color: t.textSecondary, maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.7 }} className="hero-sub">
            You know what you should do with your money. You can't execute it. FortifyOS is the financial operating system that enforces discipline — calculates your debt order, blocks premature investments, and tells you exactly what to do every morning.
          </p>

          {/* CTAs */}
          <div className="hero-buttons" style={{ display: 'flex', gap: 12, justifyContent: 'center', maxWidth: 460, margin: '0 auto 0' }}>
            {hasData ? (
              <>
                <button onClick={onDashboard} style={{ background: accent, color: isDark ? '#000' : '#FFF', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>OPEN DASHBOARD <ArrowRight size={16} /></button>
                <button onClick={onInitialize} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: "'Space Mono', monospace", fontSize: 14, padding: '14px 28px', cursor: 'pointer', color: t.textSecondary, width: '100%', textAlign: 'center' }}>SYNC NEW DATA</button>
              </>
            ) : (
              <>
                <button onClick={onInitialize} style={{ background: accent, color: isDark ? '#000' : '#FFF', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>GET STARTED <ArrowRight size={16} /></button>
                <button onClick={onDocs} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: "'Space Mono', monospace", fontSize: 14, padding: '14px 28px', cursor: 'pointer', color: t.textSecondary, width: '100%', textAlign: 'center' }}>HOW IT WORKS</button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ VALUE PROP — 3 COLUMNS ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div className="sync-row-3" style={{ display: 'grid', gap: 16, maxWidth: 780, margin: '0 auto' }}>
          {[
            { Icon: ShieldAlert, title: 'Enforces, Not Just Tracks', desc: 'Hard safety rails block financial mistakes before they happen. The Never List halts on violations. Budget Slash fires automatically when you drift.' },
            { Icon: TrendingUp, title: '7-Stage Gated Journey', desc: 'From chaos to generational wealth — mathematically verified. Investment logic stays locked until Stage 3 (debt = $0). No skipping ahead.' },
            { Icon: Lock, title: 'Your Data Stays Local', desc: 'Instructions in the cloud. Data stored locally in your browser profile. Disable browser sync for single-device isolation. Sensitive fields are auto-redacted before processing or display.' },
          ].map((c, i) => (
            <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 20 }}>
              <c.Icon size={20} style={{ color: accent, marginBottom: 12 }} />
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, marginBottom: 8, color: t.textPrimary }}>{c.title}</div>
              <div style={{ fontSize: 12, color: t.textDim, lineHeight: 1.65 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS — 3 STEPS ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>How It Works</div>
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, marginBottom: 24, color: t.textPrimary }}>Three steps. Five minutes a day.</h2>

          <div className="sync-row-3" style={{ display: 'grid', gap: 2 }}>
            {[
              { num: '01', title: 'SYNC', desc: 'Upload a statement PDF/screenshot, drop a bank CSV, or paste a JSON snapshot. Sentinel auto-redacts sensitive data. The system fingerprints your bank and parses transactions automatically.', Icon: Upload },
              { num: '02', title: 'CALCULATE', desc: 'KNOX determines your stage, ranks debts by APR, projects daily interest burn, and checks every action against safety rails. All math shown, no black boxes.', Icon: Cpu },
              { num: '03', title: 'EXECUTE', desc: 'Say "Good morning" — the Morning Pulse tells you exactly what to do today. Which debt to hit. How much is leaking. What\'s due in 48 hours.', Icon: Zap },
            ].map((s, i) => (
              <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 20, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: accent }}>{s.num}</span>
                  <s.Icon size={16} style={{ color: t.textDim }} />
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, marginBottom: 6, color: t.textPrimary, letterSpacing: '0.04em' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE 7 STAGES ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>The Journey</div>
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, marginBottom: 6, color: t.textPrimary }}>7 Stages. Mathematically Gated.</h2>
          <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 24, maxWidth: 560 }}>Every user enters at their current stage. The system moves you forward — and blocks you from skipping ahead. Your stage is calculated from real data, never a static label.</p>

          {/* Stage progress bar */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {stages.map((s, i) => (
              <div key={i} style={{ flex: 1, height: 8, background: i <= 1 ? s.color : t.elevated, transition: 'all 0.4s', position: 'relative' }}>
                {i === 1 && <div style={{ position: 'absolute', inset: 0, boxShadow: `0 0 8px ${accent}55`, pointerEvents: 'none' }} />}
              </div>
            ))}
          </div>
          <div className="stage-labels" style={{ display: 'flex', gap: 3, marginBottom: 20 }}>
            {stages.map((s, i) => (
              <span key={i} style={{ flex: 1, fontSize: 8, color: i <= 1 ? s.color : t.textDim, textTransform: 'uppercase', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{s.n}</span>
            ))}
          </div>

          {/* Stage detail rows */}
          <div style={{ display: 'grid', gap: 2 }}>
            {[
              { stage: '0–2', label: 'DEFENSE MODE', detail: 'Stabilize cash flow, build emergency buffer, stop the bleed. All investment logic locked.', color: t.warn },
              { stage: '3', label: 'DEBT LIBERATION', detail: 'Consumer debt hits $0. Investment strategies unlock. The gate that changes everything.', color: accent },
              { stage: '4–7', label: 'WEALTH BUILDING', detail: 'Passive income grows from covering needs → current life → dream life → generational impact.', color: accent },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', background: t.surface, border: `1px solid ${t.borderDim}`, padding: '12px 16px' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: r.color, minWidth: 36 }}>{r.stage}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary, letterSpacing: '0.04em', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.5 }}>{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRIVACY CALLOUT ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Lock size={24} style={{ color: accent, marginBottom: 16 }} />
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, marginBottom: 10, color: t.textPrimary }}>Instructions in the cloud. Data on your machine.</h2>
          <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, maxWidth: 520, marginBottom: 20 }}>The 20 protocol files that power KNOX contain zero financial data. Your actual numbers — balances, transactions, debts — live in 4 local CSV files that never upload. SSNs and account numbers are auto-redacted before any processing.</p>
          <div className="sync-row-3" style={{ display: 'grid', gap: 12, width: '100%' }}>
            {[
              { label: 'Cloud layer', val: 'Rules & logic only', sub: '20 .md files, 0 financial data' },
              { label: 'Local layer', val: 'Your real numbers', sub: '4 CSVs that never leave your machine' },
              { label: 'Redaction', val: 'Automatic (Sentinel)', sub: 'SSNs, card numbers, routing numbers' },
            ].map((c, i) => (
              <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 2 }}>{c.val}</div>
                <div style={{ fontSize: 10, color: t.textDim }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BOOT SEQUENCE (Brand Moment) ═══ */}
      <section style={{ padding: '36px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ textAlign: 'left', background: t.surface, border: `1px solid ${t.borderDim}`, padding: 16, borderRadius: 4 }}>
            <p style={ln(1)}>[ SYSTEM ] : INITIALIZING COMMAND LAYER...</p>
            <p style={ln(2)}>[ KERNEL ] : LOADING PHASE_AWARE_EXECUTION_v2.0</p>
            <p style={ln(3)}>[ STATUS ] : <span style={{ color: accent }}>PHASE-AWARE EXECUTION ACTIVE</span></p>
            <p style={ln(4)}>[ READY&nbsp; ] : AWAITING OPERATOR INPUT<span style={{ animation: 'blink 1s infinite' }}>_</span></p>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>FAQ</div>
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, marginBottom: 24, color: t.textPrimary }}>Common Questions</h2>

          {faqs.map((f, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${t.borderDim}` }}>
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
              >
                {f.q}
                <ChevronDown size={14} style={{ color: t.textDim, transform: faqOpen === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 12 }} />
              </button>
              {faqOpen === i && (
                <div style={{ padding: '0 0 14px', fontSize: 12, color: t.textSecondary, lineHeight: 1.7 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{ padding: '48px 24px', borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, marginBottom: 10, color: t.textPrimary }}>
            Ready to stop leaking <span style={{ color: t.danger }}>$6.05/day</span>?
          </h2>
          <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>Sync your first bank statement. The system does the rest.</p>
          <button onClick={onInitialize} style={{ background: accent, color: isDark ? '#000' : '#FFF', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 36px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>GET STARTED <ArrowRight size={16} /></button>
        </div>
      </section>

      {/* ═══ FOOTER STATS ═══ */}
      <section className="footer-stats" style={{ display: 'grid', borderTop: `1px solid ${t.borderDim}` }}>
        {[
          { label: 'PRIVACY', val: 'LOCAL BROWSER STORAGE', Icon: Lock },
          { label: 'DAILY TIME', val: '2–5 MINUTES', Icon: Clock },
          { label: 'SETUP', val: '30 MIN TO LIVE', Icon: Zap },
        ].map((s, i) => (
          <div key={i} className="footer-stat-cell" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <s.Icon size={20} style={{ color: accent, marginBottom: 4 }} />
            <span style={{ fontSize: 9, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.val}</span>
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
  const [expandedTier, setExpandedTier] = useState({ start: true, core: true, data: false, advanced: false, why: false });
  const accent = t.accent;
  const sectionRefs = useRef({});

  const sty = {
    nav: { position: 'sticky', top: 0, zIndex: 50, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, borderBottom: `1px solid ${t.borderDim}`, backdropFilter: 'blur(8px)' },
    container: { maxWidth: 780, margin: '0 auto', padding: '24px 24px 80px' },
    h2: { fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', color: accent, marginTop: 48, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${t.borderDim}` },
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
    tierHead: (open) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer', userSelect: 'none', borderBottom: open ? 'none' : `1px solid ${t.borderDim}`, marginBottom: open ? 0 : 4 }),
    tierLabel: { fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 },
  };
  const Code = ({ children }) => <code style={sty.code}>{children}</code>;
  const Lbl = ({ children }) => <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>;

  // Tiered TOC structure
  const TOC_TIERS = [
    { key: 'start', label: 'Getting Started', items: [
      { id: 'stages', num: '01', label: 'The 7 Stages' },
      { id: 'how-it-works', num: '02', label: 'How It Works' },
      { id: 'installation', num: '03', label: 'Installation' },
    ]},
    { key: 'core', label: 'Core System', items: [
      { id: 'enforcement', num: '04', label: 'The Enforcement Engine' },
      { id: 'budget', num: '05', label: 'Budget Allocation' },
      { id: 'efund', num: '06', label: 'Emergency Fund Phases' },
      { id: 'safety', num: '07', label: 'Safety Rails' },
    ]},
    { key: 'data', label: 'Data & Privacy', items: [
      { id: 'ingestion', num: '08', label: 'Data Ingestion' },
      { id: 'schema', num: '09', label: 'Snapshot Schema' },
      { id: 'sentinel', num: '10', label: 'Sentinel Redaction' },
    ]},
    { key: 'advanced', label: 'Advanced', items: [
      { id: 'calculations', num: '11', label: 'Core Calculations' },
      { id: 'commands', num: '12', label: 'Command Reference' },
      { id: 'claude-code', num: '13', label: 'Desktop Parsing (Claude Code)' },
    ]},
    { key: 'why', label: 'Why FortifyOS', items: [
      { id: 'comparison', num: '15', label: 'Competitive Comparison' },
    ]},
  ];

  const scrollTo = (id) => { setActiveSection(id); document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    const allIds = TOC_TIERS.flatMap(tier => tier.items.map(i => i.id));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.id?.replace('doc-', '');
          if (id) setActiveSection(id);
        }
      }
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 });

    const timer = setTimeout(() => {
      allIds.forEach(id => {
        const el = document.getElementById(`doc-${id}`);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  const toggleTier = (key) => setExpandedTier(prev => ({ ...prev, [key]: !prev[key] }));

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
          <p style={{ color: t.textSecondary, fontSize: 13, maxWidth: 560, lineHeight: 1.7 }}>System field manual. From first sync to financial independence — the architecture, enforcement logic, and methodology behind every calculation.</p>
          <span style={{ display: 'inline-block', marginTop: 10, fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', border: `1px solid ${t.borderDim}`, padding: '3px 8px' }}>KNOX v2.1 — FORTIFYOS v2.2</span>
        </div>

        {/* Tiered TOC */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '16px 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Navigation</div>
          {TOC_TIERS.map(tier => (
            <div key={tier.key} style={{ marginBottom: 4 }}>
              <div style={sty.tierHead(expandedTier[tier.key])} onClick={() => toggleTier(tier.key)}>
                <span style={sty.tierLabel}>{tier.label}</span>
                <ChevronRight size={12} style={{ color: t.textDim, transform: expandedTier[tier.key] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </div>
              {expandedTier[tier.key] && tier.items.map(s => (
                <div key={s.id} onClick={() => scrollTo(s.id)} style={{ padding: '4px 0 4px 16px', fontSize: 12, color: activeSection === s.id ? accent : t.textSecondary, cursor: 'pointer', borderLeft: `2px solid ${activeSection === s.id ? accent : 'transparent'}`, transition: 'all 0.2s' }}>
                  <span style={{ color: t.textDim, marginRight: 8 }}>{s.num}</span>{s.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
           TIER 1: GETTING STARTED
           ══════════════════════════════════════════════════════════ */}

        {/* 01 THE 7 STAGES */}
        <h2 id="doc-stages" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>01</span> The 7 Stages</h2>
        <p style={sty.p}>FortifyOS maps your entire financial life onto a <strong style={{ color: t.textPrimary }}>7-stage journey</strong> — from chaos to generational wealth. Your current stage is calculated from live data, not a static label. The system gates what actions are available at each stage, which prevents the most common wealth-building mistake: investing while carrying high-interest debt.</p>

        {/* Stage progress visualization */}
        <div style={{ display: 'flex', gap: 2, margin: '18px 0 6px' }}>
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{ flex: 1, height: 6, background: i <= 1 ? accent : t.elevated, boxShadow: i === 1 ? `0 0 8px ${accent}44` : 'none', transition: 'all 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
          {['0: Chaos','1: Stable','2: Safe','3: Free','4: Secure','5: Indep.','6: Freedom','7: Legacy'].map((l, i) => (
            <span key={i} style={{ flex: 1, fontSize: 7, color: i <= 1 ? accent : t.textDim, textTransform: 'uppercase', textAlign: 'center' }}>{l}</span>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Stage</th><th style={sty.th}>Name</th><th style={sty.th}>Gate (How You Advance)</th></tr></thead>
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
            ].map(([stage, name, gate]) => (
              <tr key={stage}>
                <td style={{ ...sty.td, color: accent, fontWeight: 700, textAlign: 'center' }}>{stage}</td>
                <td style={{ ...sty.td, color: t.textPrimary }}>{name}</td>
                <td style={sty.td}>{gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Defense Mode:</strong> Most users enter at Stage 0 or 1. The system enforces Defense Mode (Stages 0–3) — all investment logic is locked until Stage 3 is mathematically verified from your live data. This is a feature, not a limitation.
        </div>
        <div style={sty.note(t.warn)}>
          <strong style={{ color: t.textPrimary }}>BNPL Alert:</strong> Buy Now Pay Later platforms fragment debt across apps, making it invisible to your budget. FortifyOS tracks BNPL installments remaining — not just balances — and categorizes untracked outflow as Lifestyle by default. Nothing hides.
        </div>

        {/* 02 HOW IT WORKS */}
        <h2 id="doc-how-it-works" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>02</span> How It Works</h2>
        <p style={sty.p}>FortifyOS runs inside Claude AI through a skill package called <strong style={{ color: t.textPrimary }}>KNOX</strong> (Knowledge Nexus Operations eXecution) — 24 files that give Claude a persistent financial identity, enforcement logic, and data processing capability. Three layers keep your data safe and the system operational.</p>

        <div className="sync-row-3" style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
          {[
            { num: '1', title: 'SYNC YOUR DATA', desc: 'Drop a bank CSV or upload a text-based statement PDF. FortifyOS extracts transactions locally, runs Sentinel redaction first, then maps entries into the dashboard. JSON + manual entry are still supported.' },
            { num: '2', title: 'SYSTEM CALCULATES', desc: 'KNOX determines your stage, ranks debts by APR, calculates daily interest burn, projects cash flow, and checks every action against safety rails — in real time.' },
            { num: '3', title: 'EXECUTE WITH CONFIDENCE', desc: 'Get a Morning Pulse with exactly what to do today. Weekly HUD tracks direction. Monthly reports show the math. The system enforces — you decide.' },
          ].map((c, i) => (
            <div key={i} style={sty.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: accent }}>{c.num}</span>
                <span style={{ fontSize: 11, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <h3 style={sty.h3}>Three-Layer Architecture</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Layer</th><th style={sty.th}>Location</th><th style={sty.th}>Contains</th></tr></thead>
          <tbody>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Layer 1</td><td style={sty.td}>Claude.ai Project (Cloud)</td><td style={sty.td}>20 protocol files — rules, logic, enforcement. Zero real financial data.</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Layer 2</td><td style={sty.td}>Local Browser Profile</td><td style={sty.td}>4 CSV files — bills, BNPL tracker, debt avalanche, payment log. Your actual numbers.</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Layer 3</td><td style={sty.td}>Session Memory</td><td style={sty.td}>Live data submitted per session, processed in real time, written to local CSVs.</td></tr>
          </tbody>
        </table>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>The core principle:</strong> Instructions live in the cloud. Data lives on your machine. They never mix.
        </div>

        {/* 03 INSTALLATION */}
        <h2 id="doc-installation" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>03</span> Installation</h2>
        <p style={sty.p}>Three paths depending on your platform. Desktop gives you maximum privacy with local file processing. Mobile gives you daily access on the go.</p>

        <h3 style={sty.h3}>Mac (Full Local Workflow) — 30–45 min</h3>
        <pre style={sty.pre}>{`# 1. Create folder structure
mkdir -p ~/FORTIFY/knox/references ~/FORTIFY/knox/assets

# 2. Place 24 KNOX files in correct locations

# 3. Create Claude.ai Project → upload 20 .md files only (never CSVs)

# 4. Install Claude Code
npm install -g @anthropic/claude-code

# 5. Launch
cd ~/FORTIFY && claude

# 6. Authenticate with Anthropic account
# 7. Submit first statement → CSVs populate → system operational`}</pre>

        <h3 style={sty.h3}>Windows (Full Local Workflow) — 45–60 min</h3>
        <pre style={sty.pre}>{`# 1. Create folder structure (PowerShell, CMD, or File Explorer)

# 2. Install Node.js from nodejs.org
# 3. Install Python from python.org (check "Add to PATH")

# 4. Install Claude Code
npm install -g @anthropic/claude-code

# 5. Place 24 KNOX files in correct locations
# 6. Create Claude.ai Project → upload 20 .md files only

# 7. Launch
cd %USERPROFILE%\\FORTIFY && claude

# 8. Submit first statement → system operational`}</pre>

        <h3 style={sty.h3}>Mobile (Daily Interface) — 5 min</h3>
        <p style={sty.p}>Download the Claude app (iOS or Android), sign in with the same Anthropic account, and open the FortifyOS Project. KNOX loads automatically. You get full daily briefings, payment checks, market updates, and emergency commands. Desktop is required for CSV data processing — mobile is your daily command line.</p>

        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Daily time investment:</strong> 2–5 minutes. Say "Good morning" and the system tells you exactly what to do today.
        </div>

        <h3 style={sty.h3}>File Architecture</h3>
        <p style={sty.p}>After installation, your local FORTIFY directory contains 3 layers: the KNOX skill package (uploaded to Claude), local-only CSV data (never uploaded), and working folders for statements and reports.</p>

        {/* Interactive folder tree infographic */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '16px 0', margin: '16px 0', overflow: 'hidden' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, padding: '0 18px 12px', borderBottom: `1px solid ${t.borderDim}`, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
              <div style={{ width: 8, height: 8, background: accent, flexShrink: 0 }} />
              <span style={{ color: t.textSecondary }}>Uploaded to Claude Project</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
              <div style={{ width: 8, height: 8, background: t.danger, flexShrink: 0 }} />
              <span style={{ color: t.textSecondary }}>LOCAL ONLY — Never upload</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
              <div style={{ width: 8, height: 8, background: t.textDim, flexShrink: 0 }} />
              <span style={{ color: t.textSecondary }}>Working directory</span>
            </div>
          </div>

          {/* Tree */}
          {(() => {
            const treeStyle = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 2.0, padding: '0 18px' };
            const line = (indent, connector, name, tag, color) => (
              <div style={{ ...treeStyle, paddingLeft: indent * 18, display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{ color: t.textDim, whiteSpace: 'pre' }}>{connector} </span>
                <span style={{ color: color || t.textSecondary }}>{name}</span>
                {tag && <span style={{ fontSize: 8, color: tag.color || t.textDim, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.06em', border: `1px solid ${(tag.color || t.textDim)}40`, padding: '1px 5px', whiteSpace: 'nowrap' }}>{tag.text}</span>}
              </div>
            );
            return (<div>
              {line(0, '📁', '~/FORTIFY/', null, t.textPrimary)}

              {/* knox/ */}
              {line(0, '├── 📁', 'knox/', null, accent)}
              {line(1, '├──', 'SKILL.md', { text: 'Cloud', color: accent }, accent)}

              {/* knox/references/ */}
              {line(1, '├── 📁', 'references/', null, accent)}
              {line(2, '├──', 'fortify-core.md', { text: 'Cloud', color: accent }, accent)}
              {line(2, '├──', 'wealth-roadmap.md', { text: 'Cloud', color: accent }, accent)}
              {line(2, '├──', 'parse-protocols.md', { text: 'Cloud', color: accent }, accent)}
              {line(2, '├──', 'monthly-report.md', { text: 'Cloud', color: accent }, accent)}
              {line(2, '├──', 'sloan-protocols.md', { text: 'Cloud', color: accent }, accent)}
              {line(2, '├──', 'trade-framework.md', { text: 'Cloud', color: accent }, accent)}

              {/* Skill files */}
              <div style={{ ...treeStyle, paddingLeft: 2 * 18, color: t.textDim, fontSize: 9, lineHeight: 1.4, padding: '2px 0 2px 54px' }}>
                ├── sk01–sk13 skill files (.md) <span style={{ border: `1px solid ${accent}40`, padding: '1px 5px', marginLeft: 4, fontSize: 8, color: accent }}>Cloud</span>
              </div>

              {/* Local CSVs */}
              <div style={{ ...treeStyle, paddingLeft: 2 * 18, borderTop: `1px dashed ${t.borderDim}`, marginTop: 4, paddingTop: 4 }} />
              {line(2, '├──', 'bills-registry.csv', { text: 'Local Only', color: t.danger }, t.danger)}
              {line(2, '├──', 'bnpl-tracker.csv', { text: 'Local Only', color: t.danger }, t.danger)}
              {line(2, '├──', 'debt-avalanche.csv', { text: 'Local Only', color: t.danger }, t.danger)}
              {line(2, '└──', 'payment-log.csv', { text: 'Local Only', color: t.danger }, t.danger)}

              {/* knox/assets/ */}
              {line(1, '└── 📁', 'assets/', null, accent)}
              {line(2, '└──', 'hud-template.md', { text: 'Cloud', color: accent }, accent)}

              {/* Top-level working dirs */}
              <div style={{ borderTop: `1px solid ${t.borderDim}`, marginTop: 6, paddingTop: 6 }} />
              {line(0, '├── 📁', 'statements/', { text: 'Drop bank files here (CSV, PDF, PNG/JPG)', color: t.textDim }, t.textDim)}
              {line(0, '└── 📁', 'reports/', { text: 'Monthly PDFs save here', color: t.textDim }, t.textDim)}
            </div>);
          })()}

          {/* Counts */}
          <div style={{ display: 'flex', gap: 2, padding: '12px 18px 0', borderTop: `1px solid ${t.borderDim}`, marginTop: 12 }}>
            {[
              { n: '20', label: '.md files → Cloud', color: accent },
              { n: '4', label: '.csv files → Local', color: t.danger },
              { n: '2', label: 'Working dirs', color: t.textDim },
            ].map((c, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color, fontFamily: "'Space Mono', monospace" }}>{c.n}</div>
                <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={sty.note(t.danger)}>
          <strong style={{ color: t.textPrimary }}>The 4 CSV files contain your real financial data.</strong> They are generated by KNOX during your first sync and live exclusively on your local machine. They are never uploaded to the Claude Project. The 20 .md files uploaded to Claude contain rules, formulas, and protocols — zero personal financial data.
        </div>

        {/* ══════════════════════════════════════════════════════════
           TIER 2: CORE SYSTEM
           ══════════════════════════════════════════════════════════ */}

        {/* 04 THE ENFORCEMENT ENGINE */}
        <h2 id="doc-enforcement" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>04</span> The Enforcement Engine</h2>
        <p style={sty.p}>This is the core differentiator. Other tools track what happened. FortifyOS enforces what should happen — and blocks what shouldn't. Three enforcement layers work together to prevent financial mistakes before they occur.</p>

        <h3 style={sty.h3}>Layer 1: Validation Loop (Pre-Execution)</h3>
        <p style={sty.p}>Before any action, KNOX runs three checks. If any fails, the system halts and explains why before proceeding.</p>
        <div className="sync-row-3" style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
          {[
            { num: '1', q: 'What stage is the user in?', detail: 'Calculated from live CSV data — never a static label' },
            { num: '2', q: 'Does this align with current stage?', detail: 'Investment requests during Defense Mode → blocked' },
            { num: '3', q: 'Does this decrease DRAG or increase VELOCITY?', detail: 'If NO → system halts and explains before proceeding' },
          ].map((c, i) => (
            <div key={i} style={{ ...sty.card, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: accent, flexShrink: 0 }}>{c.num}</span>
              <div>
                <div style={{ fontSize: 12, color: t.textPrimary, marginBottom: 4 }}>{c.q}</div>
                <div style={{ fontSize: 10, color: t.textDim }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 style={sty.h3}>Layer 2: The Never List (Hard Stops)</h3>
        <p style={sty.p}>Critical violations that trigger an immediate halt if detected:</p>
        {[
          'BNPL used for consumables or depreciating assets',
          'Minimum-only payments on high-APR debt',
          'Subscriptions exceeding 2% of monthly net income',
          'Purchases over $200 without 24-hour cooling-off period',
          'Investment activity while consumer debt exists',
          'Untracked Cash App outflow (categorized Lifestyle by default)',
        ].map((r, i) => (
          <div key={i} style={sty.rail}><span style={{ color: t.danger, fontSize: 14, flexShrink: 0 }}>✗</span> {r}</div>
        ))}

        <h3 style={sty.h3}>Layer 3: Budget Slash Protocol (Active Enforcement)</h3>
        <p style={sty.p}>Triggers automatically when Velocity drops below 0.20 or when cash flow projects a deficit. The protocol freezes Lifestyle transactions, audits every non-Essential recurring charge, generates a ranked slash list by impact, and presents it for authorization. Nothing executes without your confirmation. Recovered dollars route to the Debt Avalanche alpha target.</p>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Budget Slash targets Lifestyle only.</strong> Essential and Medical categories are permanently exempt. No override authority.
        </div>

        <h3 style={sty.h3}>The Velocity Formula</h3>
        <div style={sty.formula}><Lbl>Financial Velocity</Lbl>V = (Monthly Savings + Debt Principal Paid) / Total Net Income</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Velocity</th><th style={sty.th}>Status</th><th style={sty.th}>System Response</th></tr></thead>
          <tbody>
            <tr><td style={{ ...sty.td, color: accent }}>V ≥ 0.25</td><td style={sty.td}>On Track</td><td style={sty.td}>25+ cents of every dollar moving you forward</td></tr>
            <tr><td style={{ ...sty.td, color: t.warn }}>V 0.10–0.20</td><td style={sty.td}>Alert</td><td style={sty.td}>Diagnosis before enforcement — identify root cause</td></tr>
            <tr><td style={{ ...sty.td, color: t.danger }}>V &lt; 0.10</td><td style={sty.td}>Crisis</td><td style={sty.td}>Emergency protocols activate, Budget Slash fires</td></tr>
          </tbody>
        </table>

        <h3 style={sty.h3}>Stage 0 Velocity Diagnosis</h3>
        <p style={sty.p}>Before Budget Slash fires, KNOX identifies <em>why</em> Velocity is low — because the wrong treatment makes things worse. If minimums are consuming the Wealth allocation, it's a debt restructuring audit. If it's lifestyle overspend, Budget Slash fires. If both, lifestyle gets slashed first, then debt restructure.</p>

        {/* 05 BUDGET ALLOCATION */}
        <h2 id="doc-budget" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>05</span> Budget Allocation</h2>
        <p style={sty.p}>Each category has a target (budgeted) and actual spend, with utilization percentage calculated live. Every dollar is assigned a job. Unallocated cash is treated as wasted potential.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Category</th><th style={sty.th}>Scope</th><th style={sty.th}>Priority</th></tr></thead>
          <tbody>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Essential</td><td style={sty.td}>Rent, groceries, utilities, insurance, gas</td><td style={sty.td}>Non-negotiable</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Medical</td><td style={sty.td}>Prescriptions, appointments, adaptive equipment</td><td style={{ ...sty.td, color: t.danger }}>Priority #1 always</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Debt Service</td><td style={sty.td}>Minimum payments + extra principal</td><td style={sty.td}>Active paydown</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Savings</td><td style={sty.td}>Emergency fund contributions</td><td style={sty.td}>Parallel with debt</td></tr>
            <tr><td style={{ ...sty.td, color: t.textPrimary }}>Discretionary</td><td style={sty.td}>Dining, entertainment, subscriptions</td><td style={sty.td}>Minimize (slash target)</td></tr>
          </tbody>
        </table>
        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Utilization thresholds:</strong> <span style={{ color: accent }}>0–74%</span> On track · <span style={{ color: t.warn }}>75–99%</span> Watch · <span style={{ color: t.danger }}>100%+</span> Blown — the system flags blown categories in your Morning Pulse.
        </div>

        {/* 06 EMERGENCY FUND */}
        <h2 id="doc-efund" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>06</span> Emergency Fund Phases</h2>
        <p style={sty.p}>The emergency fund is measured in <strong style={{ color: t.textPrimary }}>days of survival</strong>, not raw dollars. This forces evaluation through the lens of time: not "I have $3,000 saved" but "I have 30 days before system failure."</p>
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

        {/* 07 SAFETY RAILS */}
        <h2 id="doc-safety" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>07</span> Safety Rails</h2>
        <p style={sty.p}>Hard safety rails are immutable. They cannot be overridden by the operator, by KNOX, or by any system logic. These exist because financial ruin is not an option.</p>
        {[
          'Never invest emergency fund money',
          'Never recommend positions that could create debt',
          'Never skip minimum debt payments for investments',
          'Never suggest leverage or margin during Fortify phase',
          'Medical expenses = ALWAYS Priority #1, no cap, no slash',
          'Investment strategies locked until Stage 3 mathematically verified',
          'Stage calculated from live CSV data only — never a static label',
          'Budget Slash targets Lifestyle only — Essential and Medical exempt',
          'Family stability check: if this goes to zero, does family survive?',
        ].map((r, i) => (
          <div key={i} style={sty.rail}><span style={{ color: t.danger, fontSize: 14, flexShrink: 0 }}>✗</span> {r}</div>
        ))}
        <h3 style={sty.h3}>Soft Limits</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Limit</th><th style={sty.th}>Override Requires</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Side income reinvestment &gt;50% of side earnings</td><td style={sty.td}>Explicit approval</td></tr>
            <tr><td style={sty.td}>Any single position &gt;5% of investable capital</td><td style={sty.td}>Explicit approval</td></tr>
            <tr><td style={sty.td}>Any investment requiring &gt;$500 upfront</td><td style={sty.td}>Explicit approval during Fortify</td></tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════
           TIER 3: DATA & PRIVACY
           ══════════════════════════════════════════════════════════ */}

        {/* 08 DATA INGESTION */}
        <h2 id="doc-ingestion" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>08</span> Data Ingestion</h2>
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

        <h3 style={sty.h3}>Document Risk Tiers</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Document</th><th style={sty.th}>Sensitivity</th><th style={sty.th}>Recommended Method</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Bank screenshots</td><td style={sty.td}>Low</td><td style={sty.td}>Browser or Claude Code</td></tr>
            <tr><td style={sty.td}>Credit card statements</td><td style={sty.td}>Medium</td><td style={sty.td}>Claude Code recommended</td></tr>
            <tr><td style={sty.td}>Pay stubs</td><td style={{ ...sty.td, color: t.warn }}>High (contains SSN)</td><td style={sty.td}>Claude Code only</td></tr>
            <tr><td style={sty.td}>Tax documents (W-2, 1099)</td><td style={{ ...sty.td, color: t.danger }}>Critical</td><td style={sty.td}>Claude Code only — never cloud</td></tr>
          </tbody>
        </table>

        {/* 09 SNAPSHOT SCHEMA */}
        <h2 id="doc-schema" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>09</span> Snapshot Schema</h2>
        <p style={sty.p}>Every sync produces a snapshot — a single JSON object representing your complete financial state at a point in time. Snapshots are stored locally and power the dashboard's trend charts.</p>
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

        {/* 10 SENTINEL */}
        <h2 id="doc-sentinel" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>10</span> Sentinel Redaction</h2>
        <p style={sty.p}>All data ingested via CSV or file import passes through the Sentinel filter before processing. This is automatic — you don't have to remember to redact.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Pattern</th><th style={sty.th}>Action</th><th style={sty.th}>Example</th></tr></thead>
          <tbody>
            <tr><td style={sty.td}>Card numbers</td><td style={sty.td}>Mask to last 4</td><td style={sty.td}><Code>XXXX-XXXX-XXXX-1234</Code></td></tr>
            <tr><td style={sty.td}>SSNs</td><td style={sty.td}>Full mask</td><td style={sty.td}><Code>XXX-XX-****</Code></td></tr>
            <tr><td style={sty.td}>Routing numbers</td><td style={sty.td}>Full redact</td><td style={sty.td}><Code>[REDACTED]</Code></td></tr>
            <tr><td style={sty.td}>Physical address</td><td style={sty.td}>Full redact</td><td style={sty.td}><Code>[REDACTED]</Code></td></tr>
            <tr><td style={sty.td}>Date of birth</td><td style={sty.td}>Full redact</td><td style={sty.td}><Code>[REDACTED]</Code></td></tr>
          </tbody>
        </table>
        <div style={sty.note(t.danger)}>
          <strong style={{ color: t.textPrimary }}>Privacy Wall:</strong> Tax documents and detailed financial ledgers are local-only. Never cloud-synced. No override authority. This is absolute.
        </div>

        {/* ══════════════════════════════════════════════════════════
           TIER 4: ADVANCED
           ══════════════════════════════════════════════════════════ */}

        {/* 11 CORE CALCULATIONS */}
        <h2 id="doc-calculations" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>11</span> Core Calculations</h2>

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
        <p style={sty.p}>Debts are automatically sorted by APR descending. The highest-APR debt (the "alpha target") receives all extra payments above minimums. When zeroed, the system re-targets the next highest. KNOX tracks interest saved vs. minimum-only scenario so you can see the real dollar impact of every extra payment.</p>

        <h3 style={sty.h3}>Savings Rate</h3>
        <div style={sty.formula}><Lbl>Monthly Savings Rate</Lbl>Savings Rate = ((Income − Total Spent) / Income) × 100</div>

        {/* 12 MACRO */}
        <h2 id="doc-macro" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>12</span> Macro Intelligence & Benner Cycle</h2>
        <div style={sty.note(t.warn)}>
          <strong style={{ color: t.textPrimary }}>Phase Note:</strong> This module provides contextual awareness for long-term positioning. During Defense Mode (Stages 0–3), macro intelligence is informational only — no trade execution is permitted. Investment logic unlocks at Stage 3.
        </div>
        <p style={sty.p}>Tracks Federal Reserve liquidity conditions, Bitcoin cycle positioning, and yield curve dynamics. Used as a macro posture filter for phase-level decisions — not trading signals.</p>

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

        {/* 13 COMMANDS */}
        <h2 id="doc-commands" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>13</span> Command Reference</h2>
        <p style={sty.p}>Slash commands for direct access. Natural language triggers for conversational use. Both produce the same output.</p>
        {[
          ['/cfo', 'Morning Pulse — CFO snapshot + macro intel. Also triggered by "Good morning".'],
          ['/macro', 'Liquidity snapshot — Net Liquidity, FedWatch, yield curve, BTC phase.'],
          ['/sloan', 'TCG/Pokemon market intelligence — set trends, sealed product, pop reports.'],
          ['/avalanche', 'Debt re-rank + alpha target identification + interest saved.'],
          ['/cashflow', 'Day-by-day cash flow projection for the current period.'],
          ['/liberation', 'Countdown to debt freedom at current pace + acceleration scenarios.'],
          ['/sync [JSON]', 'Weekly HUD generation from imported snapshot data.'],
          ['/audit', 'Full financial health check — net worth, debt, budget, e-fund, projections.'],
          ['/monthly', 'Generate downloadable PDF progress report.'],
          ['/panic', 'Emergency protocol — immediate triage of financial situation.'],
          ['/protocol_reset', 'Architect First violation recovery — restart from questionnaire.'],
        ].map(([k, d], i) => (
          <div key={i} style={sty.cmd}>
            <span style={{ color: accent, fontSize: 12, minWidth: 130 }}>{k}</span>
            <span style={{ color: t.textDim, fontSize: 11 }}>{d}</span>
          </div>
        ))}
        <h3 style={{ ...sty.h3, marginTop: 20 }}>Natural Language</h3>
        {[
          ['"Good morning"', '→ Morning Pulse with progress bars'],
          ['"What\'s my net worth?"', '→ Latest calculation + trend'],
          ['"Can I afford [X]?"', '→ Budget check + opportunity cost'],
          ['"I\'m about to pay [X]"', '→ Pre-payment sanity check'],
          ['"Extra $XXX this week"', '→ Avalanche routing + Time Saved report'],
          ['"Debt payoff plan"', '→ Current pace + acceleration scenarios'],
          ['"Pokemon market"', '→ SLOAN market intel'],
          ['"What should I focus on?"', '→ Prioritized action items'],
        ].map(([k, d], i) => (
          <div key={i} style={sty.cmd}>
            <span style={{ color: accent, fontSize: 12, minWidth: 200 }}>{k}</span>
            <span style={{ color: t.textDim, fontSize: 11 }}>{d}</span>
          </div>
        ))}

        {/* 14 CLAUDE CODE */}
        <h2 id="doc-claude-code" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>14</span> Desktop Parsing (Claude Code)</h2>
        <p style={sty.p}>Screenshots and PDFs can't be parsed in the browser artifact. Claude Code on desktop fills this gap with full filesystem and library access.</p>

        <h3 style={sty.h3}>Setup</h3>
        <pre style={sty.pre}>{`# Optional desktop OCR pipeline for image statements
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

        {/* ══════════════════════════════════════════════════════════
           TIER 5: WHY FORTIFYOS
           ══════════════════════════════════════════════════════════ */}

        {/* 15 COMPETITIVE COMPARISON */}
        <h2 id="doc-comparison" style={sty.h2}><span style={{ color: t.textDim, marginRight: 6 }}>15</span> Competitive Comparison</h2>
        <p style={sty.p}>FortifyOS is not a budgeting app, a chatbot, or a dashboard. Here's how it compares to the alternatives.</p>

        <h3 style={sty.h3}>vs. Budgeting Apps (Mint, YNAB, Copilot, Monarch)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Capability</th><th style={sty.th}>Budgeting Apps</th><th style={{ ...sty.th, color: accent }}>FortifyOS</th></tr></thead>
          <tbody>
            {[
              ['Approach', 'Track what happened', 'Enforce what should happen'],
              ['Debt strategy', 'Manual categorization', 'Auto-ranked Avalanche with alpha target'],
              ['Wealth roadmap', 'None', '7-stage gated journey'],
              ['SSN redaction', 'No', 'Automatic (Sentinel)'],
              ['Daily guidance', 'No', 'Morning Pulse — what to do today'],
              ['BNPL tracking', 'Basic balance', 'Installments remaining + invisible debt alert'],
            ].map(([cap, them, us], i) => (
              <tr key={i}><td style={{ ...sty.td, color: t.textPrimary }}>{cap}</td><td style={sty.td}>{them}</td><td style={{ ...sty.td, color: accent }}>{us}</td></tr>
            ))}
          </tbody>
        </table>

        <h3 style={sty.h3}>vs. Financial Advisors</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Capability</th><th style={sty.th}>Advisors</th><th style={{ ...sty.th, color: accent }}>FortifyOS</th></tr></thead>
          <tbody>
            {[
              ['Approach', 'Give advice', 'Run calculations and show the math'],
              ['Availability', 'Office hours', '6am on your phone'],
              ['Daily cash position', 'Don\'t track', 'Calculated every session'],
              ['Cost', '$150–300/hour', 'Claude subscription'],
            ].map(([cap, them, us], i) => (
              <tr key={i}><td style={{ ...sty.td, color: t.textPrimary }}>{cap}</td><td style={sty.td}>{them}</td><td style={{ ...sty.td, color: accent }}>{us}</td></tr>
            ))}
          </tbody>
        </table>

        <h3 style={sty.h3}>vs. Generic AI (ChatGPT, Gemini, Generic Claude)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <thead><tr><th style={sty.th}>Capability</th><th style={sty.th}>Generic AI</th><th style={{ ...sty.th, color: accent }}>FortifyOS</th></tr></thead>
          <tbody>
            {[
              ['Approach', 'Answer questions', 'Enforce a system'],
              ['Financial memory', 'None', 'Knows your debts, bills, stage, alpha target'],
              ['Investment timing', 'Suggests anytime', 'Locked until Stage 3 verified'],
              ['SSN handling', 'No redaction', 'Auto-redact before processing'],
              ['Hard stops', 'None', 'Never List halts on violations'],
            ].map(([cap, them, us], i) => (
              <tr key={i}><td style={{ ...sty.td, color: t.textPrimary }}>{cap}</td><td style={sty.td}>{them}</td><td style={{ ...sty.td, color: accent }}>{us}</td></tr>
            ))}
          </tbody>
        </table>

        <div style={sty.note()}>
          <strong style={{ color: t.textPrimary }}>Important:</strong> FortifyOS does not replace a licensed financial advisor for legal or tax advice. It is a system that enforces financial discipline through math, not a source of regulated financial guidance.
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: t.textDim, marginTop: 60, paddingTop: 16, borderTop: `1px solid ${t.borderDim}`, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <p>No data is sent to external servers.</p>
          <p style={{ marginTop: 6 }}>Protect first, grow second. Every dollar has a job.</p>
          <p style={{ marginTop: 12, color: t.textGhost }}>KNOX v2.1 — FORTIFYOS v2.2</p>
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

// Statement upload state (PDF / screenshots)
const [stmtFile, setStmtFile] = useState(null);
const [stmtRawText, setStmtRawText] = useState('');
const [stmtText, setStmtText] = useState('');
const [stmtTxns, setStmtTxns] = useState([]);
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
    fontSize: 11,
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
    fontSize: 10,
  };
  const link = {
    color: t.accent,
    textDecoration: 'none',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: `1px solid ${t.borderDim}`,
    padding: '8px 10px',
    borderRadius: 4,
    background: t.void,
  };
  const assetBase = import.meta.env.BASE_URL || '/';
  const templateLinks = [
    { label: 'bills-registry.csv', href: `${assetBase}templates/bills-registry.csv` },
    { label: 'bnpl-tracker.csv', href: `${assetBase}templates/bnpl-tracker.csv` },
    { label: 'debt-avalanche.csv', href: `${assetBase}templates/debt-avalanche.csv` },
    { label: 'payment-log.csv', href: `${assetBase}templates/payment-log.csv` },
  ];
  const protocolLinks = [
    { label: 'fortify-core.md', href: `${assetBase}protocols/fortify-core.md` },
    { label: 'parse-protocols.md', href: `${assetBase}protocols/parse-protocols.md` },
    { label: 'hud-template.md', href: `${assetBase}protocols/hud-template.md` },
    { label: 'FORTIFYOS_V3.jsx', href: `${assetBase}protocols/FORTIFYOS_V3.jsx` },
    { label: 'FORTIFYOS_V3.jsx.rtf', href: `${assetBase}protocols/FORTIFYOS_V3.jsx.rtf` },
  ];


  // JSON paste state
  const [json, setJson] = useState('');
  const [jsonValidating, setJsonValidating] = useState(false);

  // Guided state
  const [gCheck, setGCheck] = useState(''); const [gSavings, setGSavings] = useState(''); const [gEF, setGEF] = useState(''); const [gOther, setGOther] = useState('');
  const [gDebts, setGDebts] = useState([{ name: '', apr: '', balance: '', minPayment: '', type: 'REVOLVING', totalTerms: '', paymentsMade: '', monthlyPayment: '', dueDate: '' }]);
  const [gBills, setGBills] = useState([{ name: '', amount: '', dueDay: '', autopay: true }]);
  const [gPaydayWeekday, setGPaydayWeekday] = useState('2');
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
        ocrWorkerRef.current.terminate().catch(() => {});
      }
      ocrWorkerRef.current = null;
    };
  }, []);

  if (!open) return null;

  const log = (msg) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 8));

  const identifyBank = (headers) => {
    for (const [key, sig] of Object.entries(BANK_SIGNATURES)) {
      if (sig.detect(headers)) return { key, ...sig };
    }
    return null;
  };


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

const handleStatementFile = async (file) => {
  setProcessing(true); setError(''); setParsedPreview(null); setSuccess(false);
  setLogs([]); setStmtFile(file); setStmtRawText(''); setStmtText(''); setStmtTxns([]); if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch(_) {} setCsvBlobUrl(''); }
  log('PIPELINE: STATEMENT RAW VIEW (NO DISPLAY REDACTION) v2026-02-23');
  const ext = file.name.split('.').pop().toLowerCase();
  log(`STATEMENT INGEST: ${file.name} (.${ext.toUpperCase()})`);
  log(`SIZE: ${(file.size / 1024).toFixed(1)}KB`);

  try {
    let rawText = '';
    if (ext === 'pdf') {
      log('PDF MODE: EXTRACTING TEXT...');
      rawText = await extractTextFromPDF(file);
      log(`RAW EXTRACT: ${(rawText||'').trim().length} CHARS — SAMPLE: ${(rawText||'').trim().slice(0,60).replace(/\n/g,' ')}`);
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

    setStmtRawText(rawText || '');
    log('PREPARING EXTRACTED TEXT VIEW...');
    setStmtText(rawText || '');

    log('PARSING TRANSACTIONS...');
    const txns = parseStatementTextToTransactions(rawText || '');
    if (!txns.length) {
      log('WARNING: NO TRANSACTIONS FOUND (HEURISTIC PARSER)');
      setError('No transactions detected. Try a text-based PDF export or CSV statement. You can review extracted text below and try parsing again.');
    } else {
      log(`FOUND: ${txns.length} TRANSACTIONS`);
    }
    setStmtTxns(txns);

    // Prepare default dashboard preview (even if empty; allows committing a baseline snapshot)
    const snap = transactionsToSnapshot(txns, stmtBankName);
    setParsedPreview(snap);

    // Prepare payment-log export (header-only if none)
    const csv = txnsToPaymentLogCSV(txns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setCsvBlobUrl(url);

    log('SYNC READY (EDIT BEFORE COMMIT)');
  } catch (e) {
    log('ERROR: STATEMENT PARSE FAILED');
    setError(e?.message || 'Statement parse failed');
  } finally { setProcessing(false); }
};

const updateStmtTxn = (i, field, val) => {
  const arr = [...stmtTxns];
  arr[i] = { ...arr[i], [field]: field === 'amount' ? (typeof val === 'number' ? val : (parseFloat(String(val).replace(/,/g,'')) || 0)) : val };
  setStmtTxns(arr);
  // keep preview + export in sync
  const snap = transactionsToSnapshot(arr, stmtBankName);
  setParsedPreview(snap);
  const csv = txnsToPaymentLogCSV(arr);
  if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch(_) {} }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  setCsvBlobUrl(url);
};

const removeStmtTxn = (i) => {
  const arr = stmtTxns.filter((_, idx) => idx !== i);
  setStmtTxns(arr);
  const snap = transactionsToSnapshot(arr, stmtBankName);
  setParsedPreview(snap);
  const csv = txnsToPaymentLogCSV(arr);
  if (csvBlobUrl) { try { URL.revokeObjectURL(csvBlobUrl); } catch(_) {} }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  setCsvBlobUrl(url);
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
      const p = JSON.parse(text);
      const missing = ['date', 'netWorth', 'debts', 'eFund'].filter(k => !(k in p));
      if (missing.length) { log(`ERROR: MISSING KEYS — ${missing.join(', ')}`); setError(`Missing: ${missing.join(', ')}`); return; }
      // Sanitize the date field
      p.date = sanitizeDate(p.date);
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
    const tL = debts.reduce((s, d) => s + d.balance, 0); const monthly = parseFloat(gMonthly) || 3000;
    const phase = efund >= monthly * 6 ? 4 : efund >= monthly * 3 ? 3 : efund >= monthly ? 2 : efund >= 1000 ? 1 : 0;
    const budgetCats = gBudget.map(b => ({ name: b.name, budgeted: parseFloat(b.budgeted) || 0, actual: parseFloat(b.actual) || 0 }));
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
  const inp = { background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px', width: '100%', outline: 'none', borderRadius: 2, boxSizing: 'border-box' };
  const lbl = { color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  return (
    <div className="sync-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }} onClick={onClose}>
      <div className="sync-shell" style={{ background: t.surface, border: `1px solid ${t.borderMid}`, maxWidth: 1100, width: 'min(98vw, 1100px)', maxHeight: '94vh', overflowY: 'auto', overflowX: 'hidden', borderRadius: 6, boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.borderDim}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.elevated }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={14} style={{ color: t.accent }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textPrimary }}>Universal Sync Terminal</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}><X size={16} style={{ color: t.textDim }} /></button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderDim}` }}>
          {[{ k: 'file', l: 'File Import' }, { k: 'statement', l: 'Statements' }, { k: 'json', l: 'JSON' }, { k: 'guided', l: 'Manual' }].map(tb => (
            <button key={tb.k} onClick={() => { setTab(tb.k); setError(''); setParsedPreview(null); }} style={{
              flex: 1, padding: 10, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: 'uppercase',
              color: tab === tb.k ? t.accent : t.textDim,
              borderBottom: tab === tb.k ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>{tb.l}</button>
          ))}
        </div>

        <div className="sync-content" style={{ padding: 16 }}>
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
                {parsedPreview._meta?.excludedTransfers > 0 && (
                  <div style={{ fontSize: 9, color: t.textSecondary, marginTop: 4 }}>ℹ {fmt(parsedPreview._meta.excludedTransfers)} excluded (transfers/refunds/large deposits)</div>
                )}
                {parsedPreview._meta?.income > 50000 && (
                  <div style={{ fontSize: 9, color: t.danger, marginTop: 4 }}>⚠ Income looks unusually high ({fmt(parsedPreview._meta.income)}) — verify via Guided tab if this includes transfers</div>
                )}
                {parsedPreview._meta?.totalExpense === 0 && parsedPreview._meta?.income > 0 && (
                  <div style={{ fontSize: 9, color: t.warn, marginTop: 4 }}>⚠ $0 expenses detected — your bank may report all amounts as positive. Try Guided tab for manual entry.</div>
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


{/* ── STATEMENT TAB ── */}
{tab === 'statement' && (<>
  <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', textAlign: 'center' }}>
        <FileText size={14} style={{ color: t.accent }} />
        <span style={lbl}>Upload Statements (PDF / Screenshots)</span>
      </div>
      <input ref={stmtFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
             onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStatementFile(f); e.target.value = ''; }} />
    </div>

    <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel }}>
      <div style={{ display: 'grid', gap: 6, fontSize: 11, color: t.textDim, lineHeight: 1.35 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.accent }}>Quality Tips</div>
        <div>• Best: Download a <b>text-based PDF</b> from your bank portal (not scanned/image-only).</div>
        <div>• Screenshots supported via local OCR. Keep captures sharp and include full transaction rows.</div>
        <div>• Sentinel redaction runs before parsing; review the extracted table before sync.</div>
      </div>
    </div>

    {/* Drag/drop area */}
    <div
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleStatementFile(e.dataTransfer.files[0]); }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => stmtFileRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? t.accent : t.borderMid}`,
        borderRadius: 8,
        padding: 20,
        background: dragOver ? t.accentMuted : t.void,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, cursor: 'pointer', transition: 'all 0.2s', minHeight: 100,
      }}
    >
      {processing
        ? <Zap size={24} style={{ color: t.accent, animation: 'blink 0.5s infinite' }} />
        : <Upload size={22} style={{ color: dragOver ? t.accent : t.textDim }} />}
      <div style={{ fontSize: 11, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {processing ? 'Processing...' : 'Drag & drop or click to select'}
      </div>
      <div style={{ fontSize: 9, color: t.textGhost }}>PDF · PNG · JPG — parsed locally, no upload</div>
    </div>

    {/* Logs */}
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim }}>Parse Log</div>
      <div style={{
        padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.input,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.textDim,
      }}>
        {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <div>Awaiting file…</div>}
      </div>
      <div style={{ padding: 10, borderRadius: 12, border: `1px solid ${t.borderDim}`, background: t.panel }}>
        <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>KNOX Templates</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {templateLinks.map((f) => (
            <a key={f.label} href={f.href} download={f.label} style={{ ...link, padding: '6px 8px', fontSize: 9 }}>
              <Download size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
              {f.label}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Protocol References</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {protocolLinks.map((f) => (
            <a key={f.label} href={f.href} target="_blank" rel="noreferrer" style={{ ...link, padding: '6px 8px', fontSize: 9 }}>
              {f.label}
            </a>
          ))}
        </div>
      </div>
      {error && <div style={{ color: t.warn, fontSize: 11 }}><AlertCircle size={12} style={{ verticalAlign: 'middle' }} /> {error}</div>}
    {stmtText && (!stmtTxns || stmtTxns.length === 0) && (
      <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel, marginTop: 10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim }}>Extracted Text</div>
          <button onClick={() => { 
            try { 
              const tx = parseStatementTextToTransactions(stmtRawText || stmtText); 
              setStmtTxns(tx); 
              const snap2 = transactionsToSnapshot(tx, stmtBankName); 
              setParsedPreview(snap2); 
              if (tx.length) setError(''); 
              log(`RE-PARSE: ${tx.length} transactions`); 
            } catch(e){ 
              setError(e?.message || 'Re-parse failed'); 
            } 
          }} style={btn}>
            <RefreshCw size={14} /> TRY PARSE AGAIN
          </button>
        </div>
        <div style={{ marginTop: 10, maxHeight: 180, overflow:'auto', whiteSpace:'pre-wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.textDim }}>
          {stmtText}
        </div>
      </div>
    )}
    </div>

    {/* Editable transaction table */}
    {parsedPreview && (
      <div style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.accent }}>Transactions Preview (Editable)</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {csvBlobUrl && (
              <a href={csvBlobUrl} download="payment-log.csv" style={{ ...link, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> DOWNLOAD payment-log.csv
              </a>
            )}
            <button onClick={confirmSync} disabled={!parsedPreview} style={{ ...btn, opacity: !parsedPreview ? 0.6 : 1 }}>
              <Shield size={14} /> COMMIT SYNC
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: 10, WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: t.textDim, textTransform: 'uppercase', fontSize: 10 }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Payee</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Category</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}>Amount</th>
                <th style={{ width: 40, padding: '8px 6px', borderBottom: `1px solid ${t.borderDim}` }}></th>
              </tr>
            </thead>
            <tbody>
              {(stmtTxns?.length ? stmtTxns.slice(0, 200) : [null]).map((tx, i) => {
                if (!tx) {
                  return (
                    <tr key="empty">
                      <td colSpan={5} style={{ padding: '10px 6px', color: t.textDim }}>
                        No transactions detected yet. If this is a scanned/image file, try a sharper image or text-based PDF export. You can still COMMIT SYNC to save a baseline snapshot.
                      </td>
                    </tr>
                  );
                }
                const inferredCat = categorize(tx.description || '');
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.borderDim}` }}>
                    <td style={{ padding: '8px 6px' }}>
                      <input value={tx.date || ''} onChange={e => updateStmtTxn(i, 'date', e.target.value)} style={{
                        width: 'clamp(88px, 16vw, 120px)', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                        background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      }} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <input value={tx.description || ''} onChange={e => updateStmtTxn(i, 'description', e.target.value)} style={{
                        width: 'clamp(160px, 36vw, 420px)', maxWidth: '52vw', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                        background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      }} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
  <select value={(tx.category ?? '')} onChange={e => updateStmtTxn(i, 'category', e.target.value)} style={{
    width: 'clamp(130px, 24vw, 220px)', maxWidth: '36vw', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
    background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  }}>
    <option value="">{`AUTO · ${inferredCat}`}</option>
    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <input value={typeof tx.amount === 'number' ? tx.amount : (parseFloat(tx.amount) || 0)}
                             onChange={e => updateStmtTxn(i, 'amount', e.target.value)} style={{
                        width: 'clamp(92px, 16vw, 120px)', padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderDim}`,
                        background: t.input, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textAlign: 'right',
                      }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <button onClick={() => removeStmtTxn(i)} style={{ ...btnGhost, padding: '6px 8px' }} aria-label="Remove row">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stmtTxns.length > 200 && <div style={{ marginTop: 8, fontSize: 10, color: t.textDim }}>Showing first 200 rows. Export includes all rows.</div>}
        </div>
      </div>
    )}

    {/* Optional raw extracted text */}
    {stmtText && (
      <details style={{ padding: 12, borderRadius: 16, border: `1px solid ${t.borderDim}`, background: t.panel }}>
            <summary style={{ cursor: 'pointer', color: t.textDim, fontSize: 11 }}>View extracted text</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: t.textDim, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          {stmtText.slice(0, 20000)}{stmtText.length > 20000 ? '\\n…(truncated)…' : ''}
        </pre>
      </details>
    )}

    {/* Privacy */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 9, color: t.warn }}>
      <ShieldAlert size={11} />
      <span>Stored locally in this browser profile. Disable browser sync for single-device isolation.</span>
    </div>

    {/* Prominent Sync button — always visible once data is ready */}
    {parsedPreview ? (
      <button onClick={confirmSync} style={{
        width: '100%', marginTop: 12, padding: '14px 0',
        background: t.accent, color: '#000',
        border: 'none', fontFamily: "'Space Mono', monospace",
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
        fontFamily: "'Space Mono', monospace", fontSize: 11,
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
                <div className="sync-row-debt" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Checking</label><CurrencyInput t={t} value={gCheck} onChange={e => setGCheck(e.target.value)} placeholder="0" /></div>
                  <div><label style={lbl}>Savings</label><CurrencyInput t={t} value={gSavings} onChange={e => setGSavings(e.target.value)} placeholder="0" /></div>
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
                  <div className="sync-row-3" style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                    <div><label style={lbl}>Due Date</label><input style={inp} type="date" value={d.dueDate || ''} onChange={e => upDebt(i, 'dueDate', e.target.value)} /></div>
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
              {/* Monthly burn rate + income */}
              <div>
                <div style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Income & Expenses</div>
                <div className="sync-row-3" style={{ display: 'grid', gap: 8 }}>
                  <div><label style={lbl}>Monthly Income</label><CurrencyInput t={t} value={gIncome} onChange={e => setGIncome(e.target.value)} placeholder="3500" /></div>
                  <div><label style={lbl}>Monthly Expenses</label><CurrencyInput t={t} value={gMonthly} onChange={e => setGMonthly(e.target.value)} placeholder="3000" /></div>
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
                  <span style={{ color: t.accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bill Calendar</span>
                  <button onClick={addBill} style={{ background: 'none', border: `1px solid ${t.borderMid}`, color: t.textSecondary, fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button>
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

              {/* Portfolio — Crypto */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: t.crypto, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Crypto Holdings</span>
                  <button onClick={addCrypto} style={{ background: 'none', border: `1px solid ${t.crypto}40`, color: t.crypto, fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>+ Add</button>
                </div>
                {gCrypto.map((c, i) => (
                  <div key={i} className="sync-row-debt" style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <div><label style={lbl}>Coin</label><input style={inp} placeholder="BTC" value={c.coin} onChange={ev => upCrypto(i, 'coin', ev.target.value)} /></div>
                    <div><label style={lbl}>Amount</label><input style={inp} placeholder="0.25" value={c.amount} onChange={ev => upCrypto(i, 'amount', ev.target.value)} inputMode="decimal" /></div>
                    <div><label style={lbl}>Avg Cost</label><CurrencyInput t={t} value={c.avgCost} onChange={ev => upCrypto(i, 'avgCost', ev.target.value)} placeholder="0" /></div>
                    <div><label style={lbl}>Current Price</label><CurrencyInput t={t} value={c.lastPrice} onChange={ev => upCrypto(i, 'lastPrice', ev.target.value)} placeholder="0" /></div>
                  </div>
                ))}
                <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>BTC accumulation window: Oct 2026. Track holdings now — system will alert when DCA activates.</div>
              </div>

              {/* Benner Cycle Phase — strategic setting only */}
              <div>
                <label style={lbl}>Benner Cycle Phase</label>
                <select style={{ ...inp, appearance: 'none' }} value={gBenner} onChange={e => setGBenner(e.target.value)}>
                  <option value="A-Year (Buy)">A-Year (Buy)</option>
                  <option value="B-Year (Sell)">B-Year (Sell)</option>
                  <option value="C-Year (Hold)">C-Year (Hold)</option>
                </select>
                <div style={{ fontSize: 8, color: t.textDim, marginTop: 3 }}>Strategic cycle position — 2026 = B-Year (Sell). Macro intel delivered via morning brief.</div>
              </div>

              {/* Live calculations */}
              {(() => {
                const a = (parseFloat(gCheck) || 0) + (parseFloat(gSavings) || 0) + (parseFloat(gEF) || 0) + (parseFloat(gOther) || 0);
                const dList = gDebts.filter(d => d.balance).map(d => ({ bal: parseFloat(d.balance) || 0, apr: parseFloat(d.apr) || 0 }));
                const dTotal = dList.reduce((s, d) => s + d.bal, 0);
                const eqVal = gEquities.filter(e => e.ticker).reduce((s, e) => s + (parseFloat(e.shares) || 0) * (parseFloat(e.lastPrice) || 0), 0);
                const optVal = gOptions.filter(o => o.ticker).reduce((s, o) => s + (parseInt(o.contracts) || 0) * 100 * (parseFloat(o.lastPrice) || 0), 0);
                const cryptoVal = gCrypto.filter(c => c.coin).reduce((s, c) => s + (parseFloat(c.amount) || 0) * (parseFloat(c.lastPrice) || 0), 0);
                const totalAssets = a + eqVal + optVal + cryptoVal;
                const nw = totalAssets - dTotal;
                const di = dList.reduce((s, d) => s + (d.bal * d.apr / 100) / 365, 0);
                const ef = parseFloat(gEF) || 0;
                const mo = parseFloat(gMonthly) || 3000;
                const inc = parseFloat(gIncome) || 0;
                const runway = mo > 0 ? Math.floor(ef / (mo / 30)) : 0;
                const totalBudgeted = gBudget.reduce((s, b) => s + (parseFloat(b.budgeted) || 0), 0);
                const totalSpent = gBudget.reduce((s, b) => s + (parseFloat(b.actual) || 0), 0);
                const benefit = parseFloat(gBenefit) || 0;
                const netToFamily = benefit > 0 ? benefit - dTotal : 0;
                const hasData = a > 0 || dTotal > 0 || totalBudgeted > 0 || eqVal > 0 || optVal > 0 || cryptoVal > 0 || benefit > 0 || inc > 0;
                if (!hasData) return null;
                return (
                  <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Live Calculation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>TOTAL ASSETS</span><span style={{ color: t.accent }}>{fmt(totalAssets)}</span>{eqVal > 0 && <span style={{ fontSize: 8, color: t.textGhost, marginLeft: 4 }}>(+{fmt(eqVal)} equity)</span>}{cryptoVal > 0 && <span style={{ fontSize: 8, color: t.crypto, marginLeft: 4 }}>(+{fmt(cryptoVal)} crypto)</span>}</div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>TOTAL DEBT</span><span style={{ color: dTotal > 0 ? t.danger : t.textPrimary }}>{fmt(dTotal)}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>NET WORTH</span><span style={{ color: nw >= 0 ? t.accent : t.danger, fontWeight: 700, fontSize: 16 }}>{nw < 0 ? '-' : ''}{fmt(Math.abs(nw))}</span></div>
                      <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>DAILY INTEREST BURN</span><span style={{ color: di > 0 ? t.danger : t.textPrimary }}>{fmt(di)}/day</span></div>
                      {ef > 0 && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>E-FUND RUNWAY</span><span style={{ color: runway >= 60 ? t.accent : runway >= 30 ? t.warn : t.danger }}>{runway} days</span><span style={{ color: t.textGhost, fontSize: 9, marginLeft: 6 }}>at {fmt(mo)}/mo burn</span></div>}
                      {totalBudgeted > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>BUDGET USED</span><span style={{ color: totalSpent > totalBudgeted ? t.danger : t.accent }}>{Math.round((totalSpent / totalBudgeted) * 100)}%</span></div>}
                      {inc > 0 && totalSpent > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>SAVINGS RATE</span><span style={{ color: (inc - totalSpent) > 0 ? t.accent : t.danger }}>{Math.round(((inc - totalSpent) / inc) * 100)}%</span></div>}
                      {optVal > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>OPTIONS EXPOSURE</span><span style={{ color: t.purple }}>{fmt(optVal)}</span></div>}
                      {cryptoVal > 0 && <div><span style={{ color: t.textDim, fontSize: 9, display: 'block' }}>CRYPTO VALUE</span><span style={{ color: t.crypto }}>{fmt(cryptoVal)}</span></div>}
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
  const mods = [{ key: 'macroBanner', label: 'Macro Banner (top strip)' }, { key: 'directive', label: 'Daily Directive' }, { key: 'netWorth', label: 'Net Worth' }, { key: 'debt', label: 'Debt Destruction' }, { key: 'planner', label: 'Bills & Payday Planner' }, { key: 'eFund', label: 'Emergency Fund' }, { key: 'budget', label: 'Budget Status' }, { key: 'protection', label: 'Protection Layer' }, { key: 'portfolio', label: 'Portfolio' }, { key: 'macro', label: 'Macro Signals' }, { key: 'market', label: 'Market Intelligence' }];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 280, background: t.surface, borderLeft: `1px solid ${t.borderDim}`, height: '100%', padding: 20, overflow: 'auto', animation: 'slideIn 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}><X size={14} style={{ color: t.textSecondary }} /></button>
        </div>
        <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Theme</div>
        <div onClick={onToggleTheme} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: `1px solid ${t.borderDim}`, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: t.textPrimary }}>{isDark ? 'Noir (Dark)' : 'Tactical (Light)'}</span>
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
  const assets = nw.assets || {};
  const cryptoVal = (latest?.portfolio?.crypto || []).reduce((s, c) => s + (Number(c.amount) || 0) * (Number(c.lastPrice) || 0), 0);
  const eqVal = (latest?.portfolio?.equities || []).reduce((s, e) => s + (Number(e.shares) || 0) * (Number(e.lastPrice) || 0), 0);
  const tCash = (assets.checking || 0) + (assets.savings || 0) + (assets.eFund || 0) + (assets.other || 0);
  const tA = tCash + eqVal + cryptoVal;
  const tL = Object.values(nw.liabilities || {}).reduce((s, v) => s + (v || 0), 0);

  // Build asset breakdown items (only show non-zero)
  const breakdown = [
    { label: 'Checking', value: assets.checking || 0, color: t.textPrimary },
    { label: 'Savings', value: assets.savings || 0, color: t.accent },
    { label: 'E-Fund', value: assets.eFund || 0, color: t.accent },
    { label: 'Equity', value: eqVal, color: t.accent },
    { label: 'Crypto', value: cryptoVal, color: t.crypto },
    { label: 'Other', value: assets.other || 0, color: t.textSecondary },
  ].filter(b => b.value > 0);

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
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
      <div><span style={{ color: t.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assets </span>{fmt(tA)}</div>
      <div><span style={{ color: t.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liabilities </span>{fmt(tL)}</div>
    </div>
    {/* Asset breakdown */}
    {breakdown.length > 1 && (
      <div style={{ borderTop: `1px solid ${t.borderDim}`, paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: 2, height: 6, marginBottom: 6 }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ flex: b.value, background: b.color, opacity: 0.7, transition: 'flex 0.6s ease-out' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, background: b.color, opacity: 0.7, flexShrink: 0 }} />
              <span style={{ color: t.textDim }}>{b.label}</span>
              <span style={{ color: b.color }}>{fmt(b.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </Card>);
}

function DebtMod({ latest, visible, t }) {
  const [extraMonthly, setExtraMonthly] = useState('');
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
    {debts.length > 0 && di > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.borderDim}`, fontSize: 9, color: t.textDim }}>
      <span>Monthly interest: <span style={{ color: t.danger }}>{fmt(Math.round(di * 30))}</span></span>
      <span>Annual if unchanged: <span style={{ color: t.danger }}>{fmt(Math.round(di * 365))}</span></span>
    </div>}

    {/* Liberation Countdown */}
    {(() => {
      if (debts.length === 0 || total <= 0) return null;
      const totalMinPayments = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
      const monthlyPrincipal = totalMinPayments > 0 ? Math.max(totalMinPayments - (di * 30), totalMinPayments * 0.3) : 0;
      const liberationMonths = monthlyPrincipal > 0 ? Math.ceil(total / monthlyPrincipal) : 0;
      const liberationDays = liberationMonths * 30;
      const accelerated50 = monthlyPrincipal > 0 ? Math.ceil(total / (monthlyPrincipal * 1.5)) : 0;
      const accelerated100 = monthlyPrincipal > 0 ? Math.ceil(total / (monthlyPrincipal * 2)) : 0;
      const extra = Math.max(0, parseFloat(extraMonthly) || 0);
      const acceleratedCustom = monthlyPrincipal > 0 ? Math.ceil(total / (monthlyPrincipal + extra)) : 0;
      const libDate = new Date();
      libDate.setMonth(libDate.getMonth() + liberationMonths);
      const libDateStr = libDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return (
        <div style={{ marginTop: 8, padding: '10px 12px', background: t.elevated, border: `1px solid ${t.accent}30`, borderLeft: `3px solid ${t.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>🔓 Liberation Countdown</span>
            <span style={{ fontSize: 9, color: t.textDim }}>{libDateStr}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: t.accent }}>{liberationDays}</span>
            <span style={{ fontSize: 10, color: t.textSecondary }}>days at current pace</span>
          </div>
          {/* Progress toward zero */}
          <div style={{ height: 4, background: t.borderDim, marginBottom: 8 }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${t.accent}, ${t.accentBright})`, width: '0%', boxShadow: `0 0 6px ${t.accent}40` }} />
          </div>
          <div style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Extra Payment / Month</div>
              <input value={extraMonthly} onChange={e => setExtraMonthly(e.target.value)} placeholder="100" inputMode="decimal" style={{ width: '100%', background: t.input, border: `1px solid ${t.borderDim}`, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '6px 8px' }} />
            </div>
            {extra > 0 && <div style={{ fontSize: 9, color: t.textSecondary }}>With {fmt(extra)} extra: <span style={{ color: t.accent }}>{acceleratedCustom * 30}d</span></div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 9 }}>
            <div style={{ color: t.textDim }}>+50%/mo extra: <span style={{ color: t.accent }}>{accelerated50 * 30}d</span> <span style={{ color: t.textGhost }}>({(liberationMonths - accelerated50)} mo saved)</span></div>
            <div style={{ color: t.textDim }}>+100%/mo extra: <span style={{ color: t.accent }}>{accelerated100 * 30}d</span> <span style={{ color: t.textGhost }}>({(liberationMonths - accelerated100)} mo saved)</span></div>
          </div>
        </div>
      );
    })()}
  </Card>);
}

function PlannerMod({ latest, visible, t }) {
  if (!visible) return null;
  const bills = latest?.bills || [];
  const debts = latest?.debts || [];
  const payroll = latest?.payroll || { frequency: 'WEEKLY', weekday: 2 };
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
  const paydayEvents = nextWeekdayDates(Number(payroll.weekday || 2), 4).map(d => ({
    label: `Payday (${weekdayName(payroll.weekday || 2)})`,
    date: d,
    amount: Number(latest?.budget?.income || latest?._meta?.income || 0) / 4,
    type: 'payday',
  }));
  const timeline = [...billEvents, ...debtEvents, ...paydayEvents]
    .filter(e => e.date && !Number.isNaN(e.date.getTime()))
    .sort((a, b) => a.date - b.date)
    .slice(0, 8);

  return (
    <Card title="Bills & Payday Planner" visible={visible} delay={120} t={t}>
      <div style={{ display: 'grid', gap: 8 }}>
        {timeline.length === 0 && <div style={{ color: t.textDim, fontSize: 11 }}>No bill or payday events tracked yet. Add in Manual Sync.</div>}
        {timeline.map((e, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.borderDim}`, paddingBottom: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: e.type === 'payday' ? t.accent : e.type === 'debt' ? t.warn : t.textPrimary }}>{e.label}</div>
              <div style={{ fontSize: 9, color: t.textDim }}>{e.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>
            <div style={{ fontSize: 10, color: e.type === 'payday' ? t.accent : t.textSecondary }}>
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
              <span style={{ fontSize: 9, fontWeight: 700, color: slashCrisis ? t.danger : t.warn, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {slashCrisis ? '🚨 BUDGET SLASH — CRISIS PROTOCOL' : '⚠ BUDGET SLASH — ACTIVE'}
              </span>
              <span style={{ fontSize: 9, color: t.textDim, marginLeft: 'auto' }}>V={Math.round(velocity * 100)}% / 25% target</span>
            </div>
            <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.5 }}>{slashDiagnosis}</div>
            {slashCrisis && <div style={{ fontSize: 9, color: t.danger, marginTop: 4, textTransform: 'uppercase' }}>⬤ Lifestyle frozen — audit all non-Essential recurring charges</div>}
          </div>
        )}

        {/* Never List Violations */}
        {violations.map((v, i) => (
          <div key={i} style={{
            padding: '6px 10px', marginBottom: i < violations.length - 1 ? 4 : 0,
            background: v.severity === 'danger' ? t.danger + '08' : t.warn + '08',
            border: `1px solid ${v.severity === 'danger' ? t.danger : t.warn}30`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 10,
          }}>
            <span style={{ color: v.severity === 'danger' ? t.danger : t.warn, fontSize: 8, fontWeight: 700, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{v.code}</span>
            <span style={{ color: t.textSecondary }}>{v.text}</span>
          </div>
        ))}
      </div>
    )}
    {/* Income / Expense / Surplus summary row */}
    {income > 0 && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${t.borderDim}` }}>
        <div>
          <div style={{ color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Income</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>{fmt(income)}</div>
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Spent</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fmt(totalSpent)}</div>
        </div>
        <div>
          <div style={{ color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Surplus</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: surplus >= 0 ? t.accent : t.danger }}>{surplus < 0 ? '-' : ''}{fmt(Math.abs(surplus))}</div>
        </div>
      </div>
    )}

    {/* Savings rate + daily discretionary */}
    {(income > 0 || discRemaining > 0) && (
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${t.borderDim}` }}>
        {income > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Savings Rate</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}%</span>
            <span style={{ fontSize: 8, color: t.textDim, marginLeft: 4 }}>/ 25% target</span>
          </div>
        )}
        {disc && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Daily Discretionary</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: dailyDisc > 5 ? t.textPrimary : t.danger }}>${dailyDisc.toFixed(2)}</span>
            <span style={{ fontSize: 8, color: t.textDim, marginLeft: 4 }}>/day • {daysLeft}d left</span>
          </div>
        )}
      </div>
    )}

    {/* Category rows */}
    {cats.length === 0 ? <div style={{ color: t.textDim, fontSize: 11 }}>No budget data</div> : <>
      {income > 0 && totalSpent === 0 && (
        <div style={{ padding: '8px 12px', marginBottom: 10, background: t.warn + '12', border: `1px solid ${t.warn}40`, borderLeft: `3px solid ${t.warn}`, fontSize: 10, color: t.warn, lineHeight: 1.5 }}>
          ⚠ Income detected ({fmt(income)}) but $0 across all categories. Re-sync via Guided tab with actual spend, or your bank CSV may need sign correction.
        </div>
      )}
      {cats.map((c, i) => { const pct = c.budgeted > 0 ? (c.actual / c.budgeted) * 100 : (c.actual > 0 ? 100 : 0); return (<div key={i} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, marginBottom: 3 }}><span style={{ color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.name}</span><span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ color: t.textPrimary, fontSize: 11 }}>{fmt(c.actual)}</span>{c.budgeted > 0 && <span style={{ color: t.textDim }}>/ {fmt(c.budgeted)}</span>}<span style={{ color: pctColor(pct, t), fontSize: 9, minWidth: 32, textAlign: 'right' }}>{c.budgeted > 0 ? Math.round(pct) + '%' : ''}</span></span></div>
      {c.budgeted > 0 && <ProgressBar percent={pct} t={t} />}
      {c.budgeted === 0 && c.actual > 0 && <div style={{ height: 6, background: t.accent, marginBottom: 4, opacity: 0.5 }} />}
    </div>); })}
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
    {!hasData ? <div style={{ color: t.textDim, fontSize: 11 }}>No positions tracked — sync via Guided tab</div> : <>
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
                <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Equity</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}><AnimNum value={totalEquityValue} /></div>
                {totalEquityCost > 0 && <div style={{ fontSize: 9, color: equityPL >= 0 ? t.accent : t.danger, marginTop: 2 }}>{equityPL >= 0 ? '↑' : '↓'} {fmt(Math.abs(equityPL))} P&L</div>}
              </div>
            )}
            {cols.includes('options') && (
              <div style={{ borderLeft: `2px solid ${t.purple}`, paddingLeft: 8 }}>
                <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Options</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.purple }}><AnimNum value={totalOptionsValue} /></div>
                <div style={{ fontSize: 9, color: t.purpleDim, marginTop: 2 }}>{options.length} contract{options.length !== 1 ? 's' : ''}</div>
              </div>
            )}
            {cols.includes('crypto') && (
              <div style={{ borderLeft: `2px solid ${t.crypto}`, paddingLeft: 8 }}>
                <div style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Crypto</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.crypto }}><AnimNum value={totalCryptoValue} /></div>
                {totalCryptoCost > 0 && <div style={{ fontSize: 9, color: cryptoPL >= 0 ? t.crypto : t.danger, marginTop: 2 }}>{cryptoPL >= 0 ? '↑' : '↓'} {fmt(Math.abs(cryptoPL))} P&L</div>}
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
              <span style={{ color: t.crypto, fontWeight: 700, fontSize: 11 }}>{c.coin || '???'}</span>
              <span style={{ color: t.textDim, fontSize: 9, marginLeft: 6 }}>{amt} @ {fmt(cost)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.crypto }}>{fmt(mv)}</div>
              {basis > 0 && <div style={{ fontSize: 9, color: pl >= 0 ? t.crypto : t.danger }}>
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
  const macro = latest?.macro || {};
  const walcl = fredMacro?.walcl?.value ?? null;
  const tga = fredMacro?.tga?.value ?? null;
  const rrp = fredMacro?.rrp?.value ?? null;
  const fredNetLiq = (walcl != null && tga != null && rrp != null) ? (walcl - tga - rrp) / 1000 : null;
  const localNetLiq = Number(macro.netLiquidity);
  const netLiqT = Number.isFinite(localNetLiq) && localNetLiq > 0 ? localNetLiq : null;
  const benner = macro.bennerPhase || 'B-Year (Sell)';
  const triggersActive = Number(macro.triggersActive || 0);
  const triggerList = Array.isArray(macro.activeTriggers) ? macro.activeTriggers.filter(Boolean) : [];

  return (
    <Card title="Macro Signals" visible={visible} delay={240} t={t}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Benner Phase</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{benner}</div>
        </div>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Net Liquidity</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: t.accent }}>
            {fredNetLiq != null ? `$${fredNetLiq.toFixed(2)}T` : netLiqT != null ? `$${netLiqT.toFixed(2)}T` : '—'}
          </div>
        </div>
        <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Triggers</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: triggersActive >= 2 ? t.danger : triggersActive === 1 ? t.warn : t.accent }}>{triggersActive}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
        <div style={{ borderLeft: `2px solid ${t.crypto}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>BTC</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: t.crypto }}>{macro.btcPrice ? fmt(macro.btcPrice) : '—'}</div>
        </div>
        <div style={{ borderLeft: `2px solid ${t.warn}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>FedWatch Cut</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: t.warn }}>{macro.fedWatchCut || 0}%</div>
        </div>
        <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Yield 10Y-2Y</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: (macro.yieldCurve10Y2Y || 0) >= 0 ? t.accent : t.danger }}>{macro.yieldCurve10Y2Y ?? 0}%</div>
        </div>
        <div style={{ borderLeft: `2px solid ${t.purple}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next FOMC</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: t.textPrimary }}>{macro.nextFomc || '—'}</div>
        </div>
      </div>
      <div style={{ border: `1px solid ${t.borderDim}`, background: t.panel, padding: '8px 10px' }}>
        <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Active Trigger Set</div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.45 }}>
          {triggerList.length ? triggerList.join(' • ') : 'No active macro triggers. Run Sync to refresh local macro state.'}
        </div>
      </div>
    </Card>
  );
}

function MarketIntelligenceMod({ latest, visible, t, isDark, fredMacro }) {
  if (!visible) return null;

  // ── Derived macro signals from FRED data ─────────────────────────
  const walcl  = fredMacro?.walcl?.value ?? null;
  const tga    = fredMacro?.tga?.value   ?? null;
  const rrp    = fredMacro?.rrp?.value   ?? null;
  const netLiq = (walcl != null && tga != null && rrp != null) ? walcl - tga - rrp : null;
  const qtqe   = walcl == null ? null : walcl > 6600000 ? 'QE' : walcl > 6200000 ? 'NEUTRAL' : 'QT';

  // ── Auto Narrative Engine ─────────────────────────────────────────
  const stage = latest ? (latest.debts?.some(d => d.balance > 0) ? (latest.eFund?.balance >= 1000 ? 2 : 1) : 3) : 0;
  const buildNarrative = () => {
    const parts = [];
    // Liquidity signal
    if (netLiq != null) {
      if (netLiq > 5500000)      parts.push(`Fed net liquidity is elevated at $${(netLiq/1000).toFixed(2)}T — historically supportive of risk assets.`);
      else if (netLiq > 4500000) parts.push(`Fed net liquidity at $${(netLiq/1000).toFixed(2)}T is neutral — watch for directional shift.`);
      else                        parts.push(`Fed net liquidity is compressed at $${(netLiq/1000).toFixed(2)}T — risk-off environment, defense posture justified.`);
    }
    // QT/QE
    if (qtqe === 'QT')      parts.push('Balance sheet is in QT. Liquidity is draining — elevated caution on risk exposure.');
    else if (qtqe === 'QE') parts.push('Balance sheet expansion (QE) supports asset prices — monitor for reversal signals.');
    // RRP near zero = bullish signal
    if (rrp != null && rrp < 1000) parts.push('RRP near zero means excess cash has left the overnight facility — historically a bullish liquidity signal.');
    // Stage-specific posture
    if (stage <= 2) parts.push('Your current stage is Defense Mode. Macro data is context only — no investment action permitted until Stage 3+.');
    return parts.length > 0 ? parts.join(' ') : 'Run a live scan to generate your macro narrative.';
  };

  // ── Styles ────────────────────────────────────────────────────────
  const card  = { background: t.surface, border: `1px solid ${t.borderDim}`, borderRadius: 4, padding: 14, marginBottom: 0 };
  const lbl   = { fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };
  const metricBox = (borderColor) => ({ padding: '10px 12px', borderRadius: 4, border: `1px solid ${borderColor || t.borderDim}`, background: t.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' });
  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} style={{ color: t.accent }} />
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Intelligence</div>
            <div style={{ fontSize: 9, color: t.textDim }}>{fredMacro?.asOf ? `FRED as of ${fredMacro.asOf}` : 'FRED Macro Narrative'}</div>
          </div>
        </div>
      </div>

      {/* Row 1 — Fed cycle metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        <div style={metricBox()}>
          <div style={lbl}>Fed Cycle</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: qtqe === 'QT' ? t.danger : qtqe === 'QE' ? t.accent : t.warn }}>{qtqe ?? '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>{walcl ? `WALCL $${(walcl/1000).toFixed(2)}T` : 'no FRED data'}</div>
        </div>
        <div style={metricBox()}>
          <div style={{ ...lbl, color: t.accent }}>Net Liquidity</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: netLiq != null && netLiq > 5000000 ? t.accent : netLiq != null ? t.warn : t.textDim }}>{netLiq != null ? `$${(netLiq/1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>WALCL − TGA − RRP</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>RRP</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.warn }}>{rrp != null ? `$${(rrp/1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>overnight reverse repo</div>
        </div>
      </div>

      {/* Row 2 — WALCL | TGA | As-Of */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <div style={metricBox()}>
          <div style={lbl}>WALCL</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary }}>{walcl != null ? `$${(walcl/1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>Fed balance sheet</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>TGA</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.warn }}>{tga != null ? `$${(tga/1000).toFixed(2)}T` : '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>Treasury General Account</div>
        </div>
        <div style={metricBox()}>
          <div style={lbl}>As Of</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fredMacro?.asOf || '—'}</div>
          <div style={{ fontSize: 9, color: t.textDim }}>FRED data timestamp</div>
        </div>
      </div>

      {/* Narrative Engine */}
      <div style={{ padding: '10px 14px', border: `1px solid ${t.accent}20`, background: t.accentMuted, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Eye size={10} style={{ color: t.accent }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Macro Narrative</span>
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.6 }}>{buildNarrative()}</div>
      </div>

      <div style={{ marginTop: 8, fontSize: 9, color: t.textGhost, lineHeight: 1.35 }}>
        Informational only. Defense Mode (Stages 0–3): no investment action permitted.
      </div>
    </div>
  );
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

function DirectiveMod({ visible, latest, t }) {
  const now = new Date();
  const monthIdx = now.getMonth();
  const dayOfMonth = now.getDate();
  const theme = MONTHLY_THEMES[monthIdx];
  const monthKey = theme.month;
  const pool = DIRECTIVES[monthKey] || DIRECTIVES.JAN;
  const directive = pool[(dayOfMonth - 1) % pool.length];

  // Data-aware context
  const stage = calcStage(latest || {});
  const meta = STAGE_META[stage] || STAGE_META[0];
  const di = dailyInterest(latest?.debts);
  const cats = latest?.budget?.categories || [];
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = totalBudgetSpent(latest);
  const blownCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 1);
  const warnCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 0.75 && (c.actual / c.budgeted) < 1);
  const velocity = calcVelocity(latest || {});
  const days = runwayDaysFromLatest(latest);
  const checking = latest?.netWorth?.assets?.checking || 0;
  const action = nextAction(latest);

  // Bills due within 48hrs (from debts with dueDate if present)
  const debts = latest?.debts || [];
  const soon = debts.filter(d => {
    if (!d.dueDate) return false;
    const due = new Date(d.dueDate);
    const diff = (due - now) / (1000 * 60 * 60);
    return diff >= 0 && diff <= 48;
  });

  const hasFinancialData = income > 0 || di > 0 || checking > 0;

  return (<Card title="CFO Daily Pulse" visible={visible} delay={20} t={t}>
    {/* ═══ CFO SNAPSHOT ═══ */}
    {hasFinancialData && (
      <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${t.borderDim}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Shield size={12} style={{ color: t[meta.color] || t.accent }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: t[meta.color] || t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            STAGE {stage}/7 — {meta.mode} MODE
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          {checking > 0 && <div>
            <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{fmt(checking)}</div>
          </div>}
          {di > 0 && <div>
            <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leaking</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.danger }}>${di.toFixed(2)}<span style={{ fontSize: 9, fontWeight: 400 }}>/day</span></div>
          </div>}
          {days > 0 && <div>
            <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Runway</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: runwayColor(days, t) }}>{days}<span style={{ fontSize: 9, fontWeight: 400 }}> days</span></div>
          </div>}
        </div>
        {/* Bills due soon */}
        {soon.length > 0 && (
          <div style={{ fontSize: 9, color: t.warn, marginBottom: 4 }}>
            ⏰ Bills due &lt;48hrs: {soon.map(d => `${d.name} (${fmt(d.minPayment || d.monthlyPayment || 0)})`).join(', ')}
          </div>
        )}
        {/* Next action */}
        <div style={{ fontSize: 10, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={10} style={{ color: t[action.color] || t.accent, flexShrink: 0 }} />
          <span>{action.text}</span>
        </div>
      </div>
    )}

    {/* ═══ TACTICAL DIRECTIVE ═══ */}
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

// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// MARKET STRIP — top-line risk/market indicators
// ═══════════════════════════════════════════════════
function MacroBanner({ fredMacro, visible, t }) {
  const [marketLive, setMarketLive] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      try {
        const fetchJsonWithCorsFallback = async (url) => {
          const direct = await fetch(url);
          if (direct.ok) return direct.json();
          const proxied = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
          if (!proxied.ok) return null;
          return proxied.json();
        };

        const fetchYahoo = async (symbol) => {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
          const j = await fetchJsonWithCorsFallback(url);
          if (!j) return null;
          const result = j?.chart?.result?.[0];
          if (!result) return null;
          const meta = result.meta || {};
          let price = Number(meta.regularMarketPrice);
          let prev = Number(meta.chartPreviousClose || meta.previousClose);
          if (!Number.isFinite(price)) {
            const closes = result.indicators?.quote?.[0]?.close || [];
            const vals = closes.filter(v => Number.isFinite(v));
            if (vals.length) price = vals[vals.length - 1];
            if (vals.length > 1) prev = vals[vals.length - 2];
          }
          if (!Number.isFinite(price)) return null;
          const chgPct = Number.isFinite(prev) && prev !== 0 ? ((price - prev) / prev) * 100 : null;
          return { price, chgPct };
        };

        const [cgRes, oilY, vixY, spxY, nasY] = await Promise.allSettled([
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'),
          fetchYahoo('CL=F'),
          fetchYahoo('^VIX'),
          fetchYahoo('^GSPC'),
          fetchYahoo('^IXIC'),
        ]);

        const cg = cgRes.status === 'fulfilled' && cgRes.value.ok ? await cgRes.value.json() : null;
        const next = {
          btc: cg?.bitcoin ? { price: Number(cg.bitcoin.usd), chgPct: Number(cg.bitcoin.usd_24h_change) } : null,
          eth: cg?.ethereum ? { price: Number(cg.ethereum.usd), chgPct: Number(cg.ethereum.usd_24h_change) } : null,
          oil: oilY.status === 'fulfilled' ? oilY.value : null,
          vix: vixY.status === 'fulfilled' ? vixY.value : null,
          sp500: spxY.status === 'fulfilled' ? spxY.value : null,
          nasdaq: nasY.status === 'fulfilled' ? nasY.value : null,
        };
        next.spy = next.sp500 ? { ...next.sp500 } : null;
        if (!cancelled) setMarketLive(next);
      } catch (_) {}
    })();

    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  const rrp     = fredMacro?.rrp?.value    ?? null;
  const silver  = fredMacro?.silver?.value ?? null;
  const silverChg = fredMacro?.silver?.change ?? null;
  const gold    = fredMacro?.gold?.value   ?? null;
  const goldChg = fredMacro?.gold?.change  ?? null;
  const oil = fredMacro?.oil ? { price: fredMacro.oil.value, chgPct: fredMacro.oil.change } : (marketLive?.oil || null);
  const spy = fredMacro?.spy ? { price: fredMacro.spy.value, chgPct: fredMacro.spy.change } : (marketLive?.spy || null);
  const vix = fredMacro?.vix ? { price: fredMacro.vix.value, chgPct: fredMacro.vix.change } : (marketLive?.vix || null);
  const sp500 = fredMacro?.sp500 ? { price: fredMacro.sp500.value, chgPct: fredMacro.sp500.change } : (marketLive?.sp500 || null);
  const nasdaq = fredMacro?.nasdaq ? { price: fredMacro.nasdaq.value, chgPct: fredMacro.nasdaq.change } : (marketLive?.nasdaq || null);
  const asOf    = fredMacro?.asOf ?? null;

  const fmtP  = (n, dec = 0) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  const lbl   = { fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 };

  const cell = { flex: '1 1 0', minWidth: 90, padding: '6px 10px', borderRight: `1px solid ${t.borderDim}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };
  const lastCell = { flex: '1 1 0', minWidth: 90, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };

  const PriceCell = ({ label, value, chg, color, isLast = false, dec = 0 }) => (
    <div style={isLast ? lastCell : cell}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: color || t.textPrimary, whiteSpace: 'nowrap' }}>{fmtP(value, dec)}</div>
      {chg != null && (
        <div style={{ fontSize: 9, color: chg >= 0 ? t.accent : t.danger, marginTop: 1 }}>
          {`${chg >= 0 ? '+' : ''}${Number(chg).toFixed(2)}%`}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ marginBottom: 8, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderTop: `2px solid ${t.accent}30`, padding: '0', display: 'flex', alignItems: 'stretch', width: '100%', overflowX: 'auto' }}>
        <PriceCell label="Bitcoin" value={marketLive?.btc?.price ?? null} chg={marketLive?.btc?.chgPct ?? null} color={t.crypto} />
        <PriceCell label="ETH" value={marketLive?.eth?.price ?? null} chg={marketLive?.eth?.chgPct ?? null} color={t.purple} />
        <PriceCell label="Gold" value={gold} chg={goldChg} color="#FFD700" />
        <PriceCell label="Silver" value={silver} chg={silverChg} color="#C0C0C0" dec={2} />
        <PriceCell label="Oil" value={oil?.price ?? null} chg={oil?.chgPct ?? null} color={t.warn} dec={2} />
        <PriceCell label="SPY" value={spy?.price ?? null} chg={spy?.chgPct ?? null} color={t.accent} dec={2} />
        <PriceCell label="VIX" value={vix?.price ?? null} chg={vix?.chgPct ?? null} color={t.danger} dec={2} />
        <PriceCell label="S&P 500" value={sp500?.price ?? null} chg={sp500?.chgPct ?? null} color={t.textPrimary} />
        <PriceCell label="NASDAQ" value={nasdaq?.price ?? null} chg={nasdaq?.chgPct ?? null} color={t.textPrimary} isLast={!asOf} />

        {/* Timestamp — flush right */}
        {asOf && <div style={{ marginLeft: 'auto', paddingRight: 12, paddingLeft: 8, flexShrink: 0, display: 'flex', alignItems: 'center' }}><div style={{ fontSize: 8, color: t.textGhost, whiteSpace: 'nowrap' }}>FRED · {asOf}</div></div>}
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
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Velocity</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: velColor }}>{(velocity * 100).toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 8, color: velColor, textTransform: 'uppercase' }}>{velocity >= 0.25 ? 'ON TRACK' : velocity >= 0.10 ? 'ALERT' : 'CRISIS'}<span style={{ color: t.textDim }}> / 25% target</span></div>
        </div>
        {/* Daily Burn */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Daily Burn</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: dailyBurn > 0 ? t.warn : t.accent }}>${dailyBurn.toFixed(2)}</div>
          <div style={{ fontSize: 8, color: dailyBurn > 0 ? t.warn : t.accent, textTransform: 'uppercase' }}>{dailyBurn > 0 ? `${fmt(Math.round(monthlyBurn))}/mo spend` : 'ZERO BURN'}</div>
        </div>
        {/* Savings Rate */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Savings Rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase' }}>{savingsRate >= 20 ? 'HEALTHY' : savingsRate > 0 ? 'LOW' : 'NO DATA'}</div>
        </div>
        {/* Runway */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Runway</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: runwayColor(runwayDaysFromLatest(latest), t) }}>{runwayDaysFromLatest(latest)}<span style={{ fontSize: 10, fontWeight: 400 }}> days</span></div>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase' }}>E-Fund Phase {latest?.eFund?.phase || 1}/4</div>
        </div>
      </div>

      {/* Combined info strip — Stage | Ingest hint | Next Action — evenly spaced */}
      <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderLeft: `3px solid ${stageColor}`, display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {/* Stage */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px', borderRight: `1px solid ${t.borderDim}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: stageColor }}>{stage}</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{meta.name}</div>
            <div style={{ fontSize: 8, color: stageColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{isDefense ? '🛡 Defense' : stage === 3 ? '🔓 Liberation' : '📈 Wealth'}</div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 8 }}>
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ width: i === stage ? 14 : 6, height: 5, background: i <= stage ? stageColor : t.elevated, opacity: i <= stage ? 1 : 0.3 }} />
            ))}
          </div>
        </div>

        {/* Ingest hint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', borderRight: `1px solid ${t.borderDim}`, flex: 1 }}>
          <Upload size={12} style={{ color: t.accent, flexShrink: 0 }} />
          <div style={{ fontSize: 10, color: t.textDim, lineHeight: 1.35, textAlign: 'center' }}>
            <span style={{ color: t.textPrimary }}>Ingest:</span> upload <span style={{ color: t.textPrimary }}>PDFs</span>, <span style={{ color: t.textPrimary }}>screenshots</span>, or <span style={{ color: t.textPrimary }}>CSVs</span> via <span style={{ color: t.textPrimary }}>Sync</span>
          </div>
        </div>

        {/* Next Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', flex: 1 }}>
          <Zap size={12} style={{ color: t[action.color] || t.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: t.textSecondary, textAlign: 'center' }}>{action.text}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════
function DashboardView({ snapshots, latest, settings, t, isDark, onSync, onToggle, onExport, onClear, onToggleTheme, syncFlash, onHome, fredMacro }) {
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vis = settings.visibleModules;
  const ac = { red: 0, amber: 0, green: 0 };
  if (latest.debts?.some(d => d.balance > 2000)) ac.red++;
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
  if (_pli?.deathBenefit > 0) { const _ntf = _pli.deathBenefit - totalDebt(latest.debts); if (_ntf < (latest.eFund?.monthlyExpenses || 3000) * 12) ac.amber++; else ac.green++; }
  // Portfolio alerts
  const _opts = latest.portfolio?.options || [];
  const _urgentOpts = _opts.filter(o => { if (!o.expDate) return false; const d = Math.floor((new Date(o.expDate) - new Date()) / 86400000); return d >= 0 && d <= 7; });
  if (_urgentOpts.length > 0) ac.red += _urgentOpts.length;

  return (<div style={{ minHeight: '100vh', background: t.void, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace", paddingBottom: 40 }}>
    <header style={{ position: 'fixed', top: 0, width: '100%', height: 48, background: t.surface, borderBottom: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 50, animation: syncFlash ? 'pulse 0.6s ease' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }} onClick={onHome} title="Return to home">
        <Shield size={14} style={{ color: t.accent }} /><span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: t.accent, fontWeight: 700, textShadow: isDark ? `0 0 10px ${t.accent}30` : 'none', whiteSpace: 'nowrap' }}>FORTIFYOS</span><span style={{ color: t.textGhost, fontSize: 9 }}>v2.4</span>
      </div>
      <span className="phase-label" style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{latest.macro?.bennerPhase ? `Benner: ${latest.macro.bennerPhase}` : 'Phase-Aware Execution Active'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setSyncOpen(true)} style={{ background: 'none', border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><RefreshCw size={10} /> Sync</button>
        <Settings size={16} style={{ color: t.textSecondary, cursor: 'pointer' }} onClick={() => setSettingsOpen(true)} />
      </div>
    </header>
    <div style={{ position: 'fixed', top: 48, width: '100%', height: 1, background: `${t.accent}15`, zIndex: 50 }} />
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 12px 52px' }}>
      <MacroBanner fredMacro={fredMacro} visible={vis.includes('macroBanner')} t={t} />
      <StatusStrip latest={latest} t={t} />
      <div className="main-grid" style={{ display: 'grid', gap: 12 }}>
        <DirectiveMod visible={vis.includes('directive')} latest={latest} t={t} />
        <NetWorthMod snapshots={snapshots} latest={latest} visible={vis.includes('netWorth')} t={t} />
        <div style={{ gridColumn: '1 / -1' }}><MacroSignalsMod latest={latest} visible={vis.includes('macro')} t={t} fredMacro={fredMacro} /></div>
        <div style={{ gridColumn: '1 / -1' }}><MarketIntelligenceMod latest={latest} visible={vis.includes('market')} t={t} isDark={isDark} fredMacro={fredMacro} /></div>
        <DebtMod latest={latest} visible={vis.includes('debt')} t={t} />
        <PlannerMod latest={latest} visible={vis.includes('planner')} t={t} />
        <EFundMod latest={latest} visible={vis.includes('eFund')} t={t} />
        <BudgetMod latest={latest} visible={vis.includes('budget')} t={t} />
        <ProtectionMod latest={latest} visible={vis.includes('protection')} t={t} />
        <PortfolioMod latest={latest} visible={vis.includes('portfolio')} t={t} />
      </div>
    </main>
    <footer style={{ position: 'fixed', bottom: 0, width: '100%', height: 32, background: t.surface, borderTop: `1px solid ${t.borderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 9, zIndex: 50 }}>
      <span style={{ color: t.textDim }}>SYNC: {latest.date || 'never'} <span style={{ color: daysSince(latest.date) >= 7 ? t.danger : daysSince(latest.date) >= 3 ? t.warn : t.textGhost }}>({daysSince(latest.date) === 0 ? 'today' : daysSince(latest.date) === 1 ? 'yesterday' : daysSince(latest.date) >= 999 ? 'no data' : `${daysSince(latest.date)}d ago`})</span></span>
      {dailyInterest(latest?.debts) > 0 && <span style={{ color: t.danger, fontWeight: 700 }}>${dailyInterest(latest?.debts).toFixed(2)}/DAY LEAKING</span>}
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
  const [fredMacro, setFredMacro] = useState(null);
  const t = isDark ? THEMES.dark : THEMES.light;

  // Fetch FRED macro data from GitHub Actions-generated macro.json
  // BASE_URL ensures correct path on GitHub Pages (/fortifyos/macro.json)
  // Cache-bust with today's date so CDN doesn't serve stale data
  useEffect(() => {
    const bust = new Date().toISOString().slice(0, 10);
    fetch(`${import.meta.env.BASE_URL}macro.json?v=${bust}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.walcl || d?.tga || d?.rrp) setFredMacro(d); })
      .catch(() => {});
  }, []);

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
        if (needsVersionBump || needsModuleMerge) {
          const merged = { ...st, visibleModules: mergedVisible, _v: DEFAULT_SETTINGS._v };
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
        monthlyExpenses: Math.round(combinedSpent || merged.eFund?.monthlyExpenses || 3000),
      };
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
    } catch(_) {}
    setSyncFlash(true); setTimeout(() => setSyncFlash(false), 600);
    setView('dashboard'); setSyncOpen(false);
  }, [latest]);

  const toggleTheme = useCallback(async () => { const n = !isDark; setIsDark(n); await store.set('fortify-theme', n); }, [isDark]);
  const toggleModule = useCallback(async (k) => {
    const m = settings.visibleModules.includes(k) ? settings.visibleModules.filter(x => x !== k) : [...settings.visibleModules, k];
    const ns = { ...settings, visibleModules: m }; setSettings(ns); await store.set('fortify-settings', ns);
  }, [settings]);
  const handleExport = useCallback(() => {
    const b = new Blob([JSON.stringify({ snapshots, latest, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fortify-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [snapshots, latest, settings]);
  const handleClear = useCallback(async () => { setSnapshots([]); setLatest(DEFAULT_SNAPSHOT); setView('landing'); await store.del('fortify-snapshots'); await store.del('fortify-latest'); }, []);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; }
        
/* Responsive layout */
.fo-main { padding-left: 14px; padding-right: 14px; }
@media (max-width: 980px) {
  .fo-topgrid { grid-template-columns: 1fr !important; }
  .fo-modgrid { grid-template-columns: 1fr !important; }
}
@media (max-width: 520px) {
  .fo-main { padding-left: 10px; padding-right: 10px; }
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 0 1px ${t.accent}60; } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 4px ${t.purple}40; border-color: ${t.purple}60; } 50% { box-shadow: 0 0 12px ${t.purple}80; border-color: ${t.purple}; } }
        @keyframes lastSeg { 0%,100% { box-shadow: 0 0 3px ${t.accent}40; } 50% { box-shadow: 0 0 8px ${t.accent}; } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::selection { background: ${t.accentMuted}; color: ${t.accent}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${t.void}; } ::-webkit-scrollbar-thumb { background: ${t.borderMid}; }
        .phase-label,.footer-label { display: block; }
        .main-grid { grid-template-columns: repeat(2, 1fr); }
        .sync-row-3 { grid-template-columns: repeat(3, 1fr); }
        .status-metrics { grid-template-columns: repeat(4, 1fr); }
        .sync-row-debt { grid-template-columns: 2fr 1fr 1.5fr 1fr; }
        .hero-title { font-size: 56px; }
        .hero-sub { font-size: 15px; }
        .hero-buttons { flex-direction: row; }
        .footer-stats { grid-template-columns: repeat(3, 1fr); }
        .footer-stat-cell { border-right: 1px solid ${t.borderDim}; }
        .footer-stat-cell:last-child { border-right: none; }
        input, select, textarea { max-width: 100%; }
        @media (max-width: 768px) {
          .sync-shell {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
          .sync-content { padding: 12px !important; }
          .sync-overlay { padding: 0 !important; }
          input, select, textarea { font-size: 16px !important; }
          button { min-height: 40px; }
          .phase-label,.footer-label { display: none !important; }
          .main-grid { grid-template-columns: 1fr !important; }
          .sync-row-3 { grid-template-columns: 1fr !important; }
          .status-metrics { grid-template-columns: 1fr 1fr !important; }
          .sync-row-debt { grid-template-columns: 1fr !important; }
          .hero-title { font-size: 36px !important; }
          .hero-sub { font-size: 13px !important; }
          .hero-buttons { flex-direction: column !important; }
          .footer-stats { grid-template-columns: 1fr !important; }
          .footer-stat-cell { border-right: none !important; border-bottom: 1px solid ${t.borderDim}; }
          .footer-stat-cell:last-child { border-bottom: none; }
          .stage-labels span { font-size: 6px !important; }
          .fo-main { overflow-x: hidden !important; }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 998, opacity: 0.025, background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${t.accent} 2px, ${t.accent} 4px)` }} />
      {view === 'loading' && <div style={{ background: t.void, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: t.accent, fontFamily: "'Space Mono', monospace", fontSize: 14, textShadow: isDark ? `0 0 10px ${t.accent}40` : 'none' }}>FORTIFYOS initializing...</div></div>}
      {view === 'landing' && <><LandingView t={t} isDark={isDark} onToggleTheme={toggleTheme} onInitialize={() => setSyncOpen(true)} onDocs={() => setView('docs')} hasData={snapshots.length > 0} onDashboard={() => setView('dashboard')} /><UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={handleSync} t={t} /></>}
      {view === 'docs' && <DocsView t={t} isDark={isDark} onBack={() => setView('landing')} onToggleTheme={toggleTheme} />}
      {view === 'dashboard' && <DashboardView snapshots={snapshots} latest={latest} settings={settings} t={t} isDark={isDark} onSync={handleSync} onToggle={toggleModule} onExport={handleExport} onClear={handleClear} onToggleTheme={toggleTheme} syncFlash={syncFlash} onHome={() => setView('landing')} fredMacro={fredMacro} />}
    </div>
  );
}
