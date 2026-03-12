from __future__ import annotations

from collections import defaultdict
import re

from app.tcg.entity_catalog import ENTITY_CATALOG
from app.tcg.schemas import Entity, NormalizedEvent


def _normalize_text(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def _token_score(entity: Entity, haystack: str) -> tuple[int, int]:
    corpus = [entity.canonical_name, *entity.aliases, *entity.identifiers.values()]
    direct_hits = 0
    token_hits = 0

    for item in corpus:
        candidate = _normalize_text(str(item))
        if not candidate:
            continue
        if candidate in haystack:
            direct_hits += 1
        tokens = [token for token in candidate.split(" ") if len(token) >= 2]
        token_hits += sum(1 for token in tokens if token in haystack)

    return direct_hits, token_hits


def resolve_entities(events: list[NormalizedEvent]) -> tuple[dict[str, Entity], dict[str, list[NormalizedEvent]]]:
    resolved: dict[str, Entity] = {entity.entity_id: entity for entity in ENTITY_CATALOG}
    grouped: dict[str, list[NormalizedEvent]] = defaultdict(list)

    for event in events:
        haystack = _normalize_text(" ".join(filter(None, [event.title, event.text, event.translated_text])))
        ranked: list[tuple[int, int, Entity]] = []
        for entity in ENTITY_CATALOG:
            direct_hits, token_hits = _token_score(entity, haystack)
            if direct_hits or token_hits >= 2:
                ranked.append((direct_hits, token_hits, entity))

        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        for _, _, entity in ranked[:2]:
            event.entity_candidates.append(entity.entity_id)
            grouped[entity.entity_id].append(event)

    return resolved, grouped
