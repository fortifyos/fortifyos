"""
utils.py — Utility helpers for the FORTIFYOS Macro Intel Engine.

Provides timezone handling (America/New_York), ISO timestamp formatting,
atomic file I/O, and safe JSON load/save.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import date, datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timezone
# ---------------------------------------------------------------------------

ET_ZONE = ZoneInfo("America/New_York")


def now_et() -> datetime:
    """Return the current datetime in the America/New_York timezone."""
    return datetime.now(tz=ET_ZONE)


def today_et() -> date:
    """Return today's date in the America/New_York timezone."""
    return now_et().date()


def to_iso(dt: datetime) -> str:
    """
    Format a datetime as an ISO 8601 string with timezone offset.

    Parameters
    ----------
    dt:
        The datetime to format.  If it is naive (no tzinfo) it is assumed
        to be in Eastern Time.

    Returns
    -------
    str
        e.g. "2026-03-10T08:00:00-05:00"
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ET_ZONE)
    return dt.isoformat()


def parse_iso(ts: str) -> datetime:
    """
    Parse an ISO 8601 timestamp string into a timezone-aware datetime.

    Parameters
    ----------
    ts:
        ISO 8601 string, e.g. "2026-03-10T08:00:00-05:00".

    Returns
    -------
    datetime
        Timezone-aware datetime object.
    """
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ET_ZONE)
    return dt


# ---------------------------------------------------------------------------
# Atomic file I/O
# ---------------------------------------------------------------------------


def safe_read_file(path: str) -> Optional[str]:
    """
    Read the entire content of a file as a string.

    Returns ``None`` if the file does not exist or cannot be read.

    Parameters
    ----------
    path:
        Absolute or relative path to the file.
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None
    except OSError as exc:
        logger.error("safe_read_file: failed to read %s: %s", path, exc)
        return None


def safe_write_file(path: str, content: str) -> bool:
    """
    Write *content* to *path* atomically via a temporary file.

    The write is first made to a sibling temp file in the same directory,
    then renamed over the target path so that readers never see a
    partially-written file.

    Parameters
    ----------
    path:
        Destination file path.
    content:
        String content to write (UTF-8).

    Returns
    -------
    bool
        ``True`` on success, ``False`` on failure.
    """
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    try:
        fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".tmp_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(content)
            os.replace(tmp_path, path)
        except Exception:
            # Clean up the temp file if the write or rename failed.
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
        return True
    except OSError as exc:
        logger.error("safe_write_file: failed to write %s: %s", path, exc)
        return False


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------


def load_json(path: str, default: Any = None) -> Any:
    """
    Load and return JSON from *path*.

    Parameters
    ----------
    path:
        File path to read.
    default:
        Value returned when the file does not exist or cannot be parsed.
        Defaults to ``None``.

    Returns
    -------
    Any
        Parsed JSON value, or *default* on error.
    """
    raw = safe_read_file(path)
    if raw is None:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("load_json: invalid JSON in %s: %s", path, exc)
        return default


def save_json(path: str, data: Any, indent: int = 2) -> bool:
    """
    Serialize *data* to JSON and write it atomically to *path*.

    Parameters
    ----------
    path:
        Destination file path.
    data:
        JSON-serialisable Python object.
    indent:
        Indentation level for pretty-printing.  Defaults to 2.

    Returns
    -------
    bool
        ``True`` on success, ``False`` on failure.
    """
    try:
        content = json.dumps(data, indent=indent, ensure_ascii=False, default=str)
    except (TypeError, ValueError) as exc:
        logger.error("save_json: serialization error for %s: %s", path, exc)
        return False
    return safe_write_file(path, content + "\n")


# ---------------------------------------------------------------------------
# Miscellaneous date helpers
# ---------------------------------------------------------------------------


def date_str(d: Optional[date] = None) -> str:
    """
    Return an ISO date string (YYYY-MM-DD) for *d*, defaulting to today ET.

    Parameters
    ----------
    d:
        Date to format.  Defaults to :func:`today_et`.
    """
    if d is None:
        d = today_et()
    return d.isoformat()


def timestamp_label(dt: Optional[datetime] = None) -> str:
    """
    Return a human-readable ET timestamp label suitable for log output.

    Example: "2026-03-10 08:00 ET"

    Parameters
    ----------
    dt:
        Datetime to format.  Defaults to :func:`now_et`.
    """
    if dt is None:
        dt = now_et()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ET_ZONE)
    return dt.strftime("%Y-%m-%d %H:%M ET")
