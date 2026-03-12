from __future__ import annotations

from app.tcg.schemas import Entity


ENTITY_CATALOG: list[Entity] = [
    Entity(
        entity_id="pkm_151_mb_gengar",
        entity_type="single",
        canonical_name="Pokemon 151 Master Ball Gengar",
        aliases=[
            "gengar master ball 151",
            "pokemon 151 master ball gengar",
            "ゲンガー マスターボールミラー 151",
            "sv2a gengar mb",
        ],
        franchise="Pokemon",
        set_name="Pokemon Card 151",
        identifiers={"card_number": "094/165"},
        region_priority=["JP", "US"],
    ),
    Entity(
        entity_id="pkm_promo_pikachu_stampbox",
        entity_type="promo",
        canonical_name="Pikachu Stamp Box Promo",
        aliases=[
            "pikachu stamp box",
            "stamp box pikachu",
            "切手box ピカチュウ",
        ],
        franchise="Pokemon",
        set_name="Japan Post Stamp Box",
        identifiers={"promo_code": "STAMPBOX-PIKA"},
        region_priority=["JP", "US"],
    ),
    Entity(
        entity_id="op_prb01_nami_alt",
        entity_type="single",
        canonical_name="One Piece PRB-01 Nami Alt Art",
        aliases=[
            "prb nami alt",
            "one piece nami alt art prb",
            "ナミ prb alt",
        ],
        franchise="One Piece",
        set_name="PRB-01",
        identifiers={"card_number": "OP01-016"},
        region_priority=["JP", "US"],
    ),
    Entity(
        entity_id="pkm_japan_classic_collection_charizard",
        entity_type="sealed",
        canonical_name="Pokemon Classic Collection Charizard Deck",
        aliases=[
            "pokemon classic collection charizard",
            "classic collection charizard deck",
            "ポケモンクラシック リザードン",
        ],
        franchise="Pokemon",
        set_name="Pokemon Classic",
        identifiers={"product_code": "PKM-CLASSIC-CHAR"},
        region_priority=["JP", "US"],
    ),
]

