"""Supreme Court e-SCR and Official Supreme Court of India Adapter.

Queries official Supreme Court neutral citations and reports:
- https://scr.sci.gov.in/scrsearch/
- https://www.sci.gov.in/judgments/
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote_plus
import httpx

from app.judgment_sources.base import BaseJudgmentAdapter

logger = logging.getLogger(__name__)


class ESCRAdapter(BaseJudgmentAdapter):
    name: str = "escr"
    source_display_name: str = "Supreme Court of India (e-SCR)"
    official_source_url: str = "https://scr.sci.gov.in/scrsearch/"

    def __init__(self, timeout: float = 8.0) -> None:
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (compatible; KaizeeJurisAI/1.0; Legal Research Assistant)",
            "Accept": "text/html,application/json,text/plain",
        }

    async def search(
        self,
        query: str,
        court: str | None = None,
        year: int | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search Supreme Court e-SCR and official reports."""
        if not query or not query.strip():
            return []

        # If court is specified and is not Supreme Court, skip e-SCR
        if court and "supreme" not in court.lower() and "sci" not in court.lower() and court.lower() != "all":
            return []

        results: list[dict[str, Any]] = []
        try:
            # Query official search endpoint with polite timeout
            encoded = quote_plus(query.strip())
            search_url = f"https://scr.sci.gov.in/scrsearch/?q={encoded}"
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(search_url, headers=self.headers)
                if resp.status_code == 200:
                    text = resp.text
                    # Extract title and neutral citation patterns
                    # e.g., 2024 INSC 150 or similar
                    neutral_matches = re.findall(r"(\d{4}\s+INSC\s+\d+)", text)
                    if neutral_matches:
                        for n_cit in neutral_matches[:limit]:
                            results.append({
                                "id": f"escr_{re.sub(r'[^a-zA-Z0-9]', '_', n_cit.lower())}",
                                "title": f"Supreme Court Judgment ({n_cit})",
                                "court": "Supreme Court of India",
                                "citation": None,
                                "neutral_citation": n_cit,
                                "year": int(n_cit.split()[0]) if n_cit.split()[0].isdigit() else year,
                                "source_url": search_url,
                                "content": f"Official record retrieved from Supreme Court of India e-SCR for {n_cit}.",
                            })
        except Exception as exc:
            logger.debug("e-SCR live search unavailable: %s", exc)

        return results

    async def get_judgment(self, judgment_id: str) -> dict[str, Any] | None:
        return None

    async def get_citing_judgments(
        self,
        judgment: dict[str, Any],
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        return []
