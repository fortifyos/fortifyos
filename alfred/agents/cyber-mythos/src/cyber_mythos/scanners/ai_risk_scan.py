from __future__ import annotations

from pathlib import Path

from ..parsers.normalize import normalize_path
from ..rules.rule_loader import make_rule_finding
from .common import iter_files, read_text, find_line

AI_TOKENS = ("prompt", "tool", "agent", "model", "llm")
UNSAFE_TOKENS = ("shell=True", "exec(", "eval(", "subprocess", "tool_call", "filesystem")
CODE_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def scan(target: Path, *, repo_root: Path, framework: str, include_paths: set[str] | None = None, rules: dict | None = None) -> tuple[list, dict]:
    findings = []
    if rules is None:
        raise ValueError("Rules are required for ai_risk_scan")
    for file_path in iter_files(target, include_paths):
        rel_parts = file_path.relative_to(target).parts
        if "tests" in rel_parts:
            continue
        if rel_parts[:6] == ("alfred", "agents", "cyber-mythos", "src", "cyber_mythos", "scanners"):
            continue
        if file_path.suffix.lower() not in CODE_SUFFIXES:
            continue
        text = read_text(file_path)
        if not text:
            continue
        lower = text.lower()
        if any(token in lower for token in AI_TOKENS) and any(token.lower() in lower for token in UNSAFE_TOKENS):
            trigger = next(token for token in UNSAFE_TOKENS if token.lower() in lower)
            line = find_line(lower, trigger.lower())
            finding = make_rule_finding(
                rules=rules,
                rule_key="ai_risk_scan.unsafe_tooling",
                title="AI-related code includes unsafe tool or execution pattern",
                framework=framework,
                file_path=normalize_path(file_path, repo_root),
                line_start=line,
                line_end=line,
                evidence=f"AI-related file includes `{trigger}` alongside agent or prompt markers.",
                impact="Unsafe tool exposure around agentic workflows can create prompt-injection-to-action risks.",
                safe_attack_path="An injected prompt or malicious input could steer an agent into invoking an overly broad tool surface.",
                references=["OWASP-LLM01", "OWASP-LLM06"],
                pattern_strength="high" if trigger in {"exec(", "eval(", "shell=True"} else "medium",
                contextual_relevance=True,
                strong_location="agents" in rel_parts,
            )
            if finding:
                findings.append(finding)
    return findings, {}
