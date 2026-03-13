from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class WatchlistEntry:
    entity_id: str
    priority: int
    enabled_sources: tuple[str, ...]
    source_queries: dict[str, list[str]] = field(default_factory=dict)
    thesis: str = ""
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
        thesis="JP master ball mirror with repeated guide lag and collector-led repricing behavior.",
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
        thesis="Limited Japan-only promo where sealed/cultural demand can outrun US guide updates.",
        notes="Limited JP promo with recurring guide lag potential.",
    ),
    WatchlistEntry(
        entity_id="op_prb01_nami_alt",
        priority=84,
        enabled_sources=("youtube", "reddit", "ebay", "pricecharting"),
        source_queries={
            "ebay": ["One Piece PRB-01 Nami Alt Art", "PRB Nami Alt"],
            "pricecharting": ["One Piece PRB-01 Nami Alt Art"],
        },
        thesis="Creator-driven One Piece demand pulse with room for cross-market catch-up.",
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
        thesis="Sealed supply compression candidate where collector storage removes visible inventory.",
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
        thesis="Emerging-franchise incubator target to validate distributor support and secondary market formation.",
        notes="Emerging TCG incubator monitor.",
    ),
    WatchlistEntry(
        entity_id="pkm_moonbreon_evolving_skies",
        priority=90,
        enabled_sources=("ebay", "pricecharting", "youtube", "psa"),
        source_queries={
            "ebay": ["Umbreon VMAX Alt Art Evolving Skies", "Moonbreon PSA 10"],
            "pricecharting": ["Umbreon VMAX Alt Art Evolving Skies"],
        },
        thesis="Blue-chip modern grail to benchmark premium single strength and flight-to-quality behavior.",
        notes="Benchmark premium Pokemon single and liquidity anchor.",
    ),
    WatchlistEntry(
        entity_id="pkm_van_gogh_pikachu",
        priority=87,
        enabled_sources=("ebay", "pricecharting", "reddit", "youtube"),
        source_queries={
            "ebay": ["Van Gogh Pikachu Promo", "Pikachu with Grey Felt Hat"],
            "pricecharting": ["Van Gogh Pikachu Promo"],
        },
        thesis="Mass-awareness promo with global collector crossover and event-driven repricing bursts.",
        notes="High-visibility promo where mainstream attention can re-accelerate quickly.",
    ),
    WatchlistEntry(
        entity_id="op_op05_luffy_signed",
        priority=86,
        enabled_sources=("ebay", "pricecharting", "youtube", "reddit"),
        source_queries={
            "ebay": ["One Piece OP05 Signed Luffy", "Luffy Signature OP05"],
            "pricecharting": ["One Piece OP05 Signed Luffy"],
        },
        thesis="Trophy-tier One Piece chase card to monitor upper-end appetite and scarcity pressure.",
        notes="High-end One Piece benchmark with strong creator and rip-content spillover.",
    ),
    WatchlistEntry(
        entity_id="lorcana_enchanted_elsa",
        priority=83,
        enabled_sources=("ebay", "pricecharting", "youtube", "reddit"),
        source_queries={
            "ebay": ["Lorcana Elsa Enchanted", "Enchanted Elsa Spirit of Winter"],
            "pricecharting": ["Lorcana Elsa Enchanted"],
        },
        thesis="Cross-franchise collector magnet and useful signal for Disney-driven premium demand.",
        notes="Core Lorcana premium monitor.",
    ),
    WatchlistEntry(
        entity_id="gundam_cg_beta_box",
        priority=79,
        enabled_sources=("ebay", "youtube", "reddit", "pricecharting"),
        source_queries={
            "ebay": ["Gundam Card Game Beta Box", "Gundam CG beta launch box"],
            "pricecharting": ["Gundam Card Game Beta Box"],
        },
        thesis="Emerging-franchise incubator candidate where distribution and organized play validation matter more than raw hype.",
        notes="Emerging TCG watch candidate for promotion gating.",
    ),
]


def get_watchlist_for_source(source_name: str) -> list[WatchlistEntry]:
    return [entry for entry in WATCHLIST if source_name in entry.enabled_sources]
