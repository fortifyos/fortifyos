# FORTIFY OS Pre-Market Intelligence Radar (Macro Sentinel)

This module generates a concise, 2-page max HTML pre-market radar with embedded charts and sends a 6-line Telegram summary + the HTML file.

## What you get
- One HTML file per run: `PreMarket_Radar_PREVIEW_YYYY-MM-DD.html`
- Embedded charts (base64 PNG inside HTML):
  - 30D price line + 5D/20D MAs (per ticker)
  - Call vs Put unusual volume (per ticker)
  - Portfolio risk bars (portfolio-level)
  - News sentiment distribution (portfolio-level)

## Data sources (pluggable)
- Prices: Stooq (no key) by default; optional: Polygon, AlphaVantage, TwelveData, Yahoo via RapidAPI, etc.
- News: Finnhub or NewsAPI (key required)
- Social: X API (bearer) or proxy fallback (news engagement + stocktwits RSS) if X not available
- Options unusual: Tradier / Polygon / Intrinio / Unusual Whales (any one; optional). If unavailable, outputs Proxy.

## Required secrets (GitHub Actions)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
Optional (recommended):
- `FINNHUB_API_KEY` or `NEWSAPI_KEY`
- `X_BEARER_TOKEN`
- `TRADIER_TOKEN` (or another options provider key)

## Run behavior
- Scheduled for weekdays; script *also* checks:
  - US market open (NYSE calendar)
  - Local time == 08:00 America/Los_Angeles
  - If market closed: sends a short Telegram message and exits (no file).
- Persistence: runs indefinitely until you set `STOP_PREMARKET_RADAR=1` in repo secrets.

## Local run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/radar.py --config config/tickers.json --out out/
```
