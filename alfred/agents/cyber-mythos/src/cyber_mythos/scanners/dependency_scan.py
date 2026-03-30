from __future__ import annotations

import json
from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding

HIGH_RISK_PACKAGES = {"child_process", "eval", "shelljs", "pickle"}


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    if rules is None:
        raise ValueError("Rules are required for dependency_scan")
    manifest = target / "package.json"
    manifest_rel = normalize_path(manifest, repo_root)
    if manifest.exists() and (include_paths is None or manifest_rel in include_paths):
        data = json.loads(manifest.read_text(encoding="utf-8"))
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        for name in sorted(deps):
            if name in HIGH_RISK_PACKAGES:
                finding = make_rule_finding(
                    rules=rules,
                    rule_key="dependency_scan.risky_dependency",
                    title="Potentially risky dependency present",
                    framework=framework,
                    file_path=manifest_rel,
                    line_start=1,
                    line_end=1,
                    evidence=f"Dependency manifest includes `{name}`.",
                    impact="Risky packages can expand the attack surface or enable unsafe execution patterns.",
                    safe_attack_path="Unsafe package use can make later command execution or deserialization mistakes easier to exploit.",
                    references=["ASVS-14.2"],
                    pattern_strength="medium",
                    contextual_relevance=True,
                    repeated=False,
                )
                if finding:
                    findings.append(finding)
    reqs = target / "requirements.txt"
    reqs_rel = normalize_path(reqs, repo_root)
    if reqs.exists() and (include_paths is None or reqs_rel in include_paths):
        for line_number, raw_line in enumerate(reqs.read_text(encoding="utf-8").splitlines(), start=1):
            dep = raw_line.strip().split("==")[0]
            if dep in HIGH_RISK_PACKAGES:
                finding = make_rule_finding(
                    rules=rules,
                    rule_key="dependency_scan.risky_dependency",
                    title="Potentially risky Python dependency present",
                    framework=framework,
                    file_path=reqs_rel,
                    line_start=line_number,
                    line_end=line_number,
                    evidence=f"Requirements file includes `{dep}`.",
                    impact="Risky packages can increase the chance of insecure execution or parsing paths.",
                    safe_attack_path="Unsafe dependency use can amplify misuse of deserialization or shell-facing code paths.",
                    references=["ASVS-14.2"],
                    pattern_strength="medium",
                    contextual_relevance=True,
                )
                if finding:
                    findings.append(finding)
    return findings, {}
