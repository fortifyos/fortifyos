import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, ChevronDown, Cpu, Eye, FileText, Gauge, Home, LayoutGrid, Search, Settings, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import SpecialistShell from '../components/SpecialistShell.jsx';
import './investment-radar.css';
import {
  AI_FRONTIER_THEMES,
  AI_HIERARCHY_STEPS,
  AI_INFRA_TICKERS,
  PORTFOLIO_OPTIONS,
  TICKER_DIRECTORY,
  getInvestableTickers,
  getUniqueUniverseTickers,
} from '../data/investmentRadarData.js';

const ALLOCATION_PRESETS = [250, 500, 1000, 2500];
const MAX_ALLOCATION = 100000;
const HORIZON_OPTIONS = ['1-3 years', '3-5 years', '5-10 years', '10+ years'];
const RISK_OPTIONS = ['Conservative', 'Balanced', 'Growth', 'Aggressive'];
const OPTION_META = {
  optionA: { code: 'A', fit: 'Preserve optionality; smallest frontier tilt.' },
  optionB: { code: 'B', fit: 'Baseline blend for disciplined AI exposure.' },
  optionC: { code: 'C', fit: 'More AI conviction without abandoning the core.' },
  optionD: { code: 'D', fit: 'Highest frontier concentration and volatility.' },
};

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

function AllocationPlanner({ amount, onAmountChange, horizon, onHorizonChange, risk, onRiskChange, recommendedOption }) {
  const normalizedAmount = Math.max(0, Math.min(MAX_ALLOCATION, Number(amount) || 0));
  return (
    <section className="ir-card ir-allocation-planner">
      <div>
        <div className="ir-kicker">Guided allocation model</div>
        <h2>Build your allocation</h2>
        <p>Declare the amount, time horizon, and risk tolerance. FORTIFY recommends a path while keeping percentages, timing, and no-trade guardrails disciplined.</p>
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
      <div className="ir-profile-controls">
        <label>
          <span>Time horizon</span>
          <select value={horizon} onChange={(event) => onHorizonChange(event.target.value)}>
            {HORIZON_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Risk tolerance</span>
          <select value={risk} onChange={(event) => onRiskChange(event.target.value)}>
            <option value="">Choose path</option>
            {RISK_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <div className="ir-recommendation">
          <span>Recommended path</span>
          <strong>{recommendedOption ? OPTION_META[recommendedOption].code : '—'}</strong>
          <small>{recommendedOption ? PORTFOLIO_OPTIONS[recommendedOption].label.replace(/^Option [A-D] - /, '') : 'Choose risk tolerance'}</small>
        </div>
      </div>
    </section>
  );
}

function AllocationCard({ optionKey, option, selected, amount, onSelect, enabled }) {
  const optionBase = Number(option.total) || 1;
  return (
    <section className={`ir-card ir-allocation ${selected ? 'is-selected is-open' : 'is-collapsed'} ${enabled ? '' : 'is-locked'}`}>
      <button className="ir-allocation-head" onClick={onSelect} disabled={!enabled} aria-expanded={selected}>
        <div>
          <div className="ir-kicker">Track 2 capital allocation</div>
          <h2>{option.label}</h2>
          <p>{OPTION_META[optionKey].fit}</p>
        </div>
        <div className="ir-total">{formatDollars(amount)}</div>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {selected && (
        <div className="ir-allocation-panel">
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
        </div>
      )}
    </section>
  );
}

function FrontierThesis() {
  const rankedNames = [
    ['1', 'CoreWeave', 'Compute frontier'],
    ['2', 'Astera Labs', 'AI chips / interconnects'],
    ['3', 'Vertiv', 'Data-center power + cooling'],
    ['4', 'Serve Robotics', 'Voice / edge / robotics'],
    ['5', 'Nebius Group', 'Alternative compute'],
  ];
  return (
    <section className="ir-card ir-frontier-thesis">
      <div className="ir-frontier-body">
        <div>
          <div className="ir-kicker">Frontier thesis</div>
          <h2>The winners may be the ecosystem itself</h2>
          <p>Instead of chasing only consumer apps, this thesis watches second-order dependencies: compute, power, data centers, robotics, memory bandwidth, and physical AI deployment.</p>
        </div>
        <div className="ir-frontier-lanes">
          <span>Compute</span>
          <span>Power</span>
          <span>Industrial automation</span>
          <span>Edge / data centers</span>
          <span>Chips</span>
          <span>Robotics</span>
          <span>Quantum</span>
        </div>
        <div className="ir-frontier-watchlist">
          {rankedNames.map(([rank, name, lane]) => (
            <div key={name}>
              <strong>{rank}</strong>
              <span>{name}</span>
              <small>{lane}</small>
            </div>
          ))}
        </div>
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

function HierarchyHeader() {
  return (
    <section className="ir-hierarchy ir-card">
      <div className="ir-card-head">
        <div>
          <div className="ir-kicker">Aschenbrenner hierarchy</div>
          <h2>Investment path to AI</h2>
        </div>
        <Cpu />
      </div>
    </section>
  );
}

function ThemeUniverse({ activeTheme, onSelectTheme, onSelectTicker }) {
  const [openThemes, setOpenThemes] = useState(() => new Set());

  const toggleTheme = (themeId) => {
    onSelectTheme(themeId);
    setOpenThemes((current) => {
      const next = new Set(current);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  };

  return (
    <section className="ir-theme-universe">
      {AI_FRONTIER_THEMES.map((theme) => {
        const isOpen = openThemes.has(theme.id);
        const hierarchyStep = AI_HIERARCHY_STEPS.find((step) => step.name === theme.stage);
        return (
          <article key={theme.id} className={`ir-theme-card ${activeTheme === theme.id ? 'active' : ''} ${isOpen ? 'is-open' : 'is-collapsed'}`}>
            <button
              className="ir-theme-head"
              onClick={() => toggleTheme(theme.id)}
              aria-expanded={isOpen}
              aria-controls={`ir-theme-panel-${theme.id}`}
            >
              <em>{hierarchyStep?.layer}</em>
              <span>{theme.label}</span>
              <strong>{theme.sector}</strong>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div id={`ir-theme-panel-${theme.id}`} className="ir-theme-panel" hidden={!isOpen}>
              <div className="ir-theme-stage">{theme.stage}</div>
              <div className="ir-top-picks">
                <span>Top conviction</span>
                <strong>{theme.topPicks.join(', ')}</strong>
              </div>
              <div className="ir-symbol-grid">
                {theme.tickers.map((symbol) => {
                  const ticker = TICKER_DIRECTORY[symbol];
                  return (
                    <button key={symbol} onClick={() => onSelectTicker(symbol)} title={`${ticker?.name || symbol} - ${ticker?.sector || theme.label}`}>
                      <strong>{symbol}</strong>
                      <span>{ticker?.name || 'Unknown'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function InvestmentRadar({ onBack, onHome, onDashboard, onMacroSentinel, onBitcoin, onSettings, onDocs, isDark = true, onToggleTheme }) {
  const [filter, setFilter] = useState('all');
  const [activeTheme, setActiveTheme] = useState('power-energy');
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('VTI');
  const [allocationAmount, setAllocationAmount] = useState(500);
  const [horizon, setHorizon] = useState('5-10 years');
  const [risk, setRisk] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);
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
  const recommendedOption = useMemo(() => {
    if (!risk) return null;
    if (risk === 'Conservative') return 'optionA';
    if (risk === 'Aggressive') return horizon === '1-3 years' ? 'optionC' : 'optionD';
    if (risk === 'Growth') return horizon === '1-3 years' ? 'optionB' : 'optionC';
    return horizon === '10+ years' ? 'optionC' : 'optionB';
  }, [horizon, risk]);

  useEffect(() => {
    setSelectedAllocation(recommendedOption);
  }, [recommendedOption]);
  const updateWorkbenchFilter = (item) => {
    const theme = AI_FRONTIER_THEMES.find((entry) => entry.id === item);
    if (theme) {
      selectTheme(item);
      return;
    }
    setFilter(item);
    setActiveTheme(null);
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
          <div className="ir-command-map">
            <div className="ir-command-head"><Cpu size={18} /><span>Frontier stack</span></div>
            <div className="ir-command-grid">
              <span>Compute</span>
              <span>Power</span>
              <span>Industrials</span>
              <span>Data centers</span>
              <span>Chips</span>
              <span>Edge AI</span>
              <span>Quantum</span>
              <span>ETFs</span>
            </div>
          </div>
          <div className="ir-metrics">
            <div><span>{AI_FRONTIER_THEMES.length}</span><small>frontier themes</small></div>
            <div><span>{universeTickers.length}</span><small>unique tickers</small></div>
            <div><span>{investable.size}</span><small>Track 2 candidates</small></div>
          </div>
        </div>
      </section>

      <TradingViewTape symbols={AI_INFRA_TICKERS.slice(0, 14)} isDark={isDark} />

      <FrontierThesis />

      <div ref={hierarchyRef} className="ir-jump-target">
        <button className="ir-section-toggle ir-hierarchy-toggle" onClick={() => setHierarchyOpen((current) => !current)} aria-expanded={hierarchyOpen}>
          <span>Investment path to AI</span>
          <small>{hierarchyOpen ? 'Collapse' : 'Expand'}</small>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {hierarchyOpen && <HierarchyHeader />}
      </div>
      {hierarchyOpen && <ThemeUniverse activeTheme={activeTheme} onSelectTheme={selectTheme} onSelectTicker={setSelectedSymbol} />}

      <div ref={allocationRef} className="ir-allocation-module ir-jump-target">
        <button className="ir-section-toggle ir-allocation-toggle" onClick={() => setAllocationOpen((current) => !current)} aria-expanded={allocationOpen}>
          <span>Guided allocation model</span>
          <small>{allocationOpen ? 'Collapse' : 'Expand'}</small>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {allocationOpen && (
          <>
            <AllocationPlanner
              amount={allocationAmount}
              onAmountChange={updateAllocationAmount}
              horizon={horizon}
              onHorizonChange={setHorizon}
              risk={risk}
              onRiskChange={setRisk}
              recommendedOption={recommendedOption}
            />
            {recommendedOption && (
              <section className="ir-grid-2">
                <AllocationCard
                  optionKey={recommendedOption}
                  option={PORTFOLIO_OPTIONS[recommendedOption]}
                  amount={allocationAmount}
                  selected={selectedAllocation === recommendedOption}
                  enabled
                  onSelect={() => setSelectedAllocation(recommendedOption)}
                />
              </section>
            )}
          </>
        )}
      </div>

      <section ref={workbenchRef} className="ir-workbench-module ir-jump-target">
        <button className="ir-section-toggle" onClick={() => setWorkbenchOpen((current) => !current)} aria-expanded={workbenchOpen}>
          <span>Ticker workbench</span>
          <small>{workbenchOpen ? 'Collapse' : 'Expand'}</small>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {workbenchOpen && (
          <section className="ir-workbench">
            <aside className="ir-sidebar">
              <div className="ir-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ticker, theme, company..." /></div>
              <div className="ir-filters">
                {['all', 'capital', 'signal', ...AI_FRONTIER_THEMES.map((theme) => theme.id)].map((item) => (
                  <button key={item} onClick={() => updateWorkbenchFilter(item)} className={filter === item ? 'active' : ''}>{AI_FRONTIER_THEMES.find((theme) => theme.id === item)?.label || item}</button>
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
        )}
      </section>
    </main>
    </SpecialistShell>
  );
}
