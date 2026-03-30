from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

from ..parsers.normalize import Finding, make_finding

RULES_PATH = (
    Path(__file__).resolve().parents[3]
    / "configs"
    / "rules"
    / "rules_index.json"
)

CONFIDENCE_LEVELS = ("low", "medium", "high")


@dataclass(frozen=True)
class Rule:
    key: str
    rule_id: str
    category: str
    severity: str
    confidence: str
    enabled: bool
    description: str
    remediation: str


def load_rules(path: Path | None = None) -> dict[str, Rule]:
    data = json.loads((path or RULES_PATH).read_text(encoding="utf-8"))
    rules = {}
    for key, raw in data.items():
        rules[key] = Rule(
            key=key,
            rule_id=raw["rule_id"],
            category=raw["category"],
            severity=raw["severity"],
            confidence=raw["confidence"],
            enabled=raw.get("enabled", True),
            description=raw["description"],
            remediation=raw["remediation"],
        )
    return rules


def get_rule(rules: dict[str, Rule], rule_key: str) -> Rule:
    return rules[rule_key]


def refine_confidence(base: str, *, pattern_strength: str = "medium", contextual_relevance: bool = False, repeated: bool = False, strong_location: bool = False) -> str:
    index = CONFIDENCE_LEVELS.index(base)
    if pattern_strength == "high":
        index += 1
    elif pattern_strength == "low":
        index -= 1
    if contextual_relevance:
        index += 1
    if repeated:
        index += 1
    if strong_location:
        index += 1
    index = max(0, min(len(CONFIDENCE_LEVELS) - 1, index))
    return CONFIDENCE_LEVELS[index]


def make_rule_finding(
    *,
    rules: dict[str, Rule],
    rule_key: str,
    title: str,
    framework: str,
    file_path: str,
    line_start: int,
    line_end: int,
    evidence: str,
    impact: str,
    safe_attack_path: str,
    references: list[str],
    pattern_strength: str = "medium",
    contextual_relevance: bool = False,
    repeated: bool = False,
    strong_location: bool = False,
    occurrence: int = 0,
) -> Finding | None:
    rule = get_rule(rules, rule_key)
    if not rule.enabled:
        return None
    confidence = refine_confidence(
        rule.confidence,
        pattern_strength=pattern_strength,
        contextual_relevance=contextual_relevance,
        repeated=repeated,
        strong_location=strong_location,
    )
    return make_finding(
        category=rule.category,
        rule_name=rule.key.split(".", 1)[1] if "." in rule.key else rule.rule_id,
        title=title,
        severity=rule.severity,
        confidence=confidence,
        framework=framework,
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        evidence=evidence,
        impact=impact,
        safe_attack_path=safe_attack_path,
        remediation=rule.remediation,
        references=references,
        occurrence=occurrence,
    )
