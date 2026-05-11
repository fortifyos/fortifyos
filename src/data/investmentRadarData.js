const DEFAULT_RISK = 'Watch valuation, cycle timing, liquidity, and whether the ticker is a direct AI beneficiary or only a second-order proxy.';

export const AI_HIERARCHY_STEPS = [
  {
    layer: '1',
    name: 'Compute Frontier',
    path: 'GPUs, accelerators, silicon, and space-grade compute',
    thesis: 'The Aschenbrenner-style starting point: intelligence scaling needs more compute before anything else matters.',
  },
  {
    layer: '2',
    name: 'Power Constraint',
    path: 'Electricity, nuclear, gas, grid capacity, and energy storage',
    thesis: 'AI factories become power hungry physical infrastructure; energy scarcity can become the bottleneck.',
  },
  {
    layer: '3',
    name: 'Industrial Buildout',
    path: 'Electrical equipment, automation, machinery, and infrastructure picks-and-shovels',
    thesis: 'If AI capex becomes a national industrial project, the builders and suppliers matter.',
  },
  {
    layer: '4',
    name: 'Data Center / Edge',
    path: 'REITs, towers, colocation, BTC-to-AI campuses, and distributed edge capacity',
    thesis: 'Compute and power have to land somewhere: campuses, interconnects, towers, and edge nodes.',
  },
  {
    layer: '5',
    name: 'AI Chips',
    path: 'Crowded semiconductor layer, custom silicon, memory, packaging, and devices',
    thesis: 'Still central, but the obvious names can become crowded; use it as a signal layer and size carefully.',
  },
  {
    layer: '6',
    name: 'Voice / Edge / Robotics',
    path: 'AI applications, agents, automation, edge devices, and network delivery',
    thesis: 'Value migrates from raw models into operational workflows, voice interfaces, robotics, and agentic software.',
  },
  {
    layer: '7',
    name: 'Quantum Optionality',
    path: 'Long-shot frontier computing',
    thesis: 'Tiny optionality bucket only; fascinating technology, high uncertainty, not core allocation.',
  },
  {
    layer: '8',
    name: 'Broad Exposure',
    path: 'Sector ETFs and diversified AI baskets',
    thesis: 'Use ETFs when the thesis is strong but single-name confidence is not.',
  },
];

export const AI_FRONTIER_THEMES = [
  {
    id: 'space-computing',
    label: 'Space Computing',
    sector: 'NVIDIA Vera Rubin / orbital infrastructure',
    stage: 'Compute Frontier',
    topPicks: ['NVDA', 'PL', 'RKLB'],
    tickers: ['NVDA', 'PL', 'RKLB', 'SPCE', 'ASTS', 'MAXR', 'LMT', 'NOC', 'BA', 'IRDM'],
  },
  {
    id: 'power-energy',
    label: 'Power / Energy',
    sector: 'Aschenbrenner Bet',
    stage: 'Power Constraint',
    topPicks: ['BE', 'VST', 'CEG'],
    tickers: ['BE', 'VST', 'CEG', 'NRG', 'NEE', 'SO', 'DUK', 'AEP', 'WMB', 'EQT', 'XLE', 'VDE'],
  },
  {
    id: 'industrials',
    label: 'Industrials',
    sector: 'Great Rotation',
    stage: 'Industrial Buildout',
    topPicks: ['XLI', 'CAT', 'ETN'],
    tickers: ['XLI', 'CAT', 'DE', 'GE', 'HON', 'EMR', 'ROK', 'ETN', 'APH', 'ITW'],
  },
  {
    id: 'data-center-edge',
    label: 'Data Center / Edge',
    sector: 'Data centers, towers, and BTC-to-AI infrastructure',
    stage: 'Data Center / Edge',
    topPicks: ['DLR', 'EQIX', 'CRWV'],
    tickers: ['CRWV', 'DLR', 'EQIX', 'AMT', 'CCI', 'CORZ', 'APLD', 'IREN', 'CIFR', 'RIOT'],
  },
  {
    id: 'ai-chips',
    label: 'AI Chips',
    sector: 'Cautious - crowded',
    stage: 'AI Chips',
    topPicks: ['INTC', 'AMD', 'AVGO'],
    tickers: ['INTC', 'AMD', 'AVGO', 'MRVL', 'MU', 'SMCI', 'QCOM', 'ARM'],
  },
  {
    id: 'voice-edge-robotics',
    label: 'Voice / Edge / Robotics',
    sector: 'Next Frontier',
    stage: 'Voice / Edge / Robotics',
    topPicks: ['SOUN', 'QCOM', 'NET'],
    tickers: ['SOUN', 'AI', 'PLTR', 'SYM', 'PATH', 'AMZN', 'GOOGL', 'AAPL', 'MSFT', 'NET'],
  },
  {
    id: 'quantum',
    label: 'Quantum',
    sector: 'Long-shot frontier optionality',
    stage: 'Quantum Optionality',
    topPicks: ['RGTI', 'IONQ'],
    tickers: ['RGTI', 'IONQ'],
  },
  {
    id: 'broad-etfs',
    label: 'ETFs for Broad Exposure',
    sector: 'Diversified sector baskets',
    stage: 'Broad Exposure',
    topPicks: ['XLI', 'XLE', 'SMH'],
    tickers: ['XLI', 'XLE', 'XLB', 'XLK', 'SMH', 'BOTZ', 'IRBO', 'AIQ', 'CHAT'],
  },
];

export const TICKER_DIRECTORY = {
  AAPL: { name: 'Apple', sector: 'Devices / edge AI', tradingView: 'NASDAQ:AAPL' },
  AEP: { name: 'American Electric Power', sector: 'Regulated electric utility', tradingView: 'NASDAQ:AEP' },
  AI: { name: 'C3.ai', sector: 'Enterprise AI software', tradingView: 'NYSE:AI' },
  AIQ: { name: 'Global X Artificial Intelligence & Technology ETF', sector: 'AI thematic ETF', tradingView: 'NASDAQ:AIQ', assetType: 'ETF' },
  AMD: { name: 'Advanced Micro Devices', sector: 'AI accelerators / CPUs', tradingView: 'NASDAQ:AMD' },
  AMT: { name: 'American Tower', sector: 'Communications towers / edge real estate', tradingView: 'NYSE:AMT' },
  AMZN: { name: 'Amazon', sector: 'Cloud AI / robotics / logistics', tradingView: 'NASDAQ:AMZN' },
  APH: { name: 'Amphenol', sector: 'Connectors / electrical components', tradingView: 'NYSE:APH' },
  APLD: { name: 'Applied Digital', sector: 'AI/HPC datacenter infrastructure', tradingView: 'NASDAQ:APLD' },
  ARM: { name: 'Arm Holdings', sector: 'CPU IP / edge compute', tradingView: 'NASDAQ:ARM' },
  ASTS: { name: 'AST SpaceMobile', sector: 'Space-based mobile broadband', tradingView: 'NASDAQ:ASTS' },
  AVGO: { name: 'Broadcom', sector: 'AI networking / custom silicon', tradingView: 'NASDAQ:AVGO' },
  BA: { name: 'Boeing', sector: 'Aerospace and defense', tradingView: 'NYSE:BA' },
  BE: { name: 'Bloom Energy', sector: 'Fuel cells / distributed power', tradingView: 'NYSE:BE' },
  BOTZ: { name: 'Global X Robotics & Artificial Intelligence ETF', sector: 'Robotics and AI ETF', tradingView: 'NASDAQ:BOTZ', assetType: 'ETF' },
  CAT: { name: 'Caterpillar', sector: 'Heavy machinery / industrial buildout', tradingView: 'NYSE:CAT' },
  CCI: { name: 'Crown Castle', sector: 'Communications towers / fiber', tradingView: 'NYSE:CCI' },
  CEG: { name: 'Constellation Energy', sector: 'Nuclear power / datacenter electricity', tradingView: 'NASDAQ:CEG' },
  CHAT: { name: 'Roundhill Generative AI & Technology ETF', sector: 'Generative AI ETF', tradingView: 'AMEX:CHAT', assetType: 'ETF' },
  CIFR: { name: 'Cipher Mining', sector: 'BTC mining / HPC conversion watch', tradingView: 'NASDAQ:CIFR' },
  CORZ: { name: 'Core Scientific', sector: 'BTC mining / AI hosting', tradingView: 'NASDAQ:CORZ' },
  CRWV: { name: 'CoreWeave', sector: 'AI cloud / GPU infrastructure', tradingView: 'NASDAQ:CRWV' },
  DE: { name: 'Deere & Company', sector: 'Agricultural machinery / autonomy', tradingView: 'NYSE:DE' },
  DLR: { name: 'Digital Realty', sector: 'Hyperscale datacenter REIT', tradingView: 'NYSE:DLR' },
  DUK: { name: 'Duke Energy', sector: 'Regulated electric utility', tradingView: 'NYSE:DUK' },
  EMR: { name: 'Emerson Electric', sector: 'Industrial automation', tradingView: 'NYSE:EMR' },
  EQIX: { name: 'Equinix', sector: 'Colocation / interconnection datacenters', tradingView: 'NASDAQ:EQIX' },
  EQT: { name: 'EQT', sector: 'Natural gas supply', tradingView: 'NYSE:EQT' },
  ETN: { name: 'Eaton', sector: 'Electrification / power management', tradingView: 'NYSE:ETN' },
  GE: { name: 'GE Aerospace', sector: 'Aerospace industrials', tradingView: 'NYSE:GE' },
  GOOGL: { name: 'Alphabet', sector: 'Cloud AI / search / TPU stack', tradingView: 'NASDAQ:GOOGL' },
  HON: { name: 'Honeywell', sector: 'Industrial automation / aerospace', tradingView: 'NASDAQ:HON' },
  INTC: { name: 'Intel', sector: 'Contrarian semiconductor / foundry', tradingView: 'NASDAQ:INTC' },
  IONQ: { name: 'IonQ', sector: 'Quantum computing', tradingView: 'NYSE:IONQ' },
  IRBO: { name: 'iShares Robotics and Artificial Intelligence Multisector ETF', sector: 'Robotics and AI ETF', tradingView: 'AMEX:IRBO', assetType: 'ETF' },
  IRDM: { name: 'Iridium Communications', sector: 'Satellite communications', tradingView: 'NASDAQ:IRDM' },
  IREN: { name: 'IREN', sector: 'BTC mining / AI datacenter watch', tradingView: 'NASDAQ:IREN' },
  ITW: { name: 'Illinois Tool Works', sector: 'Diversified industrials', tradingView: 'NYSE:ITW' },
  LMT: { name: 'Lockheed Martin', sector: 'Defense / aerospace systems', tradingView: 'NYSE:LMT' },
  MAXR: { name: 'Maxar Technologies', sector: 'Space infrastructure / private or former public ticker', tradingView: '', public: false },
  MRVL: { name: 'Marvell Technology', sector: 'Datacenter silicon / connectivity', tradingView: 'NASDAQ:MRVL' },
  MSFT: { name: 'Microsoft', sector: 'Cloud AI / enterprise software', tradingView: 'NASDAQ:MSFT' },
  MU: { name: 'Micron Technology', sector: 'Memory / HBM', tradingView: 'NASDAQ:MU' },
  NEE: { name: 'NextEra Energy', sector: 'Utility / renewable power', tradingView: 'NYSE:NEE' },
  NET: { name: 'Cloudflare', sector: 'Edge network / AI delivery', tradingView: 'NYSE:NET' },
  NOC: { name: 'Northrop Grumman', sector: 'Defense / aerospace systems', tradingView: 'NYSE:NOC' },
  NRG: { name: 'NRG Energy', sector: 'Power generation / retail electricity', tradingView: 'NYSE:NRG' },
  NVDA: { name: 'Nvidia', sector: 'AI accelerators / Vera Rubin compute', tradingView: 'NASDAQ:NVDA' },
  PATH: { name: 'UiPath', sector: 'Automation software', tradingView: 'NYSE:PATH' },
  PL: { name: 'Planet Labs', sector: 'Earth observation / space data', tradingView: 'NYSE:PL' },
  PLTR: { name: 'Palantir Technologies', sector: 'Operational AI / decision systems', tradingView: 'NASDAQ:PLTR' },
  QCOM: { name: 'Qualcomm', sector: 'Edge AI / mobile inference', tradingView: 'NASDAQ:QCOM' },
  RGTI: { name: 'Rigetti Computing', sector: 'Quantum computing', tradingView: 'NASDAQ:RGTI' },
  RIOT: { name: 'Riot Platforms', sector: 'BTC mining / power campus watch', tradingView: 'NASDAQ:RIOT' },
  RKLB: { name: 'Rocket Lab', sector: 'Space launch / systems', tradingView: 'NASDAQ:RKLB' },
  ROK: { name: 'Rockwell Automation', sector: 'Factory automation', tradingView: 'NYSE:ROK' },
  SMCI: { name: 'Super Micro Computer', sector: 'AI servers / rack integration', tradingView: 'NASDAQ:SMCI' },
  SMH: { name: 'VanEck Semiconductor ETF', sector: 'Semiconductor ETF', tradingView: 'NASDAQ:SMH', assetType: 'ETF' },
  SO: { name: 'Southern Company', sector: 'Regulated electric utility', tradingView: 'NYSE:SO' },
  SOUN: { name: 'SoundHound AI', sector: 'Voice AI', tradingView: 'NASDAQ:SOUN' },
  SPCE: { name: 'Virgin Galactic', sector: 'Speculative space infrastructure', tradingView: 'NYSE:SPCE' },
  SYM: { name: 'Symbotic', sector: 'Warehouse robotics / automation', tradingView: 'NASDAQ:SYM' },
  VDE: { name: 'Vanguard Energy ETF', sector: 'Energy sector ETF', tradingView: 'AMEX:VDE', assetType: 'ETF' },
  VST: { name: 'Vistra', sector: 'Power generation / nuclear and gas', tradingView: 'NYSE:VST' },
  VTI: { name: 'Vanguard Total Stock Market ETF', sector: 'Broad U.S. equity base', tradingView: 'AMEX:VTI', assetType: 'ETF' },
  WMB: { name: 'Williams Companies', sector: 'Natural gas pipelines', tradingView: 'NYSE:WMB' },
  XLB: { name: 'Materials Select Sector SPDR ETF', sector: 'Materials ETF', tradingView: 'AMEX:XLB', assetType: 'ETF' },
  XLE: { name: 'Energy Select Sector SPDR ETF', sector: 'Energy ETF', tradingView: 'AMEX:XLE', assetType: 'ETF' },
  XLI: { name: 'Industrial Select Sector SPDR ETF', sector: 'Industrials ETF', tradingView: 'AMEX:XLI', assetType: 'ETF' },
  XLK: { name: 'Technology Select Sector SPDR ETF', sector: 'Technology ETF', tradingView: 'AMEX:XLK', assetType: 'ETF' },
};

const CORE_TICKER_DETAILS = {
  VTI: {
    track: 'capital',
    role: 'Civilization baseline: broad U.S. equity exposure that keeps the portfolio from becoming pure AI hype.',
    thesis: 'Use as the anchor holding when capital is small and simplicity matters.',
    risk: 'Market beta; less direct AI upside than concentrated names.',
  },
  SMH: {
    track: 'capital',
    role: 'Basket exposure to AI chips and semiconductor supply chain.',
    thesis: 'Captures the compute layer without forcing a single-name NVDA/AMD/AVGO decision.',
    risk: 'Semiconductor cyclicality and valuation compression.',
  },
  XLE: {
    track: 'capital',
    role: 'Broad energy proxy for AI power demand and energy inflation.',
    thesis: 'Diversified energy exposure for the AI datacenter power bottleneck.',
    risk: 'Oil/gas cycle exposure; less pure nuclear/datacenter linkage than CEG or VST.',
  },
  CEG: {
    track: 'capital',
    role: 'Direct public-market exposure to nuclear power and datacenter electricity demand.',
    thesis: 'AI datacenters need firm clean power; nuclear scarcity can become strategic.',
    risk: 'Regulatory, power price, nuclear-policy, and valuation risk.',
  },
  PLTR: {
    track: 'capital',
    role: 'Operational AI/orchestration exposure aligned with ALFRED thesis.',
    thesis: 'AI value shifts from models to operational decision loops and enterprise workflows.',
    risk: 'High expectations, volatility, and execution/valuation risk.',
  },
  NVDA: {
    role: 'AI accelerator anchor and Vera Rubin compute signal.',
    thesis: 'Dominant GPU/software ecosystem powering frontier AI training and inference.',
    risk: 'Valuation and capex-cycle concentration.',
  },
  BE: {
    role: 'Distributed power watch for AI campuses.',
    thesis: 'Fuel cells and on-site power can matter when grid interconnects become the bottleneck.',
    risk: 'Execution, profitability, customer concentration, and financing risk.',
  },
  VST: {
    role: 'Power generation beneficiary.',
    thesis: 'Datacenter load growth raises value of firm power assets.',
    risk: 'Commodity, regulatory, and power-market risk.',
  },
  ETN: {
    role: 'Electrical infrastructure and power management.',
    thesis: 'AI buildout requires switchgear, transformers, and grid equipment.',
    risk: 'Industrial cycle and valuation.',
  },
  DLR: {
    role: 'Hyperscale datacenter REIT.',
    thesis: 'Physical AI infrastructure demand supports large-scale datacenter capacity.',
    risk: 'Rates, leverage, and energy constraints.',
  },
  EQIX: {
    role: 'Colocation and interconnection infrastructure.',
    thesis: 'AI/network traffic increases demand for strategic datacenter campuses.',
    risk: 'REIT rates, capex, and power availability.',
  },
  CRWV: {
    role: 'AI cloud and GPU infrastructure watch.',
    thesis: 'Specialized AI cloud capacity is a direct way to monitor demand for rented frontier compute.',
    risk: 'Customer concentration, capex intensity, financing, and competition from hyperscalers.',
  },
  QCOM: {
    role: 'Device-side inference and mobile AI.',
    thesis: 'AI moves from cloud to phones, PCs, cars, and edge devices.',
    risk: 'Mobile cycle and competition.',
  },
  NET: {
    role: 'Edge network and AI delivery layer.',
    thesis: 'If AI products become low-latency services, edge networking and security infrastructure matter.',
    risk: 'Valuation, competition, and monetization of AI workloads.',
  },
  SOUN: {
    role: 'Speculative voice AI watchlist.',
    thesis: 'Voice interfaces grow as AI leaves the cloud and enters workflows.',
    risk: 'Speculative, dilution, competition; not core for $500.',
  },
  IONQ: {
    role: 'Quantum computing watchlist.',
    thesis: 'Long-range frontier optionality.',
    risk: 'Very speculative; not core for $500.',
  },
  RKLB: {
    role: 'Space infrastructure watchlist.',
    thesis: 'Space systems may become frontier infrastructure layer.',
    risk: 'High volatility and execution risk; not core for $500.',
  },
};

const themeLookup = AI_FRONTIER_THEMES.reduce((acc, theme) => {
  theme.tickers.forEach((symbol) => {
    acc[symbol] = acc[symbol] || [];
    acc[symbol].push(theme.id);
  });
  return acc;
}, {});

export const AI_INFRA_TICKERS = Object.keys(TICKER_DIRECTORY).map((symbol) => {
  const base = TICKER_DIRECTORY[symbol];
  const themeIds = themeLookup[symbol] || [];
  const primaryTheme = AI_FRONTIER_THEMES.find((theme) => theme.id === themeIds[0]);
  const details = CORE_TICKER_DETAILS[symbol] || {};
  const publicTicker = base.public !== false;
  return {
    symbol,
    name: base.name,
    sector: base.sector,
    layer: primaryTheme?.label || base.sector,
    stage: primaryTheme?.stage || 'Watchlist',
    themeIds,
    assetType: base.assetType || 'Equity',
    public: publicTicker,
    track: publicTicker ? (details.track || 'signal') : 'research',
    role: details.role || `${base.name} maps to the ${primaryTheme?.label || base.sector} layer of the AI frontier universe.`,
    thesis: details.thesis || `${base.sector} is a watch node in the investment path from compute demand to power, industrial buildout, data centers, edge AI, and broad exposure.`,
    risk: details.risk || DEFAULT_RISK,
    tradingView: base.tradingView,
  };
});

export const PORTFOLIO_OPTIONS = {
  optionA: {
    label: 'Option A - disciplined default',
    status: 'open',
    total: 500,
    holdings: [
      { symbol: 'VTI', dollars: 300, pct: 60 },
      { symbol: 'SMH', dollars: 125, pct: 25 },
      { symbol: 'XLE', dollars: 75, pct: 15 },
    ],
    weeklySchedule: [
      { week: 1, VTI: 120, SMH: 50, XLE: 30, total: 200 },
      { week: 2, VTI: 60, SMH: 25, XLE: 15, total: 100 },
      { week: 3, VTI: 60, SMH: 25, XLE: 15, total: 100 },
      { week: 4, VTI: 60, SMH: 25, XLE: 15, total: 100 },
    ],
  },
  optionB: {
    label: 'Option B - AI conviction tilt',
    status: 'open',
    total: 500,
    holdings: [
      { symbol: 'VTI', dollars: 250, pct: 50 },
      { symbol: 'SMH', dollars: 125, pct: 25 },
      { symbol: 'CEG', dollars: 75, pct: 15 },
      { symbol: 'PLTR', dollars: 50, pct: 10 },
    ],
    weeklySchedule: [
      { week: 1, VTI: 100, SMH: 50, CEG: 30, PLTR: 20, total: 200 },
      { week: 2, VTI: 50, SMH: 25, CEG: 15, PLTR: 10, total: 100 },
      { week: 3, VTI: 50, SMH: 25, CEG: 15, PLTR: 10, total: 100 },
      { week: 4, VTI: 50, SMH: 25, CEG: 15, PLTR: 10, total: 100 },
    ],
  },
};

export const STARTUP_TRACKS = [
  { name: 'WattPilot', lane: 'Operator research', capitalAllocation: 0, verdict: 'Strongest strategic thesis; architecture/research only until investable path exists.' },
  { name: 'Bolo', lane: 'MVP candidate', capitalAllocation: 0, verdict: 'Most executable with limited capital; time/deliverables, not portfolio dollars.' },
  { name: 'HashFlex', lane: 'Monitor only', capitalAllocation: 0, verdict: 'Interesting but dangerous/cyclical; no capital allocation.' },
];

export function getInvestableTickers() {
  const symbols = new Set();
  Object.values(PORTFOLIO_OPTIONS).forEach((option) => option.holdings.forEach((h) => symbols.add(h.symbol)));
  return Array.from(symbols);
}

export function getUniverseTickers() {
  return AI_FRONTIER_THEMES.flatMap((theme) => theme.tickers);
}

export function getUniqueUniverseTickers() {
  return Array.from(new Set(getUniverseTickers()));
}

export function getThemeTickers(themeId) {
  const theme = AI_FRONTIER_THEMES.find((item) => item.id === themeId);
  return theme ? theme.tickers.map((symbol) => ({ symbol, ...TICKER_DIRECTORY[symbol] })) : [];
}

export function getTickerThemes(symbol) {
  return (themeLookup[symbol] || []).map((themeId) => AI_FRONTIER_THEMES.find((theme) => theme.id === themeId)).filter(Boolean);
}

export function validatePortfolioFramework() {
  const errors = [];
  Object.entries(PORTFOLIO_OPTIONS).forEach(([key, option]) => {
    const dollars = option.holdings.reduce((sum, h) => sum + h.dollars, 0);
    const pct = option.holdings.reduce((sum, h) => sum + h.pct, 0);
    if (dollars !== option.total) errors.push(`${key} dollars total ${dollars} != ${option.total}`);
    if (pct !== 100) errors.push(`${key} pct total ${pct} != 100`);
  });
  AI_FRONTIER_THEMES.forEach((theme) => {
    if (!theme.label || !theme.sector || !theme.stage) errors.push(`${theme.id} missing hierarchy labels`);
    theme.tickers.forEach((symbol) => {
      if (!TICKER_DIRECTORY[symbol]) errors.push(`${symbol} missing ticker directory entry`);
      if (!TICKER_DIRECTORY[symbol]?.name || !TICKER_DIRECTORY[symbol]?.sector) errors.push(`${symbol} missing name or sector`);
    });
  });
  STARTUP_TRACKS.forEach((idea) => {
    if (idea.capitalAllocation !== 0) errors.push(`${idea.name} has forbidden private capital allocation`);
  });
  return { valid: errors.length === 0, errors };
}
