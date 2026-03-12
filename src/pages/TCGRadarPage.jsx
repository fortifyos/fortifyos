import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Eye, FileText, Home, LayoutGrid, RefreshCw, Search, Settings, X, Zap } from "lucide-react";
import "./tcg-radar.css";

const BASE = import.meta.env.BASE_URL || "/";

function QueryConsole({ value, onChange, onRun, suggestions }) {
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
          <button type="button" onClick={onRun}>Run</button>
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
          <span>Alpha {signal.alpha_score}</span>
          <span>Conf {signal.confidence_score}</span>
        </div>
      </div>
      <p className="tcg-signal-card__summary">{signal.summary}</p>
      <div className="tcg-signal-card__chips">
        {signal.signal_types?.slice(0, 4).map((tag) => <span key={tag} className="tcg-chip">{tag.replace(/_/g, " ")}</span>)}
      </div>
      <ul className="tcg-signal-card__drivers">
        {signal.drivers?.slice(0, 3).map((driver) => <li key={driver}>{driver}</li>)}
      </ul>
    </button>
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE}tcg/latest.json?v=${Date.now()}`, { cache: "no-store" });
      const next = response.ok ? await response.json() : null;
      setPayload(next);
      setResults(next?.top_signals || []);
      setSelected(next?.top_signals?.[0] || null);
    } catch {
      setPayload(null);
      setResults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const navItems = [
    { key: "home", label: "Home", icon: Home, onClick: onHome },
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, onClick: onBack },
    { key: "radar", label: "Radar", icon: Eye, onClick: onMacroSentinel },
    { key: "macroIntel", label: "Macro Intel", icon: Activity, onClick: onMacroIntel },
    { key: "bitcoin", label: "Bitcoin", icon: null, onClick: onBitcoin },
    { key: "tcg", label: "TCG Radar", icon: Zap, onClick: null, current: true },
    { key: "docs", label: "Docs", icon: FileText, onClick: onDocs },
    { key: "settings", label: "Settings", icon: Settings, onClick: onSettings },
  ];

  const runQuery = () => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults(payload?.top_signals || []);
      return;
    }
    const filtered = (payload?.top_signals || []).filter((signal) => {
      const haystack = [
        signal.entity_name,
        signal.franchise,
        signal.entity_type,
        signal.region_lead,
        ...(signal.signal_types || []),
        ...(signal.query_tags || []),
      ].join(" ").toLowerCase();
      if (q.includes("under $300") || q.includes("under 300")) {
        return haystack.includes("promo");
      }
      return haystack.includes(q) || q.split(" ").every((token) => haystack.includes(token));
    });
    setResults(filtered);
    setSelected(filtered[0] || null);
  };

  const panels = payload?.panels || {};

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
          </div>
          <div className="tcg-title-block">
            <div>
              <div className="tcg-kicker">Operator Intelligence</div>
              <h1 className="tcg-title">TCG Market Dislocations</h1>
              <p className="tcg-subtitle">Underpriced singles, sealed stress, Japan-first momentum, creator acceleration, and promo pressure before mainstream recognition.</p>
            </div>
          </div>
        </header>

        <QueryConsole value={query} onChange={setQuery} onRun={runQuery} suggestions={payload?.query_hints || []} />

        <div className="tcg-main-grid">
          <div className="tcg-main-col">
            <Panel title="Alpha Board" eyebrow="Ranked Opportunities" right={`${results.length} results`}>
              <div className="tcg-card-list">
                {results.map((signal) => (
                  <SignalCard key={signal.entity_id} signal={signal} onSelect={setSelected} active={selected?.entity_id === signal.entity_id} />
                ))}
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
                    <span>Alpha {selected.alpha_score}</span>
                    <span>Confidence {selected.confidence_score}</span>
                    <span>Risk {selected.risk_score}</span>
                  </div>
                  <div className="tcg-detail__section">
                    <div className="tcg-detail__label">Drivers</div>
                    <ul>{selected.drivers?.map((driver) => <li key={driver}>{driver}</li>)}</ul>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
