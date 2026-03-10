"""
regime.py — Regime classification for the FORTIFYOS Macro Intel Engine.

Translates numeric dimension scores into a named regime mode, computes a
confidence score, and assembles the full RegimeState dict with rule-generated
context strings.
"""

from __future__ import annotations

import logging
from typing import Optional

from .utils import to_iso, now_et
from .sessions import session_label

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regime mode definitions
# ---------------------------------------------------------------------------

# Human-readable descriptions keyed by regime mode string.
_REGIME_DESCRIPTIONS: dict[str, str] = {
    "inflation_shock":       "Inflation shock — commodity surge and/or yield spike dominating cross-asset flows",
    "dollar_stress":         "Dollar stress — USD strength suppressing risk assets and global liquidity",
    "risk_off":              "Risk-off — volatility spike with deteriorating breadth and defensive rotation",
    "risk_on":               "Risk-on — liquidity tailwind with broad-based participation",
    "liquidity_expansion":   "Liquidity expansion — Fed/reserve easing with low volatility environment",
    "crypto_speculation":    "Crypto speculation — digital assets leading and diverging from traditional risk",
    "growth_scare":          "Growth scare — demand-side weakness signaling potential recessionary pressure",
    "mixed":                 "Mixed — no clear dominant macro regime; signals are contradictory or low-conviction",
}

# Driver labels for dominant drivers generation
_SCORE_LABELS: dict[str, str] = {
    "liquidity":           "Net Fed Liquidity",
    "inflationPressure":   "Inflation Pressure",
    "growthHealth":        "Growth Health",
    "volatilityStress":    "Volatility Stress",
    "dollarPressure":      "Dollar Pressure",
    "breadthQuality":      "Breadth Quality",
    "cryptoRiskAppetite":  "Crypto Risk Appetite",
}


# ---------------------------------------------------------------------------
# Classification logic
# ---------------------------------------------------------------------------


def classify_regime(scores: dict) -> str:
    """
    Classify the macro regime mode from dimension scores.

    Parameters
    ----------
    scores:
        RegimeScores dict with keys: liquidity, inflationPressure, growthHealth,
        volatilityStress, dollarPressure, breadthQuality, cryptoRiskAppetite.

    Returns
    -------
    str
        Regime mode string (see :data:`_REGIME_DESCRIPTIONS`).
    """
    liq    = scores.get("liquidity", 0)
    inf    = scores.get("inflationPressure", 0)
    grw    = scores.get("growthHealth", 0)
    vol    = scores.get("volatilityStress", 0)
    dol    = scores.get("dollarPressure", 0)
    bre    = scores.get("breadthQuality", 0)
    cry    = scores.get("cryptoRiskAppetite", 0)

    # Priority-ordered classification
    if inf >= 2 and dol >= 1:
        return "inflation_shock"
    if dol >= 2 and bre <= -1:
        return "dollar_stress"
    if vol >= 2 and bre <= -1:
        return "risk_off"
    if liq >= 1 and bre >= 1:
        return "risk_on"
    if vol <= -1 and liq >= 1:
        return "liquidity_expansion"
    if cry >= 2:
        return "crypto_speculation"
    if inf >= 2:
        return "inflation_shock"   # oil-driven secondary check
    if grw <= -2:
        return "growth_scare"

    return "mixed"


# ---------------------------------------------------------------------------
# Confidence computation
# ---------------------------------------------------------------------------


def compute_confidence(scores: dict, regime: str) -> float:
    """
    Compute a confidence score (0.0–1.0) for the classified regime.

    Confidence is based on:
    - The number of dimension scores that are aligned (same direction as the
      regime's implied polarity).
    - The average absolute magnitude of scores (stronger scores = higher
      confidence).
    - The number of contradictory signals (reduces confidence).

    Parameters
    ----------
    scores:
        RegimeScores dict.
    regime:
        The classified regime mode string.

    Returns
    -------
    float
        Confidence value in the range [0.0, 1.0].
    """
    values = [v for v in scores.values() if isinstance(v, (int, float))]
    if not values:
        return 0.0

    n = len(values)
    avg_magnitude = sum(abs(v) for v in values) / n

    # Regime polarity: positive regimes expect positive scores, negative regimes
    # expect negative scores.
    positive_regimes = {"risk_on", "liquidity_expansion", "crypto_speculation"}
    negative_regimes = {"risk_off", "dollar_stress", "growth_scare"}
    inflation_regimes = {"inflation_shock"}
    mixed_regimes = {"mixed"}

    if regime in positive_regimes:
        aligned = sum(1 for v in values if v > 0)
        contradictions = sum(1 for v in values if v < -1)
    elif regime in negative_regimes:
        aligned = sum(1 for v in values if v < 0)
        contradictions = sum(1 for v in values if v > 1)
    elif regime in inflation_regimes:
        liq_score = scores.get("liquidity", 0)
        inf_score = scores.get("inflationPressure", 0)
        dol_score = scores.get("dollarPressure", 0)
        aligned = sum(1 for v in [inf_score, dol_score] if v >= 1)
        contradictions = 1 if liq_score >= 2 else 0  # easy money contradicts inflation shock
    else:  # mixed
        # Confidence is inversely related to any strong singular signal
        max_abs = max(abs(v) for v in values)
        return round(max(0.1, 0.5 - (max_abs * 0.1)), 2)

    alignment_ratio = aligned / n
    contradiction_penalty = contradictions * 0.1
    magnitude_boost = min(0.3, avg_magnitude * 0.1)

    confidence = alignment_ratio * 0.6 + magnitude_boost - contradiction_penalty
    return round(max(0.05, min(1.0, confidence)), 2)


# ---------------------------------------------------------------------------
# Dominant drivers and evidence builders
# ---------------------------------------------------------------------------


def _dominant_drivers(scores: dict, regime: str) -> list[str]:
    """
    Return a list of the top 1-3 score dimensions driving the regime.

    These are rule-generated strings, not AI-produced.
    """
    # Sort by absolute magnitude, descending
    sorted_scores = sorted(
        [(k, v) for k, v in scores.items()],
        key=lambda x: abs(x[1]),
        reverse=True,
    )
    drivers = []
    for key, val in sorted_scores[:3]:
        label = _SCORE_LABELS.get(key, key)
        direction = "elevated" if val > 0 else "suppressed" if val < 0 else "neutral"
        magnitude = "strongly" if abs(val) == 2 else "moderately" if abs(val) == 1 else ""
        mag_str = f"{magnitude} " if magnitude else ""
        drivers.append(f"{label} {mag_str}{direction} (score: {val:+d})")
    return drivers


def _supporting_evidence(scores: dict, regime: str, macro_data: dict) -> list[str]:
    """
    Generate supporting evidence strings from scores and regime context.
    These are deterministic rule-based observations.
    """
    evidence = []
    inf = scores.get("inflationPressure", 0)
    vol = scores.get("volatilityStress", 0)
    liq = scores.get("liquidity", 0)
    dol = scores.get("dollarPressure", 0)
    grw = scores.get("growthHealth", 0)
    bre = scores.get("breadthQuality", 0)
    cry = scores.get("cryptoRiskAppetite", 0)

    if inf >= 1:
        evidence.append("Commodity complex showing inflation persistence — oil and/or gold trending higher")
    if inf <= -1:
        evidence.append("Commodity complex softening — disinflationary read on demand outlook")
    if vol >= 2:
        evidence.append("VIX in elevated territory — hedging demand elevated, risk premium expanding")
    if vol <= -1:
        evidence.append("VIX compressed — low implied volatility supporting risk-carrying capacity")
    if liq >= 1:
        evidence.append("Net Fed liquidity expanding — balance sheet and/or RRP dynamics supportive")
    if liq <= -1:
        evidence.append("Net Fed liquidity tightening — TGA rebuild or RRP drain reversing")
    if dol >= 1:
        evidence.append("Dollar bid — cross-asset pressure on commodities and EM risk assets")
    if dol <= -1:
        evidence.append("Dollar weakening — relief for dollar-denominated risk assets and commodities")
    if grw <= -1:
        evidence.append("Growth proxies deteriorating — SPX under pressure and/or VIX rising")
    if grw >= 1:
        evidence.append("Growth proxies constructive — SPX trending and volatility contained")
    if bre <= -1:
        evidence.append("Breadth divergence — SPX/BTC divergence or narrow leadership visible")
    if bre >= 1:
        evidence.append("Broad participation — cross-asset confirmation across equities and crypto")
    if cry >= 2:
        evidence.append("BTC leading risk assets — crypto risk appetite outpacing equity moves")

    if not evidence:
        evidence.append("Mixed signals across dimensions — no strong directional confirmation")

    return evidence


def _watch_levels(scores: dict, macro_data: dict) -> list[str]:
    """
    Generate rule-based watch level strings.

    These highlight critical price/level thresholds to monitor.
    """
    levels = []
    vol = scores.get("volatilityStress", 0)
    inf = scores.get("inflationPressure", 0)
    dol = scores.get("dollarPressure", 0)
    grw = scores.get("growthHealth", 0)

    if vol >= 1:
        levels.append("VIX 30 — a sustained breach confirms stress escalation; break below signals relief")
    if vol <= -1:
        levels.append("VIX 20 — watch for mean-reversion spike given compressed volatility baseline")
    if inf >= 1:
        levels.append("WTI $90+ — key level where energy costs begin to feed into broader CPI expectations")
        levels.append("Gold $2,400 — sustained hold signals institutional inflation hedging in force")
    if dol >= 1:
        levels.append("DXY 105 — resistance zone; sustained break higher increases cross-asset stress")
    if dol <= -1:
        levels.append("DXY 100 — psychological support; break below could accelerate commodity repricing")
    if grw <= -1:
        levels.append("SPX 200-day MA — key structural support; break and hold below shifts trend regime")
    if grw >= 1:
        levels.append("SPX all-time highs — watch for momentum exhaustion signals near prior peaks")

    levels.append("10Y Treasury 4.5% — yield boundary between equity-supportive and equity-restrictive regimes")

    return levels[:5]  # Cap at 5 watch levels


def _invalidation_conditions(scores: dict, regime: str) -> list[str]:
    """
    Generate rule-based invalidation conditions for the current regime.
    """
    conditions = []

    if regime == "risk_on":
        conditions.append("VIX spikes above 25 — signals unexpected event risk breaking the constructive setup")
        conditions.append("Breadth collapses (BTC sells off while SPX rallies) — warns of narrow leadership")
        conditions.append("Fed turns hawkish or inflation data surprises to the upside")
    elif regime == "risk_off":
        conditions.append("VIX recaptures and holds below 20 — signals de-escalation of stress regime")
        conditions.append("SPX reclaims key moving average on volume — confirms risk appetite returning")
        conditions.append("Fed signals liquidity support or pivot — removes core driver of risk-off")
    elif regime == "inflation_shock":
        conditions.append("WTI and gold both reverse — commodity complex breakdown invalidates inflation read")
        conditions.append("10Y yield drops below prior range — bond market no longer pricing inflation")
        conditions.append("DXY weakens materially — reduces imported inflation pressure signal")
    elif regime == "dollar_stress":
        conditions.append("DXY reverses sharply lower — removes primary driver of cross-asset stress")
        conditions.append("Breadth quality improves (BTC and SPX align) — stress fading from risk assets")
    elif regime == "liquidity_expansion":
        conditions.append("Fed signals balance sheet reduction — core liquidity driver removed")
        conditions.append("VIX climbs above 20 — stress entering the low-vol liquidity regime")
    elif regime == "crypto_speculation":
        conditions.append("BTC drops >5% on volume — risk appetite reversal")
        conditions.append("SPX diverges down while BTC up — warns of crypto-specific risk, not macro risk-on")
    elif regime == "growth_scare":
        conditions.append("SPX holds key support and bounces with volume — stabilization signal")
        conditions.append("VIX declines while SPX advances — fear subsiding, growth scare fading")
    else:  # mixed
        conditions.append("Any two dimensions align strongly in one direction — regime will clarify")
        conditions.append("VIX spikes above 30 — even mixed regime becomes risk-off if vol escalates")

    return conditions


# ---------------------------------------------------------------------------
# RegimeState builder
# ---------------------------------------------------------------------------


def build_regime_state(
    session: str,
    scores: dict,
    regime: str,
    confidence: float,
    macro_data: dict,
    prior_regime: Optional[dict] = None,
) -> dict:
    """
    Build the full RegimeState dict.

    All contextual strings (dominantDrivers, supportingEvidence, watchLevels,
    invalidationConditions) are rule-generated — no AI required.

    Parameters
    ----------
    session:
        Active session key.
    scores:
        RegimeScores dict.
    regime:
        Classified regime mode string.
    confidence:
        Confidence float 0-1.
    macro_data:
        Full parsed macro.json dict.
    prior_regime:
        Previous RegimeState dict (optional).

    Returns
    -------
    dict
        RegimeState dict matching the regime_state schema.
    """
    prior_mode = None
    regime_changed = False
    if prior_regime:
        prior_mode = prior_regime.get("regimeMode")
        regime_changed = prior_mode != regime

    dominant_drivers = _dominant_drivers(scores, regime)
    supporting_evidence = _supporting_evidence(scores, regime, macro_data)
    watch_levels = _watch_levels(scores, macro_data)
    invalidation_conditions = _invalidation_conditions(scores, regime)

    return {
        "session": session,
        "sessionLabel": session_label(session),
        "timestamp": to_iso(now_et()),
        "regimeMode": regime,
        "regimeDescription": _REGIME_DESCRIPTIONS.get(regime, regime),
        "confidence": confidence,
        "scores": scores,
        "priorRegimeMode": prior_mode,
        "regimeChanged": regime_changed,
        "dominantDrivers": dominant_drivers,
        "supportingEvidence": supporting_evidence,
        "watchLevels": watch_levels,
        "invalidationConditions": invalidation_conditions,
    }
