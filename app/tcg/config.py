from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class TCGConfig:
    app_env: str = os.getenv("APP_ENV", "development")
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8080"))
    data_root: Path = REPO_ROOT / "data" / "tcg"
    public_root: Path = REPO_ROOT / "public" / "tcg"
    database_path: Path = REPO_ROOT / "data" / "tcg" / "tcg_radar.db"
    enable_jp_sources: bool = os.getenv("ENABLE_JP_SOURCES", "false").lower() == "true"
    enable_translation: bool = os.getenv("ENABLE_TRANSLATION", "true").lower() == "true"
    enable_ai_narration: bool = os.getenv("ENABLE_AI_NARRATION", "false").lower() == "true"

    def ensure_dirs(self) -> None:
        for path in (
            self.data_root,
            self.data_root / "archive",
            self.data_root / "source_receipts",
            self.public_root,
            self.public_root / "archive",
            self.public_root / "source_receipts",
            self.database_path.parent,
        ):
            path.mkdir(parents=True, exist_ok=True)


CONFIG = TCGConfig()
