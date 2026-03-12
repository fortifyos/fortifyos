from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.tcg.api.store import get_entity_detail


router = APIRouter()


@router.get("/entity/{entity_id}")
def get_entity(entity_id: str):
    payload = get_entity_detail(entity_id)
    if payload:
        return payload
    raise HTTPException(status_code=404, detail="Entity not found")
