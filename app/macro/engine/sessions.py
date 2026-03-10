"""
sessions.py — Session definitions and resolution for the FORTIFYOS Macro Intel Engine.

Defines the four daily macro checkpoints and provides helpers to resolve the
current session, compute the next scheduled run, and produce human-readable
session labels.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

ET_ZONE = ZoneInfo("America/New_York")

# ---------------------------------------------------------------------------
# Session schedule
# ---------------------------------------------------------------------------

# Maps session key -> scheduled wall-clock start time in ET (HH:MM, 24-hour).
SESSIONS: dict[str, str] = {
    "global_markets": "03:00",
    "pre_market": "08:00",
    "mid_session": "14:00",
    "evening_wrap": "21:00",
}

# Ordered list of (hour, minute, key) for schedule arithmetic.
_SCHEDULE: list[tuple[int, int, str]] = sorted(
    [
        (int(t.split(":")[0]), int(t.split(":")[1]), k)
        for k, t in SESSIONS.items()
    ],
    key=lambda x: (x[0], x[1]),
)

# Human-readable labels.
_LABELS: dict[str, str] = {
    "global_markets": "Global Markets Open (03:00 ET)",
    "pre_market": "Pre-Market (08:00 ET)",
    "mid_session": "Mid-Session (14:00 ET)",
    "evening_wrap": "Evening Wrap (21:00 ET)",
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def resolve_session(dt_et: datetime) -> str:
    """
    Return the session key that is active at *dt_et*.

    The session is chosen as the most-recently-passed checkpoint for the
    given ET datetime.  Before the first checkpoint of the day (03:00) the
    function returns the previous day's last session (``"evening_wrap"``).

    Parameters
    ----------
    dt_et:
        A timezone-aware (or naive, treated as ET) datetime.

    Returns
    -------
    str
        One of the keys in :data:`SESSIONS`.
    """
    dt_et = _ensure_et(dt_et)
    current_minutes = dt_et.hour * 60 + dt_et.minute

    active_key: Optional[str] = None
    for hour, minute, key in _SCHEDULE:
        if current_minutes >= hour * 60 + minute:
            active_key = key

    # Before 03:00 — treat as the end of the previous day.
    if active_key is None:
        active_key = _SCHEDULE[-1][2]  # "evening_wrap"

    return active_key


def next_run_at(dt_et: datetime) -> datetime:
    """
    Return the next scheduled run datetime after *dt_et* (in ET).

    Parameters
    ----------
    dt_et:
        Reference datetime (timezone-aware or naive ET).

    Returns
    -------
    datetime
        The next checkpoint datetime in the America/New_York timezone.
    """
    dt_et = _ensure_et(dt_et)
    current_minutes = dt_et.hour * 60 + dt_et.minute

    # Find the first checkpoint later today.
    for hour, minute, _key in _SCHEDULE:
        if hour * 60 + minute > current_minutes:
            return dt_et.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )

    # All checkpoints have passed — wrap to tomorrow's first checkpoint.
    first_hour, first_minute, _first_key = _SCHEDULE[0]
    tomorrow = dt_et + timedelta(days=1)
    return tomorrow.replace(
        hour=first_hour, minute=first_minute, second=0, microsecond=0
    )


def session_label(key: str) -> str:
    """
    Return a human-readable label for a session key.

    Parameters
    ----------
    key:
        One of the keys in :data:`SESSIONS`.

    Returns
    -------
    str
        A descriptive label string.  Falls back to the key itself if not
        found in the label map.
    """
    return _LABELS.get(key, key)


def all_session_keys() -> list[str]:
    """Return session keys in chronological order."""
    return [k for _, _, k in _SCHEDULE]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ensure_et(dt: datetime) -> datetime:
    """Attach ET timezone to a naive datetime, or convert if already aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ET_ZONE)
    return dt.astimezone(ET_ZONE)
