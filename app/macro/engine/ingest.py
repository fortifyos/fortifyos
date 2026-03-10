"""
ingest.py — Data ingestion for the FORTIFYOS Macro Intel Engine.

Reads the existing FORTIFYOS public/macro.json data file and transforms it
into typed snapshot dicts consumed by the rest of the engine.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from .utils import load_json, to_iso, now_et

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MACRO_JSON_REL = os.path.join("public", "macro.json")

# Assets tracked in every market snapshot.
# Each entry: (asset_key, human_label, macro_json_path, value_key)
# macro_json_path is a dot-separated path into the macro.json structure.
_ASSET_MAP: list[tuple[str, str, str, str]] = [
    ("spx",  "S&P 500",           "indices.spx",         "price"),
    ("btc",  "Bitcoin",            "crypto.btc",          "price"),
    ("vix",  "CBOE VIX",          "volatility.vix",      "value"),
    ("gold", "Gold (XAU/USD)",     "commodities.gold",    "price"),
    ("wti",  "WTI Crude Oil",      "commodities.wti",     "price"),
    ("dxy",  "US Dollar Index",    "forex.dxy",           "value"),
    ("tnx",  "10Y Treasury Yield", "rates.tnx",           "yield"),
]

# Impact tag thresholds (pct change vs prior close)
_IMPACT_THRESHOLDS = [
    (2.0,  "strongly_bullish"),
    (0.75, "bullish"),
    (-0.75, "neutral"),
    (-2.0,  "bearish"),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_macro_json(base_path: str) -> dict:
    """
    Load and return the FORTIFYOS macro.json data file.

    Parameters
    ----------
    base_path:
        Root of the project (the directory that contains ``public/``).

    Returns
    -------
    dict
        Parsed macro.json content, or an empty dict on failure.
    """
    path = os.path.join(base_path, MACRO_JSON_REL)
    data = load_json(path, default={})
    if not data:
        logger.warning("load_macro_json: macro.json not found or empty at %s", path)
    return data or {}


def build_asset_snapshot(
    key: str,
    label: str,
    macro_data: dict,
    macro_path: str,
    value_key: str,
    prior_snapshot: Optional[dict] = None,
) -> dict:
    """
    Build a single AssetSnapshot dict.

    Parameters
    ----------
    key:
        Asset identifier, e.g. ``"spx"``.
    label:
        Human-readable name, e.g. ``"S&P 500"``.
    macro_data:
        Full parsed macro.json dict.
    macro_path:
        Dot-separated path into *macro_data* to find the asset sub-dict,
        e.g. ``"indices.spx"``.
    value_key:
        Key inside the asset sub-dict that holds the current numeric value,
        e.g. ``"price"`` or ``"yield"``.
    prior_snapshot:
        Previous MarketSnapshot dict (from last engine run).  Used to
        compute ``changeSinceLast`` / ``pctSinceLast``.

    Returns
    -------
    dict
        AssetSnapshot with fields: key, label, value, changeSinceLast,
        pctSinceLast, changeVsClose, pctVsClose, impactTag, meta.
    """
    asset_data = _deep_get(macro_data, macro_path)
    value: Optional[float] = None
    close: Optional[float] = None
    meta: dict = {}

    if isinstance(asset_data, dict):
        raw_val = asset_data.get(value_key)
        value = _to_float(raw_val)
        close = _to_float(asset_data.get("previousClose") or asset_data.get("close"))
        # Capture any extra metadata fields present in macro.json
        for k, v in asset_data.items():
            if k not in (value_key, "previousClose", "close"):
                meta[k] = v
    elif isinstance(asset_data, (int, float)):
        value = float(asset_data)

    # Deltas vs prior engine run
    change_since_last: Optional[float] = None
    pct_since_last: Optional[float] = None
    prior_value: Optional[float] = None

    if prior_snapshot:
        prior_assets: list[dict] = prior_snapshot.get("assets", [])
        for pa in prior_assets:
            if pa.get("key") == key:
                prior_value = _to_float(pa.get("value"))
                break

    if value is not None and prior_value is not None:
        change_since_last = round(value - prior_value, 6)
        pct_since_last = _safe_pct(change_since_last, prior_value)

    # Deltas vs prior session close
    change_vs_close: Optional[float] = None
    pct_vs_close: Optional[float] = None
    if value is not None and close is not None:
        change_vs_close = round(value - close, 6)
        pct_vs_close = _safe_pct(change_vs_close, close)

    impact_tag = _compute_impact_tag(pct_vs_close)

    return {
        "key": key,
        "label": label,
        "value": value,
        "changeSinceLast": change_since_last,
        "pctSinceLast": pct_since_last,
        "changeVsClose": change_vs_close,
        "pctVsClose": pct_vs_close,
        "impactTag": impact_tag,
        "meta": meta,
    }


def build_market_snapshot(
    session: str,
    macro_data: dict,
    prior_snapshot: Optional[dict] = None,
) -> dict:
    """
    Build a full MarketSnapshot dict for all tracked assets.

    Parameters
    ----------
    session:
        Active session key, e.g. ``"pre_market"``.
    macro_data:
        Full parsed macro.json content.
    prior_snapshot:
        Previous MarketSnapshot for delta computation.  May be ``None``.

    Returns
    -------
    dict
        MarketSnapshot with ``session``, ``timestamp``, and ``assets`` list.
        Missing assets are included with ``value=None`` and
        ``impactTag="neutral"``.
    """
    timestamp = to_iso(now_et())
    assets: list[dict] = []

    for asset_key, asset_label, macro_path, value_key in _ASSET_MAP:
        try:
            snap = build_asset_snapshot(
                key=asset_key,
                label=asset_label,
                macro_data=macro_data,
                macro_path=macro_path,
                value_key=value_key,
                prior_snapshot=prior_snapshot,
            )
        except Exception as exc:
            logger.warning(
                "build_market_snapshot: error building snapshot for %s: %s",
                asset_key, exc,
            )
            snap = _null_asset(asset_key, asset_label)
        assets.append(snap)

    return {
        "session": session,
        "timestamp": timestamp,
        "assets": assets,
    }


def get_asset(market_snapshot: dict, key: str) -> Optional[dict]:
    """Return the AssetSnapshot for *key* from a MarketSnapshot, or None."""
    for asset in market_snapshot.get("assets", []):
        if asset.get("key") == key:
            return asset
    return None


def get_value(market_snapshot: dict, key: str) -> Optional[float]:
    """Return the numeric value for asset *key* from a MarketSnapshot."""
    asset = get_asset(market_snapshot, key)
    if asset:
        return _to_float(asset.get("value"))
    return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _deep_get(data: dict, path: str) -> Any:
    """
    Traverse *data* using a dot-separated *path*.

    Returns ``None`` if any intermediate key is missing.
    """
    parts = path.split(".")
    current: Any = data
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _to_float(value: Any) -> Optional[float]:
    """Convert *value* to float, returning None on failure."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_pct(change: Optional[float], base: Optional[float]) -> Optional[float]:
    """Compute percentage change, returning None if inputs are invalid."""
    if change is None or base is None or base == 0:
        return None
    return round((change / abs(base)) * 100, 4)


def _compute_impact_tag(pct_vs_close: Optional[float]) -> str:
    """
    Map a percentage change to a qualitative impact tag.

    Uses :data:`_IMPACT_THRESHOLDS` which is ordered highest first.
    Falls back to ``"neutral"`` when *pct_vs_close* is None.
    """
    if pct_vs_close is None:
        return "neutral"
    # Iterate thresholds from largest to smallest
    thresholds = [
        (2.0,  "strongly_bullish"),
        (0.75, "bullish"),
        (-0.75, "neutral"),
        (-2.0,  "bearish"),
    ]
    for threshold, tag in thresholds:
        if pct_vs_close >= threshold:
            return tag
    return "strongly_bearish"


def _null_asset(key: str, label: str) -> dict:
    """Return an AssetSnapshot with all numeric fields set to None."""
    return {
        "key": key,
        "label": label,
        "value": None,
        "changeSinceLast": None,
        "pctSinceLast": None,
        "changeVsClose": None,
        "pctVsClose": None,
        "impactTag": "neutral",
        "meta": {},
    }
