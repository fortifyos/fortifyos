from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from app.tcg.config import CONFIG


def load_latest_payload() -> dict[str, Any]:
    return json.loads((CONFIG.data_root / "latest.json").read_text())


def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(CONFIG.database_path)
    conn.row_factory = sqlite3.Row
    return conn


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
