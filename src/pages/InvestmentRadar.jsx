import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, Building2, Cpu, Gauge, Menu, Search, ShieldCheck, X, Zap } from 'lucide-react';
import './investment-radar.css';
import {
  AI_FRONTIER_THEMES,
  AI_HIERARCHY_STEPS,
  AI_INFRA_TICKERS,
  PORTFOLIO_OPTIONS,
  STARTUP_TRACKS,
  TICKER_DIRECTORY,
  getInvestableTickers,
  getUniqueUniverseTickers,
} from '../data/investmentRadarData.js';

function TradingViewTape({ symbols }) {
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
      colorTheme: 'dark',
      locale: 'en',
    });
    ref.current.appendChild(container);
    ref.current.appendChild(script);
  }, [symbols]);
  return <div ref={ref} className="ir-tv-tape" aria-label="Live ticker tape" />;
}

function TradingViewMiniChart({ ticker }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !ticker) return;
    ref.current.innerHTML = '';
    if (!ticker.tradingView) return;
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: ticker.tradingView,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    });
    ref.current.appendChild(widget);
    ref.current.appendChild(script);
  }, [ticker?.symbol]);
  return (
    <div ref={ref} className="ir-mini-chart" aria-label={`${ticker?.symbol || 'Ticker'} live price chart`}>
      {!ticker?.tradingView && <div className="ir-chart-empty">No public TradingView symbol in this universe.</div>}
    </div>
  );
}

function AllocationCard({ option, selected }) {
  return (
    <section className={`ir-card ir-allocation ${selected ? 'is-selected' : ''}`}>
      <div className="ir-card-head">
        <div>
          <div className="ir-kicker">Track 2 capital allocation</div>
          <h2>{option.label}</h2>
        </div>
        <div className="ir-total">${option.total}</div>
      </div>
      <div className="ir-bars">
        {option.holdings.map((holding) => (
          <div key={holding.symbol} className="ir-bar-row">
            <div className="ir-bar-meta"><strong>{holding.symbol}</strong><span>${holding.dollars} · {holding.pct}%</span></div>
            <div className="ir-bar"><span style={{ width: `${holding.pct}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="ir-schedule">
        {option.weeklySchedule.map((week) => (
          <div key={week.week} className="ir-week">
            <span>W{week.week}</span>
            <strong>${week.total}</strong>
          </div>
        ))}
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
          return (
            <button key={step.layer} className={isActive ? 'active' : ''} onClick={() => theme && onSelectTheme(theme.id)}>
              <span>{step.layer}</span>
              <strong>{step.name}</strong>
              <small>{step.path}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ThemeUniverse({ activeTheme, onSelectTheme, onSelectTicker }) {
  return (
    <section className="ir-theme-universe">
      {AI_FRONTIER_THEMES.map((theme) => (
        <article key={theme.id} className={`ir-theme-card ${activeTheme === theme.id ? 'active' : ''}`}>
          <button className="ir-theme-head" onClick={() => onSelectTheme(theme.id)}>
            <span>{theme.label}</span>
            <strong>{theme.sector}</strong>
          </button>
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
        </article>
      ))}
    </section>
  );
}

export default function InvestmentRadar({ onBack, onHome, onDashboard, onMacroSentinel, onBitcoin, onSettings, onDocs }) {
  const [filter, setFilter] = useState('all');
  const [activeTheme, setActiveTheme] = useState('power-energy');
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('VTI');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
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
  const navItems = [
    { key: 'home', label: 'Home', onClick: onHome },
    { key: 'dashboard', label: 'Dashboard', onClick: onDashboard },
    { key: 'macro', label: 'Macro Radar', onClick: onMacroSentinel },
    { key: 'ai', label: 'AI Portfolio', onClick: null, current: true },
    { key: 'bitcoin', label: 'Bitcoin', onClick: onBitcoin },
    { key: 'docs', label: 'Field Manual', onClick: onDocs },
    { key: 'settings', label: 'Settings', onClick: onSettings },
  ];

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <main className="ir-shell">
      <div className="ir-bg-grid" />
      <header className="ir-nav">
        <div className="ir-mobile-nav" ref={menuRef}>
          <button className="ir-mobile-nav-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Open AI Portfolio navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
          {menuOpen && (
            <div className="ir-mobile-nav-pop">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  className={item.current ? 'active' : ''}
                  onClick={() => {
                    setMenuOpen(false);
                    item.onClick?.();
                  }}
                  disabled={!item.onClick}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ir-desktop-tabs">
          {navItems.map((item) => (
            <button key={item.key} onClick={item.onClick} disabled={!item.onClick} className={item.current ? 'active' : ''}>
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <section className="ir-hero">
        <div>
          <div className="ir-pill"><ShieldCheck size={14} /> Intelligence — not financial advice</div>
          <h1>AI Frontier Portfolio Radar</h1>
          <p>Visual command page for the Aschenbrenner hierarchy: compute, power, industrial buildout, data centers, chips, edge AI, quantum optionality, and ETF breadth.</p>
          <div className="ir-hero-actions">
            <button onClick={() => setFilter('capital')}>Show investable core</button>
            <button onClick={() => setFilter('signal')}>Show signal watchlist</button>
            <button onClick={() => selectTheme('power-energy')}>Aschenbrenner power bet</button>
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

      <TradingViewTape symbols={AI_INFRA_TICKERS.slice(0, 14)} />

      <HierarchyMap activeTheme={activeTheme} onSelectTheme={selectTheme} />
      <ThemeUniverse activeTheme={activeTheme} onSelectTheme={selectTheme} onSelectTicker={setSelectedSymbol} />

      <section className="ir-grid-2">
        <AllocationCard option={PORTFOLIO_OPTIONS.optionA} selected />
        <AllocationCard option={PORTFOLIO_OPTIONS.optionB} />
      </section>

      <section className="ir-workbench">
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

      <section className="ir-startups ir-card">
        <div className="ir-card-head"><div><div className="ir-kicker">Track 3 operator execution</div><h2>Private ideas stay out of the portfolio</h2></div><Building2 /></div>
        <div className="ir-startup-grid">
          {STARTUP_TRACKS.map((idea) => (
            <div key={idea.name} className="ir-startup">
              <strong>{idea.name}</strong>
              <span>{idea.lane}</span>
              <p>{idea.verdict}</p>
              <small>Capital allocation: ${idea.capitalAllocation}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
