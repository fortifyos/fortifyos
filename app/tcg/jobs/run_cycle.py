#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from app.tcg.adapters.ebay import EbayAdapter
from app.tcg.adapters.psa import PSAAdapter
from app.tcg.adapters.reddit import RedditAdapter
from app.tcg.adapters.tcgplayer import TCGPlayerAdapter
from app.tcg.adapters.youtube import YouTubeAdapter
from app.tcg.config import CONFIG
from app.tcg.schemas import NormalizedEvent, RawEvent
from app.tcg.services.dedupe import dedupe_events
from app.tcg.services.resolver import resolve_entities
from app.tcg.services.scoring import compute_signal
from app.tcg.services.translation import attach_translation


SOURCE_WEIGHTS = {
    "youtube": 0.92,
    "reddit": 0.58,
    "ebay": 0.94,
    "tcgplayer": 0.96,
    "psa": 0.90,
}


def _event_id(raw: RawEvent) -> str:
    payload = f"{raw.source}|{raw.external_id}|{raw.url}|{raw.published_at.isoformat()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def normalize_events(raw_events: list[RawEvent], run_id: str) -> list[NormalizedEvent]:
    normalized: list[NormalizedEvent] = []
    for raw in raw_events:
        event = NormalizedEvent(
            event_id=_event_id(raw),
            run_id=run_id,
            timestamp=raw.published_at,
            source=raw.source,
            source_type=raw.source_type,
            source_weight=SOURCE_WEIGHTS.get(raw.source, 0.5),
            url=raw.url,
            title=raw.title,
            text=raw.text,
            language=raw.language,
            region=raw.region,
            signal_hints=list(raw.metadata.get("signal_hints", [])),
            metrics={k: v for k, v in raw.metadata.items() if k != "signal_hints"},
            metadata=raw.metadata,
        )
        normalized.append(attach_translation(event))
    return normalized


def build_latest_payload(run_id: str, signals: list, events: list[NormalizedEvent]) -> dict:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    source_counts = Counter(event.source for event in events)
    receipts = sorted({event.source for event in events})
    top_signals = [signal.to_latest_dict() for signal in sorted(signals, key=lambda item: item.alpha_score, reverse=True)]

    return {
        "generated_at": generated_at,
        "run_id": run_id,
        "freshness_hours": 3,
        "top_signals": top_signals,
        "source_health": [{"source": source, "events": count} for source, count in source_counts.items()],
        "panels": {
            "japan_lead": [signal.to_latest_dict() for signal in top_signals_to_objects(signals, region="JP")],
            "sealed_dislocations": [signal.to_latest_dict() for signal in top_signals_to_objects(signals, entity_type="sealed")],
            "promo_alerts": [signal.to_latest_dict() for signal in top_signals_to_objects(signals, entity_type="promo")],
            "creator_momentum": [signal.to_latest_dict() for signal in top_signals_to_objects(signals, signal_type="creator_acceleration")],
        },
        "query_hints": [
            "show japanese promos under $300 with rising attention",
            "find sealed products with shrinking listings",
            "show pokemon signals with high confidence and low risk",
        ],
        "source_receipts": receipts,
    }


def top_signals_to_objects(signals: list, region: str | None = None, entity_type: str | None = None, signal_type: str | None = None):
    items = sorted(signals, key=lambda item: item.alpha_score, reverse=True)
    filtered = []
    for signal in items:
        if region and signal.region_lead != region:
            continue
        if entity_type and signal.entity.entity_type != entity_type:
            continue
        if signal_type and signal_type not in signal.signal_types:
            continue
        filtered.append(signal)
    return filtered[:6]


def write_outputs(payload: dict, events: list[NormalizedEvent]) -> None:
    CONFIG.ensure_dirs()
    latest_path = CONFIG.data_root / "latest.json"
    public_latest_path = CONFIG.public_root / "latest.json"

    archive_dir = CONFIG.data_root / "archive" / payload["generated_at"][:10]
    archive_dir.mkdir(parents=True, exist_ok=True)
    public_archive_dir = CONFIG.public_root / "archive" / payload["generated_at"][:10]
    public_archive_dir.mkdir(parents=True, exist_ok=True)

    run_label = payload["generated_at"][11:16].replace(":", "")
    archive_path = archive_dir / f"{run_label}.json"
    public_archive_path = public_archive_dir / f"{run_label}.json"

    latest_path.write_text(json.dumps(payload, indent=2))
    public_latest_path.write_text(json.dumps(payload, indent=2))
    archive_path.write_text(json.dumps(payload, indent=2))
    public_archive_path.write_text(json.dumps(payload, indent=2))

    log_path = CONFIG.data_root / "signal_log.jsonl"
    with log_path.open("a", encoding="utf-8") as handle:
        for signal in payload["top_signals"]:
            handle.write(json.dumps(signal) + "\n")

    receipt_path = CONFIG.data_root / "source_receipts" / f"{payload['run_id']}.json"
    public_receipt_path = CONFIG.public_root / "source_receipts" / f"{payload['run_id']}.json"
    receipt_payload = {"run_id": payload["run_id"], "events": [event.to_dict() for event in events]}
    receipt_path.write_text(json.dumps(receipt_payload, indent=2))
    public_receipt_path.write_text(json.dumps(receipt_payload, indent=2))


def run_tcg_cycle() -> dict:
    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    adapters = [
        YouTubeAdapter(),
        RedditAdapter(),
        EbayAdapter(),
        TCGPlayerAdapter(),
        PSAAdapter(),
    ]
    raw_events = [event for adapter in adapters for event in adapter.fetch()]
    normalized = normalize_events(raw_events, run_id)
    deduped = dedupe_events(normalized)
    entities, grouped = resolve_entities(deduped)
    signals = [compute_signal(entities[entity_id], entity_events) for entity_id, entity_events in grouped.items()]
    payload = build_latest_payload(run_id, signals, deduped)
    write_outputs(payload, deduped)
    return payload


if __name__ == "__main__":
    result = run_tcg_cycle()
    print(f"FORTIFY OS TCG RADAR wrote {len(result['top_signals'])} signals to {CONFIG.data_root / 'latest.json'}")
