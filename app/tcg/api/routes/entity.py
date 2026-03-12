from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.tcg.config import CONFIG


router = APIRouter()


@router.get("/entity/{entity_id}")
def get_entity(entity_id: str):
    payload = json.loads((CONFIG.data_root / "latest.json").read_text())
    for signal in payload.get("top_signals", []):
        if signal.get("entity_id") == entity_id:
            return signal
    raise HTTPException(status_code=404, detail="Entity not found")

