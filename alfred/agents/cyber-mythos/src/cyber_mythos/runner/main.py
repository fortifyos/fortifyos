from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import sys
import time
import uuid

from ..diff.diff_engine import build_diff_scope
from ..integrations.alfred_bridge import build_failure_payload, build_success_payload, read_latest_summary
from ..parsers.normalize import deduplicate_findings, normalize_path, validate_finding_dict, validate_summary_dict
from ..reporting.csv_logger import append_rows
from ..reporting.history_writer import append_history, compare_against_baseline, load_baseline, write_baseline
from ..reporting.markdown_report import render_report, write_report
from ..reporting.summary_json import write_summary
from ..rules.rule_loader import load_rules
from ..scanners.common import count_scannable_files
from ..scanners import SCANNER_ORDER
from ..scoring.score_engine import build_attack_paths, compute_score

REPO_ROOT = Path(__file__).resolve().parents[6]
MODULE_ROOT = REPO_ROOT / "alfred" / "agents" / "cyber-mythos"
OUTPUT_ROOT = MODULE_ROOT / "outputs"
SNAPSHOT_ROOT = OUTPUT_ROOT / "snapshots"
REPORT_ROOT = OUTPUT_ROOT / "reports"
KNOX_SECURITY = REPO_ROOT / "knox" / "security"
LATEST_SUMMARY_PATH = KNOX_SECURITY / "latest-security-summary.json"
CSV_LOG_PATH = KNOX_SECURITY / "security-log.csv"
HISTORY_PATH = KNOX_SECURITY / "vulnerability-history.md"
BASELINE_ROOT = KNOX_SECURITY / "baselines"
REPO_REGISTRY_PATH = KNOX_SECURITY / "repo-registry.json"


def iso_now() -> str:
    timestamp = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    return f"{timestamp}-{uuid.uuid4().hex[:6]}"


def plain_timestamp_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def slug_target(target_name: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in target_name).strip("-") or "target"


def resolve_target(target_input: str | None) -> Path:
    if not target_input:
        raise ValueError("Target is required for this command.")
    candidate = Path(target_input)
    if candidate.is_absolute():
        resolved = candidate.resolve()
    else:
        exact_repo_local = REPO_ROOT / target_input
        resolved = exact_repo_local.resolve() if exact_repo_local.exists() else (Path.cwd() / target_input).resolve()
    if not resolved.exists():
        raise ValueError(f"Target does not exist: {target_input}")
    return resolved


def ensure_security_files() -> None:
    KNOX_SECURITY.mkdir(parents=True, exist_ok=True)
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    BASELINE_ROOT.mkdir(parents=True, exist_ok=True)
    if not HISTORY_PATH.exists():
        HISTORY_PATH.write_text("# Cyber Mythos Vulnerability History\n\n", encoding="utf-8")
    if not REPO_REGISTRY_PATH.exists():
        REPO_REGISTRY_PATH.write_text(
            json.dumps(
                {
                    "repos": [
                        {
                            "name": "fortifyos",
                            "path": ".",
                            "last_scan": "",
                            "score": 100,
                        }
                    ]
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )


def load_repo_registry() -> dict:
    ensure_security_files()
    return json.loads(REPO_REGISTRY_PATH.read_text(encoding="utf-8"))


def save_repo_registry(registry: dict) -> None:
    REPO_REGISTRY_PATH.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")


def collect_scan(target: Path, *, profile: str, include_paths: set[str] | None, rules: dict) -> tuple[list, dict]:
    all_findings = []
    recon_data = {}
    triggered_scanners = 0

    for name, scanner in SCANNER_ORDER:
        if name == "repo_recon":
            findings, meta = scanner(target, include_paths=include_paths)
            recon_data.update(meta)
        else:
            findings, meta = scanner(
                target,
                repo_root=REPO_ROOT,
                framework=recon_data.get("framework", "unknown"),
                include_paths=include_paths,
                rules=rules,
            )
            if findings or meta:
                triggered_scanners += 1
        all_findings.extend(findings)

    findings = deduplicate_findings(all_findings)
    if profile == "weekly":
        triggered_scanners = max(triggered_scanners, len(SCANNER_ORDER) - 1)
    return findings, recon_data | {"triggered_scanners": triggered_scanners}


def filter_findings(findings: list, command: str) -> list:
    if command == "panic":
        return [finding for finding in findings if finding.severity in {"critical", "high"}]
    return findings


def summarize_operator_state(summary: dict) -> str:
    if summary.get("action_required"):
        if summary.get("top_findings"):
            return f"Action required: review {len(summary['top_findings'])} top findings."
        return "Action required: review scan results."
    return "No risks detected in current scan scope"


def _report_path_for(*, command: str, target_name: str, profile: str, run_id: str) -> tuple[Path, Path]:
    date_prefix = run_id.split("T", 1)[0]
    profile_suffix = f"_{profile}" if command == "audit" and profile != "default" else ""
    report_rel = Path("alfred/agents/cyber-mythos/outputs/reports") / f"{date_prefix}_{target_name}_{command}{profile_suffix}.md"
    return report_rel, REPO_ROOT / report_rel


def _build_scan_scope(target: Path, *, command: str, profile: str, diff_requested: bool) -> tuple[set[str] | None, dict]:
    if command != "audit":
        return None, {"scan_mode": "full", "files_scanned": 0, "files_total": 0, "changed_files": [], "degraded_reason": None}

    use_diff = diff_requested or profile == "pr"
    if not use_diff:
        return None, {"scan_mode": "full", "files_scanned": 0, "files_total": 0, "changed_files": [], "degraded_reason": None}

    diff_scope = build_diff_scope(target, REPO_ROOT)
    include_paths = diff_scope.scoped_files if diff_scope.scan_mode == "diff" else None
    return include_paths, {
        "scan_mode": diff_scope.scan_mode,
        "files_scanned": diff_scope.files_scanned if diff_scope.files_scanned else diff_scope.files_total,
        "files_total": diff_scope.files_total,
        "changed_files": diff_scope.changed_files,
        "degraded_reason": diff_scope.degraded_reason,
    }


def create_run_artifacts(
    *,
    command: str,
    target: Path,
    profile: str | None = None,
    diff_requested: bool = False,
) -> dict:
    ensure_security_files()
    start = time.perf_counter()
    run_started_at = plain_timestamp_now()
    run_id = iso_now()
    profile = profile or "default"
    target_name = slug_target(target.name)
    rules = load_rules()
    include_paths, scan_scope = _build_scan_scope(target, command=command, profile=profile, diff_requested=diff_requested)

    findings, recon = collect_scan(target, profile=profile, include_paths=include_paths, rules=rules)
    findings = filter_findings(findings, command)
    attack_paths = build_attack_paths(findings)
    score = compute_score(findings, scanner_count=len(SCANNER_ORDER) - 1, triggered_scanners=recon.get("triggered_scanners", 0))

    baseline_path = BASELINE_ROOT / f"{target_name}.json"
    baseline_data = load_baseline(baseline_path)
    comparison_reference = baseline_data
    if profile == "pr":
        reference_state = _reference_state_for_target(target_name)
        if reference_state is not None:
            comparison_reference = reference_state
    comparison = compare_against_baseline(findings, comparison_reference)
    risk_delta = None
    if baseline_data and isinstance(baseline_data.get("score"), int):
        risk_delta = score["score"] - baseline_data["score"]
    elif baseline_data and isinstance(baseline_data.get("run_id"), str):
        baseline_score = _score_for_run_id(baseline_data["run_id"])
        if baseline_score is not None:
            risk_delta = score["score"] - baseline_score
    elif profile == "pr":
        reference_score = _reference_score_for_target(target_name)
        if reference_score is not None:
            risk_delta = score["score"] - reference_score

    report_rel, report_path = _report_path_for(command=command, target_name=target_name, profile=profile, run_id=run_id)
    action_required = bool(findings)
    files_total = scan_scope["files_total"] or count_scannable_files(target)
    files_scanned = scan_scope["files_scanned"] or files_total
    summary = {
        "run_id": run_id,
        "target": target_name,
        "score": score["score"],
        "coverage": score["coverage"],
        "risk_level": score["risk_level"],
        "totals": score["totals"],
        "top_findings": score["top_findings"],
        "status": score["status"],
        "report_path": report_rel.as_posix(),
        "scan_mode": scan_scope["scan_mode"],
        "files_scanned": files_scanned,
        "files_total": files_total,
        "action_required": action_required,
        "summary": summarize_operator_state({"action_required": action_required, "top_findings": score["top_findings"]}),
    }
    if profile == "pr":
        summary["new_findings"] = comparison["new"]
        summary["resolved_findings"] = comparison["resolved"]
        summary["risk_delta"] = risk_delta if risk_delta is not None else 0
    validate_summary_dict(summary)
    for finding in findings:
        validate_finding_dict(finding.to_dict())

    display_findings = findings
    if profile == "pr":
        display_findings = [finding for finding in findings if finding.finding_id in comparison["new"]]

    report_content = render_report(
        command=command,
        profile=profile,
        target=target_name,
        recon=recon | scan_scope,
        findings=display_findings,
        attack_paths=attack_paths,
        score=score,
        comparison=comparison,
        summary=summary,
    )
    write_report(report_path, report_content)
    write_summary(LATEST_SUMMARY_PATH, summary)
    append_rows(CSV_LOG_PATH, timestamp=run_started_at, run_id=run_id, target=target_name, findings=findings)
    append_history(HISTORY_PATH, timestamp=run_started_at, target=target_name, summary=summary, comparison=comparison)

    snapshot_path = SNAPSHOT_ROOT / run_id.replace(":", "-")
    snapshot_path.mkdir(parents=True, exist_ok=True)
    findings_payload = [finding.to_dict() for finding in findings]
    (snapshot_path / "findings.json").write_text(json.dumps(findings_payload, indent=2) + "\n", encoding="utf-8")
    (snapshot_path / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (snapshot_path / "comparison.json").write_text(json.dumps(comparison, indent=2) + "\n", encoding="utf-8")
    duration_ms = int((time.perf_counter() - start) * 1000)
    run_json = {
        "run_id": run_id,
        "timestamp": run_started_at,
        "target": target_name,
        "command": command,
        "duration_ms": duration_ms,
        "status": "success",
    }
    (snapshot_path / "run.json").write_text(json.dumps(run_json, indent=2) + "\n", encoding="utf-8")

    summary["snapshot_path"] = normalize_path(snapshot_path, REPO_ROOT)
    summary["timestamp"] = run_started_at

    if command == "baseline":
        write_baseline(
            baseline_path,
            target=target_name,
            run_id=run_id,
            finding_ids=[finding.finding_id for finding in findings],
            score=score["score"],
        )

    _update_registry_entry(target_name=target_name, target_path=target, score=score["score"], timestamp=run_started_at)
    return build_success_payload(command=command, target=target_name, summary=summary)


def _update_registry_entry(*, target_name: str, target_path: Path, score: int, timestamp: str) -> None:
    registry = load_repo_registry()
    for repo in registry.get("repos", []):
        if repo.get("name") == target_name or resolve_target(repo.get("path", ".")).resolve() == target_path.resolve():
            repo["last_scan"] = timestamp
            repo["score"] = score
            save_repo_registry(registry)
            return


def _reference_score_for_target(target_name: str) -> int | None:
    if not SNAPSHOT_ROOT.exists():
        return None
    snapshots = sorted([path for path in SNAPSHOT_ROOT.iterdir() if path.is_dir()], reverse=True)
    for snapshot in snapshots:
        summary_path = snapshot / "summary.json"
        if not summary_path.exists():
            continue
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if summary.get("target") == target_name and isinstance(summary.get("score"), int):
            return summary["score"]
    return None


def _score_for_run_id(run_id: str) -> int | None:
    summary_path = SNAPSHOT_ROOT / run_id.replace(":", "-") / "summary.json"
    if not summary_path.exists():
        return None
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if isinstance(summary.get("score"), int):
        return summary["score"]
    return None


def _reference_state_for_target(target_name: str) -> dict | None:
    if not SNAPSHOT_ROOT.exists():
        return None
    snapshots = sorted([path for path in SNAPSHOT_ROOT.iterdir() if path.is_dir()], reverse=True)
    for snapshot in snapshots:
        summary_path = snapshot / "summary.json"
        findings_path = snapshot / "findings.json"
        if not summary_path.exists() or not findings_path.exists():
            continue
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            findings = json.loads(findings_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if summary.get("target") != target_name:
            continue
        return {
            "score": summary.get("score"),
            "finding_ids": [finding["finding_id"] for finding in findings if "finding_id" in finding],
        }
    return None


def cmd_sync_security() -> dict:
    ensure_security_files()
    snapshots = sorted([path for path in SNAPSHOT_ROOT.iterdir() if path.is_dir()])
    if not snapshots:
        raise RuntimeError("No snapshots available to sync.")
    latest = snapshots[-1]
    summary_path = latest / "summary.json"
    if not summary_path.exists():
        raise RuntimeError("Latest snapshot missing summary.json")
    shutil.copyfile(summary_path, LATEST_SUMMARY_PATH)
    summary = read_latest_summary(LATEST_SUMMARY_PATH)
    validate_summary_dict(summary)
    return build_success_payload(command="sync-security", target=summary["target"], summary=summary)


def cmd_audit_all(*, profile: str, diff_requested: bool) -> dict:
    registry = load_repo_registry()
    results = []
    failures = []
    for repo in registry.get("repos", []):
        try:
            target = resolve_target(repo["path"])
            payload = create_run_artifacts(command="audit", target=target, profile=profile, diff_requested=diff_requested)
            results.append({"name": repo["name"], "status": "ok", "result": payload})
        except Exception as exc:  # noqa: BLE001
            failures.append({"name": repo["name"], "reason": str(exc)})
            results.append({"name": repo["name"], "status": "error", "reason": str(exc)})
    return {
        "status": "degraded" if failures else "ok",
        "command": "audit-all",
        "profile": profile,
        "repos": results,
        "summary": "All repos scanned successfully" if not failures else f"{len(failures)} repo scans failed",
        "failures": failures,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cyber Mythos local-first security analysis CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    audit = subparsers.add_parser("audit")
    audit.add_argument("--target")
    audit.add_argument("--profile", choices=("default", "weekly", "pr"), default="default")
    audit.add_argument("--diff", action="store_true")
    audit.add_argument("--all", action="store_true")

    for name in ("panic", "secure", "baseline"):
        sub = subparsers.add_parser(name)
        sub.add_argument("--target", required=True)

    subparsers.add_parser("sync-security")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        if args.command == "sync-security":
            payload = cmd_sync_security()
        elif args.command == "audit" and args.all:
            payload = cmd_audit_all(profile=args.profile, diff_requested=args.diff)
        else:
            target = resolve_target(args.target)
            profile = getattr(args, "profile", "default")
            diff_requested = bool(getattr(args, "diff", False))
            payload = create_run_artifacts(command=args.command, target=target, profile=profile, diff_requested=diff_requested)
        print(json.dumps(payload, indent=2))
        return 0
    except Exception as exc:  # noqa: BLE001
        command = getattr(args, "command", "unknown")
        target = getattr(args, "target", "") or ("all" if getattr(args, "all", False) else "")
        payload = build_failure_payload(command=command, target=target or "unknown", reason=str(exc))
        print(json.dumps(payload, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
