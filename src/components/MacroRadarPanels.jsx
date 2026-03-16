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

function cleanLine(text) {
  return String(text || "")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(list, fallback) {
  return list?.length ? cleanLine(list[0]) : fallback;
}

function buildOperatorLens(regime, latestEntry, assets) {
  const scores = regime?.scores || {};
  const dominantDrivers = regime?.dominantDrivers || [];
  const supportingEvidence = regime?.supportingEvidence || [];
  const assetMap = Object.fromEntries((assets || []).map((asset) => [asset.key, asset]));

  const spx = assetMap.spx;
  const btc = assetMap.btc;
  const vix = assetMap.vix;
  const dxy = assetMap.dxy;
  const tnx = assetMap.tnx;
  const wti = assetMap.wti;

  let pressureTitle = "Global pressure is mixed";
  if ((scores.volatilityStress ?? 0) >= 1 || (scores.dollarPressure ?? 0) >= 1) {
    pressureTitle = "Global pressure is tightening";
  } else if ((scores.liquidity ?? 0) >= 1 || (scores.growthHealth ?? 0) >= 1) {
    pressureTitle = "Global pressure is loosening";
  }

  const globalPressure = {
    title: pressureTitle,
    signal: firstLine(
      dominantDrivers,
      "Global markets are not giving a clean one-way message yet.",
    ),
    connection: [
      dxy?.value != null ? `Dollar index ${Number(dxy.value).toFixed(2)} tells you whether global financing is tightening.` : null,
      tnx?.value != null ? `10Y yield ${Number(tnx.value).toFixed(2)} is the transmission channel into mortgages, credit, and duration risk.` : null,
      vix?.value != null ? `VIX ${Number(vix.value).toFixed(2)} tells you whether stress is becoming the dominant market language.` : null,
      wti?.value != null ? `WTI ${Number(wti.value).toFixed(2)} is the inflation spillover check on everything else.` : null,
      firstLine(supportingEvidence, null),
    ].filter(Boolean).slice(0, 2),
  };

  let fedTitle = "Fed transmission is unresolved";
  if ((scores.liquidity ?? 0) >= 1 && (scores.inflationPressure ?? 0) <= 0) {
    fedTitle = "Fed transmission is easing";
  } else if ((scores.liquidity ?? 0) <= -1 || (scores.inflationPressure ?? 0) >= 1) {
    fedTitle = "Fed transmission is still restrictive";
  }

  const fedTransmission = {
    title: fedTitle,
    signal: firstLine(
      latestEntry?.crossAssetConnections,
      "Rates, liquidity, and Treasury pressure are still the main levers to watch.",
    ),
    connection: [
      "The question is not whether headlines sound dovish. The question is whether reserves, Treasury pressure, and funding conditions are actually loosening.",
      firstLine(
        regime?.watchLevels,
        "Watch yield, Treasury, and liquidity thresholds before assuming better conditions are real.",
      ),
    ].filter(Boolean).slice(0, 2),
  };

  let aiTitle = "AI leadership needs confirmation";
  if ((scores.breadthQuality ?? 0) <= -1) {
    aiTitle = "AI leadership may be masking weak breadth";
  } else if ((scores.breadthQuality ?? 0) >= 1 && (scores.growthHealth ?? 0) >= 1) {
    aiTitle = "Leadership is broadening beyond a narrow AI trade";
  }

  const aiDistortion = {
    title: aiTitle,
    signal: btc?.value != null && spx?.value != null
      ? `Bitcoin ${Math.round(Number(btc.value)).toLocaleString()} and the S&P ${Number(spx.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} can both look strong while the underlying participation is still thin.`
      : "Do not confuse index strength or AI enthusiasm with broad safety across the economy.",
    connection: [
      "If a small leadership cohort is carrying the tape, households still need to operate as if conditions are selective, not universally safe.",
      "A narrow market can reward optimism right up until financing stress or weak breadth reasserts itself.",
    ],
  };

  let householdTitle = "Household conditions still demand discipline";
  if ((scores.liquidity ?? 0) >= 1 && (scores.growthHealth ?? 0) >= 1 && (scores.volatilityStress ?? 0) <= 0) {
    householdTitle = "Household conditions are improving, but not permissive";
  } else if ((scores.dollarPressure ?? 0) >= 1 || (scores.inflationPressure ?? 0) >= 1) {
    householdTitle = "Household conditions are vulnerable to renewed pressure";
  }

  const householdImpact = {
    title: householdTitle,
    signal: latestEntry?.operatorPosture
      ? cleanLine(latestEntry.operatorPosture)
      : "Your spending, debt, and savings posture should follow the regime, not your hopes.",
    connection: [
      "When policy, liquidity, or the dollar tighten, your margin for sloppy spending shrinks before the headlines fully admit it.",
      "Use macro to challenge purchases, debt timing, and risk-taking. If the system is mixed or restrictive, optional spending should feel harder to justify.",
    ],
  };

  let directiveTitle = "Operator directive: defend and preserve optionality";
  let directiveBody = "Stay selective. Protect cash, avoid chasing strong narratives, and make sure your next move improves resilience.";
  if ((scores.liquidity ?? 0) >= 1 && (scores.growthHealth ?? 0) >= 1 && (scores.volatilityStress ?? 0) <= 0) {
    directiveTitle = "Operator directive: prepare, do not overextend";
    directiveBody = "Conditions are improving enough to plan offensive moves, but you still want confirmation before loosening discipline.";
  } else if ((scores.volatilityStress ?? 0) >= 1 || (scores.dollarPressure ?? 0) >= 1) {
    directiveTitle = "Operator directive: slow down and tighten standards";
    directiveBody = "This is not a clean environment for optimism spending or loose balance-sheet decisions. Let the environment prove itself first.";
  }

  return {
    globalPressure,
    fedTransmission,
    aiDistortion,
    householdImpact,
    directive: {
      title: directiveTitle,
      body: directiveBody,
      watch: (regime?.watchLevels || latestEntry?.watchNext || []).slice(0, 3),
    },
  };
}

function OperatorCard({ eyebrow, title, signal, connection, tone = "default" }) {
  return (
    <section className={`mir-card mir-operator-card tone-${tone}`}>
      <div className="mir-card-hd">{eyebrow}</div>
      <div className="mir-card-body">
        <div className="mir-operator-title">{title}</div>
        <div className="mir-operator-block">
          <div className="mir-field-label">SIGNAL</div>
          <div className="mir-entry-story">{signal}</div>
        </div>
        <div className="mir-operator-block">
          <div className="mir-field-label">CONNECTION</div>
          <div className="mir-list">
            {(Array.isArray(connection) ? connection : [connection]).filter(Boolean).map((item, index) => (
              <div key={`${item}-${index}`} className="mir-list-item">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DirectiveCard({ directive, latestEntry }) {
  return (
    <section className="mir-card mir-directive-card">
      <div className="mir-card-hd">OPERATOR DIRECTIVE</div>
      <div className="mir-card-body">
        <div className="mir-operator-title">{directive.title}</div>
        <div className="mir-entry-story">{directive.body}</div>
        {latestEntry?.operatorPosture && (
          <div className="mir-operator-block">
            <div className="mir-field-label">CURRENT POSTURE</div>
            <div className="mir-entry-story">{cleanLine(latestEntry.operatorPosture)}</div>
          </div>
        )}
        {directive.watch?.length > 0 && (
          <div className="mir-operator-block">
            <div className="mir-field-label">WATCH NEXT</div>
            <div className="mir-list">
              {directive.watch.map((item, index) => (
                <div key={`${item}-${index}`} className="mir-list-item">{item}</div>
              ))}
            </div>
          </div>
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
  const latestEntry = useMemo(() => {
    const entries = todayLog?.entries || [];
    return entries.length ? entries[entries.length - 1] : null;
  }, [todayLog]);
  const operatorLens = useMemo(
    () => buildOperatorLens(regime, latestEntry, assets),
    [regime, latestEntry, assets],
  );

  return (
    <section className={`mir-module ${isDark ? "mir-dark" : "mir-light"}`}>
      <header className="mir-header">
        <div className="mir-title-row">
          <div>
            <h2 className="mir-title">RADAR MARKET FEED</h2>
            <div className="mir-subtitle">
              PRE-MARKET LOG · ARCHIVE HISTORY · NEXT RUN {formatCountdown(nextRunAt)}
            </div>
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

      <div className="mir-body">
        <main className="mir-main">
          <div className="mir-decision-grid">
            <OperatorCard
              eyebrow="GLOBAL PRESSURE"
              title={operatorLens.globalPressure.title}
              signal={operatorLens.globalPressure.signal}
              connection={operatorLens.globalPressure.connection}
              tone="pressure"
            />
            <OperatorCard
              eyebrow="FED TRANSMISSION"
              title={operatorLens.fedTransmission.title}
              signal={operatorLens.fedTransmission.signal}
              connection={operatorLens.fedTransmission.connection}
              tone="fed"
            />
            <OperatorCard
              eyebrow="AI / MARKET DISTORTION"
              title={operatorLens.aiDistortion.title}
              signal={operatorLens.aiDistortion.signal}
              connection={operatorLens.aiDistortion.connection}
              tone="distortion"
            />
            <OperatorCard
              eyebrow="HOUSEHOLD IMPACT"
              title={operatorLens.householdImpact.title}
              signal={operatorLens.householdImpact.signal}
              connection={operatorLens.householdImpact.connection}
              tone="impact"
            />
          </div>

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
          <DirectiveCard directive={operatorLens.directive} latestEntry={latestEntry} />
          <WatchPanel watchLevels={regime?.watchLevels} invalidation={regime?.invalidationConditions} />
          <ArchiveRail items={archive} />
        </aside>
      </div>
    </section>
  );
}
