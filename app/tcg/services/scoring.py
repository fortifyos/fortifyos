from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from app.tcg.schemas import Entity, NormalizedEvent, ScoredSignal
from app.tcg.services.narratives import build_narrative


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _norm_ratio(value: float, scale: float) -> float:
    if scale <= 0:
        return 0.0
    return max(0.0, min(100.0, (value / scale) * 100.0))


def _norm_pct(value: float, scale: float) -> float:
    if scale <= 0:
        return 0.0
    return max(0.0, min(100.0, (abs(value) / scale) * 100.0))


def _action_state(opportunity_score: float, confidence_score: float, risk_score: float, urgency_score: float) -> str:
    if opportunity_score >= 75 and confidence_score >= 70 and risk_score < 50 and urgency_score >= 55:
        return "act"
    if opportunity_score >= 55 and confidence_score >= 55 and risk_score < 60:
        return "prepare"
    if opportunity_score >= 25:
        return "observe"
    return "avoid"


def compute_signal(entity: Entity, events: list[NormalizedEvent]) -> ScoredSignal:
    metrics = [event.metrics for event in events]
    hint_counts = Counter(hint for event in events for hint in event.signal_hints)
    signal_types = sorted(hint_counts.keys())

    price_velocity_raw = _avg([float(metric.get("price_velocity", 0)) for metric in metrics])
    sold_velocity_raw = _avg([float(metric.get("sold_count_delta", 0)) for metric in metrics])
    listing_depletion_raw = abs(_avg([float(metric.get("listing_count_delta", 0)) for metric in metrics if float(metric.get("listing_count_delta", 0)) < 0]))
    attention_velocity_raw = _avg([float(metric.get("mention_velocity", 0)) for metric in metrics])
    creator_acceleration_raw = _avg([float(metric.get("creator_acceleration", 0)) for metric in metrics])
    guide_dislocation_raw = _avg([float(metric.get("guide_dislocation", 0)) for metric in metrics])
    jp_divergence_raw = _avg([float(metric.get("jp_divergence", 0)) for metric in metrics])
    scarcity_pressure_raw = _avg([float(metric.get("scarcity_pressure", 0)) for metric in metrics])

    cross_source_confirmation_score = min(100.0, len({event.source for event in events}) * 18.0)
    novelty_score = 72.0 if len(events) <= 3 else 55.0 if len(events) <= 5 else 35.0
    catalyst_score = 88.0 if "promo_catalyst" in signal_types else 65.0 if "emerging_franchise" in signal_types else 25.0

    feature_scores = {
        "price_velocity_score": _norm_ratio(price_velocity_raw, 0.25),
        "sold_velocity_score": _norm_pct(sold_velocity_raw, 20.0),
        "listing_depletion_score": _norm_pct(listing_depletion_raw, 30.0),
        "attention_velocity_score": _norm_ratio(attention_velocity_raw, 3.5),
        "creator_acceleration_score": _norm_ratio(creator_acceleration_raw, 3.0),
        "guide_dislocation_score": _norm_ratio(guide_dislocation_raw, 0.25),
        "jp_divergence_score": _norm_ratio(jp_divergence_raw, 0.25),
        "scarcity_pressure_score": _norm_ratio(scarcity_pressure_raw, 3.0),
        "catalyst_score": catalyst_score,
        "cross_source_confirmation_score": cross_source_confirmation_score,
        "novelty_score": novelty_score,
    }

    opportunity_score = round(
        0.18 * feature_scores["price_velocity_score"] +
        0.16 * feature_scores["listing_depletion_score"] +
        0.14 * feature_scores["sold_velocity_score"] +
        0.14 * feature_scores["jp_divergence_score"] +
        0.10 * feature_scores["scarcity_pressure_score"] +
        0.09 * feature_scores["creator_acceleration_score"] +
        0.08 * feature_scores["guide_dislocation_score"] +
        0.06 * feature_scores["catalyst_score"] +
        0.03 * feature_scores["novelty_score"] +
        0.02 * feature_scores["cross_source_confirmation_score"],
        2,
    )

    translation_conf = _avg([float(metric.get("translation_confidence", 0.84)) for metric in metrics])
    rumor_penalty = 10.0 if any("rumor" in (event.text or "").lower() for event in events) else 0.0
    completeness_bonus = min(16.0, len([k for k, v in feature_scores.items() if v > 0]) * 2.0)
    confidence_score = round(
        min(
            100.0,
            28.0 +
            cross_source_confirmation_score * 0.35 +
            translation_conf * 12.0 +
            completeness_bonus +
            min(20.0, len(events) * 4.5) -
            rumor_penalty,
        ),
        2,
    )

    thin_depth_penalty = 18.0 if _avg([float(metric.get("listing_count", 0)) for metric in metrics]) < 8 else 8.0
    creator_fragility_penalty = 12.0 if creator_acceleration_raw > 1.5 and cross_source_confirmation_score < 50 else 0.0
    promo_float_penalty = 9.0 if entity.entity_type == "promo" else 0.0
    risk_score = round(min(100.0, thin_depth_penalty + creator_fragility_penalty + promo_float_penalty + rumor_penalty), 2)

    urgency_score = round(
        min(
            100.0,
            0.35 * feature_scores["listing_depletion_score"] +
            0.25 * feature_scores["sold_velocity_score"] +
            0.20 * feature_scores["price_velocity_score"] +
            0.20 * feature_scores["attention_velocity_score"],
        ),
        2,
    )

    region_counts = Counter(event.region for event in events if event.region)
    region_lead = region_counts.most_common(1)[0][0] if region_counts else None
    action_state = _action_state(opportunity_score, confidence_score, risk_score, urgency_score)

    drivers: list[str] = []
    if listing_depletion_raw:
        drivers.append(f"Listings down {listing_depletion_raw:.0f}%")
    if sold_velocity_raw:
        drivers.append(f"Sold velocity up {sold_velocity_raw:.0f}%")
    if price_velocity_raw:
        drivers.append(f"Price velocity {price_velocity_raw * 100:.0f}%")
    if guide_dislocation_raw:
        drivers.append(f"Guide lag {guide_dislocation_raw * 100:.0f}%")
    if jp_divergence_raw:
        drivers.append(f"JP lead {jp_divergence_raw * 100:.0f}%")
    if creator_acceleration_raw:
        drivers.append(f"Creator acceleration {creator_acceleration_raw:.1f}x")
    if scarcity_pressure_raw:
        drivers.append(f"Scarcity pressure {scarcity_pressure_raw:.1f}")

    flags: list[str] = []
    if thin_depth_penalty >= 18:
        flags.append("thin market")
    if creator_fragility_penalty:
        flags.append("creator fragility")
    if rumor_penalty:
        flags.append("rumor penalty")
    if entity.entity_type == "promo":
        flags.append("limited float")

    narrative = build_narrative(entity, signal_types, drivers, flags, region_lead)
    query_tags = sorted(
        {
            (entity.franchise or "unknown").lower(),
            entity.entity_type,
            action_state,
            *(signal_types or []),
            f"lead:{(region_lead or 'na').lower()}",
        }
    )

    metrics_out = {
        **feature_scores,
        "ebay_sold_median": _avg([float(metric.get("median_sold_price", 0)) for metric in metrics if float(metric.get("median_sold_price", 0)) > 0]),
        "tcgplayer_market": _avg([float(metric.get("tcgplayer_market", 0)) for metric in metrics if float(metric.get("tcgplayer_market", 0)) > 0]),
        "pricecharting_price": _avg([float(metric.get("pricecharting_price", 0)) for metric in metrics if float(metric.get("pricecharting_price", 0)) > 0]),
        "price_velocity_raw": round(price_velocity_raw, 4),
        "sold_velocity_raw": round(sold_velocity_raw, 2),
        "listing_depletion_raw": round(listing_depletion_raw, 2),
        "attention_velocity_raw": round(attention_velocity_raw, 2),
        "creator_acceleration_raw": round(creator_acceleration_raw, 2),
        "guide_dislocation_raw": round(guide_dislocation_raw, 4),
        "jp_divergence_raw": round(jp_divergence_raw, 4),
        "scarcity_pressure_raw": round(scarcity_pressure_raw, 2),
    }

    return ScoredSignal(
        entity=entity,
        alpha_score=opportunity_score,
        opportunity_score=opportunity_score,
        confidence_score=confidence_score,
        risk_score=risk_score,
        urgency_score=urgency_score,
        action_state=action_state,
        time_horizon=narrative["horizon"],
        signal_types=signal_types,
        region_lead=region_lead,
        summary=narrative["summary"],
        drivers=drivers[:5],
        flags=flags,
        sources=[{"source": event.source, "url": event.url} for event in events[:6]],
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        query_tags=query_tags,
        metrics=metrics_out,
        narrative=narrative,
    )
