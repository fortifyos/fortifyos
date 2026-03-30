from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha1
from pathlib import Path
import json
import re
from typing import Iterable

SEVERITIES = ("critical", "high", "medium", "low")
CONFIDENCES = ("high", "medium", "low")

_CATEGORY_CODES = {
    "authorization": "AUTH",
    "secrets": "SECRETS",
    "routes": "ROUTES",
    "configuration": "CONFIG",
    "dependencies": "DEPS",
    "ai-risk": "AI",
    "recon": "RECON",
}


@dataclass(frozen=True)
class Finding:
    finding_id: str
    title: str
    severity: str
    confidence: str
    category: str
    framework: str
    file_path: str
    line_start: int
    line_end: int
    evidence: str
    impact: str
    safe_attack_path: str
    remediation: str
    references: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def normalize_path(path: str | Path, repo_root: Path) -> str:
    candidate = Path(path)
    if candidate.is_absolute():
        try:
            candidate = candidate.relative_to(repo_root)
        except ValueError:
            candidate = Path(candidate.name)
    return candidate.as_posix()


def build_finding_id(category: str, rule_name: str, file_path: str, occurrence: int = 0) -> str:
    category_code = _CATEGORY_CODES.get(category, "GEN")
    stable_key = "::".join((slugify(category), slugify(rule_name), slugify(file_path), str(occurrence)))
    digest = sha1(stable_key.encode("utf-8")).hexdigest()[:8].upper()
    return f"CM-{category_code}-{digest}"


def make_finding(
    *,
    category: str,
    rule_name: str,
    title: str,
    severity: str,
    confidence: str,
    framework: str,
    file_path: str,
    line_start: int,
    line_end: int,
    evidence: str,
    impact: str,
    safe_attack_path: str,
    remediation: str,
    references: list[str],
    occurrence: int = 0,
) -> Finding:
    if severity not in SEVERITIES:
        raise ValueError(f"Invalid severity: {severity}")
    if confidence not in CONFIDENCES:
        raise ValueError(f"Invalid confidence: {confidence}")
    if line_start < 1 or line_end < line_start:
        raise ValueError("Invalid line range")
    finding_id = build_finding_id(category, rule_name, file_path, occurrence)
    return Finding(
        finding_id=finding_id,
        title=title,
        severity=severity,
        confidence=confidence,
        category=category,
        framework=framework,
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        evidence=evidence,
        impact=impact,
        safe_attack_path=safe_attack_path,
        remediation=remediation,
        references=references,
    )


def deduplicate_findings(findings: Iterable[Finding]) -> list[Finding]:
    unique: dict[str, Finding] = {}
    for finding in findings:
        unique[finding.finding_id] = finding
    return list(sorted(unique.values(), key=lambda item: (SEVERITIES.index(item.severity), item.finding_id)))


def validate_finding_dict(data: dict) -> None:
    required = {
        "finding_id",
        "title",
        "severity",
        "confidence",
        "category",
        "file_path",
        "line_start",
        "line_end",
        "evidence",
        "impact",
        "safe_attack_path",
        "remediation",
        "references",
    }
    missing = required - data.keys()
    if missing:
        raise ValueError(f"Finding missing keys: {sorted(missing)}")
    if data["severity"] not in SEVERITIES:
        raise ValueError("Invalid severity")
    if data["confidence"] not in CONFIDENCES:
        raise ValueError("Invalid confidence")


def validate_summary_dict(data: dict) -> None:
    required = {"run_id", "target", "score", "coverage", "risk_level", "totals", "top_findings", "status", "report_path"}
    missing = required - data.keys()
    if missing:
        raise ValueError(f"Summary missing keys: {sorted(missing)}")
    totals = data["totals"]
    for key in ("critical", "high", "medium", "low"):
        if key not in totals:
            raise ValueError(f"Summary totals missing {key}")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
