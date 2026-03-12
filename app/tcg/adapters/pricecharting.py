from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class PriceChartingAdapter:
    source_name = "pricecharting"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="pc_gengar_001",
                source=self.source_name,
                source_type="price-guide",
                url="https://pricecharting.example/pokemon-151-master-ball-gengar",
                title="Pokemon 151 Master Ball Gengar guide lag",
                text="Guide price remains below the recent sold market while the 30 day trend is climbing.",
                language="en",
                region="US",
                author="pricecharting",
                published_at=now - timedelta(hours=1, minutes=5),
                metadata={
                    "pricecharting_price": 228.0,
                    "guide_dislocation": 0.19,
                    "price_velocity": 0.13,
                    "signal_hints": ["guide_dislocation", "jp_divergence"],
                },
            ),
            RawEvent(
                external_id="pc_stampbox_001",
                source=self.source_name,
                source_type="price-guide",
                url="https://pricecharting.example/pikachu-stamp-box-promo",
                title="Pikachu Stamp Box promo repricing context",
                text="Longer trend remains constructive while live supply stays thin relative to guide history.",
                language="en",
                region="JP",
                author="pricecharting",
                published_at=now - timedelta(hours=1, minutes=20),
                metadata={
                    "pricecharting_price": 268.0,
                    "guide_dislocation": 0.11,
                    "price_velocity": 0.08,
                    "signal_hints": ["promo_catalyst", "guide_dislocation"],
                },
            ),
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}
