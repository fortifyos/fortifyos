from __future__ import annotations

from pathlib import Path

from ..parsers.normalize import Finding


def render_report(
    *,
    command: str,
    profile: str,
    target: str,
    recon: dict,
    findings: list[Finding],
    attack_paths: list[str],
    score: dict,
    comparison: dict,
    summary: dict,
) -> str:
    system_summary = [
        f"- Mode: `{command}`",
        f"- Profile: `{profile}`",
        f"- Target: `{target}`",
        f"- Framework: `{recon.get('framework', 'unknown')}`",
        f"- Risk level: `{score['risk_level']}`",
        f"- Coverage: `{score['coverage']}`",
        f"- Scan mode: `{summary.get('scan_mode', 'full')}`",
        f"- Files scanned: `{summary.get('files_scanned', 0)}` / `{summary.get('files_total', 0)}`",
    ]
    attack_surface = [
        f"- Manifests: {', '.join(recon.get('manifests', [])) or 'none detected'}",
        f"- API routes detected: {recon.get('api_routes_detected', 0)}",
        f"- Env files detected: {recon.get('env_files_detected', 0)}",
        f"- CI files detected: {recon.get('ci_files_detected', 0)}",
        f"- Docker files detected: {recon.get('docker_files_detected', 0)}",
    ]
    pr_delta = []
    if profile == "pr":
        pr_delta = [
            f"- New findings: {', '.join(summary.get('new_findings', [])) or 'none'}",
            f"- Resolved findings: {', '.join(summary.get('resolved_findings', [])) or 'none'}",
            f"- Risk delta: `{summary.get('risk_delta', 0)}`",
        ]
    vulnerabilities = []
    if command != "secure":
        for finding in findings:
            vulnerabilities.extend(
                [
                    f"### {finding.finding_id} — {finding.title}",
                    f"- Severity: `{finding.severity}`",
                    f"- Confidence: `{finding.confidence}`",
                    f"- Location: `{finding.file_path}:{finding.line_start}`",
                    f"- Evidence: {finding.evidence}",
                    f"- Impact: {finding.impact}",
                    f"- Safe attack path: {finding.safe_attack_path}",
                    f"- Remediation: {finding.remediation}",
                    f"- References: {', '.join(finding.references)}",
                    "",
                ]
            )
        if not vulnerabilities:
            vulnerabilities = ["No findings detected in the current scan scope."]

    defensive_actions = [f"- {finding.remediation}" for finding in findings[:10]] or ["- Continue monitoring and preserve current posture."]
    if command == "secure":
        defensive_actions = []
        if findings:
            for index, finding in enumerate(findings[:10], start=1):
                defensive_actions.append(f"{index}. {finding.remediation} (`{finding.finding_id}` at `{finding.file_path}:{finding.line_start}`)")
        else:
            defensive_actions = ["- No remediation required from the current scan scope."]
    score_lines = [
        f"- Score: `{score['score']}`",
        f"- Risk level: `{score['risk_level']}`",
        f"- Totals: critical={score['totals']['critical']}, high={score['totals']['high']}, medium={score['totals']['medium']}, low={score['totals']['low']}",
    ]

    sections = ["# Cyber Mythos Report", "", "## System Summary", *system_summary, ""]
    if pr_delta:
        sections.extend(["## PR Delta", *pr_delta, ""])

    if command != "secure":
        sections.extend(["## Attack Surface Map", *attack_surface, "", "## Vulnerability Report", *vulnerabilities])
        if command != "panic":
            sections.extend(["## Safe Attack Path Simulation", *[f"- {path}" for path in attack_paths], ""])

    sections.extend(["## Defensive Actions", *defensive_actions, "", "## Security Score", *score_lines, ""])
    return "\n".join(sections)


def write_report(report_path: Path, content: str) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(content, encoding="utf-8")
