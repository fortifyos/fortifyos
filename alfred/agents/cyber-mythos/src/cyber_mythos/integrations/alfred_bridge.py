from __future__ import annotations

from pathlib import Path
import json


def build_success_payload(*, command: str, target: str, summary: dict) -> dict:
    payload = {
        "status": "ok",
        "command": command,
        "target": target,
        "run_id": summary["run_id"],
        "score": summary["score"],
        "coverage": summary["coverage"],
        "risk_level": summary["risk_level"],
        "top_findings": summary["top_findings"],
        "report_path": summary["report_path"],
    }
    for key in ("action_required", "summary", "scan_mode", "files_scanned", "files_total", "new_findings", "resolved_findings", "risk_delta"):
        if key in summary:
            payload[key] = summary[key]
    return payload


def build_failure_payload(*, command: str, target: str, reason: str, last_success: str | None = None) -> dict:
    payload = {"status": "error", "command": command, "target": target, "reason": reason}
    if last_success:
        payload["last_success"] = last_success
    return payload


def read_latest_summary(summary_path: Path) -> dict:
    return json.loads(summary_path.read_text(encoding="utf-8"))
