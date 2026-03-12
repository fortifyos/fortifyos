from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class YouTubeAdapter:
    source_name = "youtube"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="yt_gengar_mb_001",
                source=self.source_name,
                source_type="video",
                url="https://youtube.example/gengar-master-ball-supply-thinning",
                title="Master Ball Gengar supply is vanishing in Japan",
                text="Collector attention is rising fast and JP listings are drying up before US comps move.",
                language="en",
                region="JP",
                author="TCG Macro Desk",
                published_at=now - timedelta(hours=2, minutes=10),
                metadata={"mention_velocity": 3.1, "creator_acceleration": 2.6, "signal_hints": ["mention_spike", "jp_divergence"]},
            ),
            RawEvent(
                external_id="yt_prb_nami_001",
                source=self.source_name,
                source_type="video",
                url="https://youtube.example/prb-nami-alt-watch",
                title="PRB-01 Nami Alt is getting picked clean",
                text="One Piece creator chatter is rotating toward PRB alt arts ahead of broader repricing.",
                language="en",
                region="US",
                author="Box Break Signal",
                published_at=now - timedelta(hours=1, minutes=20),
                metadata={"mention_velocity": 2.4, "creator_acceleration": 2.1, "signal_hints": ["creator_acceleration", "emerging_franchise"]},
            ),
            RawEvent(
                external_id="yt_union_arena_hxh_001",
                source=self.source_name,
                source_type="video",
                url="https://youtube.example/union-arena-hxh-launch-watch",
                title="Union Arena Hunter x Hunter launch boxes are getting early collector attention",
                text="Coverage is spreading beyond Bandai-only channels as preorder chatter and event kit discussion accelerate.",
                language="en",
                region="JP",
                author="Emerging TCG Desk",
                published_at=now - timedelta(hours=1, minutes=5),
                metadata={
                    "mention_velocity": 2.9,
                    "creator_acceleration": 2.4,
                    "publisher_credibility": 0.92,
                    "organized_play_support": 0.76,
                    "distribution_strength": 0.71,
                    "signal_hints": ["emerging_franchise", "release_catalyst"],
                },
            ),
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}
