from __future__ import annotations

import re
from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding
from .common import iter_files, read_text, find_line

SECRET_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]"), "hardcoded credential-like assignment"),
    (re.compile(r"sk-[A-Za-z0-9]{16,}"), "OpenAI-style secret token pattern"),
]


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    if rules is None:
        raise ValueError("Rules are required for secrets_scan")
    for file_path in iter_files(target, include_paths):
        text = read_text(file_path)
        if not text:
            continue
        for pattern, label in SECRET_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue
            rel = normalize_path(file_path, repo_root)
            line = find_line(text, match.group(0))
            finding = make_rule_finding(
                rules=rules,
                rule_key="secrets_scan.hardcoded_secret",
                title="Possible hardcoded secret detected",
                framework=framework,
                file_path=rel,
                line_start=line,
                line_end=line,
                evidence=f"Matched {label}.",
                impact="Secret exposure can enable unauthorized access to systems or data.",
                safe_attack_path="An attacker who obtains source or logs could reuse the exposed credential against dependent services.",
                references=["ASVS-8.1", "OWASP-A02"],
                pattern_strength="high",
                contextual_relevance=True,
                strong_location=file_path.name.startswith(".env"),
            )
            if finding:
                findings.append(finding)
            break
    return findings, {}
