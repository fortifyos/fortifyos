import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileText, Home, LayoutGrid, Menu, Moon, Settings, Sun, X } from "lucide-react";
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

  // Price (CoinGecko)
  try {
    const cg = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (typeof cg?.bitcoin?.usd === "number") {
      priceUsd = cg.bitcoin.usd;
      priceOk = true;
    }
  } catch { /* ignore */ }

  // Chain status (mempool)
  try {
    const tip = await fetchJson("https://mempool.space/api/blocks/tip/height");
    if (typeof tip === "number") {
      blockHeight = tip;
    } else if (typeof tip?.height === "number") {
      blockHeight = tip.height;
    }
    if (typeof blockHeight === "number") {
      supplyMined = estimateIssuedSupply(blockHeight);
      supplyPct = (supplyMined / HARD_CAP_BTC) * 100;
      chainOk = true;
    }
  } catch { /* ignore */ }

  const status = priceOk && chainOk ? "LIVE" : (priceOk || chainOk ? "DEGRADED" : "OFFLINE");

  return { priceUsd, blockHeight, supplyMined, supplyPct, status, lastUpdatedIso: new Date().toISOString() };
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

export default function BitcoinMastery({ onBack, onHome, onDashboard, onMacroSentinel, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [net, setNet] = useState({
    priceUsd: null,
    blockHeight: null,
    supplyMined: null,
    supplyPct: null,
    lastUpdatedIso: null,
    status: "OFFLINE",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const navItems = [
    { key: "home", label: "Home", icon: Home, onClick: onHome },
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, onClick: onDashboard || onBack },
    { key: "radar", label: "Radar", icon: Eye, onClick: onMacroSentinel },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: null, current: true },
    { key: "docs", label: "Docs", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  return (
    <div className={`bm-root ${isDark ? "bm-dark" : "bm-light"}`}>
      <div ref={pulseRef} className="bm-pulse-overlay" aria-hidden="true" />

      <div className="bm-topbar">
        <div ref={menuRef} className="bm-menu-shell">
          <button
            className="bm-menu-btn"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close page menu" : "Open page menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
          {menuOpen && (
            <div className="bm-menu-pop" role="menu" aria-label="Page navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`bm-menu-item${item.current ? " is-current" : ""}`}
                    onClick={() => {
                      setMenuOpen(false);
                      if (item.onClick) item.onClick();
                    }}
                    disabled={!item.onClick}
                  >
                    {Icon ? <Icon size={15} /> : <span className="bm-menu-btc">₿</span>}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="bm-topbar-actions">
          <div className="bm-topbar-status">
            {net.lastUpdatedIso == null ? "Awaiting network sync" : `Last sync ${new Date(net.lastUpdatedIso).toLocaleTimeString()}`}
          </div>
          <button
            className="bm-theme-btn"
            type="button"
            onClick={onToggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

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
            <span className="bm-k">CAP</span>
            <span className="bm-v">21,000,000</span>
          </span>
        </div>

        <h1 className="bm-title">THE SOVEREIGN STANDARD</h1>
        <p className="bm-subtitle">1 BTC = 1/21,000,000 of Future Global Wealth</p>

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
          <div className="bm-scarcity-stats">
            <div className="bm-scarcity-stat">
              <span className="bm-scarcity-stat-label">Mined Supply</span>
              <strong className="bm-scarcity-stat-value">{scarcity.mined == null ? "—" : fmtNum(scarcity.mined, 4)}</strong>
            </div>
            <div className="bm-scarcity-stat">
              <span className="bm-scarcity-stat-label">Remaining Supply</span>
              <strong className="bm-scarcity-stat-value">{scarcity.remaining == null ? "—" : fmtNum(scarcity.remaining, 4)}</strong>
            </div>
            <div className="bm-scarcity-stat">
              <span className="bm-scarcity-stat-label">Issued %</span>
              <strong className="bm-scarcity-stat-value">{net.supplyPct == null ? "—" : `${scarcity.pct.toFixed(4)}%`}</strong>
            </div>
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
        <section className="bm-card bm-card--accent-gold">
          <div className="bm-card-h">
            <span className="bm-idx">01</span>
            <h2>GENESIS & SCARCITY</h2>
          </div>
          <p>
            Born from the 2008 financial crisis. Bitcoin is a decentralized protocol of trust with an
            immutable ledger and a hard cap enforced by global consensus.
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
            <h2>BITCOIN VS. LEAKY ASSETS</h2>
          </div>
          <div className="bm-compare">
            <div className="bm-compare-row">
              <span className="bm-compare-k">Maintenance</span>
              <span className="bm-compare-v">BTC: 0%  •  Real Estate: entropy + repairs  •  Gold: storage</span>
            </div>
            <div className="bm-compare-row">
              <span className="bm-compare-k">Portability</span>
              <span className="bm-compare-v">BTC: instant/global  •  Real Estate: immobile  •  Gold: heavy</span>
            </div>
            <div className="bm-compare-row">
              <span className="bm-compare-k">Confiscation Risk</span>
              <span className="bm-compare-v">BTC (self-custody): minimal  •  Real Estate: high  •  Gold: moderate</span>
            </div>
          </div>
          <p className="bm-note">
            Educational framework only. FortifyOS presents risk disclosures — past performance does not guarantee future results.
          </p>
        </section>

        <section className="bm-card bm-card--wide bm-card--accent-orange">
          <div className="bm-card-h">
            <span className="bm-idx">03</span>
            <h2>THE CONVICTION ENGINE</h2>
          </div>
          <div className="bm-meter" aria-label="Conviction meter">
            <div className="bm-meter-top">
              <span className="bm-meter-label">CURRENT CONVICTION LEVEL</span>
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

        <section className="bm-card bm-card--wide bm-card--accent-gold">
          <div className="bm-card-h">
            <span className="bm-idx">04</span>
            <h2>THE CITADEL PROTOCOL</h2>
          </div>
          <div className="bm-steps">
            <div className="bm-step">
              <div className="bm-step-h">I. EXIT COUNTERPARTIES</div>
              <div className="bm-step-p">Not your keys, not your coins. Withdraw to self-custody.</div>
            </div>
            <div className="bm-step">
              <div className="bm-step-h">II. HARDWARE VAULT</div>
              <div className="bm-step-p">Use a Bitcoin-focused hardware wallet; keep seed offline.</div>
            </div>
            <div className="bm-step">
              <div className="bm-step-h">III. VERIFY INDEPENDENTLY</div>
              <div className="bm-step-p">Run a node (or use your own verifier endpoint) to confirm the chain.</div>
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
              Educational content only. FortifyOS is not providing investment, tax, or legal advice.
            </div>
          </div>
        </section>
      </main>

      <footer className="bm-footer">
        <span className="bm-foot-left">FORTIFYOS // BTC MASTER PAGE</span>
        <span className="bm-foot-right">
          Last update: {net.lastUpdatedIso == null ? "—" : new Date(net.lastUpdatedIso).toLocaleString()}
        </span>
      </footer>
    </div>
  );
}
