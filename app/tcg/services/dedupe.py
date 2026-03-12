from __future__ import annotations

from app.tcg.schemas import NormalizedEvent


def dedupe_events(events: list[NormalizedEvent]) -> list[NormalizedEvent]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[NormalizedEvent] = []
    for event in events:
        key = (event.source, event.url, (event.title or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(event)
    return deduped

