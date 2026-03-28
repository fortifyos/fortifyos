from __future__ import annotations

from collections import Counter

from ..parsers.normalize import Finding

SEVERITY_DEDUCTIONS = {"critical": 25, "high": 15, "medium": 8, "low": 3}
CONFIDENCE_WEIGHTS = {"high": 1.0, "medium": 0.85, "low": 0.65}


def finding_priority(finding: Finding) -> float:
    return SEVERITY_DEDUCTIONS[finding.severity] * CONFIDENCE_WEIGHTS[finding.confidence]


def compute_score(findings: list[Finding], scanner_count: int, triggered_scanners: int) -> dict:
    totals = Counter({"critical": 0, "high": 0, "medium": 0, "low": 0})
    score = 100.0
    ranked_findings = sorted(findings, key=lambda finding: (-finding_priority(finding), finding.finding_id))
    for finding in ranked_findings:
        totals[finding.severity] += 1
        score -= SEVERITY_DEDUCTIONS[finding.severity] * CONFIDENCE_WEIGHTS[finding.confidence]

    coverage = 0.0 if scanner_count == 0 else round(triggered_scanners / scanner_count, 2)
    score = max(0, min(100, round(score)))

    if score >= 90:
        risk_level = "hardened"
    elif score >= 70:
        risk_level = "stable_but_exposed"
    elif score >= 50:
        risk_level = "vulnerable"
    else:
        risk_level = "urgent_action"

    top_findings = [finding.finding_id for finding in ranked_findings[:5]]
    status = "ok" if score >= 90 and not findings else "action_required" if findings else "ok"
    return {
        "score": score,
        "coverage": coverage,
        "risk_level": risk_level,
        "totals": dict(totals),
        "top_findings": top_findings,
        "status": status,
        "ranked_findings": ranked_findings,
    }


def build_attack_paths(findings: list[Finding]) -> list[str]:
    categories = {finding.category for finding in findings}
    paths = []
    if {"authorization", "routes"} <= categories:
        paths.append("Exposed route surface plus weak authorization checks may allow unauthorized access to privileged handlers.")
    if {"secrets", "configuration"} <= categories:
        paths.append("Exposed secrets combined with permissive configuration can widen access to internal services or sensitive data.")
    if {"ai-risk", "configuration"} <= categories:
        paths.append("Unsafe tool exposure plus permissive defaults may let untrusted prompts influence higher-impact actions.")
    return paths or ["No chained attack path identified from current findings; continue reviewing individual issues."]
