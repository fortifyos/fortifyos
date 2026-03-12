from __future__ import annotations

import json

from fastapi import APIRouter

from app.tcg.config import CONFIG


router = APIRouter()


@router.get("/latest")
def get_latest():
    return json.loads((CONFIG.data_root / "latest.json").read_text())

