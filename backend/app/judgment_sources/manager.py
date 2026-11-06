"""Judgment Sources Manager.

Orchestrates searches across verified court records, official Supreme Court e-SCR,
and public legal sources, caching verified entities in PostgreSQL.
"""

from __future__ import annotations

import logging
from typing import Any

from app import postgres
from app.judgment_sources.base import BaseJudgmentAdapter
from app.judgment_sources.ecourts_adapter import ECourtsAdapter
from app.judgment_sources.escr_adapter import ESCRAdapter
from app.judgment_sources.kanoon_adapter import IndianKanoonAdapter
from app.judgment_sources.verified_store import (
    VERIFIED_JUDGMENTS_DB,
    get_verified_judgment_by_id,
    search_verified_judgments,
)

logger = logging.getLogger(__name__)


class JudgmentSourcesManager:
    def __init__(self) -> None:
        self.adapters: list[BaseJudgmentAdapter] = [
            ESCRAdapter(),
            ECourtsAdapter(),
            IndianKanoonAdapter(),
        ]

    def _sync_verified_to_postgres(self, item: dict[str, Any]) -> None:
        """Persists verified judgment record into PostgreSQL judgments table."""
        try:
            postgres.save_judgment(item)
            for citing in item.get("citing_judgments", []):
                citing_copy = dict(citing)
                citing_copy.setdefault("source_url", item.get("source_url"))
                postgres.save_judgment(citing_copy)
                citation_id = f"cit_{item['id']}_{citing['id']}"
                postgres.save_judgment_citation(
                    citation_id=citation_id,
                    citing_judgment_id=citing["id"],
                    cited_judgment_id=item["id"],
                    paragraph_reference=", ".join(citing.get("supporting_paragraphs", [])),
                )
        except Exception as exc:
            logger.debug("Could not persist judgment to DB (running offline or unmigrated): %s", exc)

    async def search(
        self,
        query: str,
        court: str | None = None,
        year: int | None = None,
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Search judgments across verified repository, PostgreSQL, and online adapters."""
        cleaned = (query or "").strip()
        if not cleaned:
            return []

        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        # 1. Authoritative verified ground-truth repository
        verified = search_verified_judgments(cleaned, court=court, year=year, limit=limit)
        for item in verified:
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                results.append(item)
                self._sync_verified_to_postgres(item)

        # 2. Database search
        try:
            db_results = postgres.search_judgments_db(cleaned, court=court, year=year, limit=limit)
            for item in db_results:
                if item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    results.append(item)
        except Exception as exc:
            logger.debug("Database judgment search exception: %s", exc)

        # 3. External adapters (e-SCR, Kanoon) if results are below desired limit
        if len(results) < limit:
            remaining = limit - len(results)
            for adapter in self.adapters:
                try:
                    adapter_res = await adapter.search(cleaned, court=court, year=year, limit=remaining)
                    for item in adapter_res:
                        if item["id"] not in seen_ids:
                            seen_ids.add(item["id"])
                            results.append(item)
                            try:
                                postgres.save_judgment(item)
                            except Exception:
                                pass
                except Exception as exc:
                    logger.debug("Adapter %s search error: %s", adapter.name, exc)

        return results[:limit]

    async def get_judgment(self, judgment_id: str) -> dict[str, Any] | None:
        """Retrieve original judgment details by identifier."""
        # Check verified store
        v_item = get_verified_judgment_by_id(judgment_id)
        if v_item:
            self._sync_verified_to_postgres(v_item)
            return v_item

        # Check PostgreSQL
        try:
            db_item = postgres.get_judgment_by_id(judgment_id)
            if db_item:
                return db_item
        except Exception as exc:
            logger.debug("Database judgment lookup error: %s", exc)

        # Check full list in verified store by title match
        clean_id = judgment_id.lower().replace("-", "_").replace(" ", "_")
        for k, v in VERIFIED_JUDGMENTS_DB.items():
            if k == clean_id or v["id"] == judgment_id:
                return v

        return None

    async def get_citing_judgments(
        self,
        judgment: dict[str, Any],
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Retrieve subsequent citing judgments with paragraphs and treatment details."""
        j_id = judgment.get("id")
        v_item = get_verified_judgment_by_id(j_id) if j_id else None
        if not v_item:
            # Try finding in verified store by title or citation
            v_matches = search_verified_judgments(judgment.get("title", ""), limit=1)
            if v_matches:
                v_item = v_matches[0]

        citing_list: list[dict[str, Any]] = []
        if v_item and "citing_judgments" in v_item:
            citing_list.extend(v_item["citing_judgments"])

        # Also load from PostgreSQL treatments/citations
        if j_id:
            try:
                db_treatments = postgres.get_judgment_treatments_db(j_id)
                for t in db_treatments:
                    citing_list.append({
                        "id": t.get("later_judgment_id") or t["id"],
                        "title": t.get("later_title") or "Subsequent Citing Judgment",
                        "court": t.get("later_court") or "Supreme Court of India",
                        "year": t.get("later_year"),
                        "citation": t.get("later_citation"),
                        "neutral_citation": t.get("later_neutral_citation"),
                        "bench_strength": t.get("later_bench_strength", 2),
                        "source_url": t.get("later_source_url"),
                        "treatment_type": t["treatment_type"],
                        "legal_proposition": t["legal_proposition"],
                        "supporting_paragraphs": [t["paragraph_reference"]] if t.get("paragraph_reference") else [],
                        "supporting_text": t["supporting_text"],
                        "confidence": t["confidence"],
                        "verification_status": t["verification_status"],
                    })
            except Exception as exc:
                logger.debug("DB treatment lookup error: %s", exc)

        return citing_list[:limit]
