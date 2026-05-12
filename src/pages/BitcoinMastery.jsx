import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileText, Home, LayoutGrid, Settings, Shield, TrendingUp } from "lucide-react";
import SpecialistShell from "../components/SpecialistShell";
import "./bitcoin-mastery.css";

const SATS_PER_BTC = 100_000_000;
const HARD_CAP_BTC = 21_000_000;

function fmtUsd(n) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtNum(n, maxFrac = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function fmtCompact(n, maxFrac = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: maxFrac });
}

async function fetchJson(url, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "text/plain, application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function firstValidSource(sources) {
  const attempts = sources.map(async (source) => {
    const value = await source.load();
    if (value == null || (typeof value === "number" && !Number.isFinite(value))) throw new Error(`${source.name} returned no value`);
    return { value, source: source.name };
  });
  const settled = await Promise.allSettled(attempts);
  const hit = settled.find((result) => result.status === "fulfilled");
  return hit?.value ?? { value: null, source: null };
}

function parseBlockHeight(payload) {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (payload && typeof payload === "object") {
    const nested = payload.height ?? payload.block_height ?? payload.data?.height ?? payload.data?.block_height;
    return parseBlockHeight(nested);
  }
  return null;
}

function parseSats(payload) {
  const raw = typeof payload === "string" ? Number(payload.trim()) : Number(payload);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function parseMempoolInfo(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    count: Number.isFinite(Number(payload.count)) ? Number(payload.count) : null,
    vsize: Number.isFinite(Number(payload.vsize)) ? Number(payload.vsize) : null,
    totalFee: Number.isFinite(Number(payload.total_fee)) ? Number(payload.total_fee) : null,
  };
}

function parseDifficultyAdjustment(payload) {
  if (!payload || typeof payload !== "object") return null;
  const progress = Number(payload.progressPercent ?? payload.progress ?? payload.progress_percentage);
  const remaining = Number(payload.remainingBlocks ?? payload.remaining_blocks);
  return {
    progress: Number.isFinite(progress) ? progress : null,
    remainingBlocks: Number.isFinite(remaining) ? remaining : null,
  };
}

function parsePriceUsd(payload) {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload.replace(/[$,]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (payload && typeof payload === "object") {
    if (payload?.result && typeof payload.result === "object") {
      const firstMarket = Object.values(payload.result)[0];
      const krakenLast = firstMarket?.c?.[0] ?? firstMarket?.p?.[0] ?? firstMarket?.a?.[0];
      const parsedKraken = parsePriceUsd(krakenLast);
      if (Number.isFinite(parsedKraken)) return parsedKraken;
    }
    const binancePrice = payload?.symbol === "BTCUSDT" ? payload?.price : undefined;
    const nested =
      payload?.bitcoin?.usd ??
      payload?.data?.amount ??
      payload?.result?.price ??
      binancePrice ??
      payload?.USD?.last ??
      payload?.last ??
      payload?.price ??
      payload?.amount;
    return parsePriceUsd(nested);
  }
  return null;
}

async function fetchYahooPriceUsd() {
  const target = "https://query2.finance.yahoo.com/v8/finance/chart/BTC-USD?range=2d&interval=1d";
  const proxies = [
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  for (const proxy of proxies) {
    try {
      const payload = await fetchJson(proxy(target));
      const result = payload?.chart?.result?.[0];
      const metaPrice = Number(result?.meta?.regularMarketPrice);
      if (Number.isFinite(metaPrice)) return metaPrice;
      const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((value) => Number.isFinite(value));
      if (closes.length) return closes[closes.length - 1];
    } catch {}
  }

  return null;
}

async function fetchFirstPriceUsd() {
  const sources = [
    { name: "CoinGecko", load: async () => parsePriceUsd(await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")) },
    { name: "Coinbase", load: async () => parsePriceUsd(await fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot")) },
    { name: "Binance US", load: async () => parsePriceUsd(await fetchJson("https://api.binance.us/api/v3/ticker/price?symbol=BTCUSDT")) },
    { name: "Kraken", load: async () => parsePriceUsd(await fetchJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")) },
    { name: "Gemini", load: async () => parsePriceUsd(await fetchJson("https://api.gemini.com/v1/pubticker/btcusd")) },
    { name: "Yahoo", load: async () => fetchYahooPriceUsd() },
  ];

  return firstValidSource(sources);
}

async function fetchFirstBlockHeight() {
  const sources = [
    { name: "mempool.space", load: async () => parseBlockHeight(await fetchText("https://mempool.space/api/blocks/tip/height")) },
    { name: "Blockstream", load: async () => parseBlockHeight(await fetchText("https://blockstream.info/api/blocks/tip/height")) },
    { name: "blockchain.info", load: async () => parseBlockHeight(await fetchText("https://blockchain.info/q/getblockcount")) },
  ];

  return firstValidSource(sources);
}

async function fetchIssuedSupplyBtc() {
  const sources = [
    { name: "blockchain.info", load: async () => {
      const sats = parseSats(await fetchText("https://blockchain.info/q/totalbc"));
      return sats == null ? null : sats / SATS_PER_BTC;
    } },
  ];
  return firstValidSource(sources);
}

async function fetchMempoolStats() {
  const sources = [
    { name: "mempool.space", load: async () => parseMempoolInfo(await fetchJson("https://mempool.space/api/mempool")) },
  ];
  return firstValidSource(sources);
}

async function fetchFeeStats() {
  const sources = [
    { name: "mempool.space", load: async () => {
      const fees = await fetchJson("https://mempool.space/api/v1/fees/recommended");
      return {
        fastestFee: Number.isFinite(Number(fees?.fastestFee)) ? Number(fees.fastestFee) : null,
        halfHourFee: Number.isFinite(Number(fees?.halfHourFee)) ? Number(fees.halfHourFee) : null,
        hourFee: Number.isFinite(Number(fees?.hourFee)) ? Number(fees.hourFee) : null,
      };
    } },
  ];
  return firstValidSource(sources);
}

async function fetchDifficultyStats() {
  const sources = [
    { name: "mempool.space", load: async () => parseDifficultyAdjustment(await fetchJson("https://mempool.space/api/v1/difficulty-adjustment")) },
  ];
  return firstValidSource(sources);
}

function estimateIssuedSupply(blockHeight) {
  const height = Number.isFinite(blockHeight) ? Math.max(0, Math.floor(blockHeight)) : null;
  if (height == null) return null;

  let remainingBlocks = height + 1;
  let reward = 50;
  let issued = 0;

  while (remainingBlocks > 0 && reward > 0) {
    const eraBlocks = Math.min(remainingBlocks, 210_000);
    issued += eraBlocks * reward;
    remainingBlocks -= eraBlocks;
    reward /= 2;
  }

  return Math.min(HARD_CAP_BTC, issued);
}

async function loadNetworkState() {
  const [priceResult, blockResult, supplyResult, mempoolResult, feeResult, difficultyResult] = await Promise.all([
    fetchFirstPriceUsd().catch(() => ({ value: null, source: null })),
    fetchFirstBlockHeight().catch(() => ({ value: null, source: null })),
    fetchIssuedSupplyBtc().catch(() => ({ value: null, source: null })),
    fetchMempoolStats().catch(() => ({ value: null, source: null })),
    fetchFeeStats().catch(() => ({ value: null, source: null })),
    fetchDifficultyStats().catch(() => ({ value: null, source: null })),
  ]);

  let priceUsd = priceResult.value;
  let priceSource = priceResult.source;
  const blockHeight = blockResult.value;
  const blockSource = blockResult.source;
  let supplyMined = supplyResult.value;
  let supplySource = supplyResult.source;
  const mempool = mempoolResult.value;
  const fees = feeResult.value;
  const difficulty = difficultyResult.value;
  const priceOk = Number.isFinite(priceUsd);
  const chainOk = Number.isFinite(blockHeight);

  if (priceOk) {
    try {
      localStorage.setItem("fortify_btc_price_usd", String(priceUsd));
    } catch {}
  } else {
    try {
      const cachedPrice = Number(localStorage.getItem("fortify_btc_price_usd"));
      if (Number.isFinite(cachedPrice) && cachedPrice > 0) {
        priceUsd = cachedPrice;
        priceSource = "cache";
      }
    } catch {}
  }

  if (!Number.isFinite(supplyMined) && chainOk) {
      supplyMined = estimateIssuedSupply(blockHeight);
      supplySource = "subsidy estimate";
  }
  const supplyPct = Number.isFinite(supplyMined) ? (supplyMined / HARD_CAP_BTC) * 100 : null;

  const realtimeOk = Number.isFinite(priceUsd) || chainOk || mempool || fees;
  const status = Number.isFinite(priceUsd) && chainOk ? "LIVE" : (realtimeOk ? "DEGRADED" : "OFFLINE");
  return {
    priceUsd,
    priceSource,
    blockHeight,
    blockSource,
    supplyMined,
    supplySource,
    supplyPct,
    mempool,
    mempoolSource: mempoolResult.source,
    fees,
    feeSource: feeResult.source,
    difficulty,
    difficultySource: difficultyResult.source,
    status,
    lastUpdatedIso: new Date().toISOString(),
  };
}

function usePulseOverlay() {
  const ref = useRef(null);
  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("bm-pulse--on");
    void el.offsetWidth;
    el.classList.add("bm-pulse--on");
  }, []);
  return { ref, trigger };
}

export default function BitcoinMastery({ onBack, onHome, onDashboard, onMacroSentinel, onInvestmentRadar, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [net, setNet] = useState({
    priceUsd: null,
    priceSource: null,
    blockHeight: null,
    blockSource: null,
    supplyMined: null,
    supplySource: null,
    supplyPct: null,
    mempool: null,
    mempoolSource: null,
    fees: null,
    feeSource: null,
    difficulty: null,
    difficultySource: null,
    lastUpdatedIso: null,
    status: "OFFLINE",
  });
  const { ref: pulseRef, trigger: pulse } = usePulseOverlay();
  const convictionPct = 85;

  const scarcity = useMemo(() => {
    const pct = net.supplyPct ?? 0;
    const mined = net.supplyMined ?? null;
    const remaining = mined == null ? null : Math.max(0, HARD_CAP_BTC - mined);
    return { pct, mined, remaining };
  }, [net.supplyPct, net.supplyMined]);
  const halving = useMemo(() => {
    const msDay = 86400000;
    const now = new Date();
    const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const lastHalvingUTC = Date.UTC(2024, 3, 20);
    const nextHalvingUTC = Date.UTC(2028, 3, 18);
    const daysPost = Math.floor((todayUTC - lastHalvingUTC) / msDay);
    const window500Closed = daysPost > 500;
    const window500EndUTC = lastHalvingUTC + 500 * msDay;
    const nextBuyUTC = nextHalvingUTC - 500 * msDay;
    const daysToNextBuy = Math.floor((nextBuyUTC - todayUTC) / msDay);
    const daysToNextHalving = Math.floor((nextHalvingUTC - todayUTC) / msDay);
    const buyZoneOpen = daysToNextBuy <= 0;

    let phase = "Pre-Halving";
    let phaseTone = "neutral";
    let phaseDesc = "Before the April 2024 halving.";
    if (daysPost >= 0 && daysPost <= 200) {
      phase = "Early Expansion";
      phaseTone = "accum";
      phaseDesc = "Fresh post-halving supply shock. Reflexive upside is usually strongest here.";
    } else if (daysPost <= 350) {
      phase = "Mid Expansion";
      phaseTone = "accum";
      phaseDesc = "Historically the strongest upside zone of the cycle. Expansion is still active.";
    } else if (daysPost <= 500) {
      phase = "Distribution";
      phaseTone = "dist";
      phaseDesc = "Late-cycle historically. Upside may persist, but risk management matters more.";
    } else if (daysPost > 500) {
      phase = "Past Peak / Wait";
      phaseTone = "wait";
      phaseDesc = "The +500 day window is closed. Monitor for the next accumulation gate.";
    }

    const posInWindow = Math.max(0, Math.min(100, ((daysPost + 500) / 1000) * 100));
    const fmtDate = (utc) => new Date(utc).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return {
      btcPrice: net.priceUsd,
      daysPost,
      phase,
      phaseTone,
      phaseDesc,
      posInWindow,
      lastHalvingLabel: fmtDate(lastHalvingUTC),
      window500Label: fmtDate(window500EndUTC),
      window500Closed,
      nextHalvingLabel: fmtDate(nextHalvingUTC),
      nextBuyLabel: fmtDate(nextBuyUTC),
      daysToNextBuy,
      daysToNextHalving,
      buyZoneOpen,
    };
  }, [net.priceUsd]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await loadNetworkState();
      if (!alive) return;
      setNet((prev) => ({ ...prev, ...next }));
      if (next.status !== "OFFLINE") pulse();
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pulse]);

  const navItems = [
    { key: "home", label: "Home", icon: Home, onClick: onHome },
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, onClick: onDashboard || onBack },
    { key: "radar", label: "Radar", icon: Eye, onClick: onMacroSentinel },
    { key: "invest", label: "AI Portfolio", icon: TrendingUp, onClick: onInvestmentRadar },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: null, current: true },
    { key: "docs", label: "Field Manual", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  const lastSync = net.lastUpdatedIso == null ? "—" : new Date(net.lastUpdatedIso).toLocaleString();

  return (
    <SpecialistShell
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      navItems={navItems}
    >
    <div className={`bm-root fo-page-shell ${isDark ? "bm-dark" : "bm-light"}`}>
      <div ref={pulseRef} className="bm-pulse-overlay" aria-hidden="true" />

      <header className="bm-hero fo-page-hero">
        <div className="bm-statusbar" role="group" aria-label="Network status">
          <span className={`bm-live ${net.status === "LIVE" ? "is-live" : net.status === "DEGRADED" ? "is-degraded" : "is-offline"}`}>
            ● {net.status} NETWORK FEED
          </span>
          <span className="bm-divider">|</span>
          <span className="bm-kv">
            <span className="bm-k">BTC/USD</span>
            <span className="bm-v">{net.priceUsd == null ? "—" : fmtUsd(net.priceUsd)}</span>
          </span>
          <span className="bm-divider">|</span>
          <span className="bm-kv">
            <span className="bm-k">BLOCK</span>
            <span className="bm-v">{net.blockHeight == null ? "—" : fmtNum(net.blockHeight)}</span>
          </span>
          <span className="bm-divider">|</span>
          <span className="bm-kv">
            <span className="bm-k">HARD CAP</span>
            <span className="bm-v">21,000,000</span>
          </span>
        </div>

        <h1 className="bm-title">THE SOVEREIGN STANDARD</h1>
        <p className="bm-subtitle">1 BTC = 1 / 21,000,000 OF FUTURE GLOBAL WEALTH</p>

        <div className="bm-scarcity">
          <div className="bm-scarcity-row">
            <span className="bm-scarcity-label">
              NETWORK SCARCITY:
              <span className="bm-scarcity-val">{net.supplyPct == null ? " — " : ` ${scarcity.pct.toFixed(2)}% `}</span>
              MINED
            </span>
            <span className="bm-scarcity-meta">
              {scarcity.mined == null ? "SUPPLY: —" : `SUPPLY: ${fmtNum(scarcity.mined, 4)} / 21,000,000`}
              {scarcity.remaining == null ? "" : `  |  REMAINING: ${fmtNum(scarcity.remaining, 4)}`}
            </span>
          </div>
          <div className="bm-progress" aria-label="Scarcity progress">
            <div className="bm-progress-track">
              <div className="bm-progress-fill" style={{ width: `${Math.max(0, Math.min(100, scarcity.pct))}%` }} />
            </div>
          </div>
        </div>
      </header>

      <section className="bm-live-panel fo-page-section" aria-label="Live Bitcoin network telemetry">
        <div className="bm-live-panel-head">
          <div>
            <span className={`bm-live ${net.status === "LIVE" ? "is-live" : net.status === "DEGRADED" ? "is-degraded" : "is-offline"}`}>
              ● {net.status} REAL-TIME BITCOIN INTEGRATION
            </span>
            <h2>Live Chain Feed</h2>
          </div>
          <div className="bm-live-sync">REFRESHES EVERY 30S · {lastSync}</div>
        </div>
        <div className="bm-live-grid">
          <div className="bm-live-cell">
            <span>BTC/USD</span>
            <strong>{net.priceUsd == null ? "—" : fmtUsd(net.priceUsd)}</strong>
            <small>{net.priceSource || "waiting for price source"}</small>
          </div>
          <div className="bm-live-cell">
            <span>Tip Height</span>
            <strong>{net.blockHeight == null ? "—" : fmtNum(net.blockHeight)}</strong>
            <small>{net.blockSource || "waiting for chain source"}</small>
          </div>
          <div className="bm-live-cell">
            <span>Issued Supply</span>
            <strong>{net.supplyMined == null ? "—" : fmtNum(net.supplyMined, 8)}</strong>
            <small>{net.supplySource || "waiting for supply source"}</small>
          </div>
          <div className="bm-live-cell">
            <span>Remaining</span>
            <strong>{scarcity.remaining == null ? "—" : fmtNum(scarcity.remaining, 8)}</strong>
            <small>{net.supplyPct == null ? "hard cap pending" : `${net.supplyPct.toFixed(6)}% issued`}</small>
          </div>
          <div className="bm-live-cell">
            <span>Mempool</span>
            <strong>{net.mempool?.count == null ? "—" : fmtCompact(net.mempool.count, 1)}</strong>
            <small>{net.mempool?.vsize == null ? "transactions pending" : `${fmtCompact(net.mempool.vsize, 1)} vB pending`}</small>
          </div>
          <div className="bm-live-cell">
            <span>Priority Fee</span>
            <strong>{net.fees?.fastestFee == null ? "—" : `${fmtNum(net.fees.fastestFee)} sat/vB`}</strong>
            <small>{net.fees?.halfHourFee == null ? "waiting for fee source" : `30m ${fmtNum(net.fees.halfHourFee)} · 60m ${fmtNum(net.fees.hourFee ?? net.fees.halfHourFee)} sat/vB`}</small>
          </div>
          <div className="bm-live-cell">
            <span>Difficulty Epoch</span>
            <strong>{net.difficulty?.progress == null ? "—" : `${net.difficulty.progress.toFixed(1)}%`}</strong>
            <small>{net.difficulty?.remainingBlocks == null ? "waiting for epoch source" : `${fmtNum(net.difficulty.remainingBlocks)} blocks remaining`}</small>
          </div>
          <div className="bm-live-cell">
            <span>Market Cap</span>
            <strong>{net.priceUsd == null || net.supplyMined == null ? "—" : fmtUsd(net.priceUsd * net.supplyMined)}</strong>
            <small>price × issued supply</small>
          </div>
        </div>
      </section>

      <main className="bm-grid">
        <section className="bm-card fo-page-section bm-card--accent-gold">
          <div className="bm-card-h bm-card-h--split">
            <div>
              <span className="bm-idx">01</span>
              <h2>MACRO NARRATIVE: THE GENESIS</h2>
            </div>
            <span className="bm-proto-status">
              PROTOCOL STATUS: <span className="bm-green">OPERATIONAL</span>
            </span>
          </div>
          <p>
            Bitcoin is a decentralized protocol of trust with an immutable ledger and a hard cap
            enforced by global consensus. Born from the 2008 financial crisis to provide network scarcity.
          </p>
          <div className="bm-tags">
            <span className="bm-tag">HARD CAP: 21,000,000</span>
            <span className="bm-tag">ISSUANCE: HALVING CYCLE</span>
            <span className="bm-tag">LEDGER: IMMUTABLE</span>
          </div>
        </section>

        <section className="bm-card fo-page-section bm-card--accent-green">
          <div className="bm-card-h">
            <span className="bm-idx">02</span>
            <h2>COMPARATIVE ANALYSIS: LEAKY ASSETS</h2>
          </div>
          <div className="bm-table-wrap">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>ATTRIBUTE</th>
                  <th>BITCOIN</th>
                  <th>REAL ESTATE</th>
                  <th>GOLD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Maintenance</td>
                  <td className="bm-td--btc">0% Repairs</td>
                  <td className="bm-td--risk">Entropy</td>
                  <td>Storage</td>
                </tr>
                <tr>
                  <td>Portability</td>
                  <td className="bm-td--btc">Instant / Global</td>
                  <td className="bm-td--risk">Immobile</td>
                  <td>Heavy</td>
                </tr>
                <tr>
                  <td>Confiscation</td>
                  <td className="bm-td--btc">Minimal (Self-Custody)</td>
                  <td className="bm-td--risk">High Risk</td>
                  <td>Moderate</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="bm-note">
            Educational framework only. FORTIFY OS presents risk disclosures — past performance does not guarantee future results.
          </p>
        </section>

        <section className="bm-card fo-page-section bm-card--wide bm-card--accent-amber">
          <div className="bm-card-h">
            <span className="bm-idx">03</span>
            <h2>THE CONVICTION ENGINE</h2>
          </div>
          <div className="bm-conviction-level">
            CURRENT LEVEL: <span className="bm-bracket-val">[ GENERATIONAL OPPORTUNITY ]</span>
          </div>
          <div className="bm-conviction-details">
            <span>HORIZON: Minimum 4-year cycle; ignore short-term volatility.</span>
            <span>STRATEGY: DCA (Recurring buys aligned to cycle gate).</span>
          </div>
          <div className="bm-meter" aria-label="Conviction meter">
            <div className="bm-meter-top">
              <span className="bm-meter-label">CONVICTION LEVEL</span>
              <span className="bm-meter-val">{convictionPct}%</span>
            </div>
            <div className="bm-meter-track">
              <div className="bm-meter-fill" style={{ width: `${convictionPct}%` }} />
            </div>
            <div className="bm-meter-status">
              <span className="bm-status-pill">GENERATIONAL OPPORTUNITY</span>
              <span className="bm-status-sub">Minimum 4-year horizon; ignore short-term volatility.</span>
            </div>
          </div>
          <div className="bm-alloc">
            <div className="bm-alloc-card">
              <div className="bm-alloc-h">Institutional</div>
              <div className="bm-alloc-x">1–2%</div>
              <div className="bm-alloc-p">Small hedge exposure model.</div>
            </div>
            <div className="bm-alloc-card bm-alloc-card--highlight">
              <div className="bm-alloc-h">Sovereign</div>
              <div className="bm-alloc-x">High-conviction</div>
              <div className="bm-alloc-p">Rules-based, long horizon, self-custody.</div>
            </div>
            <div className="bm-alloc-card">
              <div className="bm-alloc-h">Discipline</div>
              <div className="bm-alloc-x">DCA</div>
              <div className="bm-alloc-p">Recurring buys aligned to your cycle gate.</div>
            </div>
          </div>
        </section>

        <section className={`bm-card fo-page-section bm-card--wide bm-card--accent-cycle bm-phase-${halving.phaseTone}`}>
          <div className="bm-card-h bm-card-h--split">
            <div>
              <span className="bm-idx">04</span>
              <h2>BTC 500-DAY HALVING CYCLE</h2>
            </div>
            <span className={`bm-phase-chip bm-phase-chip--${halving.phaseTone}`}>{halving.phase}</span>
          </div>
          <div className="bm-cycle-kpis">
            <div className="bm-cycle-kpi">
              <div className="bm-cycle-label">BTC PRICE</div>
              <div className="bm-cycle-value bm-cycle-value--gold">{halving.btcPrice == null ? "—" : fmtUsd(halving.btcPrice)}</div>
            </div>
            <div className="bm-cycle-kpi">
              <div className="bm-cycle-label">DAYS POST-HALVING</div>
              <div className={`bm-cycle-value bm-phase-text--${halving.phaseTone}`}>{halving.daysPost}</div>
              <div className="bm-cycle-sub">of 500-day window</div>
            </div>
            <div className="bm-cycle-kpi bm-cycle-kpi--phase">
              <div className="bm-cycle-label">PHASE</div>
              <div className={`bm-cycle-phase bm-phase-text--${halving.phaseTone}`}>{halving.phase}</div>
            </div>
          </div>
          <div className="bm-cycle-timeline">
            <div className="bm-cycle-scale">
              <span>-500D BUY ZONE</span>
              <span>HALVING APR 2024</span>
              <span>+500D PEAK</span>
            </div>
            <div className="bm-cycle-track">
              <div className="bm-cycle-zone bm-cycle-zone--accum" />
              <div className="bm-cycle-zone bm-cycle-zone--expand" />
              <div className="bm-cycle-zone bm-cycle-zone--dist" />
              <div className="bm-cycle-halving-mark" />
              <div className={`bm-cycle-now bm-phase-now--${halving.phaseTone}`} style={{ left: `${halving.posInWindow}%` }} />
            </div>
            <div className="bm-cycle-legend">
              <span className="bm-cycle-legend-accum">Accumulate</span>
              <span className="bm-cycle-legend-expand">Expand</span>
              <span className="bm-cycle-legend-dist">Distribute</span>
            </div>
            <div className="bm-cycle-desc">{halving.phaseDesc}</div>
          </div>
          <div className="bm-cycle-grid">
            <div className="bm-cycle-stat bm-cycle-stat--gold">
              <div className="bm-cycle-stat-label">LAST HALVING</div>
              <div className="bm-cycle-stat-value">{halving.lastHalvingLabel}</div>
            </div>
            <div className={`bm-cycle-stat ${halving.window500Closed ? "bm-cycle-stat--neutral" : "bm-cycle-stat--amber"}`}>
              <div className="bm-cycle-stat-label">+500D WINDOW</div>
              <div className="bm-cycle-stat-value">{halving.window500Label}{halving.window500Closed ? " ✓" : ""}</div>
            </div>
            <div className={`bm-cycle-stat ${halving.buyZoneOpen ? "bm-cycle-stat--green" : "bm-cycle-stat--purple"}`}>
              <div className="bm-cycle-stat-label">{halving.buyZoneOpen ? "BUY ZONE" : "NEXT BUY ZONE"}</div>
              <div className="bm-cycle-stat-value">{halving.buyZoneOpen ? `OPEN (${Math.abs(halving.daysToNextBuy)}D IN)` : `IN ${halving.daysToNextBuy}D`}</div>
            </div>
            <div className="bm-cycle-stat bm-cycle-stat--purple">
              <div className="bm-cycle-stat-label">NEXT HALVING (EST.)</div>
              <div className="bm-cycle-stat-value">~{halving.nextHalvingLabel}</div>
              <div className="bm-cycle-sub">in {halving.daysToNextHalving} days</div>
            </div>
            <div className={`bm-cycle-stat ${halving.buyZoneOpen ? "bm-cycle-stat--green" : "bm-cycle-stat--purple"} bm-cycle-stat--wide`}>
              <div className="bm-cycle-stat-label">NEXT BUY WINDOW (EST.)</div>
              <div className="bm-cycle-stat-value">~{halving.nextBuyLabel}</div>
              <div className="bm-cycle-sub">{halving.buyZoneOpen ? "Open now" : `in ${halving.daysToNextBuy} days`}</div>
            </div>
          </div>
          <p className="bm-note">
            Pattern fit to 3 historical cycles, not a protocol rule. Macro, regulation, ETF flows, and liquidity still matter. Use this as a timing framework, not a mechanical trigger.
          </p>
        </section>

        <section className="bm-card fo-page-section bm-card--wide bm-card--accent-gold">
          <div className="bm-card-h">
            <span className="bm-idx">05</span>
            <h2>THE CITADEL PROTOCOL (SECURITY)</h2>
          </div>
          <div className="bm-steps">
            <div className="bm-step">
              <div className="bm-step-h"><span className="bm-step-num">1.</span> EXIT COUNTERPARTIES</div>
              <div className="bm-step-p">Withdraw to self-custody immediately. Not your keys, not your coins.</div>
            </div>
            <div className="bm-step">
              <div className="bm-step-h"><span className="bm-step-num">2.</span> HARDWARE VAULT</div>
              <div className="bm-step-p">Use a Bitcoin-focused hardware wallet; keep seed offline.</div>
            </div>
            <div className="bm-step">
              <div className="bm-step-h"><span className="bm-step-num">3.</span> VERIFY INDEPENDENTLY</div>
              <div className="bm-step-p">Run a node to confirm the chain.</div>
            </div>
          </div>
          <div className="bm-actions">
            <button
              className="bm-cta"
              type="button"
              onClick={() => {
                pulse();
                window.open("https://www.bitcoin.com", "_blank", "noopener,noreferrer");
              }}
            >
              INITIATE SOVEREIGN TRANSITION
            </button>
            <div className="bm-disclaimer">
              Educational content only. FORTIFY OS is not providing investment, tax, or legal advice.
            </div>
          </div>
        </section>
      </main>

      <footer className="bm-footer fo-page-shell-panel">
        <span className="bm-foot-status">SYSTEM STATUS: EDUCATIONAL FRAMEWORK ONLY.</span>
        <span>LEGAL: FORTIFY OS is not providing investment, tax, or legal advice.</span>
        <span>LAST SYNC: {lastSync}</span>
      </footer>
    </div>
    </SpecialistShell>
  );
}
