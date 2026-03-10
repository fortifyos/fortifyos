#!/usr/bin/env python3
"""
run_macro_update.py — Main scheduled macro update job.

Runs at each of the four daily sessions:
  03:00 ET — global_markets
  08:00 ET — pre_market
  14:00 ET — mid_session
  21:00 ET — evening_wrap

Usage:
    python -m app.macro.jobs.run_macro_update [--session SESSION] [--public-dir DIR] [--dry-run]

Arguments:
    --session SESSION   Force a specific session key (default: auto-detect from current ET time)
    --public-dir DIR    Override the public data directory (default: public/macro-intel)
    --dry-run           Run the full pipeline but do not write output files
    --no-ai             Skip AI narration (use placeholder text)
    --log-level LEVEL   Logging verbosity: DEBUG, INFO, WARNING, ERROR (default: INFO)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

# ---------------------------------------------------------------------------
# Ensure repo root is on sys.path when run as a script.
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from app.macro.engine.utils import now_et, load_json, save_json, today_et
from app.macro.engine.sessions import resolve_session, session_label
from app.macro.engine.ingest import build_snapshot
from app.macro.engine.derive import derive_scores
from app.macro.engine.regime import classify_regime
from app.macro.engine.narrate import generate_narrative_entry
from app.macro.engine.publish import publish_all, publish_archive_index

logger = logging.getLogger(__name__)

ET_ZONE = ZoneInfo("America/New_York")

_DEFAULT_PUBLIC_DIR = os.path.join(_REPO_ROOT, "public", "macro-intel")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_or_init_today_log(public_dir: str, date_str: str) -> dict:
    """Load today-log.json or return a fresh skeleton."""
    path = os.path.join(public_dir, "today-log.json")
    existing = load_json(path)
    if existing and existing.get("date") == date_str:
        return existing
    # New day — return empty skeleton.
    return {
        "date": date_str,
        "status": "active",
        "timezone": "America/New_York",
        "regimeMode": "mixed",
        "lastUpdated": now_et().isoformat(),
        "entries": [],
    }


def _prepend_entry(daily_log: dict, entry: dict) -> dict:
    """Prepend *entry* to the entries list (newest first)."""
    entries: list = daily_log.get("entries", [])
    # Remove any existing entry for the same session to avoid duplicates.
    session_key = entry.get("session")
    entries = [e for e in entries if e.get("session") != session_key]
    daily_log["entries"] = [entry] + entries
    daily_log["lastUpdated"] = entry.get("timestamp", now_et().isoformat())
    daily_log["regimeMode"] = entry.get("drivers", ["mixed"])[0] if entry.get("drivers") else "mixed"
    return daily_log


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def run_update(
    session: str | None = None,
    public_dir: str = _DEFAULT_PUBLIC_DIR,
    dry_run: bool = False,
    no_ai: bool = False,
) -> bool:
    """
    Execute one full macro update cycle.

    Parameters
    ----------
    session:
        Session key override.  Auto-detected from ET clock if None.
    public_dir:
        Path to public/macro-intel directory.
    dry_run:
        If True, skip writing output files.
    no_ai:
        If True, skip Anthropic API call and use placeholder narration.

    Returns
    -------
    bool
        True if the update completed successfully.
    """
    now = now_et()
    date_str = today_et().isoformat()

    if session is None:
        session = resolve_session(now)

    logger.info("=== FORTIFYOS Macro Update | %s | session=%s ===", date_str, session)

    # 1. Ingest market data.
    logger.info("Step 1: ingest market snapshot")
    snapshot = build_snapshot()
    if snapshot is None:
        logger.error("Ingest failed — aborting update")
        return False

    # 2. Derive regime scores.
    logger.info("Step 2: derive regime scores")
    scores = derive_scores(snapshot)

    # 3. Classify regime.
    logger.info("Step 3: classify regime")
    regime = classify_regime(scores, snapshot, now)

    # 4. Generate narrative entry via AI (or placeholder).
    logger.info("Step 4: generate narrative entry (no_ai=%s)", no_ai)
    entry = generate_narrative_entry(
        session=session,
        now=now,
        snapshot=snapshot,
        scores=scores,
        regime=regime,
        no_ai=no_ai,
    )

    # 5. Load/update today log.
    logger.info("Step 5: update today-log")
    daily_log = _load_or_init_today_log(public_dir, date_str)
    daily_log = _prepend_entry(daily_log, entry)
    daily_log["regimeMode"] = regime.get("regimeMode", "mixed")

    if dry_run:
        logger.info("DRY RUN — skipping file writes")
        return True

    # 6. Publish.
    logger.info("Step 6: publish files")
    results = publish_all(
        snapshot=snapshot,
        regime=regime,
        daily_log=daily_log,
        public_dir=public_dir,
    )

    success = all(results.values())
    if success:
        logger.info("Update complete. All files written.")
    else:
        failed = [k for k, v in results.items() if not v]
        logger.error("Update partial failure — failed: %s", failed)

    return success


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FORTIFYOS Macro Intel scheduled update job")
    parser.add_argument(
        "--session",
        choices=["global_markets", "pre_market", "mid_session", "evening_wrap"],
        default=None,
        help="Force a specific session key (default: auto-detect from ET clock)",
    )
    parser.add_argument(
        "--public-dir",
        default=_DEFAULT_PUBLIC_DIR,
        help="Path to public/macro-intel directory",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run pipeline without writing output files",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Skip AI narration (use placeholder text)",
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
    ok = run_update(
        session=args.session,
        public_dir=args.public_dir,
        dry_run=args.dry_run,
        no_ai=args.no_ai,
    )
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
