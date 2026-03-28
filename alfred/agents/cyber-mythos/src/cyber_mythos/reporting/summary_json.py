from __future__ import annotations

from pathlib import Path
import json

from ..parsers.normalize import validate_summary_dict


def write_summary(summary_path: Path, summary: dict) -> None:
    validate_summary_dict(summary)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
