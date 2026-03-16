#!/usr/bin/env python3
"""
run_macro_update.py — Main job runner for the FORTIFYOS Macro Intel Engine.

Usage:
    python app/macro/jobs/run_macro_update.py --session pre_market [--dry-run] [--no-ai]

Sessions: global_markets, pre_market, mid_session, evening_wrap

Flow:
    1.  Resolve session and timestamp (ET).
    2.  Load prior market-snapshot.json, regime-state.json, today-log.json.
    3.  Ingest current upstream values from macro.json.
    4.  Calculate deltas vs prior run and prior close.
    5.  Derive rule-based scores.
    6.  Classify regime.
    7.  Generate structured what_changed summary.
    8.  Build AI prompt payload.
    9.  Generate NarrativeEntry (AI or rule-based).
    10. Append to daily log.
    11. Update all current JSON files.
    Print success/failure summary.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Optional

# ---------------------------------------------------------------------------
# Path bootstrap — ensures repo root is on sys.path when run as a script.
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from app.macro.engine.utils import now_et, to_iso, date_str, load_json
from app.macro.engine.archive import finalize_day, ArchiveError
from app.macro.engine.sessions import (
    SESSIONS,
    resolve_session,
    session_label,
)
from app.macro.engine.ingest import (
    load_macro_json,
    build_market_snapshot,
    get_value,
    get_asset,
)
from app.macro.engine.derive import derive_scores
from app.macro.engine.regime import (
    classify_regime,
    compute_confidence,
    build_regime_state,
)
from app.macro.engine.narrate import (
    build_prompt_payload,
    generate_narrative,
    rule_based_narrative,
)
from app.macro.engine.publish import (
    publish_run,
    load_market_snapshot,
    load_regime_state,
    load_today_log,
    DATA_DIR,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("macro.run_update")

_DEFAULT_DATA_DIR = os.path.join(_REPO_ROOT, DATA_DIR)


# ---------------------------------------------------------------------------
# What-changed computation
# ---------------------------------------------------------------------------


def compute_what_changed(
    current_snapshot: dict,
    prior_snapshot: Optional[dict],
    prior_regime: Optional[dict],
    current_regime_mode: str,
) -> dict:
    """
    Build a structured WhatChanged summary comparing current to prior state.

    Parameters
    ----------
    current_snapshot:
        Current MarketSnapshot dict.
    prior_snapshot:
        Prior MarketSnapshot (from last run), or None.
    prior_regime:
        Prior RegimeState dict, or None.
    current_regime_mode:
        The newly classified regime mode string.

    Returns
    -------
    dict
        WhatChanged dict with keys: ``significantMoves``, ``regimeChanged``,
        ``priorRegimeMode``, ``currentRegimeMode``, ``summary``.
    """
    significant_moves: list[str] = []

    if prior_snapshot:
        for asset in current_snapshot.get("assets", []):
            key = asset.get("key", "")
            label = asset.get("label", key)
            pct_since_last: Optional[float] = asset.get("pctSinceLast")
            change_since_last: Optional[float] = asset.get("changeSinceLast")
            if pct_since_last is not None and abs(pct_since_last) >= 0.5:
                direction = "up" if pct_since_last > 0 else "down"
                move_str = (
                    f"{label} {direction} {abs(pct_since_last):.2f}% since last checkpoint"
                )
                if change_since_last is not None:
                    move_str += f" ({change_since_last:+.4g})"
                significant_moves.append(move_str)

    prior_regime_mode: Optional[str] = (
        prior_regime.get("regimeMode") if prior_regime else None
    )
    regime_changed = (
        prior_regime_mode is not None
        and prior_regime_mode != current_regime_mode
    )

    if regime_changed:
        summary = (
            f"Regime shift: {prior_regime_mode} → {current_regime_mode}. "
            f"{len(significant_moves)} significant asset moves detected."
        )
    elif significant_moves:
        summary = (
            f"Regime stable ({current_regime_mode}). "
            f"{len(significant_moves)} significant moves since last checkpoint."
        )
    else:
        summary = (
            f"Regime stable ({current_regime_mode}). "
            "No significant moves since last checkpoint."
        )

    return {
        "significantMoves": significant_moves,
        "regimeChanged": regime_changed,
        "priorRegimeMode": prior_regime_mode,
        "currentRegimeMode": current_regime_mode,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Main run function
# ---------------------------------------------------------------------------


def run(
    session: Optional[str] = None,
    dry_run: bool = False,
    no_ai: bool = False,
    api_key: Optional[str] = None,
    data_dir: str = _DEFAULT_DATA_DIR,
) -> dict:
    """
    Execute a single macro update cycle.

    Parameters
    ----------
    session:
        Force a specific session key.  Auto-resolves from ET clock if None.
    dry_run:
        If True, compute everything but do not write any output files.
    no_ai:
        If True, use rule-based narration only (skip Anthropic API call).
    api_key:
        Anthropic API key.  Falls back to ``ANTHROPIC_API_KEY`` env var.
    data_dir:
        Absolute path to output directory for live JSON files.

    Returns
    -------
    dict
        Run result summary dict.
    """
    dt_et = now_et()
    timestamp = to_iso(dt_et)

    # --- Step 1: Resolve session ---
    if session is None:
        session = resolve_session(dt_et)
        logger.info(
            "Auto-resolved session: %s (%s)", session, session_label(session)
        )
    else:
        if session not in SESSIONS:
            raise ValueError(
                f"Unknown session {session!r}. "
                f"Valid sessions: {list(SESSIONS.keys())}"
            )
        logger.info(
            "Using specified session: %s (%s)", session, session_label(session)
        )

    logger.info("Timestamp: %s", timestamp)

    if not dry_run:
        _maybe_rollover_previous_day(data_dir)

    # --- Step 2: Load prior state ---
    prior_snapshot: Optional[dict] = load_market_snapshot(data_dir)
    prior_regime: Optional[dict] = load_regime_state(data_dir)
    prior_log: Optional[dict] = load_today_log(data_dir)

    if prior_snapshot:
        logger.info(
            "Loaded prior market snapshot (session=%s)", prior_snapshot.get("session")
        )
    else:
        logger.info("No prior market snapshot found — first run of the day")

    if prior_regime:
        logger.info(
            "Prior regime: %s (confidence=%.2f)",
            prior_regime.get("regimeMode"),
            prior_regime.get("confidence", 0),
        )
    else:
        logger.info("No prior regime state found")

    daily_log_entries: list = []
    if prior_log:
        daily_log_entries = prior_log.get("entries", [])
        logger.info("Today's log has %d prior entries", len(daily_log_entries))

    # --- Step 3: Ingest macro data ---
    macro_data = load_macro_json(_REPO_ROOT)
    if not macro_data:
        logger.warning("macro.json is empty or missing — proceeding with blank data")

    # --- Step 4 (delta calc) + Step 3 combined: Build market snapshot ---
    market_snapshot = build_market_snapshot(
        session=session,
        macro_data=macro_data,
        prior_snapshot=prior_snapshot,
    )
    logger.info(
        "Market snapshot built — %d assets",
        len(market_snapshot.get("assets", [])),
    )

    for key in ("spx", "btc", "vix", "gold", "wti"):
        val = get_value(market_snapshot, key)
        pct = (get_asset(market_snapshot, key) or {}).get("pctVsClose")
        if val is not None:
            pct_str = f" ({pct:+.2f}% vs close)" if pct is not None else ""
            logger.info("  %s: %s%s", key.upper(), f"{val:,.4g}", pct_str)

    # --- Step 5: Derive rule-based scores ---
    scores = derive_scores(macro_data, prior_market=prior_snapshot)
    logger.info("Scores: %s", scores)

    # --- Step 6: Classify regime ---
    regime_mode = classify_regime(scores)
    confidence = compute_confidence(scores, regime_mode)
    logger.info("Regime: %s (confidence=%.2f)", regime_mode, confidence)

    regime_state = build_regime_state(
        session=session,
        scores=scores,
        regime=regime_mode,
        confidence=confidence,
        macro_data=macro_data,
        prior_regime=prior_regime,
    )

    # --- Step 7: Compute what_changed ---
    what_changed = compute_what_changed(
        current_snapshot=market_snapshot,
        prior_snapshot=prior_snapshot,
        prior_regime=prior_regime,
        current_regime_mode=regime_mode,
    )
    logger.info("What changed: %s", what_changed["summary"])

    # --- Steps 8 & 9: Generate NarrativeEntry ---
    resolved_api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    if no_ai:
        logger.info("--no-ai flag set; using rule-based narration")
        entry = rule_based_narrative(
            session=session,
            regime_state=regime_state,
            market_snapshot=market_snapshot,
            what_changed=what_changed,
        )
    elif not resolved_api_key:
        logger.warning(
            "ANTHROPIC_API_KEY not set; falling back to rule-based narration"
        )
        entry = rule_based_narrative(
            session=session,
            regime_state=regime_state,
            market_snapshot=market_snapshot,
            what_changed=what_changed,
        )
    else:
        prompt_payload = build_prompt_payload(
            session=session,
            timestamp=timestamp,
            market_snapshot=market_snapshot,
            prior_market=prior_snapshot,
            regime_state=regime_state,
            prior_regime=prior_regime,
            what_changed=what_changed,
            daily_log_so_far=daily_log_entries,
        )
        entry = generate_narrative(prompt_payload, api_key=resolved_api_key)

    logger.info(
        "Narrative generated (source=%s): %s",
        entry.get("source", "?"),
        entry.get("headline", "")[:80],
    )

    # --- Steps 10 & 11: Publish ---
    if dry_run:
        logger.info("DRY RUN — skipping file writes")
        daily_log = {
            "date": date_str(),
            "entries": daily_log_entries + [entry],
            "status": "active",
        }
    else:
        daily_log = publish_run(
            market_snapshot=market_snapshot,
            regime_state=regime_state,
            entry=entry,
            data_dir=data_dir,
        )
        logger.info(
            "Published — log now has %d entries for %s",
            daily_log.get("entryCount", 0),
            daily_log.get("date", "?"),
        )

    result = {
        "success": True,
        "session": session,
        "sessionLabel": session_label(session),
        "timestamp": timestamp,
        "regimeMode": regime_mode,
        "confidence": confidence,
        "regimeChanged": what_changed["regimeChanged"],
        "priorRegimeMode": what_changed["priorRegimeMode"],
        "significantMoves": len(what_changed["significantMoves"]),
        "narrativeSource": entry.get("source", "unknown"),
        "headline": entry.get("headline", ""),
        "dryRun": dry_run,
    }

    _print_summary(result)
    return result


def _maybe_rollover_previous_day(data_dir: str) -> None:
    log_path = os.path.join(data_dir, "today-log.json")
    existing_log = load_json(log_path, default=None)
    if not existing_log:
        return

    log_date = existing_log.get("date")
    current_date = date_str()
    if not log_date or log_date == current_date:
        return

    logger.info(
        "Detected stale today-log date %s while current ET date is %s; attempting archive rollover.",
        log_date,
        current_date,
    )
    try:
        summary = finalize_day(data_dir=data_dir)
        logger.info(
            "Archive rollover complete for %s (%d entries).",
            summary.get("archived_date"),
            summary.get("entry_count", 0),
        )
    except ArchiveError as exc:
        logger.warning("Archive rollover skipped: %s", exc)


# ---------------------------------------------------------------------------
# Summary printer
# ---------------------------------------------------------------------------


def _print_summary(result: dict) -> None:
    """Print a concise run summary to stdout."""
    status = "SUCCESS" if result.get("success") else "FAILURE"
    dry_tag = " [DRY RUN]" if result.get("dryRun") else ""
    width = 62
    print(f"\n{'=' * width}")
    print(f"  FORTIFYOS MACRO INTEL ENGINE — {status}{dry_tag}")
    print(f"{'=' * width}")
    print(f"  Session    : {result.get('sessionLabel', result.get('session'))}")
    print(f"  Timestamp  : {result.get('timestamp')}")
    print(
        f"  Regime     : {result.get('regimeMode')} "
        f"(confidence={result.get('confidence', 0):.0%})"
    )
    if result.get("regimeChanged"):
        print(
            f"  [!] REGIME CHANGE: "
            f"{result.get('priorRegimeMode')} → {result.get('regimeMode')}"
        )
    print(f"  Moves      : {result.get('significantMoves', 0)} significant asset moves")
    print(f"  Narrative  : {result.get('narrativeSource', '?')}")
    headline = result.get("headline", "")
    print(f"  Headline   : {headline[:70]}")
    if result.get("error"):
        print(f"  ERROR      : {result.get('error')}")
    print(f"{'=' * width}\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="FORTIFYOS Macro Intel Engine — single update cycle runner.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--session",
        choices=list(SESSIONS.keys()),
        default=None,
        help="Force a specific session (default: auto-resolve from current ET time).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Compute everything but do not write any output files.",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        default=False,
        help="Use rule-based narration only; skip the Anthropic API call.",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Anthropic API key (default: ANTHROPIC_API_KEY env var).",
    )
    parser.add_argument(
        "--data-dir",
        default=_DEFAULT_DATA_DIR,
        help=f"Output directory for live JSON files (default: {_DEFAULT_DATA_DIR}).",
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
        result = run(
            session=args.session,
            dry_run=args.dry_run,
            no_ai=args.no_ai,
            api_key=args.api_key,
            data_dir=args.data_dir,
        )
        return 0 if result.get("success") else 1
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130
    except Exception as exc:
        logger.exception("run_macro_update failed with unhandled exception: %s", exc)
        print(f"\n[FAILURE] Unhandled exception: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
