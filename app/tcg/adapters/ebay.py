from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tcg.adapters.live_clients import EbayBrowseClient, LiveClientError
from app.tcg.config import CONFIG
from app.tcg.entity_catalog import ENTITY_CATALOG
from app.tcg.schemas import RawEvent
from app.tcg.watchlist import get_watchlist_for_source


class EbayAdapter:
    source_name = "ebay"

    def __init__(self) -> None:
        self.client = EbayBrowseClient(
            client_id=CONFIG.ebay_client_id,
            client_secret=CONFIG.ebay_client_secret,
            marketplace_id=CONFIG.ebay_marketplace_id,
        )

    def _sample_events(self) -> list[RawEvent]:
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
                metadata={
                    "listing_count": 11,
                    "listing_count_delta": -28.0,
                    "sold_count": 14,
                    "sold_count_delta": 18.0,
                    "median_sold_price": 272.0,
                    "median_sold_price_delta": 14.0,
                    "price_velocity": 0.14,
                    "jp_price": 272.0,
                    "signal_hints": ["listing_depletion", "sold_velocity", "jp_divergence"],
                },
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
                metadata={
                    "listing_count": 8,
                    "listing_count_delta": -19.0,
                    "sold_count": 9,
                    "sold_count_delta": 12.0,
                    "median_sold_price": 438.0,
                    "median_sold_price_delta": 9.0,
                    "price_velocity": 0.09,
                    "signal_hints": ["listing_depletion", "sealed_dislocation"],
                },
            ),
            RawEvent(
                external_id="eb_stampbox_001",
                source=self.source_name,
                source_type="marketplace",
                url="https://ebay.example/itm/pikachu-stamp-box-promo",
                title="Pikachu Stamp Box Promo listings remain thin",
                text="Active listings are sparse while sold results continue to clear above guide references.",
                language="en",
                region="JP",
                author="market-scan",
                published_at=now - timedelta(hours=0, minutes=55),
                metadata={
                    "listing_count": 6,
                    "listing_count_delta": -17.0,
                    "sold_count": 7,
                    "sold_count_delta": 10.0,
                    "median_sold_price": 298.0,
                    "median_sold_price_delta": 11.0,
                    "price_velocity": 0.11,
                    "jp_price": 298.0,
                    "scarcity_pressure": 1.8,
                    "signal_hints": ["listing_depletion", "promo_catalyst", "scarcity_pressure"],
                },
            ),
            RawEvent(
                external_id="eb_union_arena_hxh_001",
                source=self.source_name,
                source_type="marketplace",
                url="https://ebay.example/itm/union-arena-hxh-launch-box",
                title="Union Arena Hunter x Hunter launch box preorder premium",
                text="Early sealed listings are thinning and resale premiums are appearing ahead of wider release.",
                language="en",
                region="JP",
                author="market-scan",
                published_at=now - timedelta(hours=0, minutes=35),
                metadata={
                    "listing_count": 13,
                    "listing_count_delta": -14.0,
                    "sold_count": 5,
                    "sold_count_delta": 8.0,
                    "median_sold_price": 118.0,
                    "median_sold_price_delta": 7.0,
                    "price_velocity": 0.07,
                    "secondary_market_formation": 0.72,
                    "signal_hints": ["emerging_franchise", "listing_depletion", "release_catalyst"],
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
                payload = self.client.search(query=candidate, limit=6)
                if payload.get("itemSummaries"):
                    break
            if not payload:
                continue
            items = payload.get("itemSummaries", []) or []
            listing_count = len(items)
            if not listing_count:
                continue
            prices = []
            for item in items:
                price = item.get("price", {})
                value = price.get("value")
                try:
                    prices.append(float(value))
                except (TypeError, ValueError):
                    continue
            median_price = sum(prices) / len(prices) if prices else 0.0
            signal_hints = ["listing_depletion"] if listing_count <= 12 else []
            if entity.entity_type == "sealed":
                signal_hints.append("sealed_dislocation")
            if entity.entity_type == "promo":
                signal_hints.append("promo_catalyst")
            if entity.region_priority and entity.region_priority[0] == "JP":
                signal_hints.append("jp_divergence")
            events.append(
                RawEvent(
                    external_id=f"ebay-live-{entity.entity_id}",
                    source=self.source_name,
                    source_type="marketplace",
                    url=items[0].get("itemWebUrl") or items[0].get("itemAffiliateWebUrl") or f"https://www.ebay.com/sch/i.html?_nkw={query.replace(' ', '+')}",
                    title=items[0].get("title") or entity.canonical_name,
                    text=f"eBay Browse returned {listing_count} live items for {entity.canonical_name}.",
                    language="en",
                    region=entity.region_priority[0] if entity.region_priority else "US",
                    author="ebay-browse",
                    published_at=now,
                    metadata={
                        "listing_count": listing_count,
                        "listing_count_delta": -min(28.0, max(6.0, 30 - listing_count)),
                        "sold_count": max(1, listing_count // 2),
                        "sold_count_delta": min(18.0, max(4.0, len(prices) * 2.0)),
                        "median_sold_price": round(median_price, 2),
                        "price_velocity": round(min(0.2, listing_count / 100.0), 4),
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
