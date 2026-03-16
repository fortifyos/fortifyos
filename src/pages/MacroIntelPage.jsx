import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Activity, Eye, FileText, Home, LayoutGrid, Settings } from "lucide-react";
import SpecialistShell from "../components/SpecialistShell";
import "./macro-intel.css";

/* ══════════════════════════════════════════════════════════════
   MACRO INTEL — FORTIFY OS Operator Intelligence Interface
   Reads from public/macro-intel/ JSON data files.
   Follows FORTIFY OS design system: terminal-grade, JetBrains Mono.
   ══════════════════════════════════════════════════════════════ */

const BASE = import.meta.env.BASE_URL;
const MACRO_BASE = `${BASE}macro-intel/`;

const REGIME_LABELS = {
  risk_on:            "RISK-ON",
  risk_off:           "RISK-OFF",
  mixed:              "MIXED",
  inflation_shock:    "INFLATION SHOCK",
  growth_scare:       "GROWTH SCARE",
  liquidity_expansion:"LIQUIDITY EXPANSION",
  dollar_stress:      "DOLLAR STRESS",
  defensive_rotation: "DEFENSIVE ROTATION",
  crypto_speculation: "CRYPTO SPECULATION",
  oil_shock:          "OIL SHOCK",
};

const SESSION_LABELS = {
  global_markets: "GLOBAL MARKETS 03:00",
  pre_market:     "PRE-MARKET 08:00",
  mid_session:    "MID-SESSION 14:00",
  evening_wrap:   "EVENING WRAP 21:00",
};

const SCORE_LABELS = {
  liquidity:          "LIQUIDITY",
  inflationPressure:  "INFLATION",
  growthHealth:       "GROWTH",
  volatilityStress:   "VOLATILITY",
  dollarPressure:     "DOLLAR",
  breadthQuality:     "BREADTH",
  cryptoRiskAppetite: "CRYPTO RISK",
};

const SCORE_MEANING = {
  liquidity:         { pos: "Expanding", neg: "Contracting" },
  inflationPressure: { pos: "Rising Pressure", neg: "Easing" },
  growthHealth:      { pos: "Improving", neg: "Deteriorating" },
  volatilityStress:  { pos: "Stressed", neg: "Suppressed" },
  dollarPressure:    { pos: "Strengthening", neg: "Weakening" },
  breadthQuality:    { pos: "Broad Participation", neg: "Narrow / Weak" },
  cryptoRiskAppetite:{ pos: "Risk Appetite High", neg: "Risk Appetite Low" },
};

/* ── Run schedule (ET) ── */
const RUN_HOURS_ET = [3, 8, 14, 21]; // 03:00, 08:00, 14:00, 21:00

function computeNextRunAt() {
  try {
    const nowET = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const nowH = nowET.getHours() * 60 + nowET.getMinutes();
    for (const h of RUN_HOURS_ET) {
      if (h * 60 > nowH) {
        const next = new Date(nowET);
        next.setHours(h, 0, 0, 0);
        return next;
      }
    }
    // next day at 03:00
    const next = new Date(nowET);
    next.setDate(next.getDate() + 1);
    next.setHours(3, 0, 0, 0);
    return next;
  } catch {
    return null;
  }
}

function formatCountdown(targetDate) {
  if (!targetDate) return "--:--:--";
  const diffMs = targetDate - new Date();
  if (diffMs <= 0) return "00:00:00";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  const s = Math.floor((diffMs % 60_000) / 1_000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function fmtVal(v, key) {
  if (v == null) return "—";
  if (key === "btc") return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === "vix" || key === "tnx") return Number(v).toFixed(2);
  if (key === "spx") return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDelta(pct) {
  if (pct == null) return { text: "—", cls: "neu" };
  const sign = pct > 0 ? "+" : "";
  const cls = pct > 0 ? "pos" : pct < 0 ? "neg" : "neu";
  return { text: `${sign}${pct.toFixed(2)}%`, cls };
}

function staleClass(ts) {
  if (!ts) return "macro-stale";
  const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000;
  return ageMin > 120 ? "macro-stale" : "macro-fresh";
}

/* ── Mini Sparkline ── */
function MiniSparkline({ data, color = "#00FF41" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60, h = 18;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="mi-sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Score value CSS class ── */
function scoreValClass(v) {
  if (v >= 2)  return "pos2";
  if (v === 1) return "pos1";
  if (v === 0) return "zero";
  if (v === -1) return "neg1";
  return "neg2";
}

/* ── MacroHeader ── */
function MacroHeader({ regime, todayLog, nextRunAt, stale, tick }) {
  const mode = regime?.regimeMode ?? "mixed";
  const conf = regime?.confidence != null ? `${Math.round(regime.confidence * 100)}%` : "—";
  const session = todayLog?.entries?.[0]?.session ?? regime?.timestamp
    ? (() => {
        const h = new Date(regime.timestamp).getHours();
        if (h < 6) return "global_markets";
        if (h < 11) return "pre_market";
        if (h < 18) return "mid_session";
        return "evening_wrap";
      })()
    : null;
  const ts = regime?.timestamp ? new Date(regime.timestamp).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
  const staleCls = staleClass(regime?.timestamp);
  const countdown = formatCountdown(nextRunAt);

  return (
    <header className="mi-header">
      <div className="mi-hud" role="group" aria-label="Macro Intel Status">
        <span className={`macro-regime-pill mode-${mode}`}>{REGIME_LABELS[mode] ?? mode}</span>
        <span className="mi-hud-sep">|</span>
        <span className="mi-hud-kv">
          <span className="mi-hud-k">CONF</span>
          <span className="mi-hud-v macro-mono">{conf}</span>
        </span>
        <span className="mi-hud-sep">|</span>
        <span className="mi-hud-kv">
          <span className="mi-hud-k">FRESHNESS</span>
          <span className={`macro-mono ${staleCls}`}>{stale ? "STALE" : "FRESH"}</span>
        </span>
        <span className="mi-hud-sep">|</span>
        <span className="mi-hud-kv">
          <span className="mi-hud-k">SESSION</span>
          <span className="mi-hud-v macro-mono">{session ? SESSION_LABELS[session] : "—"}</span>
        </span>
        <span className="mi-hud-sep">|</span>
        <span className="mi-countdown">NEXT RUN <span>{countdown}</span></span>
        <span className="mi-hud-sep" style={{ marginLeft: "auto" }}>SYNC</span>
        <span className="mi-hud-v macro-mono" style={{ fontSize: 10 }}>{ts}</span>
      </div>

      <div className="mi-title-row">
        <div>
          <h1 className="mi-title">MACRO INTEL</h1>
          <div className="mi-subtitle">OPERATOR INTELLIGENCE INTERFACE</div>
        </div>
        {regime?.dominantDrivers?.length > 0 && (
          <div className="mi-drivers">
            {regime.dominantDrivers.map(d => (
              <span key={d} className="mi-driver-tag">{d.replace(/_/g, " ")}</span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ── MacroPulseStrip ── */
function MacroPulseStrip({ assets }) {
  if (!assets?.length) return null;
  return (
    <div className="mi-pulse-strip">
      <div className="mi-pulse-scroll">
        {assets.map(asset => {
          if (!asset) return null;
          const d = fmtDelta(asset.pctVsClose);
          const sparkColor = asset.pctVsClose >= 0 ? "#00FF41" : "#FF3B3B";
          return (
            <div key={asset.key} className={`macro-asset-card impact-${asset.impactTag ?? "neutral"}`}>
              <div className="mi-asset-label">{asset.label}</div>
              <div className="mi-asset-value macro-mono">{fmtVal(asset.value, asset.key)}</div>
              <div className={`mi-asset-delta macro-mono ${d.cls}`}>{d.text}</div>
              <div className="mi-asset-impact">{(asset.impactTag ?? "").replace(/_/g, " ")}</div>
              {asset.sparkline && <MiniSparkline data={asset.sparkline} color={sparkColor} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── MacroChangePanel ── */
function MacroChangePanel({ changes }) {
  if (!changes?.length) return null;
  return (
    <div>
      <div className="mi-field-label">WHAT CHANGED</div>
      <div className="mi-change-list">
        {changes.map((c, i) => (
          <div key={i} className="mi-change-item">{c}</div>
        ))}
      </div>
    </div>
  );
}

/* ── MacroConnectionMap ── */
function MacroConnectionMap({ connections }) {
  if (!connections?.length) return null;
  return (
    <div>
      <div className="mi-field-label">CROSS-ASSET CONNECTIONS</div>
      <div>
        {connections.map((c, i) => (
          <div key={i} className="mi-conn-item">
            <span className="mi-conn-arrow">→</span>
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── MacroStoryPanel (single entry) ── */
function MacroStoryPanel({ entry, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="macro-timeline-entry">
      <div className="mi-entry-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div className="mi-entry-session">
          <span className={`mi-session-badge session-${entry.session}`}>
            {SESSION_LABELS[entry.session] ?? entry.session}
          </span>
          <span className="mi-entry-time macro-mono">{entry.runTime}</span>
        </div>
        <span className={`mi-entry-chevron ${open ? "open" : ""}`}>▼</span>
      </div>

      <div className="mi-entry-headline">{entry.headline}</div>

      {open && (
        <div className="mi-entry-body">
          {entry.dominantStory && (
            <div>
              <div className="mi-field-label">DOMINANT STORY</div>
              <div className="mi-entry-story">{entry.dominantStory}</div>
            </div>
          )}

          {entry.whatChangedSinceLastReport?.length > 0 && (
            <MacroChangePanel changes={entry.whatChangedSinceLastReport} />
          )}

          {entry.crossAssetConnections?.length > 0 && (
            <MacroConnectionMap connections={entry.crossAssetConnections} />
          )}

          {entry.operatorPosture && (
            <div>
              <div className="mi-posture-label">OPERATOR POSTURE</div>
              <div className="mi-posture">{entry.operatorPosture}</div>
            </div>
          )}

          {entry.watchNext?.length > 0 && (
            <div>
              <div className="mi-field-label">WATCH NEXT</div>
              <div className="mi-list">
                {entry.watchNext.map((w, i) => (
                  <div key={i} className="mi-list-item">{w}</div>
                ))}
              </div>
            </div>
          )}

          {entry.confidenceCommentary && (
            <div>
              <div className="mi-field-label">CONFIDENCE</div>
              <div className="mi-confidence-text">{entry.confidenceCommentary}</div>
              {entry.uncertaintyFlags?.length > 0 && (
                <div className="mi-uncertainty-list">
                  {entry.uncertaintyFlags.map((f, i) => (
                    <div key={i} className="mi-uncertainty-item">{f}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── MacroTimeline (today's log) ── */
function MacroTimeline({ entries }) {
  if (!entries?.length) {
    return <div className="mi-empty">No entries yet for today. Next run at 03:00 ET.</div>;
  }
  // Show most recent first
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return (
    <div>
      {sorted.map((entry, i) => (
        <MacroStoryPanel key={entry.timestamp} entry={entry} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

/* ── MacroSignalBoard ── */
function MacroSignalBoard({ scores, evidence }) {
  if (!scores) return null;
  const keys = Object.keys(SCORE_LABELS);
  return (
    <div className="macro-card">
      <div className="macro-card-hd">
        <span className="mi-dot" style={{ background: "#00FF41" }} />
        SIGNAL BOARD
      </div>
      <div className="macro-card-body">
        {keys.map(k => {
          const v = scores[k] ?? 0;
          const meaning = v > 0 ? SCORE_MEANING[k]?.pos : v < 0 ? SCORE_MEANING[k]?.neg : "Neutral";
          const barPct = (Math.abs(v) / 2) * 50; // 0-50%
          const barCls = v > 0 ? "pos" : v < 0 ? "neg" : "zero";
          return (
            <div key={k} className="mi-score-row" title={meaning}>
              <span className="mi-score-label macro-mono">{SCORE_LABELS[k]}</span>
              <span className={`mi-score-val macro-mono ${scoreValClass(v)}`}>
                {v > 0 ? `+${v}` : v}
              </span>
              <div className="mi-score-bar-track">
                {/* center line */}
                <div style={{ position:"absolute", left:"50%", top:"-2px", width:1, height:8, background:"#333" }} />
                <div
                  className={`mi-score-bar-fill ${barCls}`}
                  style={{ width: barCls === "zero" ? "2px" : `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
        {evidence?.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #222" }}>
            <div className="mi-field-label">SUPPORTING EVIDENCE</div>
            <div className="mi-list" style={{ marginTop: 6 }}>
              {evidence.map((e, i) => (
                <div key={i} className="mi-list-item" style={{ fontSize: 11 }}>{e}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── MacroWatchPanel ── */
function MacroWatchPanel({ watchLevels, invalidation }) {
  return (
    <div className="macro-card">
      <div className="macro-card-hd">
        <span className="mi-dot" style={{ background: "#FFB800" }} />
        WATCH / INVALIDATION
      </div>
      <div className="macro-card-body">
        {watchLevels?.length > 0 && (
          <>
            <div className="mi-section-hd">Watch Levels</div>
            <div className="mi-watch-list">
              {watchLevels.map((w, i) => (
                <div key={i} className="mi-watch-item">
                  <span className="mi-watch-dot" />
                  <span className="macro-mono" style={{ fontSize: 11 }}>{w}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {invalidation?.length > 0 && (
          <>
            <div className="mi-section-hd" style={{ marginTop: 12 }}>Invalidation Conditions</div>
            <div className="mi-invalidation-list">
              {invalidation.map((c, i) => (
                <div key={i} className="mi-inv-item">
                  <span className="mi-inv-dot" />
                  <span style={{ fontSize: 11 }}>{c}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {!watchLevels?.length && !invalidation?.length && (
          <div className="mi-empty">No watch data available.</div>
        )}
      </div>
    </div>
  );
}

/* ── MacroArchiveRail ── */
function MacroArchiveRail({ items }) {
  if (!items?.length) return null;
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="macro-card">
      <div className="macro-card-hd">
        <span className="mi-dot" style={{ background: "#BF40BF" }} />
        ARCHIVE
      </div>
      <div className="macro-card-body">
        <div className="mi-archive-list">
          {sorted.map(item => (
            <div key={item.date} className="mi-archive-item">
              <div>
                <div className="mi-archive-date macro-mono">{item.date}</div>
                {item.dominantDrivers?.length > 0 && (
                  <div style={{ fontSize: 10, color: "var(--mi-ghost)", marginTop: 2, letterSpacing: ".04em" }}>
                    {item.dominantDrivers.slice(0, 2).map(d => d.replace(/_/g, " ")).join(" · ")}
                  </div>
                )}
              </div>
              <div className="mi-archive-meta">
                <span className={`mi-archive-regime mode-${item.regimeMode}`}>
                  {REGIME_LABELS[item.regimeMode] ?? item.regimeMode}
                </span>
                <span className="mi-archive-count macro-mono">{item.entryCount}×</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function MacroIntelPage({ onBack, onHome, onDashboard, onMacroSentinel, onBitcoin, onDocs, onSettings, isDark = true, onToggleTheme }) {
  const [regime, setRegime]     = useState(null);
  const [market, setMarket]     = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [archive, setArchive]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [stale, setStale]       = useState(false);
  const [tick, setTick]         = useState(0);

  // ── Countdown timer ──
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nextRunAt = useMemo(() => computeNextRunAt(), [tick]);

  // ── Load data ──
  const load = useCallback(async () => {
    const bust = `?v=${Date.now()}`;
    const safe = url => fetch(url, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    const [r, m, l, a] = await Promise.all([
      safe(`${MACRO_BASE}regime-state.json${bust}`),
      safe(`${MACRO_BASE}market-snapshot.json${bust}`),
      safe(`${MACRO_BASE}today-log.json${bust}`),
      safe(`${MACRO_BASE}archive-index.json${bust}`),
    ]);

    if (r) setRegime(r); else setStale(true);
    if (m) setMarket(m);
    if (l) setTodayLog(l);
    if (a) setArchive(a);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Assets list ──
  const assets = useMemo(() => {
    if (!market?.assets) return [];
    return Object.values(market.assets).filter(Boolean);
  }, [market]);

  if (loading) {
    return (
      <div className={`mi-root ${isDark ? "mi-dark" : "mi-light"}`}>
        <div className="mi-loading">MACRO INTEL INITIALIZING...</div>
      </div>
    );
  }

  const entries = todayLog?.entries ?? [];
  const todayDate = todayLog?.date ?? new Date().toISOString().slice(0, 10);
  const lastSyncLabel = regime?.timestamp ? new Date(regime.timestamp).toLocaleTimeString() : "—";
  const navItems = [
    { key: "home", label: "Home", icon: Home, onClick: onHome },
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, onClick: onDashboard || onBack },
    { key: "radar", label: "Radar", icon: Eye, onClick: onMacroSentinel },
    { key: "macroIntel", label: "Macro Intel", icon: Activity, onClick: null, current: true },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: onBitcoin },
    { key: "docs", label: "Field Manual", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  return (
    <SpecialistShell
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      navItems={navItems}
      statusLabel={`Last Sync ${lastSyncLabel}`}
    >
    <div className={`mi-root ${isDark ? "mi-dark" : "mi-light"}`}>
      {/* Header */}
      <MacroHeader
        regime={regime}
        todayLog={todayLog}
        nextRunAt={nextRunAt}
        stale={stale}
        tick={tick}
      />

      {/* Pulse Strip */}
      {assets.length > 0 && <MacroPulseStrip assets={assets} />}

      {/* Body */}
      <div className="mi-body">
        {/* Main — Timeline */}
        <main className="mi-main">
          <div className="macro-card-hd" style={{ marginBottom: 10, paddingLeft: 0 }}>
            <span className="mi-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00FF41", display:"inline-block" }} />
            TODAY — <span className="macro-mono">{todayDate}</span>
            {todayLog?.status === "active" && (
              <span style={{ marginLeft: 8, fontSize: 9, color: "#00FF41", border: "1px solid rgba(0,255,65,.30)", padding: "1px 5px", borderRadius: 2 }}>LIVE</span>
            )}
          </div>
          <MacroTimeline entries={entries} />
        </main>

        {/* Aside — Signal Board, Watch, Archive */}
        <aside className="mi-aside">
          <MacroSignalBoard
            scores={regime?.scores ?? todayLog?.entries?.[0]?.signalScores}
            evidence={regime?.supportingEvidence}
          />
          <MacroWatchPanel
            watchLevels={regime?.watchLevels}
            invalidation={regime?.invalidationConditions}
          />
          <MacroArchiveRail items={archive} />
        </aside>
      </div>

      {/* Footer */}
      <footer className="mi-footer">
        <span className="mi-footer-status">SYSTEM STATUS: OPERATIONAL</span>
        <span>EDUCATIONAL FRAMEWORK — NOT INVESTMENT ADVICE.</span>
        <span className="macro-mono">
          LAST SYNC: {regime?.timestamp ? new Date(regime.timestamp).toLocaleString() : "—"}
        </span>
      </footer>
    </div>
    </SpecialistShell>
  );
}
