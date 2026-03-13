from __future__ import annotations

from fastapi import APIRouter

from app.tcg.api.store import get_watchlist_overview


router = APIRouter()


@router.get("/watchlist")
def get_watchlist():
    return get_watchlist_overview()
