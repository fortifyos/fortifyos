from __future__ import annotations

from collections import defaultdict

from app.tcg.entity_catalog import ENTITY_CATALOG
from app.tcg.schemas import Entity, NormalizedEvent


def resolve_entities(events: list[NormalizedEvent]) -> tuple[dict[str, Entity], dict[str, list[NormalizedEvent]]]:
    resolved: dict[str, Entity] = {entity.entity_id: entity for entity in ENTITY_CATALOG}
    grouped: dict[str, list[NormalizedEvent]] = defaultdict(list)

    for event in events:
        haystack = " ".join(filter(None, [event.title, event.text, event.translated_text])).lower()
        for entity in ENTITY_CATALOG:
            if entity.canonical_name.lower() in haystack or any(alias.lower() in haystack for alias in entity.aliases):
                event.entity_candidates.append(entity.entity_id)
                grouped[entity.entity_id].append(event)
                break

    return resolved, grouped

