"""Judgment Validity Tracking API (v1).

Implements the official Kaizee JurisAI Judgment Validity endpoints:
- POST /api/v1/judgment/search
- POST /api/v1/judgment/analyze
- GET  /api/v1/judgment/{judgment_id}
- GET  /api/v1/judgment/{judgment_id}/treatment-history
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app import postgres
from app.judgment_classifier import (
    classify_treatment_with_ai,
    compute_overall_validity_status,
)
from app.judgment_sources.manager import JudgmentSourcesManager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/judgment",
    tags=["judgment-validity-v1"],
)

manager = JudgmentSourcesManager()


class JudgmentSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    court: str | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1800, le=2100)
    limit: int = Field(default=15, ge=1, le=50)


class JudgmentAnalyzeRequest(BaseModel):
    query: str | None = Field(default=None, max_length=500)
    judgment_id: str | None = Field(default=None, max_length=120)
    court: str | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1800, le=2100)


@router.post("/search", response_model=dict)
async def search_judgments_endpoint(request: JudgmentSearchRequest) -> dict:
    """Searches for Indian court judgments across official e-SCR, SCI, and indexed public records."""
    results = await manager.search(
        query=request.query,
        court=request.court,
        year=request.year,
        limit=request.limit,
    )

    clean_results: list[dict[str, Any]] = []
    for item in results:
        clean_results.append({
            "id": item["id"],
            "title": item["title"],
            "court": item.get("court") or "Supreme Court of India",
            "year": item.get("year"),
            "citation": item.get("citation"),
            "neutral_citation": item.get("neutral_citation"),
            "bench_strength": item.get("bench_strength", 2),
            "judgment_date": item.get("judgment_date"),
            "source_url": item.get("source_url") or "https://scr.sci.gov.in/scrsearch/",
        })

    return {
        "query": request.query,
        "court": request.court,
        "year": request.year,
        "total": len(clean_results),
        "results": clean_results,
    }


@router.post("/analyze", response_model=dict)
async def analyze_judgment_validity_endpoint(request: JudgmentAnalyzeRequest) -> dict:
    """Analyzes the subsequent judicial treatment and validity of an Indian court judgment."""
    target_judgment: dict[str, Any] | None = None

    # Step 1: Retrieve original judgment by ID or query search
    if request.judgment_id:
        target_judgment = await manager.get_judgment(request.judgment_id)

    if not target_judgment and request.query:
        search_results = await manager.search(
            query=request.query,
            court=request.court,
            year=request.year,
            limit=1,
        )
        if search_results:
            target_judgment = search_results[0]

    if not target_judgment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Judgment not found in available court records. Try searching with full title or neutral citation.",
        )

    # Step 2: Retrieve subsequent citing judgments
    citing_judgments = await manager.get_citing_judgments(target_judgment)

    # Step 3: Classify each treatment using AI and source text validation
    classified_treatments: list[dict[str, Any]] = []
    for later_item in citing_judgments:
        classified = await classify_treatment_with_ai(
            original_judgment=target_judgment,
            later_judgment=later_item,
        )
        classified_treatments.append(classified)

        # Persist treatment in PostgreSQL if connection available
        try:
            treatment_record = {
                "id": f"treat_{target_judgment['id']}_{later_item.get('id', uuid4().hex[:8])}",
                "original_judgment_id": target_judgment["id"],
                "later_judgment_id": later_item.get("id"),
                "treatment_type": classified["type"],
                "legal_proposition": classified["legal_proposition"],
                "supporting_text": classified["supporting_text"],
                "paragraph_reference": ", ".join(classified.get("supporting_paragraphs", [])),
                "confidence": classified["confidence"],
                "verification_status": classified["verification_status"],
            }
            postgres.save_judgment_treatment(treatment_record)
        except Exception as exc:
            logger.debug("Could not persist treatment to DB: %s", exc)

    # Step 4: Compute overall status
    overall_status = compute_overall_validity_status(classified_treatments)

    now_iso = datetime.now(timezone.utc).isoformat()
    limitations = [
        "Searched Supreme Court e-SCR, official judgments (sci.gov.in), and indexed legal records.",
        f"Records verified up to {now_iso[:10]}. Recent unreserved or pending reviews are subject to judicial finality.",
        "A 'FOLLOWED' status indicates absence of adverse treatment in searched records, never an absolute warranty of future validity.",
    ]

    return {
        "judgment": {
            "id": target_judgment["id"],
            "title": target_judgment["title"],
            "court": target_judgment.get("court") or "Supreme Court of India",
            "year": target_judgment.get("year"),
            "citation": target_judgment.get("citation"),
            "neutral_citation": target_judgment.get("neutral_citation"),
            "bench_strength": target_judgment.get("bench_strength", 2),
            "judgment_date": target_judgment.get("judgment_date"),
            "source_url": target_judgment.get("source_url") or "https://scr.sci.gov.in/scrsearch/",
        },
        "overall_status": overall_status,
        "treatments": classified_treatments,
        "limitations": limitations,
        "last_checked": now_iso,
    }


@router.get("/{judgment_id}", response_model=dict)
async def get_judgment_details_endpoint(judgment_id: str) -> dict:
    """Retrieves original judgment details and metadata."""
    judgment = await manager.get_judgment(judgment_id)
    if not judgment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Judgment with ID '{judgment_id}' not found.",
        )
    return judgment


@router.get("/{judgment_id}/treatment-history", response_model=dict)
async def get_treatment_history_endpoint(judgment_id: str) -> dict:
    """Retrieves chronological subsequent treatment history for a judgment."""
    judgment = await manager.get_judgment(judgment_id)
    if not judgment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Judgment with ID '{judgment_id}' not found.",
        )

    citing = await manager.get_citing_judgments(judgment)
    treatments: list[dict[str, Any]] = []
    for item in citing:
        classified = await classify_treatment_with_ai(judgment, item)
        treatments.append(classified)

    return {
        "judgment_id": judgment_id,
        "title": judgment.get("title"),
        "total_treatments": len(treatments),
        "history": sorted(treatments, key=lambda x: x.get("year") or 0, reverse=True),
    }
