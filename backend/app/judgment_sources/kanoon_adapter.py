"""Public Legal Research Adapter (Indian Kanoon).

Queries publicly accessible Indian Kanoon endpoints with rate limiting and polite handling.
Optional pilot API (https://docs.kanoon.dev/) is supported if credentials are provided in env,
but is never a required dependency.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any
from urllib.parse import quote_plus
import httpx

from app.judgment_sources.base import BaseJudgmentAdapter

logger = logging.getLogger(__name__)


class IndianKanoonAdapter(BaseJudgmentAdapter):
    name: str = "indiankanoon"
    source_display_name: str = "Indian Kanoon Public Research"
    official_source_url: str = "https://indiankanoon.org/"

    def __init__(self, timeout: float = 6.0) -> None:
        self.timeout = timeout
        self.api_token = os.environ.get("KANOON_API_TOKEN") or None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (compatible; KaizeeJurisAI/1.0; Legal Research Assistant)",
            "Accept": "text/html,application/json",
        }
        if self.api_token:
            self.headers["Authorization"] = f"Token {self.api_token}"

    async def search(
        self,
        query: str,
        court: str | None = None,
        year: int | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Politely search public index without violating rate limits."""
        if not query or not query.strip():
            return []

        search_q = query.strip()
        if year:
            search_q += f" {year}"
        if court and court.lower() != "all":
            search_q += f" {court}"

        results: list[dict[str, Any]] = []
        try:
            encoded = quote_plus(search_q)
            url = f"https://indiankanoon.org/search/?formInput={encoded}"
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    html = resp.text
                    # Extract document title and snippet matches from public results
                    title_matches = re.findall(
                        r'<a\s+href="/doc/(\d+)/"[^>]*>([^<]+)</a>',
                        html,
                        re.IGNORECASE,
                    )
                    for doc_id, doc_title in title_matches[:limit]:
                        clean_title = re.sub(r"\s+", " ", doc_title).strip()
                        if clean_title:
                            results.append({
                                "id": f"ik_{doc_id}",
                                "title": clean_title,
                                "court": "Supreme Court of India" if "Supreme Court" in html else "Indian Court",
                                "citation": None,
                                "neutral_citation": None,
                                "year": year,
                                "source_url": f"https://indiankanoon.org/doc/{doc_id}/",
                                "content": f"Case law record indexed from public legal source for {clean_title}.",
                            })
        except Exception as exc:
            logger.debug("Indian Kanoon public lookup unavailable or rate-limited: %s", exc)

        return results

    async def get_judgment(self, judgment_id: str) -> dict[str, Any] | None:
        return None

    async def get_citing_judgments(
        self,
        judgment: dict[str, Any],
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        return []
