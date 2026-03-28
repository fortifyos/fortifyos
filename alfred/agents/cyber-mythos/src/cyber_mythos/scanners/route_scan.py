from __future__ import annotations

from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding
from .common import iter_files, read_text


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    route_count = 0
    admin_routes = []
    if rules is None:
        raise ValueError("Rules are required for route_scan")
    for file_path in iter_files(target, include_paths):
        rel = file_path.relative_to(target).as_posix()
        lower = rel.lower()
        if "api" in lower or "route." in lower:
            route_count += 1
        if "admin" in lower and ("route." in lower or "api" in lower):
            admin_routes.append(rel)
            text = read_text(file_path) or ""
            if "middleware" not in text.lower() and "auth" not in text.lower():
                finding = make_rule_finding(
                    rules=rules,
                    rule_key="route_scan.exposed_admin_route",
                    title="Admin-style route appears publicly reachable",
                    framework=framework,
                    file_path=normalize_path(file_path, repo_root),
                    line_start=1,
                    line_end=1,
                    evidence="Admin route path exists without visible route-local access control markers.",
                    impact="Privileged route exposure increases risk of unauthorized access and privilege escalation.",
                    safe_attack_path="An attacker can probe admin route surfaces and attempt requests against insufficiently guarded handlers.",
                    references=["ASVS-1.2", "ASVS-4.2"],
                    pattern_strength="medium",
                    contextual_relevance=True,
                    strong_location=True,
                )
                if finding:
                    findings.append(finding)
    return findings, {"route_count": route_count, "admin_routes": admin_routes[:5]}
