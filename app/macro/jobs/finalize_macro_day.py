#!/usr/bin/env python3
"""
finalize_macro_day.py — End-of-day archival job for the FORTIFYOS Macro Intel Engine.

Runs at 2:59 AM ET to archive the previous day's log and reset for the new day.

Usage:
    python app/macro/jobs/finalize_macro_day.py [--dry-run] [--data-dir DIR]

Calls archive.finalize_day() with full error handling.
If the archive fails, the error is logged and the current day's log is NOT reset,
preserving data integrity.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime

# ---------------------------------------------------------------------------
# Path bootstrap
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from app.macro.engine.archive import finalize_day, ArchiveError
from app.macro.engine.publish import DATA_DIR
from app.macro.engine.utils import now_et, to_iso

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("macro.finalize_day")

_DEFAULT_DATA_DIR = os.path.join(_REPO_ROOT, DATA_DIR)


# ---------------------------------------------------------------------------
# Main finalize function
# ---------------------------------------------------------------------------


def run_finalize(
    dry_run: bool = False,
    data_dir: str = _DEFAULT_DATA_DIR,
) -> dict:
    """
    Archive the previous day's log and reset today-log.json for the new day.

    Delegates to :func:`app.macro.engine.archive.finalize_day`.

    If the archive fails (e.g. date mismatch, I/O error):
    - The error is logged at ERROR level.
    - The current ``today-log.json`` is NOT reset.
    - The function returns a failure result dict rather than raising.

    Parameters
    ----------
    dry_run:
        If True, log what would happen but do not write any files.
    data_dir:
        Absolute path to the live output directory (where today-log.json lives).

    Returns
    -------
    dict
        Result summary: ``{"success", "archived_date", "entry_count", "archive_path", "error"}``.
    """
    dt_et = now_et()
    logger.info(
        "=== FORTIFYOS Macro Finalize — %s ===",
        dt_et.strftime("%Y-%m-%d %H:%M ET"),
    )

    if dry_run:
        logger.info("DRY RUN — would call finalize_day(data_dir=%s)", data_dir)
        logger.info(
            "DRY RUN — would archive today-log.json and reset for the new day"
        )
        result = {
            "success": True,
            "dryRun": True,
            "archived_date": None,
            "entry_count": None,
            "archive_path": None,
            "error": None,
        }
        _print_summary(result)
        return result

    try:
        summary = finalize_day(data_dir=data_dir)
        result = {
            "success": True,
            "dryRun": False,
            "archived_date": summary["archived_date"],
            "entry_count": summary["entry_count"],
            "archive_path": summary["archive_path"],
            "error": None,
        }
        logger.info(
            "Finalize complete: archived %s (%d entries) → %s",
            summary["archived_date"],
            summary["entry_count"],
            summary["archive_path"],
        )

    except ArchiveError as exc:
        # Data-integrity-critical failure — do NOT reset the log.
        logger.error(
            "ARCHIVE FAILED (data integrity guard): %s — today-log.json has NOT been reset",
            exc,
        )
        result = {
            "success": False,
            "dryRun": False,
            "archived_date": None,
            "entry_count": None,
            "archive_path": None,
            "error": str(exc),
        }

    except Exception as exc:
        # Unexpected failure — also do NOT reset the log.
        logger.exception(
            "Unexpected error during finalize_day: %s — today-log.json has NOT been reset",
            exc,
        )
        result = {
            "success": False,
            "dryRun": False,
            "archived_date": None,
            "entry_count": None,
            "archive_path": None,
            "error": f"Unexpected error: {exc}",
        }

    _print_summary(result)
    return result


# ---------------------------------------------------------------------------
# Summary printer
# ---------------------------------------------------------------------------


def _print_summary(result: dict) -> None:
    """Print a concise finalization summary to stdout."""
    status = "SUCCESS" if result.get("success") else "FAILURE"
    dry_tag = " [DRY RUN]" if result.get("dryRun") else ""
    width = 62
    print(f"\n{'=' * width}")
    print(f"  FORTIFYOS MACRO INTEL — DAY FINALIZATION {status}{dry_tag}")
    print(f"{'=' * width}")
    if result.get("archived_date"):
        print(f"  Archived date : {result['archived_date']}")
        print(f"  Entry count   : {result['entry_count']}")
        print(f"  Archive path  : {result['archive_path']}")
    if result.get("error"):
        print(f"  ERROR         : {result['error']}")
        print(f"  IMPORTANT     : today-log.json was NOT reset due to the error above.")
        print(f"                  Investigate and re-run when safe.")
    print(f"{'=' * width}\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "FORTIFYOS Macro Intel Engine — end-of-day archival job. "
            "Runs at 2:59 AM ET."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Log what would happen but do not write any files.",
    )
    parser.add_argument(
        "--data-dir",
        default=_DEFAULT_DATA_DIR,
        help=f"Live output directory (default: {_DEFAULT_DATA_DIR}).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        default=False,
        help="Enable DEBUG logging.",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        result = run_finalize(dry_run=args.dry_run, data_dir=args.data_dir)
        return 0 if result.get("success") else 1
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130
    except Exception as exc:
        logger.exception("finalize_macro_day failed with unhandled exception: %s", exc)
        print(f"\n[FAILURE] Unhandled exception: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
