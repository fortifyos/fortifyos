from __future__ import annotations

from pathlib import Path
import csv

from ..parsers.normalize import Finding

HEADERS = [
    "timestamp",
    "run_id",
    "target",
    "finding_id",
    "severity",
    "category",
    "status",
    "file_path",
    "line_start",
    "line_end",
    "score_impact",
]

_SCORE_IMPACT = {"critical": 25, "high": 15, "medium": 8, "low": 3}


def append_rows(csv_path: Path, *, timestamp: str, run_id: str, target: str, findings: list[Finding]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    exists = csv_path.exists()
    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        if not exists:
            writer.writeheader()
        if not findings:
            writer.writerow(
                {
                    "timestamp": timestamp,
                    "run_id": run_id,
                    "target": target,
                    "finding_id": "CM-RUN-CLEAN",
                    "severity": "low",
                    "category": "run",
                    "status": "clean",
                    "file_path": "",
                    "line_start": 0,
                    "line_end": 0,
                    "score_impact": 0,
                }
            )
            return
        for finding in findings:
            writer.writerow(
                {
                    "timestamp": timestamp,
                    "run_id": run_id,
                    "target": target,
                    "finding_id": finding.finding_id,
                    "severity": finding.severity,
                    "category": finding.category,
                    "status": "open",
                    "file_path": finding.file_path,
                    "line_start": finding.line_start,
                    "line_end": finding.line_end,
                    "score_impact": _SCORE_IMPACT[finding.severity],
                }
            )
