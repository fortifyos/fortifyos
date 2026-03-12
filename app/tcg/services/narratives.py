from __future__ import annotations

from app.tcg.schemas import Entity


def build_narrative(entity: Entity, signal_types: list[str], drivers: list[str], flags: list[str], region_lead: str | None) -> dict:
    thesis = "Cross-source confirmation is building before mainstream repricing."
    if "jp_divergence" in signal_types:
        thesis = "Japan appears to be leading the move while US pricing still lags."
    elif "creator_acceleration" in signal_types:
        thesis = "Creator attention is accelerating faster than the broader market is pricing in."

    summary = f"{entity.canonical_name} is showing a tightening collector profile with {', '.join(signal_types[:3]).replace('_', ' ')}."
    watch_for = drivers[:3] or ["additional cross-source confirmation", "listing depth changes", "new sold comp strength"]
    risks = flags or ["thin market", "attention reversal"]
    horizon = "7-30d" if region_lead in {"JP", "US"} else "3-14d"

    return {
        "summary": summary,
        "thesis": thesis,
        "watch_for": watch_for,
        "risks": risks,
        "horizon": horizon,
    }

