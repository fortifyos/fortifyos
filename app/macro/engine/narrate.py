"""
narrate.py — AI narration generation for the FORTIFYOS Macro Intel Engine.

Builds the prompt payload for the AI narrator and calls the Anthropic API.
Falls back to deterministic rule-based narration if the API call fails.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

from .utils import to_iso, now_et, load_json
from .sessions import session_label

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = "claude-sonnet-4-6"

# Path to prompt template files (relative to this file's directory)
_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")


# ---------------------------------------------------------------------------
# Prompt loading
# ---------------------------------------------------------------------------


def _load_prompt(filename: str) -> str:
    """Load a prompt template file, returning empty string on failure."""
    path = os.path.normpath(os.path.join(_PROMPTS_DIR, filename))
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError as exc:
        logger.warning("_load_prompt: could not read %s: %s", path, exc)
        return ""


# ---------------------------------------------------------------------------
# Prompt payload builder
# ---------------------------------------------------------------------------


def build_prompt_payload(
    session: str,
    timestamp: str,
    market_snapshot: dict,
    prior_market: Optional[dict],
    regime_state: dict,
    prior_regime: Optional[dict],
    what_changed: dict,
    daily_log_so_far: list,
) -> dict:
    """
    Build the system + user prompt payload for the AI narrator.

    Parameters
    ----------
    session:
        Active session key, e.g. ``"pre_market"``.
    timestamp:
        ISO 8601 timestamp string for this run.
    market_snapshot:
        Current MarketSnapshot dict.
    prior_market:
        Previous MarketSnapshot dict (may be None).
    regime_state:
        Current RegimeState dict.
    prior_regime:
        Previous RegimeState dict (may be None).
    what_changed:
        WhatChanged summary dict (computed by the job runner).
    daily_log_so_far:
        List of NarrativeEntry dicts from earlier runs today.

    Returns
    -------
    dict
        {"system": str, "user": str}
    """
    system_prompt = _load_prompt("macro_narration_system.txt")

    user_template = _load_prompt("macro_narration_user.txt")

    # Build the filled-in user prompt
    scores = regime_state.get("scores", {})
    supporting_evidence = regime_state.get("supportingEvidence", [])
    watch_levels = regime_state.get("watchLevels", [])

    user_prompt = user_template.format(
        session=session_label(session),
        timestamp=timestamp,
        regime_mode=regime_state.get("regimeMode", "mixed"),
        confidence=regime_state.get("confidence", 0.0),
        scores_json=json.dumps(scores, indent=2),
        market_snapshot_json=json.dumps(market_snapshot, indent=2),
        prior_market_json=json.dumps(prior_market or {}, indent=2),
        what_changed_json=json.dumps(what_changed, indent=2),
        supporting_evidence_json=json.dumps(supporting_evidence, indent=2),
        watch_levels_json=json.dumps(watch_levels, indent=2),
    )

    return {
        "system": system_prompt,
        "user": user_prompt,
        "meta": {
            "session": session,
            "timestamp": timestamp,
            "regime_mode": regime_state.get("regimeMode", "mixed"),
            "model": ANTHROPIC_MODEL,
        },
    }


# ---------------------------------------------------------------------------
# AI generation
# ---------------------------------------------------------------------------


def generate_narrative(
    prompt_payload: dict,
    api_key: str,
) -> dict:
    """
    Generate a NarrativeEntry by calling the Anthropic API.

    Falls back to :func:`rule_based_narrative` if the API call fails for any
    reason (network error, rate limit, schema parse failure, etc.).

    Parameters
    ----------
    prompt_payload:
        Dict returned by :func:`build_prompt_payload`.
    api_key:
        Anthropic API key string.

    Returns
    -------
    dict
        NarrativeEntry dict.
    """
    try:
        import anthropic  # type: ignore

        client = anthropic.Anthropic(api_key=api_key)

        message = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2048,
            system=prompt_payload["system"],
            messages=[
                {"role": "user", "content": prompt_payload["user"]},
            ],
        )

        raw_text = ""
        for block in message.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Extract JSON from the response
        narrative_data = _extract_json(raw_text)
        if narrative_data is None:
            logger.warning("generate_narrative: could not parse JSON from AI response; using fallback")
            return _fallback_from_payload(prompt_payload)

        # Ensure required fields are present
        entry = _normalize_narrative_entry(narrative_data, prompt_payload)
        entry["source"] = "ai"
        return entry

    except ImportError:
        logger.warning("generate_narrative: anthropic package not installed; using rule-based fallback")
    except Exception as exc:
        logger.warning("generate_narrative: API call failed (%s); using rule-based fallback", exc)

    return _fallback_from_payload(prompt_payload)


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------


def rule_based_narrative(
    session: str,
    regime_state: dict,
    market_snapshot: dict,
    what_changed: dict,
) -> dict:
    """
    Generate a deterministic NarrativeEntry without any AI call.

    All text is assembled from regime scores, labels, and asset data.
    This is the fallback when the AI API is unavailable or disabled.

    Parameters
    ----------
    session:
        Active session key.
    regime_state:
        Current RegimeState dict.
    market_snapshot:
        Current MarketSnapshot dict.
    what_changed:
        WhatChanged summary dict.

    Returns
    -------
    dict
        NarrativeEntry dict with ``source="rule_based"``.
    """
    regime = regime_state.get("regimeMode", "mixed")
    confidence = regime_state.get("confidence", 0.0)
    description = regime_state.get("regimeDescription", regime)
    scores = regime_state.get("scores", {})
    drivers = regime_state.get("dominantDrivers", [])
    evidence = regime_state.get("supportingEvidence", [])
    watch_levels = regime_state.get("watchLevels", [])
    invalidation = regime_state.get("invalidationConditions", [])
    session_lbl = session_label(session)

    # Build asset change strings
    asset_lines = []
    for asset in market_snapshot.get("assets", []):
        key = asset.get("key", "")
        label = asset.get("label", key)
        val = asset.get("value")
        pct = asset.get("pctVsClose")
        if val is not None:
            pct_str = f" ({pct:+.2f}% vs close)" if pct is not None else ""
            asset_lines.append(f"{label}: {val:,.4g}{pct_str}")

    assets_summary = "; ".join(asset_lines) if asset_lines else "Asset data unavailable"

    headline = f"[{session_lbl}] {description}"

    dominant_story = (
        f"Regime classification: {regime} (confidence {confidence:.0%}). "
        f"{description}. "
        + (f"Primary drivers: {'; '.join(drivers[:2])}." if drivers else "")
    )

    cross_asset = []
    if evidence:
        cross_asset = evidence[:3]
    else:
        cross_asset = [assets_summary]

    what_changed_since = []
    significant_moves = what_changed.get("significantMoves", [])
    for move in significant_moves[:4]:
        what_changed_since.append(str(move))
    if not what_changed_since:
        what_changed_since = ["No significant changes detected since last checkpoint"]

    # Operator posture from regime
    posture_map = {
        "risk_on":            "Constructive — lean into risk with liquidity support; watch breadth for cracks",
        "risk_off":           "Defensive — reduce exposure to cyclicals; prioritize volatility management",
        "inflation_shock":    "Inflation hedge — commodities and real assets; underweight duration risk",
        "dollar_stress":      "Dollar-aware — hedge USD exposure; watch EM and commodity stress",
        "liquidity_expansion":"Carry-friendly — risk assets supported; watch for crowding reversal",
        "crypto_speculation": "Selective crypto exposure — momentum-driven; tight stops given volatility",
        "growth_scare":       "De-risk — defensive sectors, cash; wait for stabilization before re-entry",
        "mixed":              "Neutral — reduce conviction bets; size positions smaller pending clarity",
    }
    operator_posture = posture_map.get(regime, "Neutral — await clearer regime signal")

    watch_next = watch_levels[:3] if watch_levels else ["Monitor VIX, SPX, and 10Y yield for regime confirmation"]

    confidence_commentary = (
        f"Rule-based confidence: {confidence:.0%}. "
        f"Score spread suggests {'strong' if confidence >= 0.7 else 'moderate' if confidence >= 0.4 else 'low'} conviction. "
        f"{'Multiple dimensions aligned.' if confidence >= 0.6 else 'Signals partially contradictory — treat regime with caution.'}"
    )

    uncertainty_flags = []
    if confidence < 0.4:
        uncertainty_flags.append("Low confidence — regime classification may shift on next checkpoint")
    if regime == "mixed":
        uncertainty_flags.append("No dominant regime — cross-asset signals contradictory")
    vol_stress = scores.get("volatilityStress", 0)
    if vol_stress >= 1:
        uncertainty_flags.append("Elevated volatility increases path uncertainty on all price targets")
    if not uncertainty_flags:
        uncertainty_flags = ["Standard model uncertainty applies — invalidation levels above are operative"]

    return {
        "session": session,
        "sessionLabel": session_lbl,
        "timestamp": to_iso(now_et()),
        "regimeMode": regime,
        "confidence": confidence,
        "source": "rule_based",
        "headline": headline,
        "dominantStory": dominant_story,
        "crossAssetConnections": cross_asset,
        "whatChangedSinceLastReport": what_changed_since,
        "operatorPosture": operator_posture,
        "watchNext": watch_next,
        "confidenceCommentary": confidence_commentary,
        "uncertaintyFlags": uncertainty_flags,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_json(text: str) -> Optional[dict]:
    """
    Extract a JSON object from a text string.

    Handles responses that wrap JSON in markdown code fences.
    """
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    for fence in ("```json", "```"):
        if fence in text:
            start = text.find(fence) + len(fence)
            end = text.rfind("```")
            if end > start:
                candidate = text[start:end].strip()
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

    # Try to find a JSON object by braces
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return None


def _normalize_narrative_entry(data: dict, payload: dict) -> dict:
    """Ensure all required NarrativeEntry fields are present."""
    meta = payload.get("meta", {})
    required_lists = [
        "crossAssetConnections",
        "whatChangedSinceLastReport",
        "watchNext",
        "uncertaintyFlags",
    ]
    for field in required_lists:
        if not isinstance(data.get(field), list):
            data[field] = []

    required_strings = [
        "headline", "dominantStory", "operatorPosture",
        "confidenceCommentary",
    ]
    for field in required_strings:
        if not isinstance(data.get(field), str):
            data[field] = ""

    # Inject metadata
    data.setdefault("session", meta.get("session", ""))
    data.setdefault("sessionLabel", session_label(meta.get("session", "")))
    data.setdefault("timestamp", to_iso(now_et()))
    data.setdefault("regimeMode", meta.get("regime_mode", "mixed"))
    data.setdefault("confidence", 0.0)

    return data


def _fallback_from_payload(payload: dict) -> dict:
    """
    Build a minimal rule-based NarrativeEntry from a prompt payload.

    Used when the AI call fails and we only have the payload dict available
    (not the full structured objects).
    """
    meta = payload.get("meta", {})
    session = meta.get("session", "")
    regime = meta.get("regime_mode", "mixed")
    timestamp = meta.get("timestamp", to_iso(now_et()))

    return {
        "session": session,
        "sessionLabel": session_label(session),
        "timestamp": timestamp,
        "regimeMode": regime,
        "confidence": 0.0,
        "source": "rule_based_fallback",
        "headline": f"[{session_label(session)}] Regime: {regime} — AI narration unavailable",
        "dominantStory": f"Rule-based classification: {regime}. AI narration could not be generated this cycle.",
        "crossAssetConnections": ["Cross-asset analysis unavailable — review market-snapshot.json directly"],
        "whatChangedSinceLastReport": ["Delta analysis unavailable — compare snapshots manually"],
        "operatorPosture": "Neutral — insufficient data for posture recommendation",
        "watchNext": ["Review market-snapshot.json and regime-state.json for current levels"],
        "confidenceCommentary": "Confidence unavailable — AI narration failed, rule-based fallback active",
        "uncertaintyFlags": ["AI narration unavailable this cycle — rule-based fallback active"],
    }
