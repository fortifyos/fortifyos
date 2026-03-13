from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class WatchlistEntry:
    entity_id: str
    priority: int
    enabled_sources: tuple[str, ...]
    source_queries: dict[str, list[str]] = field(default_factory=dict)
    notes: str = ""


WATCHLIST: list[WatchlistEntry] = [
    WatchlistEntry(
        entity_id="pkm_151_mb_gengar",
        priority=100,
        enabled_sources=("ebay", "pricecharting", "youtube", "reddit", "psa"),
        source_queries={
            "ebay": ["Pokemon 151 Master Ball Gengar", "Gengar Master Ball 151"],
            "pricecharting": ["Pokemon 151 Master Ball Gengar"],
        },
        notes="Core JP lead single with strong collector behavior.",
    ),
    WatchlistEntry(
        entity_id="pkm_promo_pikachu_stampbox",
        priority=95,
        enabled_sources=("ebay", "pricecharting", "reddit", "tcgplayer"),
        source_queries={
            "ebay": ["Pikachu Stamp Box Promo", "Stamp Box Pikachu"],
            "pricecharting": ["Pikachu Stamp Box Promo"],
        },
        notes="Limited JP promo with recurring guide lag potential.",
    ),
    WatchlistEntry(
        entity_id="op_prb01_nami_alt",
        priority=84,
        enabled_sources=("youtube", "reddit", "ebay"),
        source_queries={
            "ebay": ["One Piece PRB-01 Nami Alt Art", "PRB Nami Alt"],
            "pricecharting": ["One Piece PRB-01 Nami Alt Art"],
        },
        notes="One Piece momentum signal with creator overlap.",
    ),
    WatchlistEntry(
        entity_id="pkm_japan_classic_collection_charizard",
        priority=88,
        enabled_sources=("ebay", "pricecharting"),
        source_queries={
            "ebay": ["Pokemon Classic Collection Charizard Deck", "Pokemon Classic Charizard Deck"],
            "pricecharting": ["Pokemon Classic Collection Charizard Deck"],
        },
        notes="Sealed supply stress monitor.",
    ),
    WatchlistEntry(
        entity_id="ua_hxh_union_arena_launch_box",
        priority=82,
        enabled_sources=("ebay", "youtube", "reddit", "pricecharting"),
        source_queries={
            "ebay": ["Union Arena Hunter x Hunter Launch Box", "Union Arena HxH Box"],
            "pricecharting": ["Union Arena Hunter x Hunter Launch Box"],
        },
        notes="Emerging TCG incubator monitor.",
    ),
]


def get_watchlist_for_source(source_name: str) -> list[WatchlistEntry]:
    return [entry for entry in WATCHLIST if source_name in entry.enabled_sources]
