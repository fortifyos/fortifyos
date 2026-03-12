from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class EbayAdapter:
    source_name = "ebay"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="eb_gengar_001",
                source=self.source_name,
                source_type="marketplace",
                url="https://ebay.example/itm/gengar-master-ball-151",
                title="Pokemon 151 Master Ball Gengar listings",
                text="Observed active listings down 28 percent, sold comps up 14 percent.",
                language="en",
                region="JP",
                author="market-scan",
                published_at=now - timedelta(hours=0, minutes=40),
                metadata={"listing_count_delta": -28.0, "sold_count_delta": 18.0, "median_sold_price_delta": 14.0, "signal_hints": ["listing_depletion", "sold_velocity"]},
            ),
            RawEvent(
                external_id="eb_classic_char_001",
                source=self.source_name,
                source_type="marketplace",
                url="https://ebay.example/itm/pokemon-classic-charizard-deck",
                title="Pokemon Classic Collection Charizard Deck supply gap",
                text="Sealed inventory has narrowed while buyer watchlists are climbing.",
                language="en",
                region="US",
                author="market-scan",
                published_at=now - timedelta(hours=1, minutes=10),
                metadata={"listing_count_delta": -19.0, "sold_count_delta": 12.0, "median_sold_price_delta": 9.0, "signal_hints": ["listing_depletion", "sealed_dislocation"]},
            ),
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}

