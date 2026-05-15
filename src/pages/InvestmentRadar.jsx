import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, Cpu, Eye, FileText, Gauge, Home, LayoutGrid, Search, Settings, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import SpecialistShell from '../components/SpecialistShell.jsx';
import './investment-radar.css';
import {
  AI_FRONTIER_THEMES,
  AI_HIERARCHY_STEPS,
  AI_INFRA_TICKERS,
  PORTFOLIO_OPTIONS,
  getInvestableTickers,
  getUniqueUniverseTickers,
} from '../data/investmentRadarData.js';

const ALLOCATION_PRESETS = [250, 500, 1000, 2500];
const MAX_ALLOCATION = 100000;

function formatDollars(value) {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function scaledDollars(total, pct) {
  return Math.round((Number(total) || 0) * (pct / 100));
}

function snapshotPath(symbol) {
  const seed = Array.from(symbol || 'AI').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 10 }, (_, index) => {
    const x = 8 + index * 10;
    const wave = Math.sin((seed + index * 13) / 10) * 13;
    const drift = (index - 4.5) * ((seed % 5) - 1);
    const y = Math.max(12, Math.min(86, 52 - wave - drift));
    return `${x},${y}`;
  }).join(' ');
}

function TickerSnapshot({ ticker }) {
  if (!ticker) return null;
  const trackLabel = ticker.track === 'capital' ? 'Track 2 core' : ticker.track === 'research' ? 'Research only' : 'Track 1 signal';
  return (
    <div className="ir-chart-snapshot">
      <div className="ir-snapshot-head">
        <div>
          <span>Daily close snapshot</span>
          <strong>{ticker.symbol}</strong>
        </div>
        <small>{trackLabel}</small>
      </div>
      <div className="ir-snapshot-visual" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={snapshotPath(ticker.symbol)} />
        </svg>
      </div>
      <div className="ir-snapshot-grid">
        <div><span>Company</span><strong>{ticker.name}</strong></div>
        <div><span>Layer</span><strong>{ticker.layer}</strong></div>
        <div><span>Sector</span><strong>{ticker.sector}</strong></div>
        <div><span>Stage</span><strong>{ticker.stage}</strong></div>
      </div>
      <p>{ticker.role}</p>
    </div>
  );
}

function TradingViewTape({ symbols, isDark }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: symbols.filter((item) => item.tradingView).map((item) => ({ proName: item.tradingView, title: item.symbol })),
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: isDark ? 'dark' : 'light',
      locale: 'en',
    });
    ref.current.appendChild(container);
    ref.current.appendChild(script);
  }, [symbols, isDark]);
  return <div ref={ref} className="ir-tv-tape" aria-label="Live ticker tape" />;
}

function TradingViewMiniChart({ ticker }) {
  return (
    <div className="ir-mini-chart" aria-label={`${ticker?.symbol || 'Ticker'} live price chart`}>
      <TickerSnapshot ticker={ticker} />
    </div>
  );
}

function AllocationPlanner({ amount, onAmountChange }) {
  const normalizedAmount = Math.max(0, Math.min(MAX_ALLOCATION, Number(amount) || 0));
  return (
    <section className="ir-card ir-allocation-planner">
      <div>
        <div className="ir-kicker">Optional allocation model</div>
        <h2>Choose capital amount</h2>
        <p>Scale either Track 2 path without changing the discipline: percentages, timing, and no-trade guardrails stay fixed.</p>
      </div>
      <div className="ir-allocation-controls">
        <label htmlFor="ir-allocation-amount">Starting amount</label>
        <div className="ir-amount-row">
          <span>$</span>
          <input
            id="ir-allocation-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={normalizedAmount}
            onChange={(event) => onAmountChange(event.target.value)}
            aria-label="Portfolio allocation amount"
          />
        </div>
        <div className="ir-preset-row" aria-label="Allocation amount presets">
          {ALLOCATION_PRESETS.map((preset) => (
            <button key={preset} className={normalizedAmount === preset ? 'active' : ''} onClick={() => onAmountChange(preset)}>
              {formatDollars(preset)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AllocationCard({ option, selected, amount }) {
  const optionBase = Number(option.total) || 1;
  return (
    <section className={`ir-card ir-allocation ${selected ? 'is-selected' : ''}`}>
      <div className="ir-card-head">
        <div>
          <div className="ir-kicker">Track 2 capital allocation</div>
          <h2>{option.label}</h2>
        </div>
        <div className="ir-total">{formatDollars(amount)}</div>
      </div>
      <div className="ir-bars">
        {option.holdings.map((holding) => {
          const dollars = scaledDollars(amount, holding.pct);
          return (
            <div key={holding.symbol} className="ir-bar-row">
              <div className="ir-bar-meta"><strong>{holding.symbol}</strong><span>{formatDollars(dollars)} · {holding.pct}%</span></div>
              <div className="ir-bar"><span style={{ width: `${holding.pct}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="ir-schedule">
        {option.weeklySchedule.map((week) => {
          const weekPct = (week.total / optionBase) * 100;
          return (
            <div key={week.week} className="ir-week">
              <span>W{week.week}</span>
              <strong>{formatDollars(scaledDollars(amount, weekPct))}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TickerCard({ ticker, active, onSelect }) {
  return (
    <button className={`ir-ticker-card ${active ? 'active' : ''}`} onClick={() => onSelect(ticker.symbol)}>
      <div className="ir-ticker-top">
        <span className="ir-symbol">{ticker.symbol}</span>
        <span className={`ir-track ${ticker.track}`}>{ticker.track === 'capital' ? 'Track 2' : ticker.track === 'research' ? 'Research' : 'Track 1'}</span>
      </div>
      <div className="ir-name">{ticker.name}</div>
      <div className="ir-layer">{ticker.layer} / {ticker.sector}</div>
      <p>{ticker.role}</p>
    </button>
  );
}

function HierarchyMap({ activeTheme, onSelectTheme }) {
  const activeStep = AI_HIERARCHY_STEPS.find((step) => AI_FRONTIER_THEMES.find((item) => item.stage === step.name)?.id === activeTheme);
  const [openLayer, setOpenLayer] = useState(activeStep?.layer || '2');

  useEffect(() => {
    if (activeStep?.layer) setOpenLayer(activeStep.layer);
  }, [activeStep?.layer]);

  return (
    <section className="ir-hierarchy ir-card">
      <div className="ir-card-head">
        <div>
          <div className="ir-kicker">Aschenbrenner hierarchy</div>
          <h2>Investment path to AI</h2>
        </div>
        <Cpu />
      </div>
      <div className="ir-hierarchy-steps">
        {AI_HIERARCHY_STEPS.map((step) => {
          const theme = AI_FRONTIER_THEMES.find((item) => item.stage === step.name);
          const isActive = theme && activeTheme === theme.id;
          const isOpen = openLayer === step.layer;
          return (
            <article key={step.layer} className={`ir-path-card ${isActive ? 'active' : ''} ${isOpen ? 'is-open' : ''}`}>
              <button
                className="ir-path-toggle"
                aria-expanded={isOpen}
                onClick={() => {
                  if (theme) onSelectTheme(theme.id);
                  setOpenLayer(isOpen ? null : step.layer);
                }}
              >
                <span>{step.layer}</span>
                <strong>{step.name}</strong>
                <small>{isOpen ? 'Close' : 'Open'}</small>
              </button>
              {isOpen && (
                <div className="ir-path-panel">
                  <p>{step.thesis}</p>
                  {theme && (
                    <>
                      <div className="ir-path-meta"><span>Top conviction</span><strong>{theme.topPicks.join(', ')}</strong></div>
                      <div className="ir-path-tickers">{theme.tickers.join(' · ')}</div>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function InvestmentRadar({ onBack, onHome, onDashboard, onMacroSentinel, onBitcoin, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [filter, setFilter] = useState('all');
  const [activeTheme, setActiveTheme] = useState('power-energy');
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('VTI');
  const [allocationAmount, setAllocationAmount] = useState(500);
  const hierarchyRef = useRef(null);
  const allocationRef = useRef(null);
  const workbenchRef = useRef(null);
  const investable = useMemo(() => new Set(getInvestableTickers()), []);
  const universeTickers = useMemo(() => getUniqueUniverseTickers(), []);
  const selected = AI_INFRA_TICKERS.find((t) => t.symbol === selectedSymbol) || AI_INFRA_TICKERS[0];
  const filtered = AI_INFRA_TICKERS.filter((ticker) => {
    const matchesFilter = filter === 'all' || ticker.track === filter || ticker.layer.toLowerCase().includes(filter) || ticker.stage.toLowerCase().includes(filter) || ticker.themeIds.includes(filter);
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [ticker.symbol, ticker.name, ticker.layer, ticker.sector, ticker.stage, ticker.role, ticker.thesis].join(' ').toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
  const activeThemeData = AI_FRONTIER_THEMES.find((theme) => theme.id === activeTheme);

  const selectTheme = (themeId) => {
    const theme = AI_FRONTIER_THEMES.find((item) => item.id === themeId);
    setActiveTheme(themeId);
    setFilter(themeId);
    if (theme?.tickers?.[0]) setSelectedSymbol(theme.tickers[0]);
  };
  const scrollToModule = (ref) => {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const showInvestableCore = () => {
    setFilter('capital');
    setSelectedSymbol('VTI');
    scrollToModule(allocationRef);
  };
  const showSignalWatchlist = () => {
    setFilter('signal');
    const signalTicker = AI_INFRA_TICKERS.find((ticker) => ticker.track === 'signal');
    if (signalTicker) setSelectedSymbol(signalTicker.symbol);
    scrollToModule(workbenchRef);
  };
  const showPowerBet = () => {
    selectTheme('power-energy');
    scrollToModule(hierarchyRef);
  };
  const updateAllocationAmount = (value) => {
    const next = Math.round(Number(value) || 0);
    setAllocationAmount(Math.max(0, Math.min(MAX_ALLOCATION, next)));
  };
  const navItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onHome },
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, onClick: onDashboard },
    { key: 'radar', label: 'Radar', icon: Eye, onClick: onMacroSentinel },
    { key: 'invest', label: 'AI Portfolio', icon: TrendingUp, onClick: null, current: true },
    { key: 'bitcoin', label: 'Bitcoin', icon: null, onClick: onBitcoin, color: '#f7931a' },
    { key: 'docs', label: 'Field Manual', icon: FileText, onClick: onDocs },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  return (
    <SpecialistShell isDark={isDark} onToggleTheme={onToggleTheme} navItems={navItems} accentColor={isDark ? '#00ff41' : '#1D7A3A'}>
      <main className="ir-shell fo-page-shell">
      <section className="ir-hero fo-page-hero">
        <div>
          <div className="ir-pill"><ShieldCheck size={14} /> Intelligence — not financial advice</div>
          <h1>AI Frontier Portfolio Radar</h1>
          <p>Visual command page for the Aschenbrenner hierarchy: compute, power, industrial buildout, data centers, chips, edge AI, quantum optionality, and ETF breadth.</p>
          <div className="ir-hero-actions">
            <button onClick={showInvestableCore}>Show investable core</button>
            <button onClick={showSignalWatchlist}>Show signal watchlist</button>
            <button onClick={showPowerBet}>Aschenbrenner power bet</button>
            <button onClick={onBack}>Back</button>
          </div>
        </div>
        <div className="ir-command-card">
          <div className="ir-command-line"><Cpu size={18} /><span>Compute - Power - Industrials - Datacenters - Chips - Edge AI - Quantum - ETFs</span></div>
          <div className="ir-metrics">
            <div><span>{AI_FRONTIER_THEMES.length}</span><small>frontier themes</small></div>
            <div><span>{universeTickers.length}</span><small>unique tickers</small></div>
            <div><span>{investable.size}</span><small>Track 2 candidates</small></div>
          </div>
        </div>
      </section>

      <TradingViewTape symbols={AI_INFRA_TICKERS.slice(0, 14)} isDark={isDark} />

      <div ref={hierarchyRef} className="ir-jump-target">
        <HierarchyMap activeTheme={activeTheme} onSelectTheme={selectTheme} />
      </div>

      <div ref={allocationRef} className="ir-allocation-module ir-jump-target">
        <AllocationPlanner amount={allocationAmount} onAmountChange={updateAllocationAmount} />
        <section className="ir-grid-2">
          <AllocationCard option={PORTFOLIO_OPTIONS.optionA} amount={allocationAmount} selected />
          <AllocationCard option={PORTFOLIO_OPTIONS.optionB} amount={allocationAmount} />
        </section>
      </div>

      <section ref={workbenchRef} className="ir-workbench ir-jump-target">
        <aside className="ir-sidebar">
          <div className="ir-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ticker, theme, company..." /></div>
          <div className="ir-filters">
            {['all', 'capital', 'signal', ...AI_FRONTIER_THEMES.map((theme) => theme.id)].map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'active' : ''}>{AI_FRONTIER_THEMES.find((theme) => theme.id === item)?.label || item}</button>
            ))}
          </div>
          {activeThemeData && (
            <div className="ir-active-theme">
              <span>{activeThemeData.label}</span>
              <strong>{activeThemeData.tickers.join(' · ')}</strong>
            </div>
          )}
          <div className="ir-card-list">
            {filtered.map((ticker) => <TickerCard key={ticker.symbol} ticker={ticker} active={ticker.symbol === selected.symbol} onSelect={setSelectedSymbol} />)}
          </div>
        </aside>

        <section className="ir-detail ir-card">
          <div className="ir-detail-head">
            <div>
              <div className="ir-kicker">{selected.track === 'capital' ? 'Track 2 - investable core' : selected.track === 'research' ? 'Research only' : 'Track 1 - signal tracking'}</div>
              <h2>{selected.symbol} · {selected.name}</h2>
              <span className="ir-layer-badge">{selected.layer}</span>
            </div>
            {selected.tradingView && <a href={`https://www.tradingview.com/symbols/${selected.tradingView.replace(':', '-')}/`} target="_blank" rel="noreferrer">Open live chart <ArrowUpRight size={14} /></a>}
          </div>
          <div className="ir-sector-line"><strong>Sector:</strong> {selected.sector} <span>Stage: {selected.stage}</span></div>
          <TradingViewMiniChart ticker={selected} />
          <div className="ir-thesis-grid">
            <div><h3><Gauge size={16} /> Role</h3><p>{selected.role}</p></div>
            <div><h3><Zap size={16} /> Thesis</h3><p>{selected.thesis}</p></div>
            <div><h3><BarChart3 size={16} /> Risk</h3><p>{selected.risk}</p></div>
          </div>
        </section>
      </section>
    </main>
    </SpecialistShell>
  );
}
