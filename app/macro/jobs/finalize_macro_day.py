#!/usr/bin/env python3
"""
finalize_macro_day.py — End-of-day archival job for the FORTIFYOS Macro Intel Engine.

Runs at 02:59 ET each day (before the 03:00 global_markets update).

Moves today-log.json into the archive directory, updates archive-index.json,
and resets today-log.json for the new day.

Usage:
    python -m app.macro.jobs.finalize_macro_day [--public-dir DIR] [--date DATE] [--dry-run]

Arguments:
    --public-dir DIR   Override public data directory (default: public/macro-intel)
    --date DATE        Archive a specific date (YYYY-MM-DD) instead of yesterday
    --dry-run          Print what would happen without writing files
    --log-level LEVEL  Logging verbosity (default: INFO)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import date

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from app.macro.engine.archive import archive_date, archive_yesterday
from app.macro.engine.utils import load_json, save_json, today_et, now_et

logger = logging.getLogger(__name__)

_DEFAULT_PUBLIC_DIR = os.path.join(_REPO_ROOT, "public", "macro-intel")


def _reset_today_log(public_dir: str) -> None:
    """Write a fresh empty today-log.json for the new day."""
    new_date = today_et().isoformat()
    skeleton = {
        "date": new_date,
        "status": "active",
        "timezone": "America/New_York",
        "regimeMode": "mixed",
        "lastUpdated": now_et().isoformat(),
        "entries": [],
    }
    path = os.path.join(public_dir, "today-log.json")
    save_json(path, skeleton)
    logger.info("finalize: today-log.json reset for %s", new_date)


def run_finalize(
    public_dir: str = _DEFAULT_PUBLIC_DIR,
    target_date: date | None = None,
    dry_run: bool = False,
) -> bool:
    """
    Archive the prior day and reset the daily log.

    Parameters
    ----------
    public_dir:
        Path to public/macro-intel directory.
    target_date:
        Date to archive.  Defaults to yesterday.
    dry_run:
        If True, log actions without writing files.

    Returns
    -------
    bool
        True on success.
    """
    if target_date is None:
        from datetime import timedelta
        target_date = today_et() - timedelta(days=1)

    logger.info("=== FORTIFYOS Macro Finalize | archiving %s ===", target_date.isoformat())

    if dry_run:
        logger.info("DRY RUN — would archive %s and reset today-log.json", target_date.isoformat())
        return True

    ok = archive_date(target_date, public_dir)
    if ok:
        _reset_today_log(public_dir)
    else:
        logger.error("finalize: archival failed for %s — today-log.json NOT reset", target_date.isoformat())

    return ok


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FORTIFYOS Macro Intel end-of-day archival job")
    parser.add_argument(
        "--public-dir",
        default=_DEFAULT_PUBLIC_DIR,
        help="Path to public/macro-intel directory",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Date to archive (YYYY-MM-DD). Defaults to yesterday.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log actions without writing files",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    target_date = None
    if args.date:
        target_date = date.fromisoformat(args.date)

    ok = run_finalize(
        public_dir=args.public_dir,
        target_date=target_date,
        dry_run=args.dry_run,
    )
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
