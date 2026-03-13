from fastapi import FastAPI

from app.tcg.api.routes.archive import router as archive_router
from app.tcg.api.routes.entity import router as entity_router
from app.tcg.api.routes.latest import router as latest_router
from app.tcg.api.routes.query import router as query_router
from app.tcg.api.routes.watchlist import router as watchlist_router


app = FastAPI(title="FORTIFY OS TCG Radar API")

app.include_router(latest_router, prefix="/api/tcg")
app.include_router(entity_router, prefix="/api/tcg")
app.include_router(archive_router, prefix="/api/tcg")
app.include_router(query_router, prefix="/api/tcg")
app.include_router(watchlist_router, prefix="/api/tcg")
