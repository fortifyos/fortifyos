"""
publish.py — Output file writing for the FORTIFYOS Macro Intel Engine.

Writes market snapshots, regime state, and the rolling daily log to the
FORTIFYOS public/macro-intel/ directory.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .utils import load_json, save_json, today_et, to_iso, now_et, date_str

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = "public/macro-intel"

# File names within DATA_DIR
_MARKET_SNAPSHOT_FILE = "market-snapshot.json"
_REGIME_STATE_FILE    = "regime-state.json"
_TODAY_LOG_FILE       = "today-log.json"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_path(filename: str, data_dir: str) -> str:
    """Return the absolute path for *filename* inside *data_dir*."""
    return os.path.join(data_dir, filename)


def _ensure_dir(data_dir: str) -> None:
    """Create *data_dir* (and parents) if it does not exist."""
    os.makedirs(data_dir, exist_ok=True)


# ---------------------------------------------------------------------------
# Individual write functions
# ---------------------------------------------------------------------------


def write_market_snapshot(market_snapshot: dict, data_dir: str = DATA_DIR) -> bool:
    """
    Write the current MarketSnapshot to ``market-snapshot.json``.

    Parameters
    ----------
    market_snapshot:
        MarketSnapshot dict to persist.
    data_dir:
        Directory where output files live.

    Returns
    -------
    bool
        ``True`` on success.
    """
    _ensure_dir(data_dir)
    path = _resolve_path(_MARKET_SNAPSHOT_FILE, data_dir)
    ok = save_json(path, market_snapshot)
    if ok:
        logger.info("write_market_snapshot: wrote %s", path)
    else:
        logger.error("write_market_snapshot: failed to write %s", path)
    return ok


def write_regime_state(regime_state: dict, data_dir: str = DATA_DIR) -> bool:
    """
    Write the current RegimeState to ``regime-state.json``.

    Parameters
    ----------
    regime_state:
        RegimeState dict to persist.
    data_dir:
        Directory where output files live.

    Returns
    -------
    bool
        ``True`` on success.
    """
    _ensure_dir(data_dir)
    path = _resolve_path(_REGIME_STATE_FILE, data_dir)
    ok = save_json(path, regime_state)
    if ok:
        logger.info("write_regime_state: wrote %s", path)
    else:
        logger.error("write_regime_state: failed to write %s", path)
    return ok


def write_today_log(daily_log: dict, data_dir: str = DATA_DIR) -> bool:
    """
    Write (overwrite) the complete DailyLog to ``today-log.json``.

    Parameters
    ----------
    daily_log:
        DailyLog dict to persist.
    data_dir:
        Directory where output files live.

    Returns
    -------
    bool
        ``True`` on success.
    """
    _ensure_dir(data_dir)
    path = _resolve_path(_TODAY_LOG_FILE, data_dir)
    ok = save_json(path, daily_log)
    if ok:
        logger.info("write_today_log: wrote %s (%d entries)", path, len(daily_log.get("entries", [])))
    else:
        logger.error("write_today_log: failed to write %s", path)
    return ok


def append_entry_to_log(entry: dict, data_dir: str = DATA_DIR) -> dict:
    """
    Append a NarrativeEntry to today's log and persist it.

    If ``today-log.json`` does not exist, or its ``date`` field does not match
    today ET, a fresh log is created before appending.

    Parameters
    ----------
    entry:
        NarrativeEntry dict to append.
    data_dir:
        Directory where output files live.

    Returns
    -------
    dict
        The updated DailyLog dict.
    """
    _ensure_dir(data_dir)
    path = _resolve_path(_TODAY_LOG_FILE, data_dir)
    today = date_str()

    existing = load_json(path, default=None)

    if existing is None or existing.get("date") != today:
        # Start a fresh log for today
        if existing is not None:
            logger.info(
                "append_entry_to_log: date mismatch (log=%s, today=%s); creating new log",
                existing.get("date"),
                today,
            )
        daily_log = _new_daily_log(today)
    else:
        daily_log = existing

    daily_log.setdefault("entries", [])
    daily_log["entries"].append(entry)
    daily_log["lastUpdated"] = to_iso(now_et())
    daily_log["entryCount"] = len(daily_log["entries"])

    write_today_log(daily_log, data_dir)
    return daily_log


def load_today_log(data_dir: str = DATA_DIR) -> Optional[dict]:
    """
    Load today's DailyLog from ``today-log.json``.

    Returns ``None`` if the file does not exist or the date does not match
    today ET.

    Parameters
    ----------
    data_dir:
        Directory where output files live.
    """
    path = _resolve_path(_TODAY_LOG_FILE, data_dir)
    existing = load_json(path, default=None)
    if existing is None:
        return None
    today = date_str()
    if existing.get("date") != today:
        logger.debug(
            "load_today_log: date mismatch (log=%s, today=%s)",
            existing.get("date"), today,
        )
        return None
    return existing


def load_market_snapshot(data_dir: str = DATA_DIR) -> Optional[dict]:
    """
    Load the current MarketSnapshot from ``market-snapshot.json``.

    Returns ``None`` if the file does not exist.
    """
    path = _resolve_path(_MARKET_SNAPSHOT_FILE, data_dir)
    return load_json(path, default=None)


def load_regime_state(data_dir: str = DATA_DIR) -> Optional[dict]:
    """
    Load the current RegimeState from ``regime-state.json``.

    Returns ``None`` if the file does not exist.
    """
    path = _resolve_path(_REGIME_STATE_FILE, data_dir)
    return load_json(path, default=None)


# ---------------------------------------------------------------------------
# Composite publish
# ---------------------------------------------------------------------------


def publish_run(
    market_snapshot: dict,
    regime_state: dict,
    entry: dict,
    data_dir: str = DATA_DIR,
) -> dict:
    """
    Publish all outputs for a single engine run.

    1. Write updated market snapshot.
    2. Write updated regime state.
    3. Append the NarrativeEntry to today's log.

    Parameters
    ----------
    market_snapshot:
        Current MarketSnapshot dict.
    regime_state:
        Current RegimeState dict.
    entry:
        NarrativeEntry to append to today's log.
    data_dir:
        Directory where output files live.

    Returns
    -------
    dict
        The updated DailyLog dict after appending the entry.
    """
    write_market_snapshot(market_snapshot, data_dir)
    write_regime_state(regime_state, data_dir)
    daily_log = append_entry_to_log(entry, data_dir)
    logger.info(
        "publish_run: complete — session=%s regime=%s confidence=%.2f",
        entry.get("session", "?"),
        entry.get("regimeMode", "?"),
        entry.get("confidence", 0.0),
    )
    return daily_log


# ---------------------------------------------------------------------------
# Internal factory
# ---------------------------------------------------------------------------


def _new_daily_log(date_str_val: str) -> dict:
    """Create an empty DailyLog dict for *date_str_val*."""
    return {
        "date": date_str_val,
        "status": "active",
        "entries": [],
        "entryCount": 0,
        "lastUpdated": to_iso(now_et()),
    }
