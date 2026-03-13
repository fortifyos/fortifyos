from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from app.tcg.config import CONFIG
from app.tcg.entity_catalog import ENTITY_CATALOG
from app.tcg.watchlist import WATCHLIST


def load_latest_payload() -> dict[str, Any]:
    return json.loads((CONFIG.data_root / "latest.json").read_text())


def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(CONFIG.database_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_watchlist_overview() -> dict[str, Any]:
    latest = load_latest_payload()
    signals_by_entity = {item.get("entity_id"): item for item in latest.get("top_signals", [])}
    source_health = {item.get("source"): item.get("events", 0) for item in latest.get("source_health", [])}
    catalog = {entity.entity_id: entity for entity in ENTITY_CATALOG}

    entries = []
    for item in sorted(WATCHLIST, key=lambda entry: entry.priority, reverse=True):
        entity = catalog.get(item.entity_id)
        live_signal = signals_by_entity.get(item.entity_id)
        entries.append(
            {
                "entity_id": item.entity_id,
                "canonical_name": entity.canonical_name if entity else item.entity_id,
                "entity_type": entity.entity_type if entity else None,
                "franchise": entity.franchise if entity else None,
                "set_name": entity.set_name if entity else None,
                "priority": item.priority,
                "enabled_sources": list(item.enabled_sources),
                "source_queries": item.source_queries,
                "notes": item.notes,
                "thesis": item.thesis,
                "has_live_signal": bool(live_signal),
                "action_state": live_signal.get("action_state") if live_signal else None,
                "opportunity_score": live_signal.get("opportunity_score") if live_signal else None,
                "region_lead": live_signal.get("region_lead") if live_signal else None,
                "source_readiness": {
                    source: source_health.get(source, 0) for source in item.enabled_sources
                },
            }
        )

    return {
        "generated_at": latest.get("generated_at"),
        "count": len(entries),
        "entries": entries,
    }


def get_entity_detail(entity_id: str) -> dict[str, Any] | None:
    latest = load_latest_payload()
    signal = next((item for item in latest.get("top_signals", []) if item.get("entity_id") == entity_id), None)
    if not signal:
        return None

    with open_db() as conn:
        entity_row = conn.execute("SELECT * FROM entities WHERE entity_id = ?", (entity_id,)).fetchone()
        price_rows = conn.execute(
            """
            SELECT run_id, timestamp, ebay_sold_median, listing_count, sold_count, tcgplayer_market, pricecharting_price, jp_price, metrics_json
            FROM price_snapshots
            WHERE entity_id = ?
            ORDER BY timestamp DESC
            LIMIT 12
            """,
            (entity_id,),
        ).fetchall()
        attention_rows = conn.execute(
            """
            SELECT run_id, timestamp, youtube_mentions, reddit_mentions, creator_count, metrics_json
            FROM attention_snapshots
            WHERE entity_id = ?
            ORDER BY timestamp DESC
            LIMIT 12
            """,
            (entity_id,),
        ).fetchall()

    return {
        "entity": {
            "entity_id": entity_row["entity_id"],
            "canonical_name": entity_row["canonical_name"],
            "entity_type": entity_row["entity_type"],
            "franchise": entity_row["franchise"],
            "set_name": entity_row["set_name"],
            "aliases": json.loads(entity_row["aliases_json"]),
            "identifiers": json.loads(entity_row["identifiers_json"]),
            "region_priority": json.loads(entity_row["region_priority_json"]),
        } if entity_row else None,
        "signal": signal,
        "price_history": [
            {
                "run_id": row["run_id"],
                "timestamp": row["timestamp"],
                "ebay_sold_median": row["ebay_sold_median"],
                "listing_count": row["listing_count"],
                "sold_count": row["sold_count"],
                "tcgplayer_market": row["tcgplayer_market"],
                "pricecharting_price": row["pricecharting_price"],
                "jp_price": row["jp_price"],
                "metrics": json.loads(row["metrics_json"] or "{}"),
            }
            for row in price_rows
        ],
        "attention_history": [
            {
                "run_id": row["run_id"],
                "timestamp": row["timestamp"],
                "youtube_mentions": row["youtube_mentions"],
                "reddit_mentions": row["reddit_mentions"],
                "creator_count": row["creator_count"],
                "metrics": json.loads(row["metrics_json"] or "{}"),
            }
            for row in attention_rows
        ],
    }
