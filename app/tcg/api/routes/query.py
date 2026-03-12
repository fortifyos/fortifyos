from __future__ import annotations

import json

from fastapi import APIRouter

from app.tcg.config import CONFIG


router = APIRouter()


def _matches(signal: dict, query: str) -> bool:
    q = query.lower()
    if signal.get("franchise", "").lower() in q:
        return True
    if signal.get("region_lead", "").lower() in q:
        return True
    if any(tag.replace("_", " ") in q or tag in q for tag in signal.get("query_tags", [])):
        return True
    if "promo" in q and signal.get("entity_type") == "promo":
        return True
    if "sealed" in q and signal.get("entity_type") == "sealed":
        return True
    return False


@router.post("/query")
def query_feed(payload: dict):
    query = str(payload.get("query", "")).strip()
    latest = json.loads((CONFIG.data_root / "latest.json").read_text())
    signals = latest.get("top_signals", [])
    results = [signal for signal in signals if _matches(signal, query)] if query else signals
    return {"results": results[:12]}

