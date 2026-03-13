from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class LiveClientError(RuntimeError):
    pass


def fetch_json(url: str, headers: dict[str, str] | None = None, data: bytes | None = None, method: str | None = None) -> dict[str, Any]:
    request = Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except (HTTPError, URLError, TimeoutError) as exc:
        raise LiveClientError(str(exc)) from exc


@dataclass
class EbayBrowseClient:
    client_id: str
    client_secret: str
    marketplace_id: str = "EBAY_US"
    token: str | None = None
    token_expires_at: datetime | None = None

    def enabled(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _ensure_token(self) -> str:
        if self.token and self.token_expires_at and datetime.now(timezone.utc) < self.token_expires_at:
            return self.token

        creds = f"{self.client_id}:{self.client_secret}".encode("utf-8")
        auth = base64.b64encode(creds).decode("ascii")
        body = urlencode(
            {
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            }
        ).encode("utf-8")
        payload = fetch_json(
            "https://api.ebay.com/identity/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data=body,
            method="POST",
        )
        access_token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 7200))
        if not access_token:
            raise LiveClientError("eBay token response did not include access_token")
        self.token = access_token
        self.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(300, expires_in - 300))
        return access_token

    def search(self, query: str, limit: int = 10, category_ids: list[str] | None = None) -> dict[str, Any]:
        token = self._ensure_token()
        params = {"q": query, "limit": str(limit)}
        if category_ids:
            params["category_ids"] = ",".join(category_ids)
        return fetch_json(
            f"https://api.ebay.com/buy/browse/v1/item_summary/search?{urlencode(params)}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "X-EBAY-C-MARKETPLACE-ID": self.marketplace_id,
            },
        )


@dataclass
class PriceChartingClient:
    api_token: str

    def enabled(self) -> bool:
        return bool(self.api_token)

    def search(self, query: str) -> dict[str, Any]:
        if not self.api_token:
            raise LiveClientError("PriceCharting token not configured")
        params = urlencode({"t": self.api_token, "q": query})
        return fetch_json(f"https://www.pricecharting.com/api/products?{params}")
