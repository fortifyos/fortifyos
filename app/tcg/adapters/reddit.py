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
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}

