#!/usr/bin/env node
/**
 * update-prices.js
 * Fetches live market prices and writes them to public/macro.json.
 * Run before deploying or via GitHub Actions cron.
 *
 * Sources:
 *   Crypto        → CoinGecko free API (no key needed)
 *   Stocks/ETFs   → Finnhub (uses FINNHUB_KEY env var if set, preferred)
 *                   Falls back to Yahoo Finance if no key
 *   Core macros   → Yahoo Finance (gold/silver/oil futures, VIX, indices)
 *   News          → CryptoCompare free API
 *
 * GitHub Actions: set FINNHUB_KEY in repo Settings → Secrets → Actions
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const OUTPUT       = join(__dirname, '..', 'public', 'macro.json');
const FINNHUB_KEY  = process.env.FINNHUB_KEY || null;

const today = () => new Date().toISOString().slice(0, 10);

if (FINNHUB_KEY) {
  console.log('  ✓ FINNHUB_KEY detected — using Finnhub for stock quotes');
} else {
  console.log('  ⚠ No FINNHUB_KEY — falling back to Yahoo Finance for stocks');
}

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchJSON(url, label = url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FortifyOS/1.0; price-updater)',
        'Accept':     'application/json',
      },
    });
    if (!r.ok) { console.warn(`  ${label}: HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) {
    console.warn(`  ${label}: ${e.message}`);
    return null;
  }
}

async function fetchText(url, label = url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FortifyOS/1.0; price-updater)',
        'Accept':     'text/plain,text/csv,*/*',
      },
    });
    if (!r.ok) { console.warn(`  ${label}: HTTP ${r.status}`); return null; }
    return await r.text();
  } catch (e) {
    console.warn(`  ${label}: ${e.message}`);
    return null;
  }
}

async function fetchFredSeriesCSV(seriesId) {
  const csv = await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`, `FRED ${seriesId}`);
  if (!csv) return null;
  const rows = csv.trim().split('\n').slice(1).map((line) => line.split(','));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const [date, rawValue] = rows[i];
    const value = Number(rawValue);
    if (date && Number.isFinite(value)) {
      return { date, value, change: null };
    }
  }
  return null;
}

// ── Finnhub ────────────────────────────────────────────────────────────────
// GET /quote returns: { c: price, d: change$, dp: change%, h, l, o, pc }

async function fetchFinnhub(symbol) {
  if (!FINNHUB_KEY) return null;
  const j = await fetchJSON(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
    `Finnhub ${symbol}`,
  );
  if (!j || j.c == null || j.c === 0) return null;
  const price  = +j.c.toFixed(2);
  const change = j.dp != null ? +j.dp.toFixed(3) : null;
  return { value: price, change };
}

// ── crypto ─────────────────────────────────────────────────────────────────

async function fetchCrypto() {
  const ids = 'bitcoin,ethereum,solana,ripple,dogecoin,cardano,avalanche-2,chainlink';
  const j = await fetchJSON(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    'CoinGecko crypto',
  );
  const result = {};
  const map = { bitcoin: 'btc', ethereum: 'eth', solana: 'sol', ripple: 'xrp', dogecoin: 'doge', cardano: 'ada', 'avalanche-2': 'avax', chainlink: 'link' };
  for (const [id, key] of Object.entries(map)) {
    if (j?.[id]?.usd) {
      const val = j[id].usd;
      const chg = +(j[id].usd_24h_change ?? 0).toFixed(3);
      result[key] = { value: val < 1 ? +val.toFixed(5) : +val.toFixed(2), change: chg };
      console.log(`  ${key.toUpperCase().padEnd(5)}: $${result[key].value.toLocaleString()} (${chg}%)`);
    }
  }
  return result;
}

// ── Yahoo Finance ──────────────────────────────────────────────────────────

async function fetchYahoo(symbol) {
  const j = await fetchJSON(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`,
    `Yahoo ${symbol}`,
  );
  const result = j?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  let price = Number(meta.regularMarketPrice);
  let prev  = Number(meta.chartPreviousClose ?? meta.previousClose);

  // Fall back to close array if meta price is missing
  if (!Number.isFinite(price)) {
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(v => Number.isFinite(v));
    if (closes.length) price = closes[closes.length - 1];
    if (closes.length > 1) prev = closes[closes.length - 2];
  }
  if (!Number.isFinite(price)) return null;

  const change = Number.isFinite(prev) && prev !== 0
    ? +((price - prev) / prev * 100).toFixed(3)
    : null;

  return { value: +price.toFixed(2), change };
}

async function fetchStocks() {
  // Core macro indicators (stored at top level of macro.json)
  const coreSymbols = {
    gold:   'GC=F',
    silver: 'SI=F',
    oil:    'CL=F',
    spy:    'SPY',
    vix:    '^VIX',
    sp500:  '^GSPC',
    nasdaq: '^IXIC',
  };

  // Extended ticker cache — stored in macro.json under "tickers" key
  // Searchable by uppercase ticker in the browser
  const tickerSymbols = {
    // Tech mega-caps
    AAPL: 'AAPL', MSFT: 'MSFT', NVDA: 'NVDA', GOOGL: 'GOOGL',
    META: 'META', AMZN: 'AMZN', TSLA: 'TSLA', AMD: 'AMD',
    // Finance / Fintech
    JPM: 'JPM', V: 'V', PYPL: 'PYPL', SQ: 'SQ', HOOD: 'HOOD',
    // Crypto-adjacent equities
    COIN: 'COIN', MSTR: 'MSTR', RIOT: 'RIOT', MARA: 'MARA', CLSK: 'CLSK',
    // Speculative / high-interest
    PLTR: 'PLTR', SOFI: 'SOFI', UPST: 'UPST', AFRM: 'AFRM',
    // ETFs
    QQQ: 'QQQ', ARKK: 'ARKK', IWM: 'IWM', GLD: 'GLD', SLV: 'SLV',
    // Crypto via Yahoo (backup to CoinGecko)
    BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD', DOGE: 'DOGE-USD',
  };

  const result = {};
  console.log('\nFetching core indicators...');
  for (const [key, symbol] of Object.entries(coreSymbols)) {
    const d = await fetchYahoo(symbol);
    if (d) {
      result[key] = d;
      console.log(`  ${key.padEnd(8)}: $${d.value.toLocaleString()} (${d.change !== null ? d.change + '%' : 'n/a'})`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nFetching extended ticker cache (${FINNHUB_KEY ? 'Finnhub' : 'Yahoo Finance'})...`);
  const tickers = {};
  for (const [ticker, symbol] of Object.entries(tickerSymbols)) {
    // Finnhub preferred: clean API, no CORS proxy needed, reliable
    // Yahoo Finance fallback: no key required but occasionally rate-limits
    const d = FINNHUB_KEY
      ? (await fetchFinnhub(ticker) || await fetchYahoo(symbol))
      : await fetchYahoo(symbol);
    if (d) {
      tickers[ticker] = { ...d, asOf: today() };
      const src = FINNHUB_KEY ? 'FH' : 'YF';
      console.log(`  [${src}] ${ticker.padEnd(6)}: $${d.value.toLocaleString()} (${d.change !== null ? d.change + '%' : 'n/a'})`);
    } else {
      console.warn(`  ${ticker.padEnd(6)}: no data`);
    }
    await new Promise(r => setTimeout(r, FINNHUB_KEY ? 120 : 250)); // Finnhub: 60 req/min free
  }
  result.tickers = tickers;

  return result;
}

// ── news ───────────────────────────────────────────────────────────────────

const NEWS_OUTPUT = join(__dirname, '..', 'public', 'macro-news.json');

function classifySentiment(title = '') {
  const lo = title.toLowerCase();
  if (/surge|rally|soar|gains?|rises?|bullish|breaks?|record|ath|approval|adoption|jumps?|pump|grew|higher|outperform/.test(lo)) return 'Bullish';
  if (/drops?|falls?|crash|plunges?|bearish|declines?|concern|risk|selloff|fear|ban|rejects?|dumps?|lower|warning|losses/.test(lo)) return 'Bearish';
  return 'Neutral';
}

async function fetchNews() {
  const j = await fetchJSON(
    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&limit=30',
    'CryptoCompare News',
  );
  const items = Array.isArray(j?.Data) ? j.Data : [];
  console.log(`  Fetched ${items.length} headlines`);
  return items.map(item => ({
    title:      item.title,
    url:        item.url,
    source:     item.source_info?.name || item.source || 'CryptoCompare',
    published:  item.published_on,
    categories: item.categories || '',
    tags:       item.tags || '',
    sentiment:  classifySentiment(item.title),
  }));
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== FortifyOS price updater ===');
  console.log(`Writing to: ${OUTPUT}\n`);

  // Read existing file to preserve FRED data (WALCL, TGA, RRP, source)
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
    console.log(`Loaded existing macro.json (asOf: ${existing.asOf})\n`);
  } catch {
    console.log('No existing macro.json found — creating from scratch.\n');
  }

  console.log('Fetching crypto...');
  const crypto = await fetchCrypto();

  console.log('\nFetching stocks & commodities...');
  const stocks = await fetchStocks();

  console.log('\nFetching Fed Funds...');
  const fedFundsRate = await fetchFredSeriesCSV('DFF');
  if (fedFundsRate) {
    console.log(`  DFF     : ${fedFundsRate.value}% (${fedFundsRate.date})`);
  }

  console.log('\nFetching news headlines...');
  const newsItems = await fetchNews();

  const output = {
    ...existing,
    ...(fedFundsRate ? {
      fedFundsRate,
      source: {
        ...(existing.source || {}),
        fedFundsRate: 'FRED CSV: DFF',
      },
    } : {}),
    ...crypto,
    ...stocks,
    asOf: today(),
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n✓ macro.json updated (asOf: ${output.asOf})`);

  // Write news to separate file
  const newsOutput = { asOf: today(), items: newsItems };
  writeFileSync(NEWS_OUTPUT, JSON.stringify(newsOutput, null, 2));
  console.log(`✓ macro-news.json updated (${newsItems.length} headlines)`);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
