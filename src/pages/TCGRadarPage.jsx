import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Eye, FileText, Home, LayoutGrid, RefreshCw, Search, Settings, X, Zap } from "lucide-react";
import "./tcg-radar.css";

const BASE = import.meta.env.BASE_URL || "/";
const TCG_API_BASE = "/tcg-api/api/tcg";

function QueryConsole({ value, onChange, onRun, suggestions, busy }) {
  return (
    <section className="tcg-panel tcg-panel--green">
      <div className="tcg-panel__header">
        <div>
          <div className="tcg-panel__eyebrow">Query Console</div>
          <h3 className="tcg-panel__title">Intent Filters</h3>
        </div>
      </div>
      <div className="tcg-panel__body">
        <div className="tcg-query">
          <Search size={16} />
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="show japanese promos under $300 with rising attention" />
          <button type="button" onClick={onRun}>{busy ? "..." : "Run"}</button>
        </div>
        <div className="tcg-query-hints">
          {suggestions?.map((hint) => (
            <button key={hint} type="button" className="tcg-chip" onClick={() => onChange(hint)}>{hint}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SignalCard({ signal, onSelect, active }) {
  return (
    <button type="button" className={`tcg-signal-card ${active ? "is-active" : ""}`} onClick={() => onSelect(signal)}>
      <div className="tcg-signal-card__top">
        <div>
          <div className="tcg-signal-card__franchise">{signal.franchise}</div>
          <h3 className="tcg-signal-card__name">{signal.entity_name}</h3>
        </div>
        <div className="tcg-signal-card__scores">
          <span>Opp {signal.opportunity_score ?? signal.alpha_score}</span>
          <span>Conf {signal.confidence_score}</span>
        </div>
      </div>
      <p className="tcg-signal-card__summary">{signal.summary}</p>
      <div className="tcg-signal-card__chips">
        <span className="tcg-chip">{signal.action_state || "observe"}</span>
        <span className="tcg-chip">Urg {signal.urgency_score ?? "—"}</span>
        <span className="tcg-chip">Risk {signal.risk_score}</span>
      </div>
      <div className="tcg-signal-card__chips">
        {signal.signal_types?.slice(0, 4).map((tag) => <span key={tag} className="tcg-chip">{tag.replace(/_/g, " ")}</span>)}
      </div>
      <ul className="tcg-signal-card__drivers">
        {signal.drivers?.slice(0, 3).map((driver) => <li key={driver}>{driver}</li>)}
      </ul>
    </button>
  );
}

function AlphaBoardSection({ title, eyebrow, signals, onSelect, selected }) {
  return (
    <div className="tcg-alpha-section">
      <div className="tcg-alpha-section__head">
        <div className="tcg-panel__eyebrow">{eyebrow}</div>
        <h4 className="tcg-alpha-section__title">{title}</h4>
      </div>
      {signals?.length ? (
        <div className="tcg-card-list">
          {signals.map((signal) => (
            <SignalCard
              key={signal.entity_id}
              signal={signal}
              onSelect={onSelect}
              active={selected?.entity_id === signal.entity_id}
            />
          ))}
        </div>
      ) : (
        <div className="tcg-empty">No signals in this bucket yet.</div>
      )}
    </div>
  );
}

function FranchiseMomentumBoard({ items }) {
  return (
    <div className="tcg-franchise-board">
      {items?.length ? items.map((item) => (
        <div key={item.franchise} className="tcg-franchise-card">
          <div className="tcg-franchise-card__top">
            <div>
              <div className="tcg-signal-card__franchise">Franchise Incubator</div>
              <h4 className="tcg-franchise-card__title">{item.franchise}</h4>
            </div>
            <div className="tcg-franchise-card__score">
              <span>{item.system_state}</span>
              <strong>{item.incubator_score}</strong>
            </div>
          </div>
          <p className="tcg-signal-card__summary">{item.headline}</p>
          <div className="tcg-signal-card__chips">
            <span className="tcg-chip">Stage {item.stage}</span>
            <span className="tcg-chip">{item.entity_count} entities</span>
            {item.established ? <span className="tcg-chip">established</span> : null}
          </div>
          <div className="tcg-detail__section">
            <div className="tcg-detail__label">Viability Gates</div>
            <ul className="tcg-franchise-card__gates">
              {Object.entries(item.gate_status || {}).map(([key, passed]) => (
                <li key={key}>
                  <span>{key.replace(/_/g, " ")}</span>
                  <strong className={passed ? "is-pass" : "is-watch"}>{passed ? "pass" : "watch"}</strong>
                </li>
              ))}
            </ul>
          </div>
          <ul className="tcg-signal-card__drivers">
            {item.drivers?.slice(0, 4).map((driver) => <li key={driver}>{driver}</li>)}
          </ul>
        </div>
      )) : <div className="tcg-empty">No incubator franchises yet.</div>}
    </div>
  );
}

function WatchlistStatusPanel({ watchlist, sourceHealth, apiMode }) {
  return (
    <div className="tcg-watchlist">
      <div className="tcg-watchlist__meta">
        <span>{watchlist?.entities_tracked || 0} tracked</span>
        <span>{apiMode ? "live api" : "snapshot"}</span>
      </div>

      <div className="tcg-detail__section">
        <div className="tcg-detail__label">Source Readiness</div>
        <ul className="tcg-watchlist__sources">
          {(sourceHealth || []).map((item) => (
            <li key={item.source}>
              <span>{item.source}</span>
              <strong>{item.events} events</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="tcg-detail__section">
        <div className="tcg-detail__label">Priority Watchlist</div>
        <ul className="tcg-watchlist__priorities">
          {(watchlist?.priorities || []).slice(0, 5).map((item) => (
            <li key={item.entity_id}>
              <span>{item.entity_id}</span>
              <strong>P{item.priority}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Panel({ title, eyebrow, tone = "green", children, right = null }) {
  return (
    <section className={`tcg-panel tcg-panel--${tone}`}>
      <div className="tcg-panel__header">
        <div>
          <div className="tcg-panel__eyebrow">{eyebrow}</div>
          <h3 className="tcg-panel__title">{title}</h3>
        </div>
        {right ? <div className="tcg-panel__meta">{right}</div> : null}
      </div>
      <div className="tcg-panel__body">{children}</div>
    </section>
  );
}

function AppMenu({ navItems }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div className="tcg-menu" ref={ref}>
      <button type="button" className="tcg-icon-btn" onClick={() => setOpen((prev) => !prev)} aria-label="Open navigation">
        {open ? <X size={15} /> : <Zap size={15} />}
      </button>
      {open ? (
        <div className="tcg-menu__pop">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                disabled={!item.onClick}
                className={`tcg-menu__item ${item.current ? "is-current" : ""}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {Icon ? <Icon size={15} /> : <span className="tcg-menu__btc">₿</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function TCGRadarPage({ onBack, onHome, onMacroSentinel, onMacroIntel, onBitcoin, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [payload, setPayload] = useState(null);
  const [apiMode, setApiMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      let next = null;
      let live = false;
      try {
        const apiResponse = await fetch(`${TCG_API_BASE}/latest`, { cache: "no-store" });
        if (apiResponse.ok) {
          next = await apiResponse.json();
          live = true;
        }
      } catch {
        next = null;
      }
      if (!next) {
        const response = await fetch(`${BASE}tcg/latest.json?v=${Date.now()}`, { cache: "no-store" });
        next = response.ok ? await response.json() : null;
      }
      setApiMode(live);
      setPayload(next);
      setResults(next?.top_signals || []);
      setSelected(next?.alpha_board?.act?.[0] || next?.top_signals?.[0] || null);
    } catch {
      setPayload(null);
      setApiMode(false);
      setResults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected?.entity_id) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      if (!apiMode) {
        setSelectedDetail({ signal: selected, price_history: [], attention_history: [] });
        return;
      }
      try {
        const response = await fetch(`${TCG_API_BASE}/entity/${selected.entity_id}`, { cache: "no-store" });
        const detail = response.ok ? await response.json() : null;
        if (!cancelled) {
          setSelectedDetail(detail || { signal: selected, price_history: [], attention_history: [] });
        }
      } catch {
        if (!cancelled) {
          setSelectedDetail({ signal: selected, price_history: [], attention_history: [] });
        }
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selected, apiMode]);

  const navItems = [
    { key: "home", label: "Home", icon: Home, onClick: onHome },
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, onClick: onBack },
    { key: "radar", label: "Radar", icon: Eye, onClick: onMacroSentinel },
    { key: "macroIntel", label: "Macro Intel", icon: Activity, onClick: onMacroIntel },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: onBitcoin },
    { key: "tcg", label: "TCG Radar", icon: Zap, onClick: null, current: true },
    { key: "docs", label: "Field Manual", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  const runQuery = async () => {
    const q = query.trim();
    if (!q) {
      setResults(payload?.top_signals || []);
      setSelected((payload?.top_signals || [])[0] || null);
      return;
    }
    if (apiMode) {
      setQueryLoading(true);
      try {
        const response = await fetch(`${TCG_API_BASE}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = response.ok ? await response.json() : { results: [] };
        setResults(data.results || []);
        setSelected((data.results || [])[0] || null);
        return;
      } catch {
        // fall back below
      } finally {
        setQueryLoading(false);
      }
    }

    const lowered = q.toLowerCase();
    const filtered = (payload?.top_signals || []).filter((signal) => {
      const haystack = [
        signal.entity_name,
        signal.franchise,
        signal.entity_type,
        signal.region_lead,
        signal.action_state,
        ...(signal.signal_types || []),
        ...(signal.query_tags || []),
      ].join(" ").toLowerCase();
      return haystack.includes(lowered) || lowered.split(" ").every((token) => haystack.includes(token));
    });
    setResults(filtered);
    setSelected(filtered[0] || null);
  };

  const panels = payload?.panels || {};
  const alphaBoard = payload?.alpha_board || {};
  const watchlist = payload?.watchlist || {};
  const sourceHealth = payload?.source_health || [];

  return (
    <div className={`tcg-root ${isDark ? "tcg-dark" : "tcg-light"}`}>
      <nav className="tcg-topbar">
        <div className="tcg-topbar__left">
          <AppMenu navItems={navItems} />
          <div className="tcg-brand">FORTIFY OS</div>
        </div>
        <div className="tcg-topbar__center">TCG RADAR</div>
        <div className="tcg-topbar__right">
          <button type="button" className="tcg-icon-btn" onClick={load} aria-label="Refresh TCG radar"><RefreshCw size={15} /></button>
          <button type="button" className="tcg-icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">{isDark ? "◐" : "◑"}</button>
        </div>
      </nav>

      <div className="tcg-shell">
        <header className="tcg-hero">
          <div className="tcg-statusbar">
            <span className="tcg-status">{loading ? "LOADING" : "LIVE FEED"}</span>
            <span>RUN {payload?.run_id || "—"}</span>
            <span>GENERATED {payload?.generated_at ? new Date(payload.generated_at).toLocaleString() : "—"}</span>
            <span>{payload?.top_signals?.length || 0} SIGNALS</span>
            <span>{apiMode ? "API MODE" : "SNAPSHOT MODE"}</span>
          </div>
          <div className="tcg-title-block">
            <div>
              <div className="tcg-kicker">Operator Intelligence</div>
              <h1 className="tcg-title">TCG Market Dislocations</h1>
              <p className="tcg-subtitle">Underpriced singles, sealed stress, Japan-first momentum, creator acceleration, and promo pressure before mainstream recognition.</p>
            </div>
          </div>
        </header>

        <QueryConsole value={query} onChange={setQuery} onRun={runQuery} suggestions={payload?.query_hints || []} busy={queryLoading} />

        <div className="tcg-main-grid">
          <div className="tcg-main-col">
            <Panel title="Alpha Board" eyebrow="Ranked Opportunities" right={`${results.length} results`}>
              <AlphaBoardSection title="Act Opportunities" eyebrow="High Conviction" signals={alphaBoard.act} onSelect={setSelected} selected={selected} />
              <AlphaBoardSection title="Prepare Opportunities" eyebrow="Structural Setup" signals={alphaBoard.prepare} onSelect={setSelected} selected={selected} />
              <AlphaBoardSection title="Observe Signals" eyebrow="Early Formation" signals={query ? results : alphaBoard.observe} onSelect={setSelected} selected={selected} />
              <div className="tcg-alpha-section">
                <div className="tcg-alpha-section__head">
                  <div className="tcg-panel__eyebrow">Emerging Franchise Momentum</div>
                  <h4 className="tcg-alpha-section__title">Incubator Board</h4>
                </div>
                <FranchiseMomentumBoard items={alphaBoard.franchise_momentum} />
              </div>
            </Panel>
          </div>

          <aside className="tcg-side-col">
            <Panel title="Entity Detail" eyebrow="Selected Signal" tone="amber">
              {selected ? (
                <div className="tcg-detail">
                  <div className="tcg-detail__name">{selected.entity_name}</div>
                  <div className="tcg-detail__meta">{selected.franchise} · {selected.entity_type} · Lead {selected.region_lead || "—"}</div>
                  <p className="tcg-detail__summary">{selected.summary}</p>
                  <div className="tcg-detail__scores">
                    <span>Opp {selected.opportunity_score ?? selected.alpha_score}</span>
                    <span>Confidence {selected.confidence_score}</span>
                    <span>Risk {selected.risk_score}</span>
                    <span>Urgency {selected.urgency_score ?? "—"}</span>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Action State</div>
                    <div>{selected.action_state || "observe"}</div>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Drivers</div>
                    <ul>{selected.drivers?.map((driver) => <li key={driver}>{driver}</li>)}</ul>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Narrative</div>
                    <ul>
                      <li>{selected.narrative?.thesis || selected.summary}</li>
                      {selected.narrative?.watch_for?.slice?.(0, 2)?.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Entity History</div>
                    <div className="tcg-detail__history">
                      <span>Price snapshots {selectedDetail?.price_history?.length || 0}</span>
                      <span>Attention snapshots {selectedDetail?.attention_history?.length || 0}</span>
                    </div>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Source Receipts</div>
                    <ul>{selected.sources?.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></li>)}</ul>
                  </div>
                </div>
              ) : (
                <div className="tcg-empty">No matching signal selected.</div>
              )}
            </Panel>
            <Panel title="Japan Lead" eyebrow="Regional Divergence" tone="purple">
              <ul className="tcg-mini-list">{panels.japan_lead?.slice(0, 5).map((signal) => <li key={signal.entity_id}>{signal.entity_name} <span>{signal.alpha_score}</span></li>)}</ul>
            </Panel>
            <Panel title="Sealed Dislocations" eyebrow="Supply Gaps" tone="gold">
              <ul className="tcg-mini-list">{panels.sealed_dislocations?.slice(0, 5).map((signal) => <li key={signal.entity_id}>{signal.entity_name} <span>{signal.alpha_score}</span></li>)}</ul>
            </Panel>
            <Panel title="Promo Alerts" eyebrow="Limited Catalysts" tone="amber">
              <ul className="tcg-mini-list">{panels.promo_alerts?.slice(0, 5).map((signal) => <li key={signal.entity_id}>{signal.entity_name} <span>{signal.alpha_score}</span></li>)}</ul>
            </Panel>
            <Panel title="Creator Momentum" eyebrow="Attention Rotation" tone="green">
              <ul className="tcg-mini-list">{panels.creator_momentum?.slice(0, 5).map((signal) => <li key={signal.entity_id}>{signal.entity_name} <span>{signal.alpha_score}</span></li>)}</ul>
            </Panel>
            <Panel title="Radar Coverage" eyebrow="Watchlist Status" tone="green">
              <WatchlistStatusPanel watchlist={watchlist} sourceHealth={sourceHealth} apiMode={apiMode} />
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
