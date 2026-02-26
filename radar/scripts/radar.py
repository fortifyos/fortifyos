#!/usr/bin/env python3
""" 
FortifyOS Pre-Market Intelligence Radar generator.
Outputs:
  - PreMarket_Radar_PREVIEW_YYYY-MM-DD.html (self-contained, charts embedded)
  - latest.json (signals + series data for React-native Macro Sentinel dashboard)
Delivery:
  - Discord webhook message (max 6 lines) + attaches HTML

Design goals:
- <= 2 pages when printed
- scannable blocks, no long prose
- best-effort proxies if any data missing (labeled Proxy)
"""

from __future__ import annotations
import argparse
import base64
import datetime as dt
import io
import json
\1
import hashlib
from datetime import datetime, timedelta
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def next_run_at_8am(tz_name="America/New_York"):
    # returns ISO8601 with offset if possible
    now_utc = datetime.utcnow()
    if ZoneInfo:
        tz = ZoneInfo(tz_name)
        now = datetime.now(tz)
        target = now.replace(hour=8, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target + timedelta(days=1)
        # If weekend, roll forward to Monday
        while target.weekday() >= 5:
            target += timedelta(days=1)
        return target.isoformat()
    # fallback: UTC 13:00 approximate for ET (proxy)
    return (now_utc.replace(hour=13, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat() + "Z"

def volatility_percentile(vol_series):
    # percentile rank of last point within series
    if not vol_series:
        return None
    last = vol_series[-1]
    sorted_vals = sorted(vol_series)
    rank = sorted_vals.index(last)
    return int(round(100 * rank / max(len(sorted_vals)-1, 1)))

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import requests
import pandas_market_calendars as mcal

from zoneinfo import ZoneInfo

# -----------------------------
# Utilities
# -----------------------------

NY_TZ = ZoneInfo("America/New_York")

# User/operator timezone for the run gate.
# Default: America/New_York (user is East Coast).
RADAR_TZ = ZoneInfo(os.getenv("RADAR_TZ", "America/New_York"))

def b64_png(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

def is_market_open_today(date: dt.date) -> bool:
    nyse = mcal.get_calendar("NYSE")
    sched = nyse.schedule(start_date=date - dt.timedelta(days=3), end_date=date + dt.timedelta(days=3))
    return pd.Timestamp(date) in sched.index.normalize()

def should_run_now() -> Tuple[bool, str]:
    # Gate to 08:00 local RADAR_TZ; run cron at 13/14 UTC to be DST-safe (US Eastern).
    now_local = dt.datetime.now(tz=RADAR_TZ)
    if now_local.hour != 8:
        return False, f"Gate: local time {now_local:%H:%M} != 08:00"
    if now_local.weekday() >= 5:
        return False, "Market closed: weekend"
    if not is_market_open_today(now_local.date()):
        return False, f"Market closed: holiday ({now_local.date().isoformat()})"
    if os.getenv("STOP_PREMARKET_RADAR", "").strip() in ("1","true","TRUE","yes","YES"):
        return False, "STOP_PREMARKET_RADAR set"
    return True, "OK"

def next_run_at(now: dt.datetime) -> dt.datetime:
    """Next scheduled run time at 08:00 RADAR_TZ on the next NYSE trading day."""
    nyse = mcal.get_calendar("NYSE")
    # Search ahead up to 10 days for next open session
    start = now.date()
    end = start + dt.timedelta(days=14)
    sched = nyse.schedule(start_date=start, end_date=end)
    # Normalize sessions to date in NY time
    sessions = [d.date() for d in sched.index.tz_localize(None)]
    # If today is a session and time < 08:00, next run is today 08:00
    today = now.astimezone(RADAR_TZ).date()
    eight_today = dt.datetime.combine(today, dt.time(8,0), tzinfo=RADAR_TZ)
    if today in sessions and now.astimezone(RADAR_TZ) < eight_today:
        return eight_today
    # Otherwise next session's 08:00
    for d in sessions:
        if d > today:
            return dt.datetime.combine(d, dt.time(8,0), tzinfo=RADAR_TZ)
    # Fallback: tomorrow 08:00
    d = today + dt.timedelta(days=1)
    return dt.datetime.combine(d, dt.time(8,0), tzinfo=RADAR_TZ)

# -----------------------------
# Data Providers (best-effort)
# -----------------------------

def fetch_stooq_daily(symbol: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    Free proxy daily prices from Stooq (no API key).
    For US tickers, stooq uses lowercase and may require suffixes; we best-effort.
    """
    # Basic mapping: BTC-USD -> btcusd
    sym = symbol.replace("-", "").replace("^", "").lower()
    # Stooq for US equities often: aapl.us; ETFs: spy.us
    if symbol.endswith("-USD"):
        sym = symbol.replace("-USD", "usd").lower()
    if "." not in sym:
        # guess US
        sym = f"{sym}.us"
    url = f"https://stooq.com/q/d/l/?s={sym}&i=d"
    try:
        r = requests.get(url, timeout=20)
        if r.status_code != 200 or "Date,Open" not in r.text:
            return None
        df = pd.read_csv(io.StringIO(r.text))
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").tail(days).reset_index(drop=True)
        df.rename(columns={"Close": "close"}, inplace=True)
        return df[["Date","close"]]
    except Exception:
        return None

def fetch_prices(symbol: str) -> Tuple[pd.DataFrame, str]:
    """
    Returns (df, source_label).
    df columns: Date, close
    """
    df = fetch_stooq_daily(symbol)
    if df is not None and len(df) >= 25:
        return df, "Stooq"
    # Proxy fallback: synthetic random walk (clearly labeled Proxy)
    rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=60, freq="B")
    base = 100 + rng.normal(0, 1)
    steps = rng.normal(0, 1, size=len(dates))
    close = np.maximum(1, base + np.cumsum(steps))
    dfp = pd.DataFrame({"Date": dates, "close": close})
    return dfp, "Proxy"

def fetch_news(symbol: str, n: int = 5) -> Tuple[List[Dict], str]:
    """
    Returns list of {title, url, publishedAt, sentiment_label} and source label.
    Sentiment is heuristic keyword-based if provider doesn't return it.
    """
    finnhub = os.getenv("FINNHUB_API_KEY", "").strip()
    newsapi = os.getenv("NEWSAPI_KEY", "").strip()

    items: List[Dict] = []
    if finnhub:
        try:
            # Finnhub company-news needs from/to + symbol
            today = dt.date.today()
            frm = (today - dt.timedelta(days=1)).isoformat()
            to = today.isoformat()
            url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={frm}&to={to}&token={finnhub}"
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                data = r.json()[:n]
                for it in data:
                    items.append({
                        "title": it.get("headline","").strip(),
                        "url": it.get("url",""),
                        "publishedAt": dt.datetime.fromtimestamp(it.get("datetime",0)).isoformat(),
                    })
                return classify_news(items), "Finnhub"
        except Exception:
            pass

    if newsapi:
        try:
            q = symbol
            url = f"https://newsapi.org/v2/everything?q={q}&pageSize={n}&sortBy=publishedAt&apiKey={newsapi}"
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                data = r.json().get("articles", [])[:n]
                for it in data:
                    items.append({
                        "title": (it.get("title") or "").strip(),
                        "url": it.get("url",""),
                        "publishedAt": (it.get("publishedAt") or "").strip(),
                    })
                return classify_news(items), "NewsAPI"
        except Exception:
            pass

    # Proxy: none available
    return [], "Proxy"

BULL_KW = ("beats", "surge", "record", "upgrade", "strong", "profit", "win", "partnership", "contract", "growth")
BEAR_KW = ("miss", "downgrade", "fall", "probe", "lawsuit", "weak", "layoff", "cut", "warning", "decline", "drop")

def classify_news(items: List[Dict]) -> List[Dict]:
    for it in items:
        t = (it.get("title") or "").lower()
        bull = any(k in t for k in BULL_KW)
        bear = any(k in t for k in BEAR_KW)
        if bull and not bear:
            it["sentiment_label"] = "Bullish"
        elif bear and not bull:
            it["sentiment_label"] = "Bearish"
        else:
            it["sentiment_label"] = "Neutral"
    return items

def fetch_social_sentiment(symbol: str) -> Tuple[str, str]:
    """
    Returns (summary_label, source_label).
    If X is unavailable, use Proxy.
    """
    if os.getenv("X_BEARER_TOKEN","").strip():
        # Placeholder: implement X API v2 search endpoints here.
        return "Mixed", "X (stub)"
    return "Mixed", "Proxy"

def fetch_options_unusual(symbol: str) -> Tuple[Dict, str]:
    """
    Returns dict: {call_vol, put_vol, call_put_skew, abnormal_flag}
    If provider missing: Proxy.
    """
    if os.getenv("TRADIER_TOKEN","").strip():
        # Placeholder: implement Tradier options stats here.
        return {"call_vol": 0, "put_vol": 0, "call_put_skew": 1.0, "abnormal_flag": False}, "Tradier (stub)"
    # Proxy: derive from recent volatility
    df, _ = fetch_prices(symbol)
    rets = df["close"].pct_change().dropna()
    vol = float(rets.tail(20).std() * np.sqrt(252))
    call = int(1000 * clamp(1.5 - vol, 0.2, 2.0))
    put = int(1000 * clamp(vol, 0.2, 2.0))
    skew = call / max(put, 1)
    return {"call_vol": call, "put_vol": put, "call_put_skew": skew, "abnormal_flag": vol > 0.6}, "Proxy"

# -----------------------------
# Analytics + Charts
# -----------------------------

@dataclass
class TickerReport:
    symbol: str
    name: str
    price_source: str
    news_source: str
    social_source: str
    options_source: str
    price_df: pd.DataFrame
    ma5: float
    ma20: float
    trend: str
    news: List[Dict]
    news_class: str
    social_label: str
    options: Dict
    risk_level: str
    suggested_action: str

def compute_ma(df: pd.DataFrame, window: int) -> float:
    return float(df["close"].rolling(window).mean().iloc[-1])

def classify_trend(df: pd.DataFrame) -> str:
    # Simple: last close vs 20D MA and 5D slope
    ma20 = df["close"].rolling(20).mean()
    if len(ma20.dropna()) == 0:
        return "Sideways"
    last = df["close"].iloc[-1]
    ma20_last = float(ma20.iloc[-1])
    slope5 = float(df["close"].diff().tail(5).mean())
    if last > ma20_last and slope5 > 0:
        return "Up"
    if last < ma20_last and slope5 < 0:
        return "Down"
    return "Choppy"

def classify_news_bucket(news: List[Dict]) -> str:
    if not news:
        return "Neutral"
    labels = [it.get("sentiment_label","Neutral") for it in news]
    bull = labels.count("Bullish")
    bear = labels.count("Bearish")
    if bull > bear + 1:
        return "Bullish"
    if bear > bull + 1:
        return "Bearish"
    return "Neutral"

def risk_score(df: pd.DataFrame, options: Dict, news_bucket: str, ma5: float, ma20: float,
              weights: Dict[str,float]) -> float:
    rets = df["close"].pct_change().dropna()
    vol = float(rets.tail(20).std() * np.sqrt(252))
    vol_norm = clamp(vol / 0.8, 0, 1)  # 0.8 annualized as "high" reference

    skew = float(options.get("call_put_skew", 1.0))
    skew_extreme = clamp(abs(np.log(max(skew, 1e-6))) / 1.0, 0, 1)  # 1.0 log ratio ~ extreme
    news_norm = {"Bullish":0.3, "Neutral":0.5, "Bearish":0.8}.get(news_bucket, 0.5)

    ma_div = clamp(abs(ma5 - ma20) / max(ma20, 1e-6), 0, 1)

    score = (
        weights.get("vol_weight",0.3) * vol_norm +
        weights.get("options_weight",0.3) * skew_extreme +
        weights.get("news_weight",0.2) * news_norm +
        weights.get("ma_weight",0.2) * ma_div
    ) * 100.0
    return float(clamp(score, 0, 100))

def risk_level_from_score(score: float) -> str:
    if score <= 33:
        return "Low"
    if score <= 66:
        return "Medium"
    return "High"

def suggested_action(trend: str, news_class: str, risk_level: str) -> str:
    if risk_level == "High" and trend == "Down":
        return "Consider Trimming"
    if news_class == "Bullish" and risk_level != "High" and trend in ("Up","Choppy"):
        return "Opportunistic Buy"
    if risk_level == "High":
        return "Watch"
    return "Hold"

def chart_price(df: pd.DataFrame, symbol: str) -> str:
    d = df.tail(30).copy()
    d["ma5"] = d["close"].rolling(5).mean()
    d["ma20"] = d["close"].rolling(20).mean()
    fig = plt.figure(figsize=(5.2, 2.0))
    ax = fig.add_subplot(111)
    ax.plot(d["Date"], d["close"], linewidth=1.6)
    ax.plot(d["Date"], d["ma5"], linewidth=1.1)
    ax.plot(d["Date"], d["ma20"], linewidth=1.1)
    ax.set_title(f"{symbol} — 30D Price + 5D/20D MA", fontsize=9)
    ax.tick_params(axis='x', labelrotation=35, labelsize=7)
    ax.tick_params(axis='y', labelsize=7)
    ax.grid(True, alpha=0.25)
    return b64_png(fig)

def chart_options_bar(options: Dict, symbol: str) -> str:
    callv = options.get("call_vol", 0)
    putv = options.get("put_vol", 0)
    fig = plt.figure(figsize=(5.2, 1.6))
    ax = fig.add_subplot(111)
    ax.bar(["Calls","Puts"], [callv, putv])
    ax.set_title(f"{symbol} — Unusual Volume (Call vs Put)", fontsize=9)
    ax.tick_params(axis='y', labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)

def chart_news_distribution(all_news: List[Dict]) -> str:
    labels = [n.get("sentiment_label","Neutral") for n in all_news] or ["Neutral"]
    cats = ["Bullish","Neutral","Bearish"]
    vals = [labels.count(c) for c in cats]
    fig = plt.figure(figsize=(5.2, 1.7))
    ax = fig.add_subplot(111)
    ax.bar(cats, vals)
    ax.set_title("Portfolio — News Sentiment Distribution (24h)", fontsize=9)
    ax.tick_params(axis='y', labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)

def chart_portfolio_risk(reports: List[TickerReport], weights: Dict[str,float]) -> str:
    syms = [r.symbol for r in reports]
    scores = [float(risk_score(r.price_df, r.options, r.news_class, r.ma5, r.ma20, weights)) for r in reports]
    fig = plt.figure(figsize=(5.2, 1.8))
    ax = fig.add_subplot(111)
    ax.bar(syms, scores)
    ax.set_ylim(0, 100)
    ax.set_title("Portfolio — Risk Scores (0–100)", fontsize=9)
    ax.tick_params(axis='x', labelrotation=0, labelsize=7)
    ax.tick_params(axis='y', labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)

# -----------------------------
# Discord
# -----------------------------

def discord_send(webhook_url: str, content: str, file_path: Optional[str] = None) -> None:
    """Send a Discord webhook message; optionally attach a file."""
    if not webhook_url:
        return
    try:
        if file_path:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, "text/html")}
                data = {"content": content}
                requests.post(webhook_url, data=data, files=files, timeout=60)
        else:
            requests.post(webhook_url, json={"content": content}, timeout=20)
    except Exception:
        # Delivery failure should not block artifact generation.
        pass


def build_latest_json(date: dt.date, reports: List[TickerReport], all_news: List[Dict], cfg: Dict) -> Dict:
    """Builds the React dashboard payload (signals + series)."""
    # Portfolio stance: conservative if >1 High risk
    highs = [r for r in reports if r.risk_level == "High"]
    stance = "Defensive" if len(highs) >= 2 else ("Neutral" if len(highs) == 1 else "Constructive")

    bullish = [r for r in reports if r.news_class == "Bullish" and r.risk_level != "High"]
    most_bull = bullish[0].symbol if bullish else (reports[0].symbol if reports else "")

    # Highest risk: by risk score (not label)
    weights = cfg.get("risk_model", {})
    scored = [(r.symbol, float(risk_score(r.price_df, r.options, r.news_class, r.ma5, r.ma20, weights))) for r in reports]
    highest_risk = sorted(scored, key=lambda x: x[1], reverse=True)[0][0] if scored else ""

    # Macro driver proxy
    macro_driver = "Rates / USD regime" if not all_news else "Headline tape (24h)"
    macro_source = "Proxy" if not all_news else "News"

    # Portfolio news distribution
    labels = [it.get("sentiment_label", "Neutral") for it in all_news]
    news_dist = {
        "Bullish": labels.count("Bullish"),
        "Neutral": labels.count("Neutral"),
        "Bearish": labels.count("Bearish"),
    }

    tickers_out = []
    price_series = {}
    options_out = []
    risk_out = []

    for r in reports:
        # Price series (30 trading days)
        df = r.price_df.copy()
        df = df.tail(35).reset_index(drop=True)
        df["ma5"] = df["close"].rolling(5).mean()
        df["ma20"] = df["close"].rolling(20).mean()
        ser = []
        for _, row in df.tail(30).iterrows():
            ser.append({
                "date": pd.to_datetime(row["Date"]).date().isoformat(),
                "close": float(row["close"]),
                "ma5": float(row["ma5"]) if pd.notna(row["ma5"]) else None,
                "ma20": float(row["ma20"]) if pd.notna(row["ma20"]) else None,
            })
        price_series[r.symbol] = {
            "source": r.price_source,
            "trend": r.trend,
            "last": float(df["close"].iloc[-1]),
            "ma5": float(r.ma5),
            "ma20": float(r.ma20),
            "series": ser,
        }

        opt = {
            "symbol": r.symbol,
            "callVol": int(r.options.get("call_vol", 0)),
            "putVol": int(r.options.get("put_vol", 0)),
            "skew": float(r.options.get("call_put_skew", 1.0)),
            "abnormal": bool(r.options.get("abnormal_flag", False)),
            "source": r.options_source,
        }
        options_out.append(opt)

        score = float(risk_score(r.price_df, r.options, r.news_class, r.ma5, r.ma20, weights))
        risk_out.append({"symbol": r.symbol, "score": round(score, 2), "level": r.risk_level})

        tickers_out.append({
            "symbol": r.symbol,
            "name": r.name,
            "quickTake": r.quick_take,
            "newsClass": r.news_class,
            "newsSource": r.news_source,
            "news": (r.news or [])[:5],
            "social": r.social_label,
            "socialSource": r.social_source,
            "options": opt,
            "riskLevel": r.risk_level,
            "riskScore": round(score, 2),
            "action": r.suggested_action,
        })

    payload = {
        "schema": "fortifyos.macro_sentinel.latest.v1",
        "date": date.isoformat(),
        "generatedAt": dt.datetime.now(tz=RADAR_TZ).isoformat(),
        "timezone": str(RADAR_TZ),
        "nextRunAt": next_run_at(dt.datetime.now(tz=RADAR_TZ)).isoformat(),
        "isHoliday": not is_market_open_today(date),
        "htmlFile": f"PreMarket_Radar_PREVIEW_{date.isoformat()}.html",
        "regimeMode": "RISK_OFF" if stance.lower().startswith(("def", "risk-off")) else "RISK_ON",
        "volatility": volatility_payload,
        "portfolio": {
            "stance": stance,
            "mostBullish": most_bull,
            "highestRisk": highest_risk,
            "macroDriver": {"text": macro_driver, "source": macro_source},
        },
        "tickers": tickers_out,
        "charts": {
            "newsSentiment": news_dist,
            "risk": risk_out,
            "options": options_out,
            "priceSeries": price_series,
        },
    }
    return payload

# -----------------------------
# HTML template
# -----------------------------

def render_html(date: dt.date, reports: List[TickerReport], portfolio_risk_img: str, news_dist_img: str) -> str:
    # Keep <= 2 pages: tight grid, minimal text, small charts.
    css = """
    :root{--bg:#0b0b0c;--fg:#f2f2f3;--mut:#a8a8ad;--acc:#39ff14;--card:#121214;}
    *{box-sizing:border-box}
    body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--fg);}
    .wrap{padding:14px 16px 16px 16px;max-width:980px;margin:0 auto;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;border:1px solid #222;border-radius:10px;padding:10px 12px;background:linear-gradient(180deg,#0c0c0e,#0a0a0b);}
    .title{font-size:16px;font-weight:700;letter-spacing:.2px}
    .sub{font-size:11px;color:var(--mut)}
    .stamp{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:var(--mut);text-align:right}
    .grid{display:grid;grid-template-columns: 1fr 1fr;gap:10px;margin-top:10px}
    .card{background:var(--card);border:1px solid #242428;border-radius:10px;padding:10px}
    .kpi{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px}
    .k{border:1px solid #222;border-radius:8px;padding:6px 7px}
    .k .l{font-size:10px;color:var(--mut)}
    .k .v{font-size:12px;font-weight:700;margin-top:2px}
    .row{display:grid;grid-template-columns: 1.05fr .95fr; gap:10px; align-items:start; margin-top:8px}
    img{max-width:100%;height:auto;border-radius:8px;border:1px solid #222}
    .mini{font-size:11px;color:var(--mut);line-height:1.3}
    .pill{display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid #2a2a2f;font-size:10px;color:var(--mut);margin-right:6px}
    .acc{color:var(--acc)}
    .news li{margin:2px 0}
    .news a{color:#d7d7da;text-decoration:none}
    .news a:hover{text-decoration:underline}
    .tight{margin:0;padding-left:16px}
    .footer{margin-top:10px;color:var(--mut);font-size:10px;font-family:ui-monospace,Menlo,Consolas,monospace}
    @media print{
      body{background:#fff;color:#000}
      .card,.hdr{break-inside:avoid}
      :root{--bg:#fff;--fg:#000;--mut:#333;--card:#fff;--acc:#0a0}
    }
    """
    blocks = []
    for r in reports:
        news_lines = ""
        if r.news:
            li = []
            for it in r.news[:5]:
                title = (it.get("title","")[:90]).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                url = (it.get("url","") or "#")
                sent = it.get("sentiment_label","Neutral")
                li.append(f'<li><span class="pill">{sent}</span><a href="{url}">{title}</a></li>')
            news_lines = "<ul class='tight news'>" + "".join(li) + "</ul>"
        else:
            news_lines = "<div class='mini'>No news available. <span class='pill'>Proxy</span></div>"

        blocks.append(f"""
        <div class="card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <div>
              <div style="font-size:14px;font-weight:800">{r.symbol} <span class="mini">— {r.name}</span></div>
              <div class="mini">
                <span class="pill">Trend: <b>{r.trend}</b></span>
                <span class="pill">News: <b>{r.news_class}</b></span>
                <span class="pill">Social: <b>{r.social_label}</b></span>
                <span class="pill">Risk: <b class="acc">{r.risk_level}</b></span>
              </div>
            </div>
            <div class="mini" style="text-align:right">
              <div><span class="pill">Price src</span> {r.price_source}</div>
              <div><span class="pill">News src</span> {r.news_source}</div>
              <div><span class="pill">Social src</span> {r.social_source}</div>
              <div><span class="pill">Options src</span> {r.options_source}</div>
            </div>
          </div>

          <div class="kpi">
            <div class="k"><div class="l">5D MA</div><div class="v">{r.ma5:.2f}</div></div>
            <div class="k"><div class="l">20D MA</div><div class="v">{r.ma20:.2f}</div></div>
            <div class="k"><div class="l">Call/Put Skew</div><div class="v">{r.options.get("call_put_skew",1.0):.2f}</div></div>
            <div class="k"><div class="l">Unusual Calls</div><div class="v">{int(r.options.get("call_vol",0))}</div></div>
            <div class="k"><div class="l">Unusual Puts</div><div class="v">{int(r.options.get("put_vol",0))}</div></div>
          </div>

          <div class="row">
            <div>
              <img alt="price" src="data:image/png;base64,{r.price_chart_b64}">
              <div class="mini" style="margin-top:4px"><b>Quick take:</b> {r.quick_take}</div>
              <div class="mini"><b>Suggested action:</b> <span class="acc">{r.suggested_action}</span></div>
            </div>
            <div>
              <img alt="options" src="data:image/png;base64,{r.options_chart_b64}">
              <div class="mini" style="margin-top:6px"><b>Top news (24h):</b></div>
              {news_lines}
            </div>
          </div>
        </div>
        """)

    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pre-Market Radar PREVIEW {date.isoformat()}</title>
<style>{css}</style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div>
        <div class="title">Pre-Market Intelligence Radar <span class="acc">PREVIEW</span></div>
        <div class="sub">Top signals • News + Social + Options + Price context • 24h scope (unless noted)</div>
      </div>
      <div class="stamp">
        DATE: {date.isoformat()}<br/>
        MODE: Macro Sentinel<br/>
        BUILD: FortifyOS
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px">Portfolio Risk</div>
        <img alt="portfolio risk" src="data:image/png;base64,{portfolio_risk_img}">
        <div class="mini">Risk score is volatility + options skew + news polarity + MA divergence. (Proxy where needed)</div>
      </div>
      <div class="card">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px">News Sentiment Distribution</div>
        <img alt="news distribution" src="data:image/png;base64,{news_dist_img}">
        <div class="mini">Classification uses provider sentiment where available; otherwise keyword heuristic.</div>
      </div>
    </div>

    <div class="grid" style="margin-top:10px">
      {''.join(blocks)}
    </div>

    <div class="footer">FORTIFYOS • KNOX Macro Sentinel • Output is intentionally terse and scannable.</div>
  </div>
</body>
</html>
"""
    return html

# Extend dataclass fields dynamically without changing the decorator
TickerReport.price_chart_b64 = ""
TickerReport.options_chart_b64 = ""
TickerReport.quick_take = ""

def build_reports(cfg: Dict) -> Tuple[List[TickerReport], List[Dict]]:
    tickers = cfg.get("tickers", [])
    weights = cfg.get("risk_model", {})
    all_news: List[Dict] = []
    reports: List[TickerReport] = []

    for t in tickers:
        symbol = t["symbol"]
        name = t.get("name", symbol)

        price_df, price_src = fetch_prices(symbol)
        ma5 = compute_ma(price_df, 5)
        ma20 = compute_ma(price_df, 20)
        trend = classify_trend(price_df)

        news, news_src = fetch_news(symbol, n=5)
        all_news.extend(news)
        news_class = classify_news_bucket(news)

        social_label, social_src = fetch_social_sentiment(symbol)
        options, opt_src = fetch_options_unusual(symbol)

        score = risk_score(price_df, options, news_class, ma5, ma20, cfg.get("risk_model", {}))
        rlevel = risk_level_from_score(score)
        action = suggested_action(trend, news_class, rlevel)

        rpt = TickerReport(
            symbol=symbol, name=name,
            price_source=price_src, news_source=news_src, social_source=social_src, options_source=opt_src,
            price_df=price_df, ma5=ma5, ma20=ma20, trend=trend,
            news=news, news_class=news_class, social_label=social_label,
            options=options, risk_level=rlevel, suggested_action=action
        )

        # charts
        rpt.price_chart_b64 = chart_price(price_df, symbol)
        rpt.options_chart_b64 = chart_options_bar(options, symbol)

        # quick take (max 2 lines)
        # Keep short: trend + catalyst + risk.
        qt = []
        qt.append(f"{trend} trend; 5D/20D: {ma5:.2f}/{ma20:.2f}.")
        if news_class != "Neutral":
            qt.append(f"News bias {news_class}; options skew {options.get('call_put_skew',1.0):.2f}.")
        else:
            qt.append(f"Options skew {options.get('call_put_skew',1.0):.2f}; risk {rlevel}.")
        rpt.quick_take = " ".join(qt)[:160]

        reports.append(rpt)

    return reports, all_news

def discord_summary(reports: List[TickerReport], all_news: List[Dict], cfg: Dict) -> str:
    # Portfolio stance: conservative if >1 High risk
    highs = [r for r in reports if r.risk_level == "High"]
    stance = "Defensive" if len(highs) >= 2 else ("Neutral" if len(highs) == 1 else "Constructive")

    bullish = [r for r in reports if r.news_class == "Bullish" and r.risk_level != "High"]
    most_bull = bullish[0].symbol if bullish else reports[0].symbol

    highest_risk = sorted(reports, key=lambda r: r.risk_level, reverse=True)[0].symbol
    # Macro driver proxy: if no news, label proxy
    macro = "Rates / USD regime (Proxy)" if not all_news else "Headline tape (24h)"

    lines = [
        f"Stance: {stance}",
        f"Most bullish: {most_bull}",
        f"Highest risk: {highest_risk}",
        f"Macro driver: {macro}",
        f"Action bias: Protect first, grow second",
        f"File: HTML radar attached",
    ]
    return "\n".join(lines[:6])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", "--tickers", dest="config", required=True)
    ap.add_argument("--out", "--outdir", dest="out", required=True)
    ap.add_argument("--json", dest="json_out", default="")
    ap.add_argument("--public-json", dest="public_json", default="")
    args = ap.parse_args()

    ok, reason = should_run_now()
    webhook = os.getenv("DISCORD_WEBHOOK_URL", "").strip()

    if not ok:
        if webhook:
            discord_send(webhook, f"Pre-Market Radar skipped — {reason}")
        return

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    reports, all_news = build_reports(cfg)

    # portfolio charts
    weights = cfg.get("risk_model", {})
    port_risk_img = chart_portfolio_risk(reports, weights)
    news_dist_img = chart_news_distribution(all_news)

    date = dt.datetime.now(tz=RADAR_TZ).date()
    html = render_html(date, reports, port_risk_img, news_dist_img)

    os.makedirs(args.out, exist_ok=True)
    out_file = os.path.join(args.out, f"PreMarket_Radar_PREVIEW_{date.isoformat()}.html")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(html)

    # React dashboard payload
    latest_payload = build_latest_json(date, reports, all_news, cfg)
    if args.json_out:
        os.makedirs(os.path.dirname(args.json_out), exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(latest_payload, f, ensure_ascii=False, indent=2)
    if args.public_json:
        os.makedirs(os.path.dirname(args.public_json), exist_ok=True)
        with open(args.public_json, "w", encoding="utf-8") as f:
            json.dump(latest_payload, f, ensure_ascii=False, indent=2)

    if webhook:
        msg = discord_summary(reports, all_news, cfg)
        discord_send(webhook, msg, out_file)

if __name__ == "__main__":
    main()


# ---- FORTIFYOS Macro Sentinel metadata (Plus) ----
try:
    RADAR_TZ = os.environ.get("RADAR_TZ", "America/New_York")
except Exception:
    RADAR_TZ = "America/New_York"

# Best-effort regime mode:
# Prefer SPY MA signal if present; else use avg risk score.
try:
    spy = next((t for t in tickers if t.get("ticker") == "SPY"), None)
    regime_mode = "RISK_ON"
    if spy and "price_df" in spy:
        ma5 = float(spy["price_df"]["ma5"].iloc[-1])
        ma20 = float(spy["price_df"]["ma20"].iloc[-1])
        if ma5 < ma20:
            regime_mode = "RISK_OFF"
    # risk override
    avg_risk = sum([t.get("risk_score", 50) for t in tickers]) / max(len(tickers), 1)
    if avg_risk >= 67:
        regime_mode = "RISK_OFF"
except Exception:
    regime_mode = "UNKNOWN"

# Volatility series proxy: portfolio rolling 10D vol from normalized series (if available)
vol_series = []
is_proxy = True
try:
    # port_df should exist in script; if not, derive.
    if "port_df" in globals():
        vals = port_df["value"].values
    else:
        # derive from tickers price_df closes
        portfolio = pd.concat([t["price_df"].set_index("date")[["close"]] for t in tickers], axis=1)
        portfolio.columns = [t["ticker"] for t in tickers]
        port_norm = portfolio / portfolio.iloc[0] * 100
        vals = port_norm.mean(axis=1).values
    r = pd.Series(vals).pct_change().dropna()
    vol10 = r.rolling(10).std() * (252 ** 0.5) * 100
    vol_series = [float(x) for x in vol10.dropna().tail(14).values]
except Exception:
    vol_series = []

vol_pct = volatility_percentile(vol_series) if vol_series else None

# Determine 'mostBullish' and 'highestRisk' best-effort
try:
    most_bullish = next((t["ticker"] for t in tickers if str(t.get("news_class","")).startswith("Bullish")), tickers[0]["ticker"])
except Exception:
    most_bullish = "N/A"

try:
    highest_risk = sorted(tickers, key=lambda x: x.get("risk_score", 0), reverse=True)[0]["ticker"]
except Exception:
    highest_risk = "N/A"

# Html + hash
html_file_name = f"PreMarket_Radar_PREVIEW_{date_str}.html" if "date_str" in globals() else None
html_sha = None
try:
    if html_file_name:
        html_path = Path("/mnt/data") / html_file_name
        if html_path.exists():
            html_sha = sha256_file(str(html_path))
except Exception:
    html_sha = None


# Build ticker summaries for UI (best-effort / proxy)
ticker_summaries = []
try:
    for t0 in tickers:
        ticker_summaries.append({
            "symbol": t0.get("ticker") or t0.get("symbol"),
            "name": t0.get("name", ""),
            "newsClass": t0.get("news_class", "Neutral"),
            "socialSentiment": t0.get("social", "Mixed"),
            "optionsSignal": t0.get("options_signal", "Balanced"),
            "riskScore": t0.get("risk_score", None),
            "riskLevel": t0.get("risk_level", None),
            "action": t0.get("action", "Hold/Watch"),
        })
except Exception:
    ticker_summaries = []

# Key Issues (Bull vs Bear) — short, scannable
key_issues = [
  {
    "issue": "AI momentum vs valuation discipline",
    "bull": "Earnings keep validating AI spend; leaders regain trend.",
    "bear": "Crowded positioning; guidance misses trigger fast risk-off."
  },
  {
    "issue": "Breadth + macro uncertainty",
    "bull": "Dip-buying holds; breadth stabilizes into month-end.",
    "bear": "Narrow rally breaks; higher vol forces de-risking."
  },
  {
    "issue": "Crypto flow regime",
    "bull": "ETF flows support higher lows; risk-on spillover continues.",
    "bear": "Headline volatility; downside hedging expands quickly."
  }
]

latest = {
  "schema": "fortifyos.macro_sentinel.latest.v1",
  "generatedAt": datetime.now(ZoneInfo(RADAR_TZ)).isoformat() if ZoneInfo else datetime.utcnow().isoformat() + "Z",
  "radarTZ": RADAR_TZ,
  "nextRunAt": next_run_at_8am(RADAR_TZ),
  "isHoliday": False,
  "overallStance": "Defensive" if regime_mode == "RISK_OFF" else "Constructive",
  "mostBullish": most_bullish,
  "highestRisk": highest_risk,
  "macroDriver": "AI earnings narrative (Proxy)",
  "regimeMode": regime_mode,
  "volatility": {
    "series": vol_series,
    "label": "10D Vol (Proxy)" if is_proxy else "10D Vol",
    "isProxy": True if is_proxy else False
  },
  "volatilityPercentile": vol_pct,
  "htmlFile": html_file_name,
  "htmlSha256": html_sha,
  "tickers": ticker_summaries,
  "keyIssues": key_issues
}

# Write to repo paths if running in GitHub Actions (workspace), else best-effort local
try:
    workspace = os.environ.get("GITHUB_WORKSPACE")
    if workspace:
        out_dir = Path(workspace) / "radar" / "out"
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "latest.json").write_text(json.dumps(latest, indent=2), encoding="utf-8")

        pub_ms = Path(workspace) / "public" / "macro-sentinel"
        pub_ms.mkdir(parents=True, exist_ok=True)
        (pub_ms / "latest.json").write_text(json.dumps(latest, indent=2), encoding="utf-8")

        pub_radar = Path(workspace) / "public" / "radar"
        pub_radar.mkdir(parents=True, exist_ok=True)
        # Copy html already produced by script if present in out_dir or current path
        # This script likely already writes HTML; ensure published file exists.
        if html_file_name:
            # try from out_dir
            candidate = out_dir / html_file_name
            if candidate.exists():
                shutil.copyfile(candidate, pub_radar / html_file_name)
            else:
                # fall back to local /mnt/data
                local_candidate = Path("/mnt/data") / html_file_name
                if local_candidate.exists():
                    shutil.copyfile(local_candidate, pub_radar / html_file_name)

        # Maintain archive index.json with sha
        index_path = pub_radar / "index.json"
        try:
            idx = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
        except Exception:
            idx = []
        if html_file_name:
            entry = {"file": html_file_name, "sha256": html_sha, "generatedAt": latest["generatedAt"]}
            if not any(e.get("file") == html_file_name for e in idx):
                idx.insert(0, entry)
                index_path.write_text(json.dumps(idx[:120], indent=2), encoding="utf-8")
except Exception:
    pass
