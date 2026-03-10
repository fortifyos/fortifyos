"""
derive.py — Deterministic regime scoring for the FORTIFYOS Macro Intel Engine.

Each dimension is scored on an integer scale from -2 (strong negative signal)
to +2 (strong positive signal).  All scoring is rule-based — no AI involved.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from .ingest import get_value, get_asset

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Score clamp helper
# ---------------------------------------------------------------------------


def _clamp(value: float) -> int:
    """Clamp *value* to the [-2, +2] integer range."""
    return max(-2, min(2, int(round(value))))


def _safe(value: Any) -> Optional[float]:
    """Return *value* as float, or None if not numeric."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _pct_change(current: Optional[float], prior: Optional[float]) -> Optional[float]:
    """Return percentage change from *prior* to *current*, or None."""
    if current is None or prior is None or prior == 0:
        return None
    return ((current - prior) / abs(prior)) * 100


# ---------------------------------------------------------------------------
# Individual dimension scorers
# ---------------------------------------------------------------------------


def score_liquidity(macro: dict) -> int:
    """
    Score net Fed liquidity direction.

    Uses WALCL (Fed balance sheet), TGA (Treasury General Account), and
    RRP (Reverse Repo) when available.  Net liquidity = WALCL - TGA - RRP.
    A rising net liquidity is constructive (+); falling is restrictive (-).

    Scores:
      +2 : net liquidity expanding rapidly (>3% WoW)
      +1 : net liquidity expanding modestly
       0 : stable / data missing
      -1 : net liquidity contracting modestly
      -2 : net liquidity contracting rapidly
    """
    fed = macro.get("fedBalance", {}) or {}
    walcl = _safe(fed.get("walcl") or fed.get("WALCL"))
    walcl_prior = _safe(fed.get("walclPrior") or fed.get("walcl_prior"))
    tga = _safe(fed.get("tga") or fed.get("TGA"))
    tga_prior = _safe(fed.get("tgaPrior") or fed.get("tga_prior"))
    rrp = _safe(fed.get("rrp") or fed.get("RRP"))
    rrp_prior = _safe(fed.get("rrpPrior") or fed.get("rrp_prior"))

    if walcl is None and walcl_prior is None:
        # Try legacy flat keys
        walcl = _safe(macro.get("walcl"))
        walcl_prior = _safe(macro.get("walclPrior"))
        tga = _safe(macro.get("tga"))
        tga_prior = _safe(macro.get("tgaPrior"))
        rrp = _safe(macro.get("rrp"))
        rrp_prior = _safe(macro.get("rrpPrior"))

    if walcl is None:
        return 0

    net = walcl - (tga or 0.0) - (rrp or 0.0)
    if walcl_prior is not None:
        net_prior = walcl_prior - (tga_prior or 0.0) - (rrp_prior or 0.0)
        pct = _pct_change(net, net_prior)
        if pct is None:
            return 0
        if pct > 3:
            return 2
        if pct > 0.5:
            return 1
        if pct < -3:
            return -2
        if pct < -0.5:
            return -1
        return 0

    # No prior — score from absolute TGA/RRP drain contribution
    drain = (tga or 0.0) + (rrp or 0.0)
    drain_pct = (drain / walcl * 100) if walcl else 0
    if drain_pct < 10:
        return 1
    if drain_pct > 25:
        return -1
    return 0


def score_inflation(macro: dict) -> int:
    """
    Score inflationary pressure.

    Considers: WTI crude oil (pct vs close), gold (pct vs close), and 10Y
    Treasury yield direction.  Rising commodities + rising yields = higher
    inflation pressure.

    Scores:
      +2 : strong inflationary signals across multiple dimensions
      +1 : moderate inflation signal
       0 : neutral / mixed
      -1 : dis-inflationary signals present
      -2 : strong deflationary / demand-collapse signal
    """
    indices = macro.get("commodities", {}) or {}
    rates = macro.get("rates", {}) or {}

    wti_price = _safe((indices.get("wti") or {}).get("price"))
    wti_close = _safe((indices.get("wti") or {}).get("previousClose") or (indices.get("wti") or {}).get("close"))
    gold_price = _safe((indices.get("gold") or {}).get("price"))
    gold_close = _safe((indices.get("gold") or {}).get("previousClose") or (indices.get("gold") or {}).get("close"))
    tnx_yield = _safe((rates.get("tnx") or {}).get("yield"))
    tnx_close = _safe((rates.get("tnx") or {}).get("previousClose") or (rates.get("tnx") or {}).get("close"))

    signals: list[int] = []

    wti_pct = _pct_change(wti_price, wti_close)
    if wti_pct is not None:
        if wti_pct > 2:
            signals.append(2)
        elif wti_pct > 0.5:
            signals.append(1)
        elif wti_pct < -2:
            signals.append(-2)
        elif wti_pct < -0.5:
            signals.append(-1)
        else:
            signals.append(0)

    gold_pct = _pct_change(gold_price, gold_close)
    if gold_pct is not None:
        if gold_pct > 1.5:
            signals.append(2)
        elif gold_pct > 0.3:
            signals.append(1)
        elif gold_pct < -1.5:
            signals.append(-2)
        elif gold_pct < -0.3:
            signals.append(-1)
        else:
            signals.append(0)

    tnx_pct = _pct_change(tnx_yield, tnx_close)
    if tnx_pct is not None:
        # Rising yields are pro-inflation signal (but also demand concern)
        if tnx_pct > 2:
            signals.append(1)
        elif tnx_pct < -2:
            signals.append(-1)
        else:
            signals.append(0)

    if not signals:
        return 0

    avg = sum(signals) / len(signals)
    return _clamp(avg)


def score_growth(macro: dict) -> int:
    """
    Score growth health proxy.

    Uses SPX trend vs prior close and VIX level as a fear gauge.

    Scores:
      +2 : SPX strongly up, VIX low (<15)
      +1 : SPX up, VIX moderate
       0 : flat / mixed
      -1 : SPX down, VIX elevated (>25)
      -2 : SPX significantly down, VIX spiking (>35)
    """
    idx = macro.get("indices", {}) or {}
    vol = macro.get("volatility", {}) or {}

    spx_price = _safe((idx.get("spx") or {}).get("price"))
    spx_close = _safe((idx.get("spx") or {}).get("previousClose") or (idx.get("spx") or {}).get("close"))
    vix_val = _safe((vol.get("vix") or {}).get("value"))

    score = 0

    spx_pct = _pct_change(spx_price, spx_close)
    if spx_pct is not None:
        if spx_pct > 1.5:
            score += 2
        elif spx_pct > 0.4:
            score += 1
        elif spx_pct < -1.5:
            score -= 2
        elif spx_pct < -0.4:
            score -= 1

    if vix_val is not None:
        if vix_val < 15:
            score += 1
        elif vix_val > 35:
            score -= 2
        elif vix_val > 25:
            score -= 1

    return _clamp(score / 2 if score != 0 else 0)


def score_volatility(macro: dict) -> int:
    """
    Score volatility stress.

    Uses VIX level and its change vs prior close.
    Higher VIX and accelerating VIX = more stress (higher score).

    Scores:
      +2 : VIX > 35, spiking
      +1 : VIX > 25 or accelerating
       0 : VIX 15-25, stable
      -1 : VIX declining from elevated
      -2 : VIX < 12, complacency / extremely low vol
    """
    vol = macro.get("volatility", {}) or {}
    vix_val = _safe((vol.get("vix") or {}).get("value"))
    vix_close = _safe((vol.get("vix") or {}).get("previousClose") or (vol.get("vix") or {}).get("close"))

    if vix_val is None:
        return 0

    score = 0

    # Level component
    if vix_val >= 35:
        score += 2
    elif vix_val >= 25:
        score += 1
    elif vix_val <= 12:
        score -= 2
    elif vix_val <= 15:
        score -= 1

    # Change component
    vix_pct = _pct_change(vix_val, vix_close)
    if vix_pct is not None:
        if vix_pct > 10:
            score += 1
        elif vix_pct < -10:
            score -= 1

    return _clamp(score)


def score_dollar(macro: dict) -> int:
    """
    Score dollar pressure.

    Uses DXY direction (vs prior close).  A strengthening dollar exerts
    cross-asset pressure on risk assets and commodities.

    Scores:
      +2 : DXY strongly up (>1%)
      +1 : DXY modestly up (0.3-1%)
       0 : DXY flat
      -1 : DXY modestly weaker
      -2 : DXY strongly weaker (>1%)
    """
    forex = macro.get("forex", {}) or {}
    dxy_val = _safe((forex.get("dxy") or {}).get("value"))
    dxy_close = _safe((forex.get("dxy") or {}).get("previousClose") or (forex.get("dxy") or {}).get("close"))

    if dxy_val is None:
        # Fallback: try top-level dxy
        dxy_val = _safe(macro.get("dxy"))

    if dxy_val is None:
        return 0

    pct = _pct_change(dxy_val, dxy_close)
    if pct is None:
        return 0

    if pct > 1.0:
        return 2
    if pct > 0.3:
        return 1
    if pct < -1.0:
        return -2
    if pct < -0.3:
        return -1
    return 0


def score_breadth(macro: dict) -> int:
    """
    Score market breadth quality.

    Proxy: SPX vs BTC divergence (if BTC lags SPX rally, breadth is suspect),
    and VIX vs SPX price (elevated VIX during SPX rally = narrow leadership).

    Scores:
      +2 : SPX and BTC both rallying, VIX falling
      +1 : SPX up, BTC following, VIX stable
       0 : mixed signals
      -1 : SPX up but BTC lagging or VIX elevated
      -2 : SPX rally with VIX spike or BTC selling off
    """
    idx = macro.get("indices", {}) or {}
    crypto = macro.get("crypto", {}) or {}
    vol = macro.get("volatility", {}) or {}

    spx_price = _safe((idx.get("spx") or {}).get("price"))
    spx_close = _safe((idx.get("spx") or {}).get("previousClose") or (idx.get("spx") or {}).get("close"))
    btc_price = _safe((crypto.get("btc") or {}).get("price"))
    btc_close = _safe((crypto.get("btc") or {}).get("previousClose") or (crypto.get("btc") or {}).get("close"))
    vix_val = _safe((vol.get("vix") or {}).get("value"))
    vix_close = _safe((vol.get("vix") or {}).get("previousClose") or (vol.get("vix") or {}).get("close"))

    spx_pct = _pct_change(spx_price, spx_close)
    btc_pct = _pct_change(btc_price, btc_close)
    vix_pct = _pct_change(vix_val, vix_close)

    score = 0

    if spx_pct is not None and btc_pct is not None:
        # Both positive and aligned
        if spx_pct > 0.3 and btc_pct > 0.3:
            score += 1
        # SPX up but BTC lagging or negative = breadth concern
        elif spx_pct > 0.3 and btc_pct < -0.3:
            score -= 2
        elif spx_pct > 0.3 and btc_pct < 0:
            score -= 1
        # Both negative = risk-off broadly
        elif spx_pct < -0.3 and btc_pct < -0.3:
            score -= 1

    if vix_pct is not None:
        # VIX falling while SPX up = confirmed breadth
        if vix_pct < -5 and spx_pct is not None and spx_pct > 0:
            score += 1
        # VIX spiking while SPX up = divergence, breadth suspect
        elif vix_pct > 10 and spx_pct is not None and spx_pct > 0:
            score -= 2
        elif vix_pct > 5:
            score -= 1

    return _clamp(score)


def score_crypto(macro: dict) -> int:
    """
    Score crypto risk appetite.

    Uses BTC trend relative to SPX.  BTC outperforming = risk-on signal;
    BTC underperforming during SPX rally = caution.

    Scores:
      +2 : BTC strongly up (>3%) and outperforming SPX
      +1 : BTC up and in-line with SPX
       0 : flat or in-line
      -1 : BTC lagging SPX rally or declining
      -2 : BTC strongly down (>3%) regardless of SPX
    """
    crypto = macro.get("crypto", {}) or {}
    idx = macro.get("indices", {}) or {}

    btc_price = _safe((crypto.get("btc") or {}).get("price"))
    btc_close = _safe((crypto.get("btc") or {}).get("previousClose") or (crypto.get("btc") or {}).get("close"))
    spx_price = _safe((idx.get("spx") or {}).get("price"))
    spx_close = _safe((idx.get("spx") or {}).get("previousClose") or (idx.get("spx") or {}).get("close"))

    btc_pct = _pct_change(btc_price, btc_close)
    spx_pct = _pct_change(spx_price, spx_close)

    if btc_pct is None:
        return 0

    # Absolute BTC movement
    if btc_pct > 5:
        abs_score = 2
    elif btc_pct > 1.5:
        abs_score = 1
    elif btc_pct < -5:
        abs_score = -2
    elif btc_pct < -1.5:
        abs_score = -1
    else:
        abs_score = 0

    # Relative vs SPX
    if spx_pct is not None:
        diff = btc_pct - spx_pct
        if diff > 2:
            rel_score = 1    # BTC outperforming — added risk appetite
        elif diff < -2:
            rel_score = -1   # BTC lagging — risk appetite fading
        else:
            rel_score = 0
    else:
        rel_score = 0

    return _clamp((abs_score + rel_score) / 1.5)


# ---------------------------------------------------------------------------
# Main derive function
# ---------------------------------------------------------------------------


def derive_scores(macro_data: dict, prior_market: Optional[dict] = None) -> dict:
    """
    Compute all regime dimension scores and return a RegimeScores dict.

    Parameters
    ----------
    macro_data:
        Parsed macro.json content.
    prior_market:
        Previous MarketSnapshot dict (optional; used for change context).

    Returns
    -------
    dict
        RegimeScores with keys: liquidity, inflationPressure, growthHealth,
        volatilityStress, dollarPressure, breadthQuality, cryptoRiskAppetite.
    """
    try:
        liq = score_liquidity(macro_data)
    except Exception as exc:
        logger.warning("score_liquidity failed: %s", exc)
        liq = 0

    try:
        inf = score_inflation(macro_data)
    except Exception as exc:
        logger.warning("score_inflation failed: %s", exc)
        inf = 0

    try:
        grw = score_growth(macro_data)
    except Exception as exc:
        logger.warning("score_growth failed: %s", exc)
        grw = 0

    try:
        vol = score_volatility(macro_data)
    except Exception as exc:
        logger.warning("score_volatility failed: %s", exc)
        vol = 0

    try:
        dol = score_dollar(macro_data)
    except Exception as exc:
        logger.warning("score_dollar failed: %s", exc)
        dol = 0

    try:
        bre = score_breadth(macro_data)
    except Exception as exc:
        logger.warning("score_breadth failed: %s", exc)
        bre = 0

    try:
        cry = score_crypto(macro_data)
    except Exception as exc:
        logger.warning("score_crypto failed: %s", exc)
        cry = 0

    return {
        "liquidity": liq,
        "inflationPressure": inf,
        "growthHealth": grw,
        "volatilityStress": vol,
        "dollarPressure": dol,
        "breadthQuality": bre,
        "cryptoRiskAppetite": cry,
    }
