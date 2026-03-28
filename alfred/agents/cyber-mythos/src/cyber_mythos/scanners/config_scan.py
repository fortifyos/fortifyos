from __future__ import annotations

from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding
from .common import iter_files, read_text, find_line

CONFIG_SUFFIXES = {".env", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"}
RISK_PATTERNS = [
    ("localhost", "Development-only host binding present."),
    ("debug: true", "Debug mode explicitly enabled."),
    ("allowAllOrigins", "Permissive origin configuration detected."),
]


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    if rules is None:
        raise ValueError("Rules are required for config_scan")
    for file_path in iter_files(target, include_paths):
        if file_path.suffix.lower() not in CONFIG_SUFFIXES and file_path.name not in {"Dockerfile", ".env"}:
            continue
        text = read_text(file_path)
        if not text:
            continue
        lower = text.lower()
        for token, evidence in RISK_PATTERNS:
            if token.lower() in lower:
                line = find_line(lower, token.lower())
                finding = make_rule_finding(
                    rules=rules,
                    rule_key="config_scan.risky_default",
                    title="Risky configuration default detected",
                    framework=framework,
                    file_path=normalize_path(file_path, repo_root),
                    line_start=line,
                    line_end=line,
                    evidence=evidence,
                    impact="Permissive configuration can weaken application security boundaries when promoted beyond local development.",
                    safe_attack_path="Unsafe defaults can remain enabled in higher environments and widen exposure to unauthorized requests or data handling mistakes.",
                    references=["ASVS-14.4"],
                    pattern_strength="low",
                    contextual_relevance=file_path.suffix.lower() in CONFIG_SUFFIXES,
                )
                if finding:
                    findings.append(finding)
    return findings, {}
