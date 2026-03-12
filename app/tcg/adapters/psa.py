from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.schemas import RawEvent


class PSAAdapter:
    source_name = "psa"

    def fetch(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        return [
            RawEvent(
                external_id="psa_gengar_001",
                source=self.source_name,
                source_type="population",
                url="https://psa.example/pop/gengar-master-ball",
                title="PSA pop update: Master Ball Gengar",
                text="Population growth remains modest versus rising demand chatter.",
                language="en",
                region="US",
                author="psa",
                published_at=now - timedelta(hours=2),
                metadata={"psa_pop_growth_rate": 3.0, "scarcity_pressure": 2.0, "signal_hints": ["scarcity_pressure"]},
            )
        ]

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "sample-live"}

