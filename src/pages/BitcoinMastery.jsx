import React, { useEffect, useMemo, useRef, useState } from "react";
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
    const res = await fetch(url, { signal: ctrl.signal, headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadNetworkState() {
  let priceUsd = null;
  let blockHeight = null;
  let supplyMined = null;
  let supplyPct = null;
  let priceOk = false;
  let chainOk = false;

  try {
    const cg = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (typeof cg?.bitcoin?.usd === "number") {
      priceUsd = cg.bitcoin.usd;
      priceOk = true;
    }
  } catch { /* ignore */ }

  try {
    const tip = await fetchJson("https://mempool.space/api/blocks/tip/height");
    if (typeof tip === "number") {
      blockHeight = tip;
    } else if (typeof tip?.height === "number") {
      blockHeight = tip.height;
    }

    const totalSats = await fetchJson("https://mempool.space/api/txoutsetinfo");
    if (typeof totalSats !== "number") {
      const obj = totalSats;
      if (typeof obj?.total_amount === "number") {
        supplyMined = obj.total_amount / SATS_PER_BTC;
        supplyPct = (supplyMined / HARD_CAP_BTC) * 100;
        chainOk = true;
      }
    }
  } catch { /* ignore */ }

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

export default function BitcoinMastery({ onBack }) {
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
    return () => { alive = false; window.clearInterval(id); };
  }, [pulse]);

  const lastSync = net.lastUpdatedIso == null
    ? "—"
    : new Date(net.lastUpdatedIso).toLocaleString();

  return (
    <div className="bm-root">
      <div ref={pulseRef} className="bm-pulse-overlay" aria-hidden="true" />

      {onBack && (
        <div className="bm-back-bar">
          <button className="bm-back-btn" onClick={onBack}>← Back to Dashboard</button>
        </div>
      )}

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
              <span className="bm-scarcity-val">
                {net.supplyPct == null ? " — " : ` ${scarcity.pct.toFixed(2)}% `}
              </span>
              MINED
            </span>
            <span className="bm-scarcity-meta">
              {scarcity.mined == null ? "SUPPLY: —" : `SUPPLY: ${fmtNum(scarcity.mined, 4)} / 21,000,000`}
              {scarcity.remaining == null ? "" : `  |  REMAINING: ${fmtNum(scarcity.remaining, 4)}`}
            </span>
          </div>
          <div className="bm-progress" aria-label="Scarcity progress">
            <div className="bm-progress-track">
              <div
                className="bm-progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, scarcity.pct))}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="bm-grid">

        {/* 01 | MACRO NARRATIVE */}
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

        {/* 02 | COMPARATIVE ANALYSIS */}
        <section className="bm-card bm-card--accent-green">
          <div className="bm-card-h">
            <span className="bm-idx">02</span>
            <h2>COMPARATIVE ANALYSIS: LEAKY ASSETS</h2>
          </div>
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
          <p className="bm-note">
            Educational framework only. FortifyOS presents risk disclosures — past performance does not guarantee future results.
          </p>
        </section>

        {/* 03 | CONVICTION ENGINE */}
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

        {/* 04 | CITADEL PROTOCOL */}
        <section className="bm-card bm-card--wide bm-card--accent-gold">
          <div className="bm-card-h">
            <span className="bm-idx">04</span>
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
                window.dispatchEvent(new CustomEvent("fortify:command", { detail: { cmd: "bitcoin.secure" } }));
              }}
            >
              INITIATE SOVEREIGN TRANSITION
            </button>
            <div className="bm-disclaimer">
              Educational content only. FortifyOS is not providing investment, tax, or legal advice.
            </div>
          </div>
        </section>

      </main>

      <footer className="bm-footer">
        <span className="bm-foot-status">SYSTEM STATUS: EDUCATIONAL FRAMEWORK ONLY.</span>
        <span>LEGAL: FortifyOS is not providing investment, tax, or legal advice.</span>
        <span>LAST SYNC: {lastSync}</span>
      </footer>
    </div>
  );
}
