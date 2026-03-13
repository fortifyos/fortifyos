from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.adapters.live_clients import LiveClientError, PriceChartingClient
from app.tcg.config import CONFIG
from app.tcg.entity_catalog import ENTITY_CATALOG
from app.tcg.schemas import RawEvent
from app.tcg.watchlist import get_watchlist_for_source


class PriceChartingAdapter:
    source_name = "pricecharting"

    def __init__(self) -> None:
        self.client = PriceChartingClient(api_token=CONFIG.pricecharting_api_token)

    def _sample_events(self) -> list[RawEvent]:
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

    def _live_events(self) -> list[RawEvent]:
        now = datetime.now(timezone.utc)
        events: list[RawEvent] = []
        entity_map = {entity.entity_id: entity for entity in ENTITY_CATALOG}
        for watch in get_watchlist_for_source(self.source_name):
            entity = entity_map.get(watch.entity_id)
            if not entity:
                continue
            query_candidates = watch.source_queries.get(self.source_name) or ([entity.aliases[0]] if entity.aliases else [entity.canonical_name])
            payload = None
            query = query_candidates[0]
            for candidate in query_candidates:
                query = candidate
                payload = self.client.search(candidate)
                products = payload.get("products") or payload.get("result") or []
                if products:
                    break
            if not payload:
                continue
            products = payload.get("products") or payload.get("result") or []
            if isinstance(products, dict):
                products = [products]
            if not products:
                continue
            product = products[0]
            price = product.get("price") or product.get("loose-price") or product.get("used-price") or product.get("new-price") or 0
            try:
                guide_price = float(price)
            except (TypeError, ValueError):
                guide_price = 0.0
            signal_hints = ["guide_dislocation"]
            if entity.entity_type == "promo":
                signal_hints.append("promo_catalyst")
            if entity.region_priority and entity.region_priority[0] == "JP":
                signal_hints.append("jp_divergence")
            events.append(
                RawEvent(
                    external_id=f"pricecharting-live-{entity.entity_id}",
                    source=self.source_name,
                    source_type="price-guide",
                    url=product.get("url") or f"https://www.pricecharting.com/search-products?type=prices&q={query.replace(' ', '+')}",
                    title=product.get("product-name") or entity.canonical_name,
                    text=f"PriceCharting returned a guide anchor for {entity.canonical_name}.",
                    language="en",
                    region="US",
                    author="pricecharting",
                    published_at=now,
                    metadata={
                        "pricecharting_price": round(guide_price, 2),
                        "guide_dislocation": 0.08 if guide_price else 0.0,
                        "price_velocity": 0.05,
                        "watchlist_priority": watch.priority,
                        "signal_hints": sorted(set(signal_hints)),
                    },
                )
            )
        return events

    def fetch(self) -> list[RawEvent]:
        if self.client.enabled():
            try:
                events = self._live_events()
                if events:
                    return events
            except LiveClientError:
                pass
        return self._sample_events()

    def healthcheck(self) -> dict:
        return {"source": self.source_name, "status": "live-ready" if self.client.enabled() else "sample-live"}
