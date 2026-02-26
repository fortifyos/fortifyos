#!/usr/bin/env python3
"""FortifyOS Pre-Market Intelligence Radar generator.

Outputs:
- radar/out/PreMarket_Radar_PREVIEW_YYYY-MM-DD.html (self-contained HTML)
- radar/out/latest.json
- public/macro-sentinel/latest.json (when requested)
- radar/out/index.json archive index with sha256

Delivery:
- Discord webhook 6-line summary + attached HTML (if DISCORD_WEBHOOK_URL set)
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import io
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pandas_market_calendars as mcal
import requests
from zoneinfo import ZoneInfo

RADAR_TZ = ZoneInfo(os.getenv("RADAR_TZ", "America/New_York"))

BULL_KW = ("beats", "surge", "record", "upgrade", "strong", "profit", "win", "partnership", "contract", "growth")
BEAR_KW = ("miss", "downgrade", "fall", "probe", "lawsuit", "weak", "layoff", "cut", "warning", "decline", "drop")


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
    risk_score: float
    risk_level: str
    suggested_action: str
    quick_take: str
    price_chart_b64: str
    options_chart_b64: str


def b64_png(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def is_market_open_today(date: dt.date) -> bool:
    nyse = mcal.get_calendar("NYSE")
    sched = nyse.schedule(start_date=date - dt.timedelta(days=3), end_date=date + dt.timedelta(days=3))
    return pd.Timestamp(date) in sched.index.normalize()


def should_run_now() -> Tuple[bool, str]:
    now_local = dt.datetime.now(tz=RADAR_TZ)
    if now_local.hour != 8:
        return False, f"Gate: local time {now_local:%H:%M} != 08:00"
    if now_local.weekday() >= 5:
        return False, "Market closed: weekend"
    if not is_market_open_today(now_local.date()):
        return False, f"Market closed: holiday ({now_local.date().isoformat()})"
    if os.getenv("STOP_PREMARKET_RADAR", "").strip().lower() in {"1", "true", "yes"}:
        return False, "STOP_PREMARKET_RADAR set"
    return True, "OK"


def next_run_at(now: dt.datetime) -> dt.datetime:
    nyse = mcal.get_calendar("NYSE")
    sched = nyse.schedule(start_date=now.date(), end_date=now.date() + dt.timedelta(days=14))
    sessions = [d.date() for d in sched.index.tz_localize(None)]
    today = now.astimezone(RADAR_TZ).date()
    eight_today = dt.datetime.combine(today, dt.time(8, 0), tzinfo=RADAR_TZ)
    if today in sessions and now.astimezone(RADAR_TZ) < eight_today:
        return eight_today
    for d in sessions:
        if d > today:
            return dt.datetime.combine(d, dt.time(8, 0), tzinfo=RADAR_TZ)
    return dt.datetime.combine(today + dt.timedelta(days=1), dt.time(8, 0), tzinfo=RADAR_TZ)


def fetch_stooq_daily(symbol: str, days: int = 60) -> Optional[pd.DataFrame]:
    sym = symbol.replace("-", "").replace("^", "").lower()
    if symbol.endswith("-USD"):
        sym = symbol.replace("-USD", "usd").lower()
    if "." not in sym:
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
        return df[["Date", "close"]]
    except Exception:
        return None


def fetch_prices(symbol: str) -> Tuple[pd.DataFrame, str]:
    df = fetch_stooq_daily(symbol)
    if df is not None and len(df) >= 25:
        return df, "Stooq"
    rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=60, freq="B")
    base = 100 + rng.normal(0, 1)
    steps = rng.normal(0, 1, size=len(dates))
    close = np.maximum(1, base + np.cumsum(steps))
    return pd.DataFrame({"Date": dates, "close": close}), "Proxy"


def classify_news(items: List[Dict]) -> List[Dict]:
    for it in items:
        title = (it.get("title") or "").lower()
        bull = any(k in title for k in BULL_KW)
        bear = any(k in title for k in BEAR_KW)
        if bull and not bear:
            it["sentiment_label"] = "Bullish"
        elif bear and not bull:
            it["sentiment_label"] = "Bearish"
        else:
            it["sentiment_label"] = "Neutral"
    return items


def fetch_news(symbol: str, n: int = 5) -> Tuple[List[Dict], str]:
    finnhub = os.getenv("FINNHUB_API_KEY", "").strip()
    newsapi = os.getenv("NEWSAPI_KEY", "").strip()

    if finnhub:
        try:
            today = dt.date.today()
            frm = (today - dt.timedelta(days=1)).isoformat()
            to = today.isoformat()
            url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={frm}&to={to}&token={finnhub}"
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                items = []
                for it in r.json()[:n]:
                    items.append(
                        {
                            "title": (it.get("headline") or "").strip(),
                            "url": it.get("url", ""),
                            "publishedAt": dt.datetime.fromtimestamp(it.get("datetime", 0)).isoformat(),
                        }
                    )
                return classify_news(items), "Finnhub"
        except Exception:
            pass

    if newsapi:
        try:
            url = f"https://newsapi.org/v2/everything?q={symbol}&pageSize={n}&sortBy=publishedAt&apiKey={newsapi}"
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                items = []
                for it in r.json().get("articles", [])[:n]:
                    items.append(
                        {
                            "title": (it.get("title") or "").strip(),
                            "url": it.get("url", ""),
                            "publishedAt": (it.get("publishedAt") or "").strip(),
                        }
                    )
                return classify_news(items), "NewsAPI"
        except Exception:
            pass

    return [], "Proxy"


def fetch_social_sentiment(_symbol: str) -> Tuple[str, str]:
    # Placeholder: can be upgraded to X API sampling.
    return "Mixed", "Proxy"


def fetch_options_unusual(symbol: str) -> Tuple[Dict, str]:
    # Proxy based on realized vol; replace with provider API when available.
    df, _ = fetch_prices(symbol)
    vol = float(df["close"].pct_change().dropna().tail(20).std() * np.sqrt(252))
    call = int(1000 * clamp(1.5 - vol, 0.2, 2.0))
    put = int(1000 * clamp(vol, 0.2, 2.0))
    skew = call / max(put, 1)
    return {
        "call": call,
        "put": put,
        "call_put_skew": skew,
        "abnormal": vol > 0.6,
    }, "Proxy"


def compute_ma(df: pd.DataFrame, window: int) -> float:
    return float(df["close"].rolling(window).mean().iloc[-1])


def classify_trend(df: pd.DataFrame) -> str:
    ma20 = df["close"].rolling(20).mean()
    if len(ma20.dropna()) == 0:
        return "Sideways"
    last = float(df["close"].iloc[-1])
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
    labels = [it.get("sentiment_label", "Neutral") for it in news]
    bull = labels.count("Bullish")
    bear = labels.count("Bearish")
    if bull > bear + 1:
        return "Bullish"
    if bear > bull + 1:
        return "Bearish"
    return "Neutral"


def risk_score(df: pd.DataFrame, options: Dict, news_class: str, ma5: float, ma20: float, weights: Dict[str, float]) -> float:
    r = df["close"].pct_change().dropna()
    vol_pct = float((r.tail(20).std() * np.sqrt(252)) * 100)
    skew = float(options.get("call_put_skew", 1.0))
    skew_ext = abs(np.log(max(skew, 1e-6))) * 100.0
    pol = 100.0 if news_class == "Bearish" else (0.0 if news_class == "Bullish" else 40.0)
    div = abs(ma5 - ma20) / max(abs(ma20), 1e-6) * 100.0

    wv = float(weights.get("volatility", 0.30))
    ws = float(weights.get("options_skew", 0.30))
    wn = float(weights.get("news_shift", 0.20))
    wd = float(weights.get("ma_divergence", 0.20))

    score = (wv * clamp(vol_pct, 0, 100) + ws * clamp(skew_ext, 0, 100) + wn * clamp(pol, 0, 100) + wd * clamp(div * 2, 0, 100))
    return round(clamp(score, 0, 100), 2)


def risk_level_from_score(score: float) -> str:
    if score <= 33:
        return "Low"
    if score <= 66:
        return "Medium"
    return "High"


def suggested_action(trend: str, news_class: str, risk_level: str) -> str:
    if risk_level == "High":
        return "Consider Trimming" if trend == "Down" else "Watch"
    if news_class == "Bullish" and trend in ("Up", "Choppy"):
        return "Opportunistic Buy"
    if news_class == "Bearish":
        return "Hold"
    return "Watch"


def chart_price(df: pd.DataFrame, symbol: str) -> str:
    d = df.tail(30).copy()
    d["ma5"] = d["close"].rolling(5).mean()
    d["ma20"] = d["close"].rolling(20).mean()
    fig = plt.figure(figsize=(5.2, 2.0))
    ax = fig.add_subplot(111)
    ax.plot(d["Date"], d["close"], label="Close")
    ax.plot(d["Date"], d["ma5"], label="MA5")
    ax.plot(d["Date"], d["ma20"], label="MA20")
    ax.set_title(f"{symbol} — 30D + MA5/MA20", fontsize=9)
    ax.tick_params(axis="x", labelrotation=0, labelsize=7)
    ax.tick_params(axis="y", labelsize=7)
    ax.grid(True, alpha=0.25)
    ax.legend(fontsize=7, loc="upper left")
    return b64_png(fig)


def chart_options_bar(options: Dict, symbol: str) -> str:
    fig = plt.figure(figsize=(3.0, 1.8))
    ax = fig.add_subplot(111)
    ax.bar(["Calls", "Puts"], [int(options.get("call", 0)), int(options.get("put", 0))])
    ax.set_title(f"{symbol} — Unusual Vol", fontsize=9)
    ax.tick_params(axis="y", labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)


def chart_news_distribution(all_news: List[Dict]) -> str:
    labels = [n.get("sentiment_label", "Neutral") for n in all_news] or ["Neutral"]
    cats = ["Bullish", "Neutral", "Bearish"]
    vals = [labels.count(c) for c in cats]
    fig = plt.figure(figsize=(5.2, 1.8))
    ax = fig.add_subplot(111)
    ax.bar(cats, vals)
    ax.set_title("Portfolio — News Sentiment Distribution", fontsize=9)
    ax.tick_params(axis="y", labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)


def chart_portfolio_risk(reports: List[TickerReport]) -> str:
    fig = plt.figure(figsize=(5.2, 1.8))
    ax = fig.add_subplot(111)
    ax.bar([r.symbol for r in reports], [r.risk_score for r in reports])
    ax.set_ylim(0, 100)
    ax.set_title("Portfolio — Risk Scores (0–100)", fontsize=9)
    ax.tick_params(axis="x", labelsize=7)
    ax.tick_params(axis="y", labelsize=7)
    ax.grid(True, axis="y", alpha=0.25)
    return b64_png(fig)


def discord_send(webhook_url: str, content: str, file_path: Optional[Path] = None) -> None:
    if not webhook_url:
        return
    try:
        if file_path and file_path.exists():
            with file_path.open("rb") as f:
                requests.post(
                    webhook_url,
                    data={"content": content},
                    files={"file": (file_path.name, f, "text/html")},
                    timeout=60,
                )
        else:
            requests.post(webhook_url, json={"content": content}, timeout=20)
    except Exception:
        pass


def build_reports(cfg: Dict) -> Tuple[List[TickerReport], List[Dict]]:
    reports: List[TickerReport] = []
    all_news: List[Dict] = []
    risk_weights = cfg.get("risk_model", {})

    for t in cfg.get("tickers", []):
        symbol = t.get("symbol") or t.get("ticker")
        if not symbol:
            continue
        name = t.get("name", symbol)

        price_df, price_src = fetch_prices(symbol)
        news, news_src = fetch_news(symbol, n=5)
        social_label, social_src = fetch_social_sentiment(symbol)
        options, opt_src = fetch_options_unusual(symbol)

        ma5 = compute_ma(price_df, 5)
        ma20 = compute_ma(price_df, 20)
        trend = classify_trend(price_df)
        news_class = classify_news_bucket(news)
        score = risk_score(price_df, options, news_class, ma5, ma20, risk_weights)
        rlevel = risk_level_from_score(score)
        action = suggested_action(trend, news_class, rlevel)

        quick_take = f"{trend} trend; 5D/20D {ma5:.2f}/{ma20:.2f}. "
        if news_class != "Neutral":
            quick_take += f"News {news_class}; options skew {options.get('call_put_skew', 1.0):.2f}."
        else:
            quick_take += f"Options skew {options.get('call_put_skew', 1.0):.2f}; risk {rlevel}."
        quick_take = quick_take[:180]

        rpt = TickerReport(
            symbol=symbol,
            name=name,
            price_source=price_src,
            news_source=news_src,
            social_source=social_src,
            options_source=opt_src,
            price_df=price_df,
            ma5=ma5,
            ma20=ma20,
            trend=trend,
            news=news,
            news_class=news_class,
            social_label=social_label,
            options=options,
            risk_score=score,
            risk_level=rlevel,
            suggested_action=action,
            quick_take=quick_take,
            price_chart_b64=chart_price(price_df, symbol),
            options_chart_b64=chart_options_bar(options, symbol),
        )
        reports.append(rpt)
        all_news.extend(news)

    return reports, all_news


def render_html(date: dt.date, reports: List[TickerReport], portfolio_risk_img: str, news_dist_img: str) -> str:
    css = """
    :root{
      --app-bg:#050505; --app-text:#f4f4f5; --panel-bg:#111113; --panel-border:#27272a;
      --text-muted:#a1a1aa; --text-meta:#71717a; --accent:#22c55e; --danger:#ef4444;
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      background:var(--app-bg); color:var(--app-text);
    }
    .wrap{padding:14px 16px 16px;max-width:1080px;margin:0 auto;}
    .hdr{
      display:flex;justify-content:space-between;align-items:flex-end;
      border:1px solid var(--panel-border); border-radius:0; padding:10px 12px; background:var(--panel-bg);
    }
    .title{font-size:16px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .sub{font-size:11px;color:var(--text-muted)}
    .stamp{font-size:11px;color:var(--text-meta);text-align:right}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
    .card{background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:0;padding:10px}
    .kpi{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px}
    .k{border:1px solid var(--panel-border);border-radius:0;padding:6px 7px}
    .k .l{font-size:10px;color:var(--text-meta);text-transform:uppercase;letter-spacing:.08em}
    .k .v{font-size:12px;font-weight:700;margin-top:2px}
    .row{display:grid;grid-template-columns:1.05fr .95fr;gap:10px;align-items:start;margin-top:8px}
    img{max-width:100%;height:auto;border-radius:0;border:1px solid var(--panel-border)}
    .mini{font-size:11px;color:var(--text-muted);line-height:1.35}
    .pill{
      display:inline-block;padding:2px 6px;border-radius:0;border:1px solid var(--panel-border);
      font-size:10px;color:var(--text-muted);margin-right:6px;
    }
    .acc{color:var(--accent)}
    .news li{margin:2px 0}
    .news a{color:var(--app-text);text-decoration:none}
    .news a:hover{text-decoration:underline}
    .tight{margin:0;padding-left:16px}
    .footer{margin-top:10px;color:var(--text-meta);font-size:10px}
    @media (max-width: 900px){.grid{grid-template-columns:1fr}.kpi{grid-template-columns:repeat(2,1fr)}.row{grid-template-columns:1fr}}
    @media print{body{background:#fff;color:#000}.card,.hdr{break-inside:avoid}}
    """

    blocks = []
    for r in reports:
        if r.news:
            lis = []
            for n in r.news[:5]:
                title = (n.get("title", "")[:90]).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                url = n.get("url", "") or "#"
                sent = n.get("sentiment_label", "Neutral")
                lis.append(f'<li><span class="pill">{sent}</span><a href="{url}">{title}</a></li>')
            news_html = "<ul class='tight news'>" + "".join(lis) + "</ul>"
        else:
            news_html = "<div class='mini'>No news available. <span class='pill'>Proxy</span></div>"

        blocks.append(
            f"""
            <div class=\"card\">
              <div style=\"display:flex;justify-content:space-between;gap:10px;align-items:flex-start\">
                <div>
                  <div style=\"font-size:14px;font-weight:800\">{r.symbol} <span class=\"mini\">— {r.name}</span></div>
                  <div class=\"mini\">
                    <span class=\"pill\">Trend: <b>{r.trend}</b></span>
                    <span class=\"pill\">News: <b>{r.news_class}</b></span>
                    <span class=\"pill\">Social: <b>{r.social_label}</b></span>
                    <span class=\"pill\">Risk: <b class=\"acc\">{r.risk_level}</b></span>
                  </div>
                </div>
                <div class=\"mini\" style=\"text-align:right\">
                  <div><span class=\"pill\">Price src</span> {r.price_source}</div>
                  <div><span class=\"pill\">News src</span> {r.news_source}</div>
                  <div><span class=\"pill\">Social src</span> {r.social_source}</div>
                  <div><span class=\"pill\">Options src</span> {r.options_source}</div>
                </div>
              </div>

              <div class=\"kpi\">
                <div class=\"k\"><div class=\"l\">5D MA</div><div class=\"v\">{r.ma5:.2f}</div></div>
                <div class=\"k\"><div class=\"l\">20D MA</div><div class=\"v\">{r.ma20:.2f}</div></div>
                <div class=\"k\"><div class=\"l\">Call/Put Skew</div><div class=\"v\">{r.options.get('call_put_skew',1.0):.2f}</div></div>
                <div class=\"k\"><div class=\"l\">Unusual Calls</div><div class=\"v\">{int(r.options.get('call',0))}</div></div>
                <div class=\"k\"><div class=\"l\">Unusual Puts</div><div class=\"v\">{int(r.options.get('put',0))}</div></div>
              </div>

              <div class=\"row\">
                <div>
                  <img alt=\"price\" src=\"data:image/png;base64,{r.price_chart_b64}\"/>
                  <div class=\"mini\" style=\"margin-top:4px\"><b>Quick take:</b> {r.quick_take}</div>
                  <div class=\"mini\"><b>Suggested action:</b> <span class=\"acc\">{r.suggested_action}</span></div>
                </div>
                <div>
                  <img alt=\"options\" src=\"data:image/png;base64,{r.options_chart_b64}\"/>
                  <div class=\"mini\" style=\"margin-top:6px\"><b>Top news (24h):</b></div>
                  {news_html}
                </div>
              </div>
            </div>
            """
        )

    return f"""<!doctype html>
<html>
<head>
<meta charset=\"utf-8\"/>
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>
<title>Pre-Market Radar PREVIEW {date.isoformat()}</title>
<style>{css}</style>
</head>
<body>
  <div class=\"wrap\">
    <div class=\"hdr\">
      <div>
        <div class=\"title\">Pre-Market Intelligence Radar <span class=\"acc\">PREVIEW</span></div>
        <div class=\"sub\">Top signals • News + Social + Options + Price context • 24h scope (unless noted)</div>
      </div>
      <div class=\"stamp\">DATE: {date.isoformat()}<br/>MODE: Macro Sentinel<br/>BUILD: FortifyOS</div>
    </div>

    <div class=\"grid\">
      <div class=\"card\">
        <div style=\"font-weight:800;font-size:12px;margin-bottom:6px\">Portfolio Risk</div>
        <img alt=\"portfolio risk\" src=\"data:image/png;base64,{portfolio_risk_img}\"/>
        <div class=\"mini\">Risk score combines volatility, options skew, news polarity, and MA divergence (Proxy where needed).</div>
      </div>
      <div class=\"card\">
        <div style=\"font-weight:800;font-size:12px;margin-bottom:6px\">News Sentiment Distribution</div>
        <img alt=\"news distribution\" src=\"data:image/png;base64,{news_dist_img}\"/>
        <div class=\"mini\">Classification uses provider sentiment where available; otherwise keyword heuristic.</div>
      </div>
    </div>

    <div class=\"grid\" style=\"margin-top:10px\">{''.join(blocks)}</div>
    <div class=\"footer\">FORTIFYOS • KNOX Macro Sentinel • Output intentionally terse and scannable.</div>
  </div>
</body>
</html>"""


def build_portfolio_series(reports: List[TickerReport]) -> List[Dict]:
    if not reports:
        return []
    frames = []
    for r in reports:
        d = r.price_df.tail(30).copy()
        d = d[["Date", "close"]].rename(columns={"close": r.symbol})
        frames.append(d.set_index("Date"))
    merged = pd.concat(frames, axis=1).dropna(how="all")
    merged = merged.fillna(method="ffill").fillna(method="bfill")
    norm = merged / merged.iloc[0] * 100.0
    portfolio = norm.mean(axis=1)
    out = []
    for idx, val in portfolio.items():
        out.append({"date": pd.to_datetime(idx).date().isoformat(), "value": round(float(val), 4)})
    return out[-30:]


def build_latest_json(date: dt.date, reports: List[TickerReport], all_news: List[Dict], cfg: Dict, html_file: str, html_sha: str) -> Dict:
    highs = [r for r in reports if r.risk_level == "High"]
    stance = "Defensive" if len(highs) >= 2 else ("Neutral" if len(highs) == 1 else "Constructive")

    bullish = [r for r in reports if r.news_class == "Bullish" and r.risk_level != "High"]
    most_bull = bullish[0].symbol if bullish else (reports[0].symbol if reports else "")

    highest = sorted(reports, key=lambda x: x.risk_score, reverse=True)[0].symbol if reports else ""

    labels = [n.get("sentiment_label", "Neutral") for n in all_news]
    news_dist = {
        "Bullish": labels.count("Bullish"),
        "Neutral": labels.count("Neutral"),
        "Bearish": labels.count("Bearish"),
    }

    vol_series = [round(r.risk_score, 2) for r in reports]
    vol_pct = int(round(np.percentile(vol_series, 50))) if vol_series else None

    tickers = []
    options_out = []
    risk_out = []
    price_series = {}

    for r in reports:
        ds = r.price_df.tail(30).copy()
        ds["ma5"] = ds["close"].rolling(5).mean()
        ds["ma20"] = ds["close"].rolling(20).mean()
        ser = []
        for _, row in ds.iterrows():
            ser.append(
                {
                    "date": pd.to_datetime(row["Date"]).date().isoformat(),
                    "close": float(row["close"]),
                    "ma5": float(row["ma5"]) if pd.notna(row["ma5"]) else None,
                    "ma20": float(row["ma20"]) if pd.notna(row["ma20"]) else None,
                }
            )

        opt = {
            "symbol": r.symbol,
            "call": int(r.options.get("call", 0)),
            "put": int(r.options.get("put", 0)),
            "skew": float(r.options.get("call_put_skew", 1.0)),
            "abnormal": bool(r.options.get("abnormal", False)),
            "source": r.options_source,
        }
        options_out.append(opt)
        risk_out.append({"symbol": r.symbol, "score": r.risk_score, "level": r.risk_level})

        tickers.append(
            {
                # canonical for UI
                "ticker": r.symbol,
                "symbol": r.symbol,
                "name": r.name,
                "quick_take": r.quick_take,
                "quickTake": r.quick_take,
                "news_class": r.news_class,
                "newsClass": r.news_class,
                "news": r.news[:5],
                "social": r.social_label,
                "social_label": r.social_label,
                "options_signal": f"Skew {r.options.get('call_put_skew', 1.0):.2f}",
                "options": opt,
                "risk_score": r.risk_score,
                "riskScore": r.risk_score,
                "risk_level": r.risk_level,
                "riskLevel": r.risk_level,
                "action": r.suggested_action,
            }
        )

        price_series[r.symbol] = {
            "source": r.price_source,
            "trend": r.trend,
            "last": float(ds["close"].iloc[-1]),
            "ma5": float(r.ma5),
            "ma20": float(r.ma20),
            "series": ser,
        }

    key_issues = [
        {
            "issue": "AI momentum vs valuation discipline",
            "bull": "Earnings momentum supports risk appetite.",
            "bear": "Crowded positioning can unwind quickly.",
        },
        {
            "issue": "Rates and dollar pressure",
            "bull": "Stable yields support growth assets.",
            "bear": "Rate spikes compress multiples and raise volatility.",
        },
    ]

    return {
        "schema": "fortifyos.macro_sentinel.latest.v1",
        "date": date.isoformat(),
        "generatedAt": dt.datetime.now(tz=RADAR_TZ).isoformat(),
        "radarTZ": str(RADAR_TZ),
        "timezone": str(RADAR_TZ),
        "nextRunAt": next_run_at(dt.datetime.now(tz=RADAR_TZ)).isoformat(),
        "isHoliday": not is_market_open_today(date),
        "overallStance": stance,
        "mostBullish": most_bull,
        "highestRisk": highest,
        "macroDriver": "Headline tape (24h)" if all_news else "Rates / USD regime (Proxy)",
        "regimeMode": "RISK_OFF" if stance in {"Defensive", "Neutral"} else "RISK_ON",
        "volatility": {
            "series": vol_series,
            "label": "Ticker Risk Scores",
            "isProxy": True,
        },
        "volatilityPercentile": vol_pct,
        "htmlFile": html_file,
        "htmlSha256": html_sha,
        "tickers": tickers,
        "keyIssues": key_issues,
        "series": {"portfolio30d": build_portfolio_series(reports)},
        "portfolio": {
            "stance": stance,
            "mostBullish": most_bull,
            "highestRisk": highest,
            "macroDriver": {"text": "Headline tape (24h)" if all_news else "Rates / USD regime", "source": "News" if all_news else "Proxy"},
        },
        "charts": {
            "newsSentiment": news_dist,
            "risk": risk_out,
            "options": options_out,
            "priceSeries": price_series,
        },
    }


def update_archive_index(out_dir: Path, html_name: str, generated_at: str, sha: str) -> None:
    idx_path = out_dir / "index.json"
    try:
        existing = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else []
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

    # normalize old string-list format to object-list
    normalized = []
    for item in existing:
        if isinstance(item, str):
            normalized.append({"file": item, "generatedAt": None, "sha256": ""})
        elif isinstance(item, dict):
            normalized.append(item)

    entry = {"file": html_name, "generatedAt": generated_at, "sha256": sha}
    normalized = [e for e in normalized if e.get("file") != html_name]
    normalized.insert(0, entry)
    idx_path.write_text(json.dumps(normalized[:120], indent=2), encoding="utf-8")


def discord_summary(reports: List[TickerReport], all_news: List[Dict]) -> str:
    highs = [r for r in reports if r.risk_level == "High"]
    stance = "Defensive" if len(highs) >= 2 else ("Neutral" if len(highs) == 1 else "Constructive")
    bullish = [r for r in reports if r.news_class == "Bullish" and r.risk_level != "High"]
    most_bull = bullish[0].symbol if bullish else (reports[0].symbol if reports else "N/A")
    highest = sorted(reports, key=lambda r: r.risk_score, reverse=True)[0].symbol if reports else "N/A"
    macro = "Headline tape (24h)" if all_news else "Rates / USD regime (Proxy)"
    lines = [
        f"Stance: {stance}",
        f"Most bullish: {most_bull}",
        f"Highest risk: {highest}",
        f"Macro driver: {macro}",
        "Action bias: Protect first, grow second",
        "File: HTML radar attached",
    ]
    return "\n".join(lines[:6])


def main() -> None:
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

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    reports, all_news = build_reports(cfg)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    date = dt.datetime.now(tz=RADAR_TZ).date()
    html_name = f"PreMarket_Radar_PREVIEW_{date.isoformat()}.html"
    html_path = out_dir / html_name

    html = render_html(date, reports, chart_portfolio_risk(reports), chart_news_distribution(all_news))
    html_path.write_text(html, encoding="utf-8")

    html_sha = sha256_file(html_path)
    latest = build_latest_json(date, reports, all_news, cfg, html_name, html_sha)

    if args.json_out:
        p = Path(args.json_out)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(latest, indent=2), encoding="utf-8")

    if args.public_json:
        p = Path(args.public_json)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(latest, indent=2), encoding="utf-8")

    update_archive_index(out_dir, html_name, latest["generatedAt"], html_sha)

    if webhook:
        discord_send(webhook, discord_summary(reports, all_news), html_path)


if __name__ == "__main__":
    main()
