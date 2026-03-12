from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.tcg.config import CONFIG


router = APIRouter()


@router.get("/archive")
def get_archive(date: str, run: str):
    path = CONFIG.data_root / "archive" / date / f"{run}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archive snapshot not found")
    return json.loads(path.read_text())

