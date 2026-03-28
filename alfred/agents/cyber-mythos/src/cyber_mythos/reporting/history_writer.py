from __future__ import annotations

from pathlib import Path
import json

from ..parsers.normalize import Finding


def load_baseline(baseline_path: Path) -> dict | None:
    if not baseline_path.exists():
        return None
    return json.loads(baseline_path.read_text(encoding="utf-8"))


def compare_against_baseline(findings: list[Finding], baseline_data: dict | None) -> dict:
    current_ids = {finding.finding_id for finding in findings}
    baseline_ids = set((baseline_data or {}).get("finding_ids", []))
    return {
        "new": sorted(current_ids - baseline_ids),
        "resolved": sorted(baseline_ids - current_ids),
        "persistent": sorted(current_ids & baseline_ids),
    }


def append_history(history_path: Path, *, timestamp: str, target: str, summary: dict, comparison: dict) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"## {timestamp} — {target}",
        f"- Score: `{summary['score']}`",
        f"- Risk level: `{summary['risk_level']}`",
        f"- New findings: {', '.join(comparison['new']) or 'none'}",
        f"- Resolved findings: {', '.join(comparison['resolved']) or 'none'}",
        f"- Persistent findings: {', '.join(comparison['persistent']) or 'none'}",
        "",
    ]
    with history_path.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def write_baseline(baseline_path: Path, *, target: str, run_id: str, finding_ids: list[str], score: int | None = None) -> None:
    baseline_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"target": target, "run_id": run_id, "finding_ids": finding_ids}
    if score is not None:
        payload["score"] = score
    baseline_path.write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )
