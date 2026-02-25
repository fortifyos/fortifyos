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
    borderDim: '#1A1A1A', borderMid: '#2A2A2A', borderBright: '#333333',
    textPrimary: '#E8E8E8', textSecondary: '#888888', textDim: '#555555', textGhost: '#333333',
    accent: '#00FF41', accentBright: '#39FF14', accentDim: '#00CC33', accentMuted: '#0A3D1A',
    danger: '#FF3333', warn: '#FFB800',
    purple: '#BF40BF', purpleDim: '#8A2D8A', purpleMuted: '#2D0A2D',
    crypto: '#F7931A', cryptoDim: '#C67A15', cryptoMuted: '#3D250A',
  },
  light: {
    void: '#FFFFFF', surface: '#FFFFFF', elevated: '#F8F9FA', input: '#F3F4F6',
    borderDim: '#D1D5DB', borderMid: '#9CA3AF', borderBright: '#6B7280',
    textPrimary: '#111111', textSecondary: '#1F2937', textDim: '#4B5563', textGhost: '#9CA3AF',
    accent: '#00FF41', accentBright: '#39FF14', accentDim: '#00CC33', accentMuted: '#0A3D1A',
    danger: '#FF3333', warn: '#FFB800',
    purple: '#BF40BF', purpleDim: '#8A2D8A', purpleMuted: '#2D0A2D',
    crypto: '#F7931A', cryptoDim: '#C67A15', cryptoMuted: '#3D250A',
  },
};

// ═══════════════════════════════════════════════════
// PDF.js LOADER (Client-side, zero network data transfer)
// ═══════════════════════════════════════════════════
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfjsReady = null;
function loadPDFJS() {
  if (pdfjsReady) return pdfjsReady;
  pdfjsReady = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) { reject(new Error('PDF.js did not initialize')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(lib);
    };
    script.onerror = () => { pdfjsReady = null; reject(new Error('Failed to load PDF.js from CDN')); };
    document.head.appendChild(script);
  });
  return pdfjsReady;
}

async function extractPDFText(file) {
  const lib = await loadPDFJS();
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    let currentLine = '';
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += (currentLine ? ' ' : '') + item.str;
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pages.push(lines);
  }
  return { pages, allLines: pages.flat(), numPages: pdf.numPages };
}

// ═══════════════════════════════════════════════════
// PDF BANK TEXT PARSERS
// ═══════════════════════════════════════════════════
const PDF_BANK_PARSERS = {
  chase: {
    name: 'Chase',
    detect: (lines) => {
      const text = lines.join(' ');
      return /JPMorgan Chase/i.test(text) || /chase\.com/i.test(text) || (/CHASE/i.test(text) && /statement/i.test(text));
    },
    parse: (lines) => {
      const txns = [];
      // Chase statements: MM/DD date, description, then amount (negative=charge, positive=payment)
      const dateRe = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;
      const dateRe2 = /^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;
      for (const line of lines) {
        let m = line.match(dateRe2);
        if (m) {
          txns.push({ date: m[1], description: m[3].trim(), amount: -parseFloat(m[4].replace(/,/g, '')) });
          continue;
        }
        m = line.match(dateRe);
        if (m) {
          const amt = parseFloat(m[3].replace(/,/g, ''));
          const desc = m[2].trim();
          if (/payment|credit/i.test(desc)) txns.push({ date: m[1], description: desc, amount: Math.abs(amt) });
          else txns.push({ date: m[1], description: desc, amount: -Math.abs(amt) });
          continue;
        }
      }
      return txns;
    },
  },
  bofa: {
    name: 'Bank of America',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Bank of America/i.test(text) || /bankofamerica\.com/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      const dateRe = /^(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;
      for (const line of lines) {
        const m = line.match(dateRe);
        if (m) {
          const amt = parseFloat(m[3].replace(/,/g, ''));
          const desc = m[2].trim();
          if (/deposit|direct dep|credit|payment received/i.test(desc)) txns.push({ date: m[1], description: desc, amount: Math.abs(amt) });
          else txns.push({ date: m[1], description: desc, amount: -Math.abs(amt) });
        }
      }
      return txns;
    },
  },
  amex: {
    name: 'American Express',
    detect: (lines) => {
      const text = lines.join(' ');
      return /American Express/i.test(text) || /americanexpress\.com/i.test(text) || /AMEX/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      const dateRe = /^(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/;
      for (const line of lines) {
        const m = line.match(dateRe);
        if (m) {
          const amt = parseFloat(m[3].replace(/,/g, ''));
          const desc = m[2].trim();
          if (/payment.*received|credit/i.test(desc)) txns.push({ date: m[1], description: desc, amount: Math.abs(amt) });
          else txns.push({ date: m[1], description: desc, amount: -Math.abs(amt) });
        }
      }
      return txns;
    },
  },
  capitalOne: {
    name: 'Capital One',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Capital One/i.test(text) || /capitalone\.com/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      // Capital One CC statements use: "Jan 28 Jan 28 DESCRIPTION - $211.00" or "$211.00"
      // Trans Date, Post Date (both "Mon DD"), Description, then [- ]$Amount
      for (const line of lines) {
        // Pattern: MonthAbbr Day MonthAbbr Day Description [-]$Amount
        let m = line.match(/^(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s+(.+?)\s+-\s*\$([\d,]+\.\d{2})$/);
        if (m) {
          // Negative amount (payment/credit)
          txns.push({ date: m[1], description: m[3].trim(), amount: parseFloat(m[4].replace(/,/g, '')) });
          continue;
        }
        m = line.match(/^(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s+(.+?)\s+\$([\d,]+\.\d{2})$/);
        if (m) {
          // Positive amount (charge)
          txns.push({ date: m[1], description: m[3].trim(), amount: -parseFloat(m[4].replace(/,/g, '')) });
          continue;
        }
        // Also try MM/DD format
        m = line.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+-?\s*\$([\d,]+\.\d{2})$/);
        if (m) {
          const desc = m[3].trim();
          const amt = parseFloat(m[4].replace(/,/g, ''));
          if (/payment|credit|pymt/i.test(desc) || line.includes('- $'))
            txns.push({ date: m[1], description: desc, amount: amt });
          else
            txns.push({ date: m[1], description: desc, amount: -amt });
        }
      }
      return txns;
    },
  },
  wellsFargo: {
    name: 'Wells Fargo',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Wells Fargo/i.test(text) || /wellsfargo\.com/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      const dateRe = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;
      for (const line of lines) {
        const m = line.match(dateRe);
        if (m) {
          const amt = parseFloat(m[3].replace(/,/g, ''));
          txns.push({ date: m[1], description: m[2].trim(), amount: amt < 0 ? amt : -amt });
        }
      }
      return txns;
    },
  },
  citi: {
    name: 'Citi',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Citibank/i.test(text) || /citi\.com/i.test(text) || (/Citi/i.test(text) && /statement/i.test(text));
    },
    parse: (lines) => {
      const txns = [];
      const dateRe = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/;
      for (const line of lines) {
        const m = line.match(dateRe);
        if (m) {
          const amt = parseFloat(m[3].replace(/,/g, ''));
          const desc = m[2].trim();
          if (/payment|credit|refund/i.test(desc)) txns.push({ date: m[1], description: desc, amount: Math.abs(amt) });
          else txns.push({ date: m[1], description: desc, amount: -Math.abs(amt) });
        }
      }
      return txns;
    },
  },
  usaa: {
    name: 'USAA',
    detect: (lines) => {
      const text = lines.join(' ');
      return /USAA/i.test(text) || /usaa\.com/i.test(text) || /United Services Automobile/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      for (const line of lines) {
        // USAA: "MM/DD Description $Amount" or "MM/DD MM/DD Description Amount"
        let m = line.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const desc = m[3].trim();
          const amt = parseFloat(m[4].replace(/,/g, ''));
          if (/payment|credit|pymt/i.test(desc) || line.includes('- $')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
          continue;
        }
        m = line.match(/^(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const desc = m[2].trim();
          const amt = parseFloat(m[3].replace(/,/g, ''));
          if (/payment|credit|pymt|deposit|direct dep/i.test(desc) || line.includes('- $')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
        }
      }
      return txns;
    },
  },
  avant: {
    name: 'Avant',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Avant/i.test(text) && (/AvantCard/i.test(text) || /avant\.com/i.test(text) || /WebBank/i.test(text));
    },
    parse: (lines) => {
      const txns = [];
      for (const line of lines) {
        // Avant CC: "MM/DD MM/DD Description $Amount" or "Mon DD Mon DD Description $Amount"
        let m = line.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (!m) m = line.match(/^(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const desc = m[3].trim();
          const amt = parseFloat(m[4].replace(/,/g, ''));
          if (/payment|credit|pymt/i.test(desc) || line.includes('- $') || line.includes('- ')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
          continue;
        }
        m = line.match(/^(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const desc = m[2].trim();
          const amt = parseFloat(m[3].replace(/,/g, ''));
          if (/payment|credit|pymt/i.test(desc) || line.includes('- $')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
        }
      }
      return txns;
    },
  },
  missionLane: {
    name: 'Mission Lane',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Mission Lane/i.test(text) || /missionlane\.com/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      for (const line of lines) {
        let m = line.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (!m) m = line.match(/^(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (!m) m = line.match(/^(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const dateIdx = m[3] ? 3 : 2;
          const amtIdx = m[4] ? 4 : 3;
          const desc = m[dateIdx].trim();
          const amt = parseFloat(m[amtIdx].replace(/,/g, ''));
          if (/payment|credit|pymt/i.test(desc) || line.includes('- $')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
        }
      }
      return txns;
    },
  },
  navyFederal: {
    name: 'Navy Federal',
    detect: (lines) => {
      const text = lines.join(' ');
      return /Navy Federal/i.test(text) || /navyfederal\.org/i.test(text) || /NFCU/i.test(text);
    },
    parse: (lines) => {
      const txns = [];
      for (const line of lines) {
        // Navy Federal: "MM/DD/YY or MM/DD Description Amount" or with Trans/Post date columns
        let m = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (!m) m = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/);
        if (m) {
          const hasPostDate = m[4] !== undefined;
          const desc = hasPostDate ? m[3].trim() : m[2].trim();
          const amt = parseFloat((hasPostDate ? m[4] : m[3]).replace(/,/g, ''));
          if (/payment|credit|pymt|deposit|direct dep|payroll/i.test(desc) || line.includes('- $')) txns.push({ date: m[1], description: desc, amount: amt });
          else txns.push({ date: m[1], description: desc, amount: -amt });
        }
      }
      return txns;
    },
  },
  generic: {
    name: 'Generic',
    detect: () => true,
    parse: (lines) => {
      const txns = [];
      const patterns = [
        // Trans Date + Post Date + Description + $Amount (most CC statements)
        { re: /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/, dateG: 1, descG: 3, amtG: 4 },
        // Mon DD + Mon DD + Description + $Amount (Capital One style)
        { re: /^(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/, dateG: 1, descG: 3, amtG: 4 },
        // Date + Description + $Amount (simple format)
        { re: /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+-?\s*\$?([\d,]+\.\d{2})$/, dateG: 1, descG: 2, amtG: 3 },
        // ISO Date + Description + Amount
        { re: /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+\$?(-?[\d,]+\.\d{2})$/, dateG: 1, descG: 2, amtG: 3 },
        // DD Mon + Description + Amount (UK/Canadian style)
        { re: /^(\d{1,2}\s+\w{3})\s+(.+?)\s+([\d,]+\.\d{2})$/, dateG: 1, descG: 2, amtG: 3 },
        // Mon DD, YYYY + Description + Amount
        { re: /^(\w{3}\s+\d{1,2},?\s*\d{4})\s+(.+?)\s+\$?(-?[\d,]+\.\d{2})$/, dateG: 1, descG: 2, amtG: 3 },
        // Date + Amount + Description (SunTrust style)
        { re: /^(\d{1,2}\/\d{1,2})\s+([\d,]+\.\d{2})\s+(.+)$/, dateG: 1, descG: 3, amtG: 2 },
      ];
      for (const line of lines) {
        for (const p of patterns) {
          const m = line.match(p.re);
          if (m) {
            const desc = m[p.descG].trim();
            let amt = parseFloat(m[p.amtG].replace(/,/g, ''));
            if (/payment|credit|pymt|deposit|direct dep|payroll|refund/i.test(desc) || line.includes('- $')) {
              amt = Math.abs(amt);
            } else if (amt > 0) {
              amt = -amt;
            }
            if (/^(date|trans|post|description|amount|balance|total|page|opening|closing|beginning|ending)/i.test(desc)) break;
            txns.push({ date: m[p.dateG], description: desc, amount: amt });
            break;
          }
        }
      }
      return txns;
    },
  },
};

function parsePDFTransactions(allLines) {
  // Redact sensitive data from extracted text first
  const redactedLines = allLines.map(l => sentinel.redact(l));
  // Detect bank
  let bank = 'Unknown';
  let txns = [];
  for (const [key, parser] of Object.entries(PDF_BANK_PARSERS)) {
    if (key === 'generic') continue;
    if (parser.detect(redactedLines)) {
      txns = parser.parse(redactedLines);
      bank = parser.name;
      break;
    }
  }
  if (bank === 'Unknown') {
    txns = PDF_BANK_PARSERS.generic.parse(redactedLines);
  }

  // Extract credit card statement summary (works for any bank)
  const summary = extractStatementSummary(redactedLines);

  // If we got summary data but few/no transactions, synthesize transactions from summary
  if (txns.length === 0 && summary.hasData) {
    if (summary.payments > 0) {
      txns.push({ date: summary.cycleStart || 'N/A', description: 'PAYMENT', amount: summary.payments });
    }
    if (summary.interestCharged > 0) {
      txns.push({ date: summary.cycleEnd || 'N/A', description: 'INTEREST CHARGE', amount: -summary.interestCharged });
    }
    if (summary.fees > 0) {
      txns.push({ date: summary.cycleEnd || 'N/A', description: 'FEES', amount: -summary.fees });
    }
    if (summary.purchases > 0) {
      txns.push({ date: summary.cycleEnd || 'N/A', description: 'PURCHASES (TOTAL)', amount: -summary.purchases });
    }
  }

  return { bank, txns, lineCount: redactedLines.length, summary };
}

function extractStatementSummary(lines) {
  const s = {
    hasData: false,
    previousBalance: 0, payments: 0, purchases: 0, cashAdvances: 0,
    fees: 0, interestCharged: 0, newBalance: 0,
    creditLimit: 0, availableCredit: 0,
    minPayment: 0, dueDate: '', apr: 0,
    cycleStart: '', cycleEnd: '',
    totalInterestYTD: 0, totalFeesYTD: 0,
  };

  const joined = lines.join('\n');
  const flat = lines.join(' ');

  // Helper to find dollar amounts after a label
  const findAmt = (pattern) => {
    const re = new RegExp(pattern + '\\s*[-+=+]*\\s*\\$?([\\d,]+\\.\\d{2})', 'i');
    const m = flat.match(re);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };

  s.previousBalance = findAmt('Previous Balance');
  s.newBalance = findAmt('New Balance');
  s.creditLimit = findAmt('Credit Limit');
  s.minPayment = findAmt('Minimum Payment Due');
  s.interestCharged = findAmt('Total Interest for This Period');
  if (!s.interestCharged) s.interestCharged = findAmt('Interest Charged');
  s.fees = findAmt('Total Fees for This Period');
  if (!s.fees) s.fees = findAmt('Fees Charged');
  s.totalInterestYTD = findAmt('Total Interest charged');
  s.totalFeesYTD = findAmt('Total Fees charged');

  // Payments (may have "- $" prefix)
  const pmtMatch = flat.match(/Payments\s*[-–]?\s*\$?([\d,]+\.\d{2})/i);
  if (pmtMatch) s.payments = parseFloat(pmtMatch[1].replace(/,/g, ''));

  // Transactions/Purchases total from summary
  const txnMatch = flat.match(/Transactions\s*\+?\s*\$?([\d,]+\.\d{2})/i);
  if (txnMatch) s.purchases = parseFloat(txnMatch[1].replace(/,/g, ''));

  // APR
  const aprMatch = flat.match(/(\d+\.\d+)%\s*[PpVv]/);
  if (aprMatch) s.apr = parseFloat(aprMatch[1]);
  if (!s.apr) {
    const aprMatch2 = flat.match(/APR\)?:?\s*(\d+\.\d+)%/i);
    if (aprMatch2) s.apr = parseFloat(aprMatch2[1]);
  }

  // Due date
  const dueMatch = flat.match(/(?:Payment\s+)?Due\s+Date:?\s*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
  if (dueMatch) s.dueDate = dueMatch[1];

  // Billing cycle
  const cycleMatch = flat.match(/(\w{3}\s+\d{1,2},?\s*\d{4})\s*[-–]\s*(\w{3}\s+\d{1,2},?\s*\d{4})/);
  if (cycleMatch) {
    s.cycleStart = cycleMatch[1];
    s.cycleEnd = cycleMatch[2];
  }

  s.hasData = s.newBalance > 0 || s.previousBalance > 0 || s.payments > 0;
  return s;
}

// ═══════════════════════════════════════════════════
// BANK FINGERPRINT LIBRARY (CSV)
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
// ═══════════════════════════════════════════════════
// SENTINEL REDACTION FILTER
// ═══════════════════════════════════════════════════
// Goal: aggressively mask common sensitive fields BEFORE any parsing / display.
// (Matches the desktop Parse Protocols philosophy: redact-first, then reason.)
const sentinel = {
  redact: (text) => {
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
    t = t.replace(/\b(?:account|acct|card|iban)\s*(?:#|no\.?|number|ending\s+in|last\s*4)\s*[:\-]?\s*\d{3,}\b/gi, '[REDACTED ACCOUNT]');

    // Email addresses
    t = t.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]');

    // US phone numbers
    t = t.replace(/\b(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}\b/g, '[REDACTED PHONE]');

    // DOB / Birthdate when labeled (avoid blanketing all dates)
    t = t.replace(/\b(?:dob|date\s+of\s+birth|birth\s*date)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi, 'DOB: [REDACTED]');

    // Long digit sequences (9+ digits) when likely identifiers (avoid amounts with decimals)
    t = t.replace(/\b\d{9,}\b/g, (m) => (m.length <= 4 ? m : `${'X'.repeat(Math.max(0, m.length - 4))}${m.slice(-4)}`));

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

function categorize(desc) {
  const d = (desc || '').toLowerCase();
  for (const r of CATEGORY_RULES) { if (r.match.test(d)) return r.cat; }
  return 'Uncategorized';
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
};
const DEFAULT_SETTINGS = { visibleModules: ['directive', 'netWorth', 'debt', 'eFund', 'budget', 'protection', 'portfolio'], _v: 3 };
const fmt = (n) => { if (n == null || isNaN(n)) return '$0'; return '$' + Math.abs(Math.round(Number(n))).toLocaleString('en-US'); };
const dailyInterest = (d) => d ? d.reduce((s, x) => s + ((x.balance || 0) * ((x.apr || 0) / 100)) / 365, 0) : 0;
const totalDebt = (d) => d ? d.reduce((s, x) => s + (x.balance || 0), 0) : 0;
const runwayDays = (ef) => (!ef || !ef.monthlyExpenses) ? 0 : Math.floor((ef.balance || 0) / (ef.monthlyExpenses / 30));
const efundTargets = (m) => [1000, m, m * 3, m * 6];
const pctColor = (p, t) => p >= 100 ? t.danger : p >= 75 ? t.warn : t.accent;
const runwayColor = (d, t) => d < 30 ? t.danger : d < 60 ? t.warn : t.accent;
const CURRENCY_SYMBOL = (() => { try { return (0).toLocaleString(undefined, { style: 'currency', currency: Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).resolvedOptions().currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d.,\s]/g, '').trim(); } catch { return '$'; } })();

// Stage calculation from live data
function calcStage(latest) {
  const debt = totalDebt(latest?.debts);
  const ef = latest?.eFund || {};
  const bal = ef.balance || 0;
  const monthly = ef.monthlyExpenses || 3000;
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = (latest?.budget?.categories || []).reduce((s, c) => s + (c.actual || 0), 0);

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
  const totalSpent = (latest?.budget?.categories || []).reduce((s, c) => s + (c.actual || 0), 0);
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
  const monthly = ef.monthlyExpenses || 3000;
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
    { q: 'How is this different from YNAB or Mint?', a: 'YNAB asks you to categorize. FortifyOS auto-parses your bank CSV and tells you exactly which debt to pay, how much interest is leaking daily, and blocks investment activity until you\'re debt-free. It enforces a 7-stage wealth journey — they give you a pie chart.' },
    { q: 'What do I need to get started?', a: 'A Claude subscription ($20/mo) and a bank statement CSV. Setup takes 30-45 minutes on Mac, 45-60 on Windows. After that, daily use is 2-5 minutes — say "Good morning" and the system tells you what to do.' },
    { q: 'Can I use it on my phone?', a: 'Yes. Install the Claude app, sign in with the same account, and your FortifyOS project loads automatically. You get daily briefings, payment checks, and emergency commands. Desktop is needed for CSV processing — mobile is your daily command line.' },
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
                <button onClick={onDashboard} style={{ background: accent, color: '#000', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>OPEN DASHBOARD <ArrowRight size={16} /></button>
                <button onClick={onInitialize} style={{ background: 'none', border: `1px solid ${t.borderDim}`, fontFamily: "'Space Mono', monospace", fontSize: 14, padding: '14px 28px', cursor: 'pointer', color: t.textSecondary, width: '100%', textAlign: 'center' }}>SYNC NEW DATA</button>
              </>
            ) : (
              <>
                <button onClick={onInitialize} style={{ background: accent, color: '#000', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 28px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>GET STARTED <ArrowRight size={16} /></button>
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
              { num: '01', title: 'SYNC', desc: 'Drop your bank CSV or paste a JSON snapshot. Sentinel auto-redacts sensitive data. The system fingerprints your bank and parses transactions automatically.', Icon: Upload },
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
          <button onClick={onInitialize} style={{ background: accent, color: '#000', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, padding: '14px 36px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>GET STARTED <ArrowRight size={16} /></button>
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
            { num: '1', title: 'SYNC YOUR DATA', desc: 'Drop a bank CSV, paste JSON from Claude Code, or fill in the guided form. Sentinel auto-redacts SSNs and account numbers before anything is processed.' },
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
              {line(0, '├── 📁', 'statements/', { text: 'Drop raw CSVs here', color: t.textDim }, t.textDim)}
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
            { title: 'CSV IMPORT (PRIMARY)', desc: 'Drop a .csv bank export. Auto-detects Chase, BofA, Amex, Capital One, Wells Fargo, and Citi via header fingerprinting.' },
            { title: 'PDF PARSE (PRIVACY-FIRST)', desc: 'Drop a bank statement PDF. Parsed 100% client-side using PDF.js — zero network calls. Works on mobile. Sentinel redaction applied before preview.' },
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
            <tr><td style={sty.td}>Bank screenshots</td><td style={sty.td}>Low</td><td style={sty.td}>Either (browser or Claude Code)</td></tr>
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
          ['/sync [JSON]', 'Weekly HUD generation from OpenClaw manifest data.'],
          ['/audit', 'Full financial health check — net worth, debt, budget, e-fund, projections.'],
          ['/monthly', 'Generate downloadable PDF progress report.'],
          ['/panic', 'Emergency protocol — immediate triage of financial situation.'],
          ['/scan_now', 'Manual trigger for OpenClaw automated scans.'],
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

  // JSON paste state
  const [json, setJson] = useState('');
  const [jsonValidating, setJsonValidating] = useState(false);

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfTxns, setPdfTxns] = useState(null);
  const [pdfBank, setPdfBank] = useState('');
  const [pdfMeta, setPdfMeta] = useState(null);
  const pdfRef = useRef();

  // Guided state
  const [gCheck, setGCheck] = useState(''); const [gSavings, setGSavings] = useState(''); const [gEF, setGEF] = useState(''); const [gOther, setGOther] = useState('');
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
  const [gCrypto, setGCrypto] = useState([{ coin: '', amount: '', avgCost: '', lastPrice: '' }]);
  const upEquity = (i, f, v) => { const e = [...gEquities]; e[i][f] = v; setGEquities(e); };
  const upOption = (i, f, v) => { const o = [...gOptions]; o[i][f] = v; setGOptions(o); };
  const upCrypto = (i, f, v) => { const c = [...gCrypto]; c[i][f] = v; setGCrypto(c); };
  const addEquity = () => setGEquities([...gEquities, { ticker: '', shares: '', avgCost: '', lastPrice: '' }]);
  const addOption = () => setGOptions([...gOptions, { ticker: '', type: 'CALL', contracts: '', strikePrice: '', expDate: '', lastPrice: '' }]);
  const addCrypto = () => setGCrypto([...gCrypto, { coin: '', amount: '', avgCost: '', lastPrice: '' }]);

  // Income state
  const [gIncome, setGIncome] = useState('');

  // Macro state
  const [gBenner, setGBenner] = useState('B-Year (Sell)');

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
        if (ext === 'pdf') {
          log('PDF DETECTED — Use the PDF Parse tab');
          setError('Switch to the PDF Parse tab to import PDF statements directly.');
        } else {
          log('FORMAT REQUIRES EXTERNAL PARSE');
          log('→ Drop this file into Claude chat');
          log('→ Claude outputs JSON snapshot');
          log('→ Paste JSON here via JSON tab');
          setError(`${ext.toUpperCase()} files need Claude chat parsing. Use the JSON tab after.`);
        }
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

  const handlePDFFile = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setPdfLoading(true); setError(''); setPdfTxns(null); setPdfBank(''); setPdfMeta(null); setParsedPreview(null);
    setLogs([]);
    log(`DETECTED: ${file.name} (.PDF)`);
    log(`SIZE: ${(file.size / 1024).toFixed(1)}KB`);
    log('LOADING PDF.js ENGINE (client-side)...');
    try {
      const { pages, allLines, numPages } = await extractPDFText(file);
      log(`EXTRACTED: ${numPages} pages, ${allLines.length} text lines`);
      if (allLines.length < 5) {
        log('⚠ LOW TEXT CONTENT — PDF may be scanned/image-based');
        setError('This PDF appears to be scanned (image-based). Text-based PDFs from your bank portal work best. For scanned PDFs, use Claude chat or Claude Code with OCR.');
        setPdfLoading(false);
        return;
      }
      log('RUNNING SENTINEL REDACTION FILTER...');
      log('DETECTING BANK FINGERPRINT...');
      const { bank, txns, lineCount, summary } = parsePDFTransactions(allLines);
      log(`FINGERPRINT: ${bank.toUpperCase()}`);
      log(`TRANSACTIONS FOUND: ${txns.length}`);
      if (summary && summary.hasData) {
        log(`STATEMENT SUMMARY: Balance ${fmt(summary.newBalance)} | APR ${summary.apr}%`);
      }
      if (txns.length === 0 && (!summary || !summary.hasData)) {
        log('⚠ ZERO TRANSACTIONS + NO SUMMARY DATA');
        setError(`No parseable data found in this PDF. The ${bank} parser could not match patterns. Try downloading a CSV from your bank if available.`);
        setPdfLoading(false);
        return;
      }
      // Calculate totals from transactions
      const amounts = txns.map(t => t.amount);
      const totalIn = amounts.filter(a => a > 0).reduce((s, a) => s + a, 0);
      const totalOut = amounts.filter(a => a < 0).reduce((s, a) => s + Math.abs(a), 0);
      const dates = txns.map(t => t.date).filter(Boolean).sort();
      setPdfBank(bank);
      setPdfTxns(txns);
      setPdfMeta({
        count: txns.length,
        dateRange: summary.cycleStart && summary.cycleEnd
          ? `${summary.cycleStart} — ${summary.cycleEnd}`
          : dates.length >= 2 ? `${dates[0]} — ${dates[dates.length - 1]}` : (dates[0] || 'N/A'),
        totalIn: Math.round(totalIn),
        totalOut: Math.round(totalOut),
        lineCount,
        fileName: file.name,
        summary: summary && summary.hasData ? summary : null,
      });
      log('PARSE COMPLETE — REVIEW BELOW');
    } catch (e) {
      log(`ERROR: ${e.message}`);
      setError(`PDF parsing failed: ${e.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const pdfSyncToDashboard = () => {
    if (!pdfTxns || pdfTxns.length === 0) return;
    const snapshot = transactionsToSnapshot(pdfTxns, pdfBank || 'PDF');
    onSync(snapshot);
    setSuccess(true);
    log('✓ SYNC COMMITTED TO STORAGE');
    setTimeout(() => { setSuccess(false); setPdfTxns(null); setPdfMeta(null); setParsedPreview(null); setLogs([]); onClose(); }, 600);
  };

  const pdfDownloadCSV = () => {
    if (!pdfTxns || pdfTxns.length === 0) return;
    const header = 'Date,Description,Amount';
    const rows = pdfTxns.map(t => {
      const desc = (t.description || '').replace(/"/g, '""');
      return `${t.date},"${desc}",${t.amount.toFixed(2)}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (pdfMeta?.fileName || 'statement').replace(/\.pdf$/i, '') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    log('✓ CSV DOWNLOADED');
  };

  const handleGuided = async () => {
    const checking = parseFloat(gCheck) || 0; const savings = parseFloat(gSavings) || 0; const efund = parseFloat(gEF) || 0; const other = parseFloat(gOther) || 0;
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
    const snap = { date: new Date().toISOString().slice(0, 10), netWorth: { assets: { checking, savings, eFund: efund, other }, liabilities: debts.reduce((o, d) => ({ ...o, [d.name]: d.balance }), {}), total: totalAssets - tL }, debts, eFund: { balance: efund, monthlyExpenses: monthly, phase }, budget: { income, categories: budgetCats }, macro, protection, portfolio };
    // Sanity check: warn but don't block
    if (income > 50000) {
      if (!window.confirm(`Income entered: ${fmt(income)}. This seems unusually high for a monthly figure. Continue?`)) return;
    }
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
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}><X size={16} style={{ color: t.textDim }} /></button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderDim}` }}>
          {[{ k: 'file', l: 'CSV Import' }, { k: 'pdf', l: 'PDF Parse' }, { k: 'json', l: 'JSON' }, { k: 'guided', l: 'Manual' }].map(tb => (
            <button key={tb.k} onClick={() => { setTab(tb.k); setError(''); setParsedPreview(null); setPdfTxns(null); setPdfMeta(null); }} style={{
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
              <button onClick={confirmSync} style={{ width: '100%', padding: 14, background: t.accent, color: '#000', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>CONFIRM & SYNC</button>
            )}

            {/* Privacy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 9, color: t.warn }}>
              <ShieldAlert size={11} />
              <span>SENTINEL: All parsing on-device. No PII stored. Card numbers auto-redacted.</span>
            </div>
          </>)}

          {/* ── PDF PARSE TAB ── */}
          {tab === 'pdf' && (<>
            {/* Drop zone for PDF */}
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handlePDFFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => pdfRef.current?.click()}
              style={{
                height: 120, border: `2px dashed ${dragOver ? t.accent : t.borderMid}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: dragOver ? t.accentMuted : t.void, cursor: 'pointer',
                transition: 'all 0.2s', marginBottom: 12, borderRadius: 4,
              }}>
              <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handlePDFFile(e.target.files[0]); }} />
              {pdfLoading
                ? <Zap size={24} style={{ color: t.accent, animation: 'blink 0.5s infinite' }} />
                : <FileText size={22} style={{ color: dragOver ? t.accent : t.textDim }} />}
              <span style={{ fontSize: 10, color: t.textDim, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {pdfLoading ? 'Extracting text...' : 'Drop PDF or tap to browse'}
              </span>
              <span style={{ fontSize: 9, color: t.textGhost, marginTop: 4 }}>Bank statement PDFs only</span>
            </div>

            {/* Supported banks */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {['Chase', 'BofA', 'Amex', 'Capital One', 'Wells Fargo', 'Citi', 'USAA', 'Avant', 'Mission Lane', 'Navy Federal', 'Generic'].map(b => (
                <span key={b} style={{ fontSize: 8, color: b === 'Generic' ? t.warn : t.textDim, border: `1px solid ${b === 'Generic' ? t.warn + '40' : t.borderDim}`, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b}</span>
              ))}
            </div>

            {/* Terminal log */}
            <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 10, height: 100, overflow: 'hidden', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.accentDim, lineHeight: 1.6 }}>
                {logs.length === 0 && <div style={{ color: t.textGhost }}>PDF PARSER IDLE. Drop a statement to begin.</div>}
                {logs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>

            {error && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.danger, fontSize: 11, marginBottom: 8 }}><AlertCircle size={13} /> {error}</div>}

            {/* Transaction preview */}
            {pdfTxns && pdfMeta && (
              <div style={{ marginBottom: 12 }}>
                {/* Statement Summary Card (for credit cards) */}
                {pdfMeta.summary && (
                  <div style={{ background: t.void, border: `1px solid ${t.accent}30`, padding: 12, borderRadius: 4, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: t.accent, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>{pdfBank} Statement Summary</span>
                      {pdfMeta.summary.dueDate && <span style={{ fontSize: 9, color: t.warn }}>Due: {pdfMeta.summary.dueDate}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                      {pdfMeta.summary.previousBalance > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previous Balance</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>{fmt(pdfMeta.summary.previousBalance)}</div>
                      </div>}
                      <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Balance</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.danger, fontWeight: 700, fontSize: 16 }}>{fmt(pdfMeta.summary.newBalance)}</div>
                      </div>
                      {pdfMeta.summary.payments > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payments</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.accent }}>{fmt(pdfMeta.summary.payments)}</div>
                      </div>}
                      {pdfMeta.summary.interestCharged > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interest Charged</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.danger }}>{fmt(pdfMeta.summary.interestCharged)}</div>
                      </div>}
                      {pdfMeta.summary.apr > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>APR</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.danger }}>{pdfMeta.summary.apr}%</div>
                      </div>}
                      {pdfMeta.summary.minPayment > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Minimum Payment</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.warn }}>{fmt(pdfMeta.summary.minPayment)}</div>
                      </div>}
                      {pdfMeta.summary.creditLimit > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Credit Limit</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>{fmt(pdfMeta.summary.creditLimit)}</div>
                      </div>}
                      {pdfMeta.summary.totalInterestYTD > 0 && <div>
                        <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interest YTD</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", color: t.danger }}>{fmt(pdfMeta.summary.totalInterestYTD)}</div>
                      </div>}
                    </div>
                    {pdfMeta.summary.interestCharged > 0 && (
                      <div style={{ marginTop: 8, padding: '6px 8px', background: t.danger + '10', border: `1px solid ${t.danger}30`, borderRadius: 2, fontSize: 9, color: t.danger }}>
                        Daily interest burn: {fmt(pdfMeta.summary.newBalance * (pdfMeta.summary.apr / 100) / 365)}/day at {pdfMeta.summary.apr}% APR
                      </div>
                    )}
                  </div>
                )}

                {/* Transaction summary bar */}
                <div style={{ background: t.void, border: `1px solid ${t.borderDim}`, padding: 12, borderRadius: 4, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: t.accent, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>{pdfBank} — {pdfMeta.count} transactions</span>
                    <span style={{ fontSize: 9, color: t.textDim }}>{pdfMeta.dateRange}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Income / Credits</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, fontFamily: "'Space Mono', monospace" }}>{fmt(pdfMeta.totalIn)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expenses / Debits</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.danger, fontFamily: "'Space Mono', monospace" }}>{fmt(pdfMeta.totalOut)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: (pdfMeta.totalIn - pdfMeta.totalOut) >= 0 ? t.accent : t.danger, fontFamily: "'Space Mono', monospace" }}>
                        {(pdfMeta.totalIn - pdfMeta.totalOut) >= 0 ? '' : '-'}{fmt(Math.abs(pdfMeta.totalIn - pdfMeta.totalOut))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction list (scrollable) */}
                <div style={{ maxHeight: 200, overflow: 'auto', border: `1px solid ${t.borderDim}`, borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: t.elevated, position: 'sticky', top: 0 }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.borderDim}` }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.borderDim}` }}>Description</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: t.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.borderDim}` }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfTxns.slice(0, 50).map((txn, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${t.borderDim}` }}>
                          <td style={{ padding: '5px 8px', color: t.textDim, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{txn.date}</td>
                          <td style={{ padding: '5px 8px', color: t.textPrimary, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: txn.amount >= 0 ? t.accent : t.textPrimary }}>
                            {txn.amount >= 0 ? '+' : ''}{txn.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pdfTxns.length > 50 && (
                    <div style={{ padding: '6px 8px', fontSize: 9, color: t.textDim, textAlign: 'center', borderTop: `1px solid ${t.borderDim}` }}>
                      Showing 50 of {pdfTxns.length} — all transactions included in sync/download
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <button onClick={pdfSyncToDashboard} style={{
                    padding: 14, background: t.accent, color: '#000',
                    border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', textTransform: 'uppercase', borderRadius: 2,
                  }}>SYNC TO DASHBOARD</button>
                  <button onClick={pdfDownloadCSV} style={{
                    padding: 14, background: 'none', color: t.accent,
                    border: `1px solid ${t.accent}`, fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', textTransform: 'uppercase', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}><Download size={13} /> DOWNLOAD CSV</button>
                </div>
              </div>
            )}

            {success && <div style={{ color: t.accent, fontSize: 11, marginBottom: 8 }}>✓ SYNC COMMITTED</div>}

            {/* Privacy notice */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 9, color: t.warn }}>
              <ShieldAlert size={11} />
              <span>100% CLIENT-SIDE. PDF never leaves your device. Zero network calls. Sentinel redaction applied.</span>
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
            {parsedPreview && <button onClick={confirmSync} style={{ width: '100%', padding: 14, background: t.accent, color: '#000', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', marginBottom: 8 }}>CONFIRM & SYNC</button>}
            {!parsedPreview && <button onClick={handlePasteSync} disabled={jsonValidating || !json} style={{ width: '100%', padding: 14, background: jsonValidating ? t.elevated : t.accent, color: jsonValidating ? t.textDim : '#000', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: jsonValidating ? 'wait' : 'pointer', textTransform: 'uppercase' }}>{jsonValidating ? 'VALIDATING...' : 'VALIDATE SCHEMA'}</button>}
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
                </div>
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
              <button onClick={handleGuided} style={{ width: '100%', padding: 14, background: t.accent, color: '#000', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>BUILD & SYNC</button>
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
  const mods = [{ key: 'directive', label: 'Daily Directive' }, { key: 'netWorth', label: 'Net Worth' }, { key: 'debt', label: 'Debt Destruction' }, { key: 'eFund', label: 'Emergency Fund' }, { key: 'budget', label: 'Budget Status' }, { key: 'protection', label: 'Protection Layer' }, { key: 'portfolio', label: 'Portfolio' }];
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 9 }}>
            <div style={{ color: t.textDim }}>+50%/mo extra: <span style={{ color: t.accent }}>{accelerated50 * 30}d</span> <span style={{ color: t.textGhost }}>({(liberationMonths - accelerated50)} mo saved)</span></div>
            <div style={{ color: t.textDim }}>+100%/mo extra: <span style={{ color: t.accent }}>{accelerated100 * 30}d</span> <span style={{ color: t.textGhost }}>({(liberationMonths - accelerated100)} mo saved)</span></div>
          </div>
        </div>
      );
    })()}
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
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const totalSpent = cats.reduce((s, c) => s + (c.actual || 0), 0);
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
  const totalSpent = cats.reduce((s, c) => s + (c.actual || 0), 0);
  const blownCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 1);
  const warnCats = cats.filter(c => c.budgeted > 0 && (c.actual / c.budgeted) >= 0.75 && (c.actual / c.budgeted) < 1);
  const velocity = calcVelocity(latest || {});
  const ef = latest?.eFund || {};
  const days = runwayDays(ef);
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
// STATUS STRIP — Stage + Velocity + Daily Burn + Savings Rate
// ═══════════════════════════════════════════════════
function StatusStrip({ latest, t }) {
  const stage = calcStage(latest);
  const meta = STAGE_META[stage] || STAGE_META[0];
  const velocity = calcVelocity(latest);
  const di = dailyInterest(latest?.debts);
  const savingsRate = calcSavingsRate(latest);
  const action = nextAction(latest);
  const stageColor = t[meta.color] || t.accent;
  const isDefense = stage <= 2;

  const velColor = velocity >= 0.25 ? t.accent : velocity >= 0.10 ? t.warn : t.danger;
  const srColor = savingsRate >= 20 ? t.accent : savingsRate >= 10 ? t.warn : savingsRate > 0 ? t.warn : t.danger;

  return (
    <div style={{ marginBottom: 12, animation: 'fadeIn 0.4s ease-out' }}>
      {/* Stage banner */}
      <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderLeft: `3px solid ${stageColor}`, padding: '12px 16px', marginBottom: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: stageColor }}>{stage}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{meta.name}</div>
              <div style={{ fontSize: 9, color: stageColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{isDefense ? '🛡 DEFENSE MODE' : stage === 3 ? '🔓 LIBERATION' : '📈 WEALTH BUILDING'}</div>
            </div>
          </div>
          {/* Stage progress mini-bar */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ width: i === stage ? 16 : 8, height: 6, background: i <= stage ? stageColor : t.elevated, transition: 'all 0.3s', opacity: i <= stage ? 1 : 0.3 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="status-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
        {/* Velocity */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Velocity</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: velColor }}>{(velocity * 100).toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 8, color: velColor, textTransform: 'uppercase' }}>{velocity >= 0.25 ? 'ON TRACK' : velocity >= 0.10 ? 'ALERT' : 'CRISIS'}<span style={{ color: t.textDim }}> / 25% target</span></div>
        </div>
        {/* Daily Burn */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Daily Burn</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: di > 0 ? t.danger : t.accent }}>${di.toFixed(2)}</div>
          <div style={{ fontSize: 8, color: di > 0 ? t.danger : t.accent, textTransform: 'uppercase' }}>{di > 0 ? `${fmt(Math.round(di * 30))}/mo wasted` : 'ZERO BURN'}</div>
        </div>
        {/* Savings Rate */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Savings Rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: srColor }}>{savingsRate.toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase' }}>{savingsRate >= 20 ? 'HEALTHY' : savingsRate > 0 ? 'LOW' : 'NO DATA'}</div>
        </div>
        {/* Runway */}
        <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, padding: '10px 14px' }}>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Runway</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: runwayColor(runwayDays(latest?.eFund), t) }}>{runwayDays(latest?.eFund)}<span style={{ fontSize: 10, fontWeight: 400 }}> days</span></div>
          <div style={{ fontSize: 8, color: t.textDim, textTransform: 'uppercase' }}>E-Fund Phase {latest?.eFund?.phase || 1}/4</div>
        </div>
      </div>

      {/* Next Action callout */}
      <div style={{ background: t.surface, border: `1px solid ${t.borderDim}`, borderLeft: `3px solid ${t[action.color] || t.accent}`, padding: '8px 14px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={12} style={{ color: t[action.color] || t.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: t.textSecondary }}>{action.text}</span>
      </div>
    </div>
  );
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
        <Shield size={14} style={{ color: t.accent }} /><span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: t.accent, fontWeight: 700, textShadow: isDark ? `0 0 10px ${t.accent}30` : 'none', whiteSpace: 'nowrap' }}>FORTIFYOS</span><span style={{ color: t.textGhost, fontSize: 9 }}>v2.3</span>
      </div>
      <span className="phase-label" style={{ color: t.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{latest.macro?.bennerPhase ? `Benner: ${latest.macro.bennerPhase}` : 'Phase-Aware Execution Active'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setSyncOpen(true)} style={{ background: 'none', border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><RefreshCw size={10} /> Sync</button>
        <Settings size={16} style={{ color: t.textSecondary, cursor: 'pointer' }} onClick={() => setSettingsOpen(true)} />
      </div>
    </header>
    <div style={{ position: 'fixed', top: 48, width: '100%', height: 1, background: `${t.accent}15`, zIndex: 50 }} />
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 12px 52px' }}>
      <StatusStrip latest={latest} t={t} />
      <div className="main-grid" style={{ display: 'grid', gap: 12 }}>
        <DirectiveMod visible={vis.includes('directive')} latest={latest} t={t} />
        <NetWorthMod snapshots={snapshots} latest={latest} visible={vis.includes('netWorth')} t={t} />
        <DebtMod latest={latest} visible={vis.includes('debt')} t={t} />
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
  const t = isDark ? THEMES.dark : THEMES.light;

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
        }));
        const migratedLatest = lt ? {
          ...lt,
          date: sanitizeDate(lt.date),
          netWorth: { ...lt.netWorth, assets: { savings: 0, ...((lt.netWorth || {}).assets || {}) } },
          portfolio: { equities: [], options: [], crypto: [], ...((lt || {}).portfolio || {}) },
          macro: { ...DEFAULT_SNAPSHOT.macro, ...((lt || {}).macro || {}) },
        } : migrated[migrated.length - 1];
        setSnapshots(migrated);
        setLatest(migratedLatest);
      }
      // Always start at landing — user navigates to dashboard manually
      setView('landing');
      if (st) {
        if ((st._v || 0) < DEFAULT_SETTINGS._v) {
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
    // Deep merge for nested objects to prevent losing crypto/macro/protection data
    const merged = { ...DEFAULT_SNAPSHOT, ...data };
    // Sanitize date — reject garbage, stale, or future dates
    merged.date = sanitizeDate(data.date);
    // Ensure nested portfolio/protection/macro objects merge with defaults
    merged.portfolio = { ...DEFAULT_SNAPSHOT.portfolio, ...(data.portfolio || {}) };
    merged.macro = { ...DEFAULT_SNAPSHOT.macro, ...(data.macro || {}) };
    merged.protection = { ...DEFAULT_SNAPSHOT.protection, ...(data.protection || {}) };
    merged.netWorth = { ...DEFAULT_SNAPSHOT.netWorth, ...(data.netWorth || {}) };
    merged.netWorth.assets = { ...DEFAULT_SNAPSHOT.netWorth.assets, ...(data.netWorth?.assets || {}) };
    // Recalculate net worth total to include crypto + equity + savings
    const assets = merged.netWorth.assets;
    const cashTotal = (assets.checking || 0) + (assets.savings || 0) + (assets.eFund || 0) + (assets.other || 0);
    const eqVal = (merged.portfolio.equities || []).reduce((s, e) => s + (e.shares || 0) * (e.lastPrice || 0), 0);
    const cryptoVal = (merged.portfolio.crypto || []).reduce((s, c) => s + (c.amount || 0) * (c.lastPrice || 0), 0);
    const liabilities = Object.values(merged.netWorth.liabilities || {}).reduce((s, v) => s + (v || 0), 0);
    merged.netWorth.total = cashTotal + eqVal + cryptoVal - liabilities;
    const ns = [...snapshots, merged]; setSnapshots(ns); setLatest(merged);
    await store.set('fortify-snapshots', ns); await store.set('fortify-latest', merged);
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
        @media (max-width: 768px) {
          .phase-label,.footer-label { display: none !important; }
          .main-grid { grid-template-columns: 1fr !important; }
          .sync-row-3 { grid-template-columns: 1fr !important; }
          .status-metrics { grid-template-columns: 1fr 1fr !important; }
          .sync-row-debt { grid-template-columns: 1fr 1fr !important; }
          .hero-title { font-size: 36px !important; }
          .hero-sub { font-size: 13px !important; }
          .hero-buttons { flex-direction: column !important; }
          .footer-stats { grid-template-columns: 1fr !important; }
          .footer-stat-cell { border-right: none !important; border-bottom: 1px solid ${t.borderDim}; }
          .footer-stat-cell:last-child { border-bottom: none; }
          .stage-labels span { font-size: 6px !important; }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 998, opacity: 0.025, background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${t.accent} 2px, ${t.accent} 4px)` }} />
      {view === 'loading' && <div style={{ background: t.void, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: t.accent, fontFamily: "'Space Mono', monospace", fontSize: 14, textShadow: isDark ? `0 0 10px ${t.accent}40` : 'none' }}>FORTIFYOS initializing...</div></div>}
      {view === 'landing' && <><LandingView t={t} isDark={isDark} onToggleTheme={toggleTheme} onInitialize={() => setSyncOpen(true)} onDocs={() => setView('docs')} hasData={snapshots.length > 0} onDashboard={() => setView('dashboard')} /><UniversalSync open={syncOpen} onClose={() => setSyncOpen(false)} onSync={handleSync} t={t} /></>}
      {view === 'docs' && <DocsView t={t} isDark={isDark} onBack={() => setView('landing')} onToggleTheme={toggleTheme} />}
      {view === 'dashboard' && <DashboardView snapshots={snapshots} latest={latest} settings={settings} t={t} isDark={isDark} onSync={handleSync} onToggle={toggleModule} onExport={handleExport} onClear={handleClear} onToggleTheme={toggleTheme} syncFlash={syncFlash} onHome={() => setView('landing')} />}
    </div>
  );
}
