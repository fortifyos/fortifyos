from __future__ import annotations

import re

from fastapi import APIRouter

from app.tcg.api.store import load_latest_payload


router = APIRouter()


def _extract_price_cap(query: str) -> int | None:
    match = re.search(r"under\s+\$?(\d+)", query)
    return int(match.group(1)) if match else None


def _matches(signal: dict, query: str, price_cap: int | None) -> bool:
    q = query.lower()
    haystack = " ".join(
        [
            signal.get("entity_name", ""),
            signal.get("franchise", ""),
            signal.get("entity_type", ""),
            signal.get("region_lead", ""),
            signal.get("action_state", ""),
            *signal.get("signal_types", []),
            *signal.get("query_tags", []),
        ]
    ).lower()

    if "japanese" in q or "jp" in q:
        if signal.get("region_lead", "").lower() != "jp":
            return False
    if "promo" in q and signal.get("entity_type") != "promo":
        return False
    if "sealed" in q and signal.get("entity_type") != "sealed":
        return False
    if "high confidence" in q and float(signal.get("confidence_score", 0)) < 70:
        return False
    if "low risk" in q and float(signal.get("risk_score", 100)) > 45:
        return False
    if "rising attention" in q:
        attention_score = float(signal.get("metrics", {}).get("attention_velocity_score", 0))
        creator_score = float(signal.get("metrics", {}).get("creator_acceleration_score", 0))
        if max(attention_score, creator_score) < 20:
            return False
    if "underpriced" in q or "guide lag" in q:
        if float(signal.get("metrics", {}).get("guide_dislocation_score", 0)) < 20:
            return False
    if "japanese promos" in q and not (
        signal.get("entity_type") == "promo" and signal.get("region_lead", "").lower() == "jp"
    ):
        return False
    if "shrinking listings" in q and float(signal.get("metrics", {}).get("listing_depletion_score", 0)) < 30:
        return False
    if price_cap is not None:
        price_candidates = [
            signal.get("metrics", {}).get("pricecharting_price"),
            signal.get("metrics", {}).get("ebay_sold_median"),
            signal.get("metrics", {}).get("tcgplayer_market"),
        ]
        numeric = [float(value) for value in price_candidates if isinstance(value, (int, float))]
        if numeric and min(numeric) > price_cap:
            return False

    ignored_tokens = {
        "show", "find", "with", "and", "under", "high", "low", "japanese", "jp", "promos", "promo",
        "rising", "attention", "sealed", "shrinking", "listings", "underpriced", "guide", "lag",
        "products", "product", "signals", "signal", "confidence", "risk",
    }
    tokens = [
        token for token in re.split(r"\s+", q)
        if token and token not in ignored_tokens and not token.startswith("$")
    ]
    if not tokens:
        return True
    return all(token in haystack or token.isdigit() for token in tokens)


@router.post("/query")
def query_feed(payload: dict):
    query = str(payload.get("query", "")).strip()
    latest = load_latest_payload()
    signals = latest.get("top_signals", [])
    price_cap = _extract_price_cap(query.lower())
    if not query:
        results = signals
    else:
        results = [signal for signal in signals if _matches(signal, query, price_cap)]
    return {"results": results[:12], "count": len(results)}
