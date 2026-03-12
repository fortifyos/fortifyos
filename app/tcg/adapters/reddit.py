from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class RedditAdapter:
    source_name = "reddit"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="rd_gengar_001",
                source=self.source_name,
                source_type="post",
                url="https://reddit.example/r/pokeinvesting/master-ball-gengar",
                title="Master Ball Gengar listings feel lighter this week",
                text="Seeing fewer clean copies under my buy line. JP sellers are pulling inventory fast.",
                language="en",
                region="US",
                author="collector_watch",
                published_at=now - timedelta(hours=2, minutes=45),
                metadata={"mention_velocity": 1.8, "cross_source_confirmation": 1.0, "signal_hints": ["listing_depletion"]},
            ),
            RawEvent(
                external_id="rd_stampbox_001",
                source=self.source_name,
                source_type="post",
                url="https://reddit.example/r/pokeinvesting/stamp-box-pikachu",
                title="Stamp Box Pikachu still feels underfollowed",
                text="Japan sellers are firming prices but US attention is still muted.",
                language="en",
                region="JP",
                author="promo_scout",
                published_at=now - timedelta(hours=1, minutes=5),
                metadata={"mention_velocity": 1.6, "jp_divergence": 2.8, "signal_hints": ["promo_catalyst", "jp_divergence"]},
            ),
            RawEvent(
                external_id="rd_union_arena_hxh_001",
                source=self.source_name,
                source_type="post",
                url="https://reddit.example/r/tradingcardcommunity/union-arena-hxh-launch",
                title="Union Arena HxH launch already showing sealed interest",
                text="Stores are discussing event kits, product allocations, and early resale premiums for first wave boxes.",
                language="en",
                region="US",
                author="emerging_scout",
                published_at=now - timedelta(hours=0, minutes=50),
                metadata={
                    "mention_velocity": 1.9,
                    "secondary_market_formation": 0.66,
                    "distribution_strength": 0.68,
                    "signal_hints": ["emerging_franchise", "listing_depletion"],
                },
            ),
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}
