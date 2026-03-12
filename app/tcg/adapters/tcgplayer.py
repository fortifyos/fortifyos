from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class TCGPlayerAdapter:
    source_name = "tcgplayer"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="tcg_stampbox_001",
                source=self.source_name,
                source_type="marketplace",
                url="https://tcgplayer.example/product/stamp-box-pikachu",
                title="Pikachu Stamp Box Promo market depth",
                text="Median sold price up 11 percent on shrinking float, low relist behavior.",
                language="en",
                region="US",
                author="market-scan",
                published_at=now - timedelta(hours=0, minutes=55),
                metadata={"sold_count_delta": 15.0, "median_sold_price_delta": 11.0, "scarcity_pressure": 2.4, "signal_hints": ["scarcity_pressure", "promo_catalyst"]},
            )
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}

