import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileText, Home, LayoutGrid, Settings, Shield, Activity, Zap } from "lucide-react";
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

async function fetchJson(url, timeoutMs = 7000) {
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

async function fetchText(url, timeoutMs = 7000) {
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
    const nested =
      payload?.bitcoin?.usd ??
      payload?.data?.amount ??
      payload?.result?.price ??
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
    async () => parsePriceUsd(await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")),
    async () => parsePriceUsd(await fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot")),
    async () => parsePriceUsd(await fetchJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")),
    async () => parsePriceUsd(await fetchJson("https://api.gemini.com/v1/pubticker/btcusd")),
    async () => fetchYahooPriceUsd(),
  ];

  for (const load of sources) {
    try {
      const price = await load();
      if (Number.isFinite(price)) return price;
    } catch {}
  }

  return null;
}

async function fetchFirstBlockHeight() {
  const sources = [
    async () => parseBlockHeight(await fetchJson("https://mempool.space/api/blocks/tip/height")),
    async () => parseBlockHeight(await fetchText("https://mempool.space/api/blocks/tip/height")),
    async () => parseBlockHeight(await fetchText("https://blockstream.info/api/blocks/tip/height")),
    async () => parseBlockHeight(await fetchText("https://blockchain.info/q/getblockcount")),
  ];

  for (const load of sources) {
    try {
      const height = await load();
      if (Number.isFinite(height)) return height;
    } catch {}
  }

  return null;
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
  let priceUsd = null;
  let blockHeight = null;
  let supplyMined = null;
  let supplyPct = null;
  let priceOk = false;
  let chainOk = false;

  try {
    priceUsd = await fetchFirstPriceUsd();
    if (typeof priceUsd === "number") {
      try {
        localStorage.setItem("fortify_btc_price_usd", String(priceUsd));
      } catch {}
      priceOk = true;
    }
  } catch {}

  if (!priceOk) {
    try {
      const cachedPrice = Number(localStorage.getItem("fortify_btc_price_usd"));
      if (Number.isFinite(cachedPrice) && cachedPrice > 0) {
        priceUsd = cachedPrice;
        priceOk = true;
      }
    } catch {}
  }

  try {
    blockHeight = await fetchFirstBlockHeight();
    if (typeof blockHeight === "number") {
      supplyMined = estimateIssuedSupply(blockHeight);
      supplyPct = (supplyMined / HARD_CAP_BTC) * 100;
      chainOk = true;
    }
  } catch {}

  const status = priceOk && chainOk ? "LIVE" : (priceOk || chainOk ? "DEGRADED" : "OFFLINE");
  return { priceUsd, blockHeight, supplyMined, supplyPct, status, lastUpdatedIso: new Date().toISOString() };
}

function usePulseOverlay() {
  const ref = useRef(null);
  const trigger = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("bm-pulse--on");
    void el.offsetWidth;
    el.classList.add("bm-pulse--on");
  };
  return { ref, trigger };
}

export default function BitcoinMastery({ onBack, onHome, onDashboard, onMacroSentinel, onMacroIntel, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [net, setNet] = useState({
    priceUsd: null,
    blockHeight: null,
    supplyMined: null,
    supplyPct: null,
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
    { key: "macroIntel", label: "Macro Intel", icon: Activity, onClick: onMacroIntel },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: null, current: true },
    { key: "tcg", label: "TCG Radar", icon: Zap, onClick: null },
    { key: "docs", label: "Field Manual", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  const lastSync = net.lastUpdatedIso == null ? "—" : new Date(net.lastUpdatedIso).toLocaleString();

  return (
    <SpecialistShell
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      navItems={navItems}
      centerLabel="FORTIFY OS"
      statusLabel={`Last Sync ${lastSync === "—" ? "—" : new Date(net.lastUpdatedIso).toLocaleTimeString()}`}
    >
    <div className={`bm-root ${isDark ? "bm-dark" : "bm-light"}`}>
      <div ref={pulseRef} className="bm-pulse-overlay" aria-hidden="true" />

      <header className="bm-hero">
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

      <main className="bm-grid">
        <section className="bm-card bm-card--accent-gold">
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

        <section className="bm-card bm-card--accent-green">
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

        <section className="bm-card bm-card--wide bm-card--accent-amber">
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

        <section className={`bm-card bm-card--wide bm-card--accent-cycle bm-phase-${halving.phaseTone}`}>
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

        <section className="bm-card bm-card--wide bm-card--accent-gold">
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

      <footer className="bm-footer">
        <span className="bm-foot-status">SYSTEM STATUS: EDUCATIONAL FRAMEWORK ONLY.</span>
        <span>LEGAL: FORTIFY OS is not providing investment, tax, or legal advice.</span>
        <span>LAST SYNC: {lastSync}</span>
      </footer>
    </div>
    </SpecialistShell>
  );
}
