from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from contextlib import contextmanager

from app.tcg.config import CONFIG
from app.tcg.schemas import Entity, NormalizedEvent, ScoredSignal


SCHEMA = """
CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  franchise TEXT,
  set_name TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  identifiers_json TEXT NOT NULL DEFAULT '{}',
  region_priority_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT,
  region TEXT,
  raw_title TEXT,
  raw_text TEXT,
  translated_text TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ebay_sold_median REAL,
  listing_count INTEGER,
  sold_count INTEGER,
  tcgplayer_market REAL,
  pricecharting_price REAL,
  jp_price REAL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(run_id, entity_id)
);

CREATE TABLE IF NOT EXISTS attention_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  youtube_mentions REAL,
  reddit_mentions REAL,
  creator_count REAL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(run_id, entity_id)
);

CREATE TABLE IF NOT EXISTS signal_snapshots (
  signal_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  opportunity_score REAL NOT NULL,
  confidence_score REAL NOT NULL,
  risk_score REAL NOT NULL,
  urgency_score REAL NOT NULL,
  action_state TEXT NOT NULL,
  signal_types_json TEXT NOT NULL DEFAULT '[]',
  drivers_json TEXT NOT NULL DEFAULT '[]',
  flags_json TEXT NOT NULL DEFAULT '[]',
  narrative_json TEXT NOT NULL DEFAULT '{}',
  metrics_json TEXT NOT NULL DEFAULT '{}'
);
"""


@contextmanager
def get_connection():
    CONFIG.ensure_dirs()
    conn = sqlite3.connect(CONFIG.database_path)
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def _aggregate_event_metrics(events: list[NormalizedEvent]) -> dict[str, dict]:
    grouped: dict[str, dict] = defaultdict(
        lambda: {
            "timestamp": None,
            "ebay_sold_median": None,
            "listing_count": None,
            "sold_count": None,
            "tcgplayer_market": None,
            "pricecharting_price": None,
            "jp_price": None,
            "youtube_mentions": 0.0,
            "reddit_mentions": 0.0,
            "creator_count": 0.0,
            "metrics": {},
        }
    )

    for event in events:
        for entity_id in event.entity_candidates:
            bucket = grouped[entity_id]
            bucket["timestamp"] = event.timestamp.isoformat()
            metrics = event.metrics
            if "median_sold_price" in metrics:
                bucket["ebay_sold_median"] = float(metrics["median_sold_price"])
            if "listing_count" in metrics:
                bucket["listing_count"] = int(metrics["listing_count"])
            if "sold_count" in metrics:
                bucket["sold_count"] = int(metrics["sold_count"])
            if "tcgplayer_market" in metrics:
                bucket["tcgplayer_market"] = float(metrics["tcgplayer_market"])
            if "pricecharting_price" in metrics:
                bucket["pricecharting_price"] = float(metrics["pricecharting_price"])
            if "jp_price" in metrics:
                bucket["jp_price"] = float(metrics["jp_price"])
            if event.source == "youtube":
                bucket["youtube_mentions"] += float(metrics.get("mention_velocity", 0))
                bucket["creator_count"] += float(metrics.get("creator_acceleration", 0))
            if event.source == "reddit":
                bucket["reddit_mentions"] += float(metrics.get("mention_velocity", 0))
            bucket["metrics"].update(metrics)

    return grouped


def persist_run(run_id: str, entities: dict[str, Entity], events: list[NormalizedEvent], signals: list[ScoredSignal]) -> None:
    init_db()
    snapshots = _aggregate_event_metrics(events)
    with get_connection() as conn:
        for entity in entities.values():
            conn.execute(
                """
                INSERT INTO entities (
                    entity_id, canonical_name, entity_type, franchise, set_name, aliases_json, identifiers_json, region_priority_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(entity_id) DO UPDATE SET
                    canonical_name=excluded.canonical_name,
                    entity_type=excluded.entity_type,
                    franchise=excluded.franchise,
                    set_name=excluded.set_name,
                    aliases_json=excluded.aliases_json,
                    identifiers_json=excluded.identifiers_json,
                    region_priority_json=excluded.region_priority_json
                """,
                (
                    entity.entity_id,
                    entity.canonical_name,
                    entity.entity_type,
                    entity.franchise,
                    entity.set_name,
                    json.dumps(entity.aliases),
                    json.dumps(entity.identifiers),
                    json.dumps(entity.region_priority),
                ),
            )

        for event in events:
            conn.execute(
                """
                INSERT OR REPLACE INTO source_events (
                    event_id, run_id, source, source_type, url, language, region, raw_title, raw_text, translated_text, metadata_json, published_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.event_id,
                    run_id,
                    event.source,
                    event.source_type,
                    event.url,
                    event.language,
                    event.region,
                    event.title,
                    event.text,
                    event.translated_text,
                    json.dumps(event.metadata),
                    event.timestamp.isoformat(),
                ),
            )

        for entity_id, snapshot in snapshots.items():
            conn.execute(
                """
                INSERT OR REPLACE INTO price_snapshots (
                    run_id, entity_id, timestamp, ebay_sold_median, listing_count, sold_count, tcgplayer_market, pricecharting_price, jp_price, metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    entity_id,
                    snapshot["timestamp"],
                    snapshot["ebay_sold_median"],
                    snapshot["listing_count"],
                    snapshot["sold_count"],
                    snapshot["tcgplayer_market"],
                    snapshot["pricecharting_price"],
                    snapshot["jp_price"],
                    json.dumps(snapshot["metrics"]),
                ),
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO attention_snapshots (
                    run_id, entity_id, timestamp, youtube_mentions, reddit_mentions, creator_count, metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    entity_id,
                    snapshot["timestamp"],
                    snapshot["youtube_mentions"],
                    snapshot["reddit_mentions"],
                    snapshot["creator_count"],
                    json.dumps(snapshot["metrics"]),
                ),
            )

        for signal in signals:
            conn.execute(
                """
                INSERT OR REPLACE INTO signal_snapshots (
                    signal_id, run_id, entity_id, timestamp, opportunity_score, confidence_score, risk_score, urgency_score,
                    action_state, signal_types_json, drivers_json, flags_json, narrative_json, metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{run_id}:{signal.entity.entity_id}",
                    run_id,
                    signal.entity.entity_id,
                    signal.generated_at,
                    signal.opportunity_score,
                    signal.confidence_score,
                    signal.risk_score,
                    signal.urgency_score,
                    signal.action_state,
                    json.dumps(signal.signal_types),
                    json.dumps(signal.drivers),
                    json.dumps(signal.flags),
                    json.dumps(signal.narrative),
                    json.dumps(signal.metrics),
                ),
            )
        conn.commit()
