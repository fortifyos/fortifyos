from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class RawEvent:
    external_id: str
    source: str
    source_type: str
    url: str
    published_at: datetime
    title: str | None = None
    text: str | None = None
    language: str | None = None
    region: str | None = None
    author: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["published_at"] = self.published_at.isoformat()
        return payload


@dataclass
class NormalizedEvent:
    event_id: str
    run_id: str
    timestamp: datetime
    source: str
    source_type: str
    source_weight: float
    url: str
    title: str | None = None
    text: str | None = None
    language: str | None = None
    region: str | None = None
    translated_text: str | None = None
    entity_candidates: list[str] = field(default_factory=list)
    signal_hints: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["timestamp"] = self.timestamp.isoformat()
        return payload


@dataclass
class Entity:
    entity_id: str
    entity_type: str
    canonical_name: str
    aliases: list[str]
    franchise: str | None = None
    set_name: str | None = None
    rarity: str | None = None
    language: str | None = None
    grading: str | None = None
    release_date: str | None = None
    identifiers: dict[str, Any] = field(default_factory=dict)
    region_priority: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ScoredSignal:
    entity: Entity
    alpha_score: float
    opportunity_score: float
    confidence_score: float
    risk_score: float
    urgency_score: float
    action_state: str
    time_horizon: str
    signal_types: list[str]
    region_lead: str | None
    summary: str
    drivers: list[str]
    flags: list[str]
    sources: list[dict[str, str]]
    generated_at: str
    query_tags: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    narrative: dict[str, Any] = field(default_factory=dict)

    def to_latest_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity.entity_id,
            "entity_name": self.entity.canonical_name,
            "entity_type": self.entity.entity_type,
            "franchise": self.entity.franchise,
            "set_name": self.entity.set_name,
            "alpha_score": self.alpha_score,
            "opportunity_score": self.opportunity_score,
            "confidence_score": self.confidence_score,
            "risk_score": self.risk_score,
            "urgency_score": self.urgency_score,
            "action_state": self.action_state,
            "signal_types": self.signal_types,
            "region_lead": self.region_lead,
            "time_horizon": self.time_horizon,
            "summary": self.summary,
            "drivers": self.drivers,
            "flags": self.flags,
            "sources": self.sources,
            "query_tags": self.query_tags,
            "metrics": self.metrics,
            "narrative": self.narrative,
        }
