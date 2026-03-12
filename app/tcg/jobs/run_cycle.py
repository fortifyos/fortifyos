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
from app.tcg.adapters.pricecharting import PriceChartingAdapter
from app.tcg.adapters.psa import PSAAdapter
from app.tcg.adapters.reddit import RedditAdapter
from app.tcg.adapters.tcgplayer import TCGPlayerAdapter
from app.tcg.adapters.youtube import YouTubeAdapter
from app.tcg.config import CONFIG
from app.tcg.db import persist_run
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
    "pricecharting": 0.78,
}

ESTABLISHED_FRANCHISES = {"Pokemon", "Magic the Gathering", "Yu-Gi-Oh", "One Piece", "Lorcana"}

EMERGING_FRANCHISE_PROFILES = {
    "Union Arena": {
        "publisher_credibility": 0.92,
        "distribution_strength": 0.74,
        "organized_play_support": 0.76,
        "secondary_market_formation": 0.69,
    },
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
    ranked = sorted(signals, key=lambda item: item.opportunity_score, reverse=True)
    top_signals = [signal.to_latest_dict() for signal in ranked]
    franchise_momentum = build_franchise_momentum(events, signals)
    alpha_board = {
        "act": [signal.to_latest_dict() for signal in ranked if signal.action_state == "act"][:8],
        "prepare": [signal.to_latest_dict() for signal in ranked if signal.action_state == "prepare"][:8],
        "observe": [signal.to_latest_dict() for signal in ranked if signal.action_state == "observe"][:8],
        "franchise_momentum": franchise_momentum,
    }

    return {
        "generated_at": generated_at,
        "run_id": run_id,
        "freshness_hours": 3,
        "top_signals": top_signals,
        "alpha_board": alpha_board,
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


def build_franchise_momentum(events: list[NormalizedEvent], signals: list) -> list[dict]:
    by_franchise: dict[str, dict] = {}
    signal_map: dict[str, list] = {}
    for signal in signals:
        franchise = signal.entity.franchise or "Unknown"
        signal_map.setdefault(franchise, []).append(signal)

    for event in events:
        franchise = None
        for candidate in event.entity_candidates:
            for signal in signals:
                if signal.entity.entity_id == candidate:
                    franchise = signal.entity.franchise or "Unknown"
                    break
            if franchise:
                break
        if not franchise:
            continue

        bucket = by_franchise.setdefault(
            franchise,
            {
                "franchise": franchise,
                "attention_velocity": 0.0,
                "creator_acceleration": 0.0,
                "listing_depletion": 0.0,
                "secondary_market_formation": 0.0,
                "release_catalyst": 0.0,
                "publisher_credibility": EMERGING_FRANCHISE_PROFILES.get(franchise, {}).get("publisher_credibility", 0.55),
                "distribution_strength": EMERGING_FRANCHISE_PROFILES.get(franchise, {}).get("distribution_strength", 0.5),
                "organized_play_support": EMERGING_FRANCHISE_PROFILES.get(franchise, {}).get("organized_play_support", 0.45),
                "supporting_entities": set(),
            },
        )
        m = event.metrics
        bucket["attention_velocity"] = max(bucket["attention_velocity"], float(m.get("mention_velocity", 0)))
        bucket["creator_acceleration"] = max(bucket["creator_acceleration"], float(m.get("creator_acceleration", 0)))
        bucket["listing_depletion"] = max(bucket["listing_depletion"], abs(float(m.get("listing_count_delta", 0))) if float(m.get("listing_count_delta", 0)) < 0 else 0)
        bucket["secondary_market_formation"] = max(bucket["secondary_market_formation"], float(m.get("secondary_market_formation", 0)))
        bucket["release_catalyst"] = max(bucket["release_catalyst"], 1.0 if "release_catalyst" in event.signal_hints else 0.0)
        bucket["publisher_credibility"] = max(bucket["publisher_credibility"], float(m.get("publisher_credibility", bucket["publisher_credibility"])))
        bucket["distribution_strength"] = max(bucket["distribution_strength"], float(m.get("distribution_strength", bucket["distribution_strength"])))
        bucket["organized_play_support"] = max(bucket["organized_play_support"], float(m.get("organized_play_support", bucket["organized_play_support"])))
        bucket["supporting_entities"].update(event.entity_candidates)

    items = []
    for franchise, bucket in by_franchise.items():
        is_established = franchise in ESTABLISHED_FRANCHISES
        gate_scores = {
            "publisher_credibility": bucket["publisher_credibility"],
            "distribution_strength": bucket["distribution_strength"],
            "organized_play_support": bucket["organized_play_support"],
            "secondary_market_formation": bucket["secondary_market_formation"],
        }
        gate_status = {name: value >= 0.65 for name, value in gate_scores.items()}
        if is_established:
            gate_status = {name: True for name in gate_scores}
        passed_gates = sum(1 for value in gate_status.values() if value)
        if is_established:
            stage = "established"
        elif passed_gates < 2:
            stage = "watch"
        elif passed_gates < 4:
            stage = "validate"
        elif bucket["secondary_market_formation"] < 0.8:
            stage = "incubate"
        else:
            stage = "promote"

        incubator_score = round(
            min(
                100.0,
                18.0 * bucket["attention_velocity"] +
                16.0 * bucket["creator_acceleration"] +
                0.9 * bucket["listing_depletion"] +
                25.0 * bucket["secondary_market_formation"] +
                18.0 * bucket["release_catalyst"],
            ),
            2,
        )

        linked_signals = signal_map.get(franchise, [])
        headline = linked_signals[0].summary if linked_signals else f"{franchise} is being monitored for early collector ecosystem formation."
        items.append(
            {
                "franchise": franchise,
                "stage": stage,
                "system_state": stage.upper(),
                "established": is_established,
                "incubator_score": incubator_score,
                "gate_status": gate_status,
                "gate_scores": {name: round(value, 2) for name, value in gate_scores.items()},
                "drivers": [
                    f"Attention velocity {bucket['attention_velocity']:.1f}x",
                    f"Creator acceleration {bucket['creator_acceleration']:.1f}x",
                    f"Listing depletion {bucket['listing_depletion']:.0f}%",
                    f"Secondary market formation {bucket['secondary_market_formation'] * 100:.0f}%",
                ],
                "headline": headline,
                "entity_count": len(bucket["supporting_entities"]),
            }
        )

    return sorted(items, key=lambda item: (item["established"], item["incubator_score"]), reverse=True)[:8]


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
        PriceChartingAdapter(),
        TCGPlayerAdapter(),
        PSAAdapter(),
    ]
    raw_events = [event for adapter in adapters for event in adapter.fetch()]
    normalized = normalize_events(raw_events, run_id)
    deduped = dedupe_events(normalized)
    entities, grouped = resolve_entities(deduped)
    signals = [compute_signal(entities[entity_id], entity_events) for entity_id, entity_events in grouped.items()]
    persist_run(run_id, entities, deduped, signals)
    payload = build_latest_payload(run_id, signals, deduped)
    write_outputs(payload, deduped)
    return payload


if __name__ == "__main__":
    result = run_tcg_cycle()
    print(f"FORTIFY OS TCG RADAR wrote {len(result['top_signals'])} signals to {CONFIG.data_root / 'latest.json'}")
