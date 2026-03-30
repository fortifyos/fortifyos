from __future__ import annotations

from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding
from .common import iter_files, read_text, find_line

ROUTE_HINTS = ("route.ts", "route.js", "api", "admin")
AUTH_MARKERS = ("auth", "session", "verify", "token", "role", "middleware")


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    if rules is None:
        raise ValueError("Rules are required for auth_scan")
    for file_path in iter_files(target, include_paths):
        rel = file_path.relative_to(target).as_posix().lower()
        if not any(hint in rel for hint in ROUTE_HINTS):
            continue
        text = read_text(file_path)
        if not text:
            continue
        if "admin" in rel and not any(marker in text.lower() for marker in AUTH_MARKERS):
            line = 1
            finding = make_rule_finding(
                rules=rules,
                rule_key="auth_scan.missing_auth_guard",
                title="Admin-like route lacks visible authorization guard",
                framework=framework,
                file_path=normalize_path(file_path, repo_root),
                line_start=line,
                line_end=line,
                evidence="Admin or API route content lacks obvious auth/session/role guard markers.",
                impact="Unauthorized requests may reach privileged handlers without sufficient authorization checks.",
                safe_attack_path="An external request can reach privileged route logic if route-level authorization is missing.",
                references=["ASVS-4.1", "ASVS-4.2"],
                pattern_strength="medium",
                contextual_relevance=True,
                strong_location="admin" in rel,
            )
            if finding:
                findings.append(finding)
        elif "export async function" in text and "auth" not in text.lower() and "session" not in text.lower() and "token" not in text.lower():
            line = find_line(text, "export async function")
            finding = make_rule_finding(
                rules=rules,
                rule_key="auth_scan.missing_auth_guard",
                title="Route handler lacks visible authorization check",
                framework=framework,
                file_path=normalize_path(file_path, repo_root),
                line_start=line,
                line_end=line,
                evidence="Route handler exports were found without obvious auth/session checks in the same file.",
                impact="Missing authorization checks can widen access to sensitive route behavior.",
                safe_attack_path="Requests may reach business logic without route-local authorization enforcement.",
                references=["ASVS-4.1"],
                pattern_strength="low",
                contextual_relevance=False,
            )
            if finding:
                findings.append(finding)
    return findings, {}
