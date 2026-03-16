import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./macro-radar-panels.css";

const BASE = import.meta.env.BASE_URL || "/";
const MACRO_BASE = `${BASE}macro-intel/`;
const RUN_HOURS_ET = [0, 3, 6, 9, 12, 15, 18, 21];

const REGIME_LABELS = {
  risk_on: "RISK-ON",
  risk_off: "RISK-OFF",
  mixed: "MIXED",
  inflation_shock: "INFLATION SHOCK",
  growth_scare: "GROWTH SCARE",
  liquidity_expansion: "LIQUIDITY EXPANSION",
  dollar_stress: "DOLLAR STRESS",
  defensive_rotation: "DEFENSIVE ROTATION",
  crypto_speculation: "CRYPTO SPECULATION",
  oil_shock: "OIL SHOCK",
};

const SESSION_LABELS = {
  global_markets: "GLOBAL MARKETS",
  pre_market: "PRE-MARKET",
  mid_session: "MID-SESSION",
  evening_wrap: "EVENING WRAP",
};

const SCORE_LABELS = {
  liquidity: "LIQUIDITY",
  inflationPressure: "INFLATION",
  growthHealth: "GROWTH",
  volatilityStress: "VOLATILITY",
  dollarPressure: "DOLLAR",
  breadthQuality: "BREADTH",
  cryptoRiskAppetite: "CRYPTO RISK",
};

const SCORE_MEANING = {
  liquidity: { pos: "Expanding", neg: "Contracting" },
  inflationPressure: { pos: "Rising Pressure", neg: "Easing" },
  growthHealth: { pos: "Improving", neg: "Deteriorating" },
  volatilityStress: { pos: "Stressed", neg: "Suppressed" },
  dollarPressure: { pos: "Strengthening", neg: "Weakening" },
  breadthQuality: { pos: "Broad Participation", neg: "Narrow / Weak" },
  cryptoRiskAppetite: { pos: "Risk Appetite High", neg: "Risk Appetite Low" },
};

function computeNextRunAt() {
  try {
    const nowEt = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    );
    const nowMinutes = nowEt.getHours() * 60 + nowEt.getMinutes();
    for (const hour of RUN_HOURS_ET) {
      if (hour * 60 > nowMinutes) {
        const next = new Date(nowEt);
        next.setHours(hour, 0, 0, 0);
        return next;
      }
    }
    const next = new Date(nowEt);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
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
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtValue(value, key) {
  if (value == null) return "—";
  if (key === "btc") return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === "vix" || key === "tnx") return Number(value).toFixed(2);
  if (key === "spx") return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDelta(pct) {
  if (pct == null) return { text: "—", cls: "neu" };
  const sign = pct > 0 ? "+" : "";
  const cls = pct > 0 ? "pos" : pct < 0 ? "neg" : "neu";
  return { text: `${sign}${pct.toFixed(2)}%`, cls };
}

function staleClass(ts) {
  if (!ts) return "mir-stale";
  const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000;
  return ageMin > 180 ? "mir-stale" : "mir-fresh";
}

function scoreValClass(value) {
  if (value >= 2) return "pos2";
  if (value === 1) return "pos1";
  if (value === 0) return "zero";
  if (value === -1) return "neg1";
  return "neg2";
}

function MiniSparkline({ data, color = "#00FF41" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 18;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="mir-sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SignalBoard({ scores, evidence }) {
  if (!scores) return null;
  return (
    <section className="mir-card">
      <div className="mir-card-hd">RADAR SIGNAL BOARD</div>
      <div className="mir-card-body">
        {Object.keys(SCORE_LABELS).map((key) => {
          const value = scores[key] ?? 0;
          const meaning = value > 0 ? SCORE_MEANING[key]?.pos : value < 0 ? SCORE_MEANING[key]?.neg : "Neutral";
          const barPct = (Math.abs(value) / 2) * 50;
          const barCls = value > 0 ? "pos" : value < 0 ? "neg" : "zero";
          return (
            <div key={key} className="mir-score-row" title={meaning}>
              <span className="mir-score-label">{SCORE_LABELS[key]}</span>
              <span className={`mir-score-val ${scoreValClass(value)}`}>{value > 0 ? `+${value}` : value}</span>
              <div className="mir-score-bar-track">
                <div className="mir-score-bar-center" />
                <div className={`mir-score-bar-fill ${barCls}`} style={{ width: barCls === "zero" ? "2px" : `${barPct}%` }} />
              </div>
            </div>
          );
        })}
        {evidence?.length > 0 && (
          <div className="mir-evidence">
            <div className="mir-field-label">SUPPORTING EVIDENCE</div>
            <div className="mir-list">
              {evidence.map((item, index) => (
                <div key={`${item}-${index}`} className="mir-list-item">{item}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WatchPanel({ watchLevels, invalidation }) {
  return (
    <section className="mir-card">
      <div className="mir-card-hd">WATCH / INVALIDATION</div>
      <div className="mir-card-body">
        {watchLevels?.length > 0 && (
          <>
            <div className="mir-section-hd">Watch Levels</div>
            <div className="mir-watch-list">
              {watchLevels.map((item, index) => (
                <div key={`${item}-${index}`} className="mir-watch-item">
                  <span className="mir-watch-dot" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {invalidation?.length > 0 && (
          <>
            <div className="mir-section-hd mir-section-gap">Invalidation Conditions</div>
            <div className="mir-watch-list">
              {invalidation.map((item, index) => (
                <div key={`${item}-${index}`} className="mir-watch-item mir-invalidation-item">
                  <span className="mir-watch-dot" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {!watchLevels?.length && !invalidation?.length && (
          <div className="mir-empty">No watch data available yet.</div>
        )}
      </div>
    </section>
  );
}

function ArchiveRail({ items }) {
  if (!items?.length) return null;
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="mir-card">
      <div className="mir-card-hd">ARCHIVE HISTORY</div>
      <div className="mir-card-body">
        <div className="mir-archive-list">
          {sorted.map((item) => (
            <div key={item.date} className="mir-archive-item">
              <div>
                <div className="mir-archive-date">{item.date}</div>
                {item.dominantDrivers?.length > 0 && (
                  <div className="mir-archive-drivers">
                    {item.dominantDrivers.slice(0, 2).map((d) => d.replace(/_/g, " ")).join(" · ")}
                  </div>
                )}
              </div>
              <div className="mir-archive-meta">
                <span className={`mir-archive-regime mode-${item.regimeMode}`}>
                  {REGIME_LABELS[item.regimeMode] ?? item.regimeMode}
                </span>
                <span className="mir-archive-count">{item.entryCount}x</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Timeline({ entries }) {
  if (!entries?.length) {
    return <div className="mir-empty">No checkpoint entries yet. The next 3-hour refresh will populate the feed.</div>;
  }
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return (
    <div className="mir-timeline">
      {sorted.map((entry, index) => (
        <details key={entry.timestamp || `${entry.session}-${index}`} className="mir-entry" open={index === 0}>
          <summary className="mir-entry-summary">
            <div className="mir-entry-session">
              <span className={`mir-session-badge session-${entry.session}`}>{SESSION_LABELS[entry.session] ?? entry.session}</span>
              <span className="mir-entry-time">{entry.runTime || entry.timestamp || "—"}</span>
            </div>
            <span className="mir-entry-headline">{entry.headline || "No headline available."}</span>
          </summary>
          <div className="mir-entry-body">
            {entry.dominantStory && (
              <div>
                <div className="mir-field-label">DOMINANT STORY</div>
                <div className="mir-entry-story">{entry.dominantStory}</div>
              </div>
            )}
            {entry.whatChangedSinceLastReport?.length > 0 && (
              <div>
                <div className="mir-field-label">WHAT CHANGED</div>
                <div className="mir-list">
                  {entry.whatChangedSinceLastReport.map((item, i) => (
                    <div key={`${item}-${i}`} className="mir-list-item">{item}</div>
                  ))}
                </div>
              </div>
            )}
            {entry.crossAssetConnections?.length > 0 && (
              <div>
                <div className="mir-field-label">CROSS-ASSET CONNECTIONS</div>
                <div className="mir-list">
                  {entry.crossAssetConnections.map((item, i) => (
                    <div key={`${item}-${i}`} className="mir-list-item">{item}</div>
                  ))}
                </div>
              </div>
            )}
            {entry.operatorPosture && (
              <div>
                <div className="mir-field-label">OPERATOR POSTURE</div>
                <div className="mir-entry-story">{entry.operatorPosture}</div>
              </div>
            )}
            {entry.watchNext?.length > 0 && (
              <div>
                <div className="mir-field-label">WATCH NEXT</div>
                <div className="mir-list">
                  {entry.watchNext.map((item, i) => (
                    <div key={`${item}-${i}`} className="mir-list-item">{item}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function MacroRadarPanels({ isDark = true }) {
  const [regime, setRegime] = useState(null);
  const [market, setMarket] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nextRunAt = useMemo(() => computeNextRunAt(), [tick]);

  const load = useCallback(async () => {
    const bust = `?v=${Date.now()}`;
    const safe = async (url) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    };

    const [nextRegime, nextMarket, nextLog, nextArchive] = await Promise.all([
      safe(`${MACRO_BASE}regime-state.json${bust}`),
      safe(`${MACRO_BASE}market-snapshot.json${bust}`),
      safe(`${MACRO_BASE}today-log.json${bust}`),
      safe(`${MACRO_BASE}archive-index.json${bust}`),
    ]);

    setRegime(nextRegime);
    setMarket(nextMarket);
    setTodayLog(nextLog);
    setArchive(Array.isArray(nextArchive) ? nextArchive : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => { load(); }, 300_000);
    return () => window.clearInterval(id);
  }, [load]);

  const assets = useMemo(() => {
    if (!market?.assets) return [];
    return Array.isArray(market.assets) ? market.assets.filter(Boolean) : Object.values(market.assets).filter(Boolean);
  }, [market]);

  const confidenceLabel = regime?.confidence != null ? `${Math.round(regime.confidence * 100)}%` : "—";
  const sessionKey = todayLog?.entries?.length ? todayLog.entries[todayLog.entries.length - 1]?.session : null;
  const lastSync = regime?.timestamp
    ? new Date(regime.timestamp).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
    : "—";
  const freshnessClass = staleClass(regime?.timestamp);

  return (
    <section className={`mir-module ${isDark ? "mir-dark" : "mir-light"}`}>
      <header className="mir-header">
        <div className="mir-hud">
          <span className={`mir-regime-pill mode-${regime?.regimeMode || "mixed"}`}>{REGIME_LABELS[regime?.regimeMode] ?? "MIXED"}</span>
          <span className="mir-hud-sep">|</span>
          <span className="mir-hud-kv"><span className="mir-hud-k">CONF</span><span className="mir-hud-v">{confidenceLabel}</span></span>
          <span className="mir-hud-sep">|</span>
          <span className="mir-hud-kv"><span className="mir-hud-k">FRESHNESS</span><span className={freshnessClass}>{regime?.timestamp ? (freshnessClass === "mir-fresh" ? "FRESH" : "STALE") : "PENDING"}</span></span>
          <span className="mir-hud-sep">|</span>
          <span className="mir-hud-kv"><span className="mir-hud-k">SESSION</span><span className="mir-hud-v">{SESSION_LABELS[sessionKey] ?? "AWAITING CHECKPOINT"}</span></span>
          <span className="mir-hud-sep">|</span>
          <span className="mir-hud-kv"><span className="mir-hud-k">NEXT RUN</span><span className="mir-countdown">{formatCountdown(nextRunAt)}</span></span>
          <span className="mir-hud-sep mir-hud-sep-right">SYNC</span>
          <span className="mir-hud-v">{lastSync}</span>
        </div>

        <div className="mir-title-row">
          <div>
            <h2 className="mir-title">RADAR MARKET FEED</h2>
            <div className="mir-subtitle">GLOBAL MARKETS · PRE-MARKET LOG · ARCHIVE HISTORY</div>
          </div>
          {regime?.dominantDrivers?.length > 0 && (
            <div className="mir-drivers">
              {regime.dominantDrivers.map((driver) => (
                <span key={driver} className="mir-driver-tag">{driver.replace(/_/g, " ")}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      {assets.length > 0 && (
        <div className="mir-pulse-strip">
          <div className="mir-pulse-scroll">
            {assets.map((asset) => {
              const delta = fmtDelta(asset.pctVsClose);
              const sparkColor = asset.pctVsClose >= 0 ? "#00FF41" : "#FF3B3B";
              return (
                <div key={asset.key} className={`mir-asset-card impact-${asset.impactTag ?? "neutral"}`}>
                  <div className="mir-asset-label">{asset.label}</div>
                  <div className="mir-asset-value">{fmtValue(asset.value, asset.key)}</div>
                  <div className={`mir-asset-delta ${delta.cls}`}>{delta.text}</div>
                  <div className="mir-asset-impact">{(asset.impactTag ?? "").replace(/_/g, " ")}</div>
                  {asset.sparkline && <MiniSparkline data={asset.sparkline} color={sparkColor} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mir-body">
        <main className="mir-main">
          <div className="mir-card">
            <div className="mir-card-hd">
              TODAY'S TIMELINE
              {todayLog?.status === "active" && <span className="mir-live-pill">LIVE</span>}
            </div>
            <div className="mir-card-body">
              <div className="mir-field-label">
                {todayLog?.date || new Date().toISOString().slice(0, 10)} · REFRESHES EVERY 3 HOURS
              </div>
              {loading ? <div className="mir-empty">Loading market feed…</div> : <Timeline entries={todayLog?.entries ?? []} />}
            </div>
          </div>
        </main>

        <aside className="mir-aside">
          <SignalBoard scores={regime?.scores ?? todayLog?.entries?.[0]?.signalScores} evidence={regime?.supportingEvidence} />
          <WatchPanel watchLevels={regime?.watchLevels} invalidation={regime?.invalidationConditions} />
          <ArchiveRail items={archive} />
        </aside>
      </div>
    </section>
  );
}
