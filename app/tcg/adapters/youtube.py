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
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}

