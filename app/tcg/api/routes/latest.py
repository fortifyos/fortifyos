from __future__ import annotations

from fastapi import APIRouter

from app.tcg.api.store import load_latest_payload


router = APIRouter()


@router.get("/latest")
def get_latest():
    return load_latest_payload()
