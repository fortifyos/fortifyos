from __future__ import annotations

from typing import Protocol

from app.tcg.schemas import RawEvent


class SourceAdapter(Protocol):
    source_name: str

    def fetch(self) -> list[RawEvent]:
        ...

    def healthcheck(self) -> dict:
        ...

