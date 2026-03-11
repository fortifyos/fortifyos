# FortifyOS Upgrade: Macro Sentinel (Pre-Market Intelligence Radar)

## Placement in FortifyOS
Add under: `knox/agents/macro_sentinel/`

### Responsibilities
1. Generate daily pre-market radar HTML (2 pages max, embedded charts)
2. Send Telegram summary (<= 6 lines) + attach HTML
3. Skip if market closed (weekends + NYSE holidays)
4. Persist daily archive to `/out/` in repo (or to storage provider later)

## Deterministic Inputs
- Ticker universe (static): `config/tickers.json`
- Risk model weights: `config/tickers.json -> risk_model`
- Provider keys via secrets/env

## Deterministic Outputs
- `out/PreMarket_Radar_PREVIEW_YYYY-MM-DD.html`
- Telegram message:
  - Overall stance
  - Most bullish stock
  - Highest risk stock
  - 1 key macro driver
  - Action bias
  - File attached

## Data Providers (pluggable)
- Prices:
  - Default: Stooq (no key)
  - Optional: Polygon / TwelveData / AlphaVantage
- News:
  - Finnhub or NewsAPI
- Social:
  - X API v2 (bearer) or Proxy
- Options unusual activity:
  - Tradier / Polygon / Intrinio / Unusual Whales
  - If missing => Proxy (labeled in report)

## Why this improves progress
- Moves “manual prompting” into an *agent module* that runs without you
- Builds signal memory (archive) to detect shifts vs reacting to noise
- Makes risk systematic (0–100 score) so KNOX posture can gate actions

## Next upgrades (after scaffold)
1. Add “BTC Cycle Gate” overlay into header (500-day window state)
2. Add macro overlay: DXY, 10Y, VIX regime, Fed calendar
3. Add “Never List” tie-in: auto-flag tickers on Never List
4. Add storage abstraction: iCloud/Drive/local (Flutter target)
