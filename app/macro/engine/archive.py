"""
archive.py — Archive rotation for the FORTIFYOS Macro Intel Engine.

Runs at 2:59 AM ET (before the 03:00 global_markets checkpoint) to:
1. Archive the previous day's log to data/archive/YYYY-MM-DD.json.
2. Update archive-index.json.
3. Reset today-log.json for the new day (empty entries, new date, status: "active").

market-snapshot.json and regime-state.json are left in place as prior references
for the new day's first run.
"""

from __future__ import annotations

import logging
import os
from datetime import timedelta
from typing import Optional

from .utils import (
    load_json,
    save_json,
    today_et,
    to_iso,
    now_et,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

# Live output dir — relative to project root; callers may override.
DATA_DIR = "public/macro-intel"

# Internal engine data dir for archives (next to this file's package).
_ENGINE_DATA_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "data")
)
_ARCHIVE_SUBDIR = os.path.join(_ENGINE_DATA_DIR, "archive")
_ARCHIVE_INDEX_PATH = os.path.join(_ENGINE_DATA_DIR, "archive-index.json")

# Maximum items retained in the rolling archive index.
ARCHIVE_INDEX_MAX = 90

_TODAY_LOG_FILE = "today-log.json"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def finalize_day(data_dir: str = DATA_DIR) -> dict:
    """
    Archive the previous day's log and reset today-log.json for the new day.

    Steps:
      1. Read today-log.json.
      2. Validate it has entries and that its ``date`` field matches the prior
         calendar day (i.e. this function was called after midnight ET).
      3. Write archived copy to ``data/archive/YYYY-MM-DD.json``
         with ``status: "archived"``.
      4. Update ``data/archive-index.json`` with a new ArchiveIndexItem.
      5. Reset ``today-log.json`` for the new day:
         empty entries, today's date, ``status: "active"``.
      6. Leave ``market-snapshot.json`` and ``regime-state.json`` in place
         as prior reference for the 03:00 run.

    Parameters
    ----------
    data_dir:
        Directory where the live output files (today-log.json, etc.) live.
        Defaults to ``public/macro-intel``.

    Returns
    -------
    dict
        Summary: ``{"archived_date", "entry_count", "archive_path"}``.

    Raises
    ------
    ArchiveError
        If any step that would compromise data integrity fails.
        The caller MUST catch this and NOT reset the live log.
    """
    log_path = os.path.join(data_dir, _TODAY_LOG_FILE)
    existing_log = load_json(log_path, default=None)

    if existing_log is None:
        raise ArchiveError(
            f"finalize_day: today-log.json not found at {log_path}"
        )

    entries: list = existing_log.get("entries", [])
    log_date_str: str = existing_log.get("date", "")

    # The prior calendar day (the day we intend to archive)
    today = today_et()
    prior_day = today - timedelta(days=1)
    prior_day_str = prior_day.isoformat()

    if log_date_str != prior_day_str:
        raise ArchiveError(
            f"finalize_day: log date {log_date_str!r} does not match expected "
            f"prior day {prior_day_str!r}. Refusing to archive to avoid data loss."
        )

    if not entries:
        logger.warning(
            "finalize_day: today-log for %s has no entries; archiving empty log",
            log_date_str,
        )

    # --- Step 3: Write archived copy ---
    os.makedirs(_ARCHIVE_SUBDIR, exist_ok=True)
    archive_path = os.path.join(_ARCHIVE_SUBDIR, f"{log_date_str}.json")

    archived_log = dict(existing_log)
    archived_log["status"] = "archived"
    archived_log["archivedAt"] = to_iso(now_et())

    ok = save_json(archive_path, archived_log)
    if not ok:
        raise ArchiveError(
            f"finalize_day: failed to write archive file {archive_path}"
        )
    logger.info("finalize_day: archived %s → %s", log_date_str, archive_path)

    # --- Step 4: Update archive-index.json ---
    _update_archive_index(
        archived_log=archived_log,
        date_str_val=log_date_str,
        archive_path=archive_path,
    )

    # --- Step 5: Reset today-log.json for the new day ---
    new_log = _new_daily_log(today.isoformat())
    reset_ok = save_json(log_path, new_log)
    if not reset_ok:
        # Archive succeeded — do NOT raise here so we don't re-archive.
        # Log loudly; operator must manually reset the log.
        logger.error(
            "finalize_day: archive succeeded but failed to reset %s. "
            "Manual intervention required to reset today-log.json.",
            log_path,
        )
    else:
        logger.info(
            "finalize_day: reset today-log.json for new day %s",
            today.isoformat(),
        )

    return {
        "archived_date": log_date_str,
        "entry_count": len(entries),
        "archive_path": archive_path,
    }


# ---------------------------------------------------------------------------
# Archive index helpers
# ---------------------------------------------------------------------------


def _update_archive_index(
    archived_log: dict,
    date_str_val: str,
    archive_path: str,
) -> None:
    """
    Add or refresh an ArchiveIndexItem in archive-index.json.

    Parameters
    ----------
    archived_log:
        The archived DailyLog dict (already written to disk).
    date_str_val:
        ISO date string for the archived day.
    archive_path:
        Absolute path to the archived JSON file.
    """
    index: list = load_json(_ARCHIVE_INDEX_PATH, default=[])
    if not isinstance(index, list):
        logger.warning("_update_archive_index: index was not a list; resetting to []")
        index = []

    # Remove any existing entry for this date
    index = [item for item in index if item.get("date") != date_str_val]

    entries: list = archived_log.get("entries", [])

    # Collect regime modes and dominant drivers from all entries in the log
    regime_modes: list[str] = [e.get("regimeMode", "mixed") for e in entries if e.get("regimeMode")]
    # Most common regime mode for the day
    day_regime = _most_common(regime_modes) if regime_modes else "mixed"

    drivers: list[str] = []
    for entry in entries:
        drivers.extend(entry.get("dominantDrivers", []))

    # De-duplicate drivers preserving first-occurrence order
    seen: set[str] = set()
    unique_drivers: list[str] = []
    for d in drivers:
        if d not in seen:
            seen.add(d)
            unique_drivers.append(d)

    new_item: dict = {
        "date": date_str_val,
        "regimeMode": day_regime,
        "dominantDrivers": unique_drivers[:5],
        "entryCount": len(entries),
        "archivePath": archive_path,
        "archivedAt": to_iso(now_et()),
        "status": "archived",
    }

    index.append(new_item)

    # Sort most-recent first
    index.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Trim rolling window
    if len(index) > ARCHIVE_INDEX_MAX:
        index = index[:ARCHIVE_INDEX_MAX]

    ok = save_json(_ARCHIVE_INDEX_PATH, index)
    if ok:
        logger.info(
            "_update_archive_index: updated index — %s (%d entries), index size %d",
            date_str_val, len(entries), len(index),
        )
    else:
        logger.error(
            "_update_archive_index: failed to write index at %s", _ARCHIVE_INDEX_PATH
        )


def load_archive_index() -> list:
    """
    Return the archive index list, most-recent first.

    Returns an empty list if the index file does not exist.
    """
    index = load_json(_ARCHIVE_INDEX_PATH, default=[])
    return index if isinstance(index, list) else []


def load_archived_day(date_str_val: str) -> Optional[dict]:
    """
    Load a specific archived DailyLog.

    Parameters
    ----------
    date_str_val:
        ISO date string, e.g. ``"2026-03-09"``.

    Returns
    -------
    dict or None
        The archived DailyLog, or None if not found.
    """
    path = os.path.join(_ARCHIVE_SUBDIR, f"{date_str_val}.json")
    return load_json(path, default=None)


# ---------------------------------------------------------------------------
# Internal factories
# ---------------------------------------------------------------------------


def _new_daily_log(date_val: str) -> dict:
    """Create an empty DailyLog dict for *date_val* (ISO date string)."""
    return {
        "date": date_val,
        "status": "active",
        "entries": [],
        "entryCount": 0,
        "lastUpdated": to_iso(now_et()),
    }


def _most_common(items: list) -> str:
    """Return the most frequently occurring item in *items*."""
    from collections import Counter
    if not items:
        return "mixed"
    counter = Counter(items)
    return counter.most_common(1)[0][0]


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------


class ArchiveError(RuntimeError):
    """
    Raised when archive finalization fails in a data-integrity-critical way.

    Callers MUST catch this and NOT reset the live log file.
    """
    pass
