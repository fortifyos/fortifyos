from __future__ import annotations

from collections import Counter

from app.tcg.schemas import Entity, NormalizedEvent, ScoredSignal
from app.tcg.services.narratives import build_narrative


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _norm(value: float, scale: float) -> float:
    if scale <= 0:
        return 0.0
    return max(0.0, min(100.0, (value / scale) * 100.0))


def compute_signal(entity: Entity, events: list[NormalizedEvent]) -> ScoredSignal:
    metrics = [event.metrics for event in events]
    hint_counts = Counter(hint for event in events for hint in event.signal_hints)
    signal_types = [hint for hint, count in hint_counts.items() if count >= 1]

    mention_velocity = _avg([float(metric.get("mention_velocity", 0)) for metric in metrics])
    creator_acceleration = _avg([float(metric.get("creator_acceleration", 0)) for metric in metrics])
    listing_depletion = abs(_avg([float(metric.get("listing_count_delta", 0)) for metric in metrics if float(metric.get("listing_count_delta", 0)) < 0]))
    sold_velocity = _avg([float(metric.get("sold_count_delta", 0)) for metric in metrics])
    jp_divergence = _avg([float(metric.get("jp_divergence", 0)) for metric in metrics])
    scarcity_pressure = _avg([float(metric.get("scarcity_pressure", 0)) for metric in metrics])
    catalyst_score = 90.0 if "promo_catalyst" in signal_types else 30.0 if "emerging_franchise" in signal_types else 0.0
    cross_source_confirmation = min(100.0, len({event.source_type for event in events}) * 25.0)
    novelty_score = 70.0 if len(events) <= 3 else 45.0

    feature_scores = {
        "mention_velocity_score": _norm(mention_velocity, 3.5),
        "listing_depletion_score": _norm(listing_depletion, 30.0),
        "sold_velocity_score": _norm(sold_velocity, 20.0),
        "jp_divergence_score": _norm(jp_divergence, 3.0),
        "creator_acceleration_score": _norm(creator_acceleration, 3.0),
        "scarcity_pressure_score": _norm(scarcity_pressure, 3.0),
        "catalyst_score": catalyst_score,
        "cross_source_confirmation_score": cross_source_confirmation,
        "novelty_score": novelty_score,
    }

    alpha_score = round(
        0.20 * feature_scores["mention_velocity_score"] +
        0.17 * feature_scores["listing_depletion_score"] +
        0.15 * feature_scores["sold_velocity_score"] +
        0.14 * feature_scores["jp_divergence_score"] +
        0.10 * feature_scores["creator_acceleration_score"] +
        0.09 * feature_scores["scarcity_pressure_score"] +
        0.07 * feature_scores["catalyst_score"] +
        0.05 * feature_scores["cross_source_confirmation_score"] +
        0.03 * feature_scores["novelty_score"],
        2,
    )

    translation_conf = _avg([float(metric.get("translation_confidence", 0.8)) for metric in metrics])
    confidence_score = round(min(100.0, 38.0 + len(events) * 8.0 + translation_conf * 10.0 + cross_source_confirmation * 0.25), 2)

    rumor_penalty = 8.0 if any("rumor" in (event.text or "").lower() for event in events) else 0.0
    thin_market_penalty = 14.0 if entity.entity_type in {"promo", "single"} and sold_velocity < 12 else 7.0
    creator_fragility = 10.0 if creator_acceleration > 1.5 and cross_source_confirmation < 50 else 0.0
    risk_score = round(min(100.0, thin_market_penalty + creator_fragility + rumor_penalty + max(0.0, 20 - sold_velocity)), 2)

    region_counts = Counter(event.region for event in events if event.region)
    region_lead = region_counts.most_common(1)[0][0] if region_counts else None

    drivers: list[str] = []
    if listing_depletion:
        drivers.append(f"Listings down {listing_depletion:.0f}%")
    if sold_velocity:
        drivers.append(f"Sold comps up {sold_velocity:.0f}%")
    if mention_velocity:
        drivers.append(f"Mentions {mention_velocity:.1f}x baseline")
    if creator_acceleration:
        drivers.append(f"Creator acceleration {creator_acceleration:.1f}")
    if jp_divergence:
        drivers.append(f"JP lead score {jp_divergence:.1f}")

    flags: list[str] = []
    if risk_score >= 45:
        flags.append("thin market")
    if creator_fragility:
        flags.append("creator fragility")
    if entity.entity_type == "promo":
        flags.append("limited float")

    narrative = build_narrative(entity, signal_types, drivers, flags, region_lead)
    query_tags = sorted({entity.franchise.lower(), entity.entity_type, *(signal_types or []), f"lead:{(region_lead or 'na').lower()}"})

    return ScoredSignal(
        entity=entity,
        alpha_score=alpha_score,
        confidence_score=confidence_score,
        risk_score=risk_score,
        time_horizon=narrative["horizon"],
        signal_types=signal_types,
        region_lead=region_lead,
        summary=narrative["summary"],
        drivers=drivers[:4],
        flags=flags,
        sources=[{"source": event.source, "url": event.url} for event in events[:5]],
        query_tags=query_tags,
        metrics=feature_scores,
    )

