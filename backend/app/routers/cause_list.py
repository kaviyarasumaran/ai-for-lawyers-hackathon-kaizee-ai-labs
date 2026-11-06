"""Router for Madras High Court Daily Cause List extraction, automated pipeline, and AI intelligence."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.cause_list_db import (
    answer_cause_list_query,
    create_cause_list_pdf_from_items,
    empty_mhc_cause_list,
    extract_text_from_pdf_bytes,
    normalize_date_to_ddmmyyyy,
    parse_mhc_cause_list_text,
)
from app.cause_list_pipeline import (
    execute_cause_list_pipeline,
    get_cause_list_from_store,
    get_cause_list_pdf_from_store,
    get_pipeline_status,
    load_pipeline_history,
    purge_all_cause_lists,
    save_cause_list_pdf_to_store,
    save_cause_list_to_store,
)
from app.court_list_assistant_pipeline import execute_court_list_assistant_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cause-list",
    tags=["cause-list"],
)


class CauseListAiQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1_000)
    date: str | None = Field(default=None, max_length=30)
    items: list[dict[str, Any]] = Field(default_factory=list)


class CauseListPipelineTriggerRequest(BaseModel):
    date: str | None = Field(default=None, max_length=30)


@router.get("")
async def get_cause_list(
    date: str | None = Query(default=None, description="Date in DDMMYYYY or YYYY-MM-DD format"),
    page: int | None = Query(default=None, ge=1, description="Page number (1-based)"),
    page_size: int | None = Query(default=None, ge=1, le=500, description="Items per page"),
    pageSize: int | None = Query(default=None, ge=1, le=500, description="Items per page (camelCase alias)"),
    search: str | None = Query(default=None, description="Search term for case, party, counsel, or judge"),
    court: str | None = Query(default=None, description="Filter by court number"),
    category: str | None = Query(default=None, description="Filter by category (admission, orders, final, special)"),
    session: str | None = Query(default=None, description="Filter by session (morning, afternoon)"),
) -> dict[str, Any]:
    """Retrieves cause list for given date with optional filtering and pagination."""
    date_code, display_date = normalize_date_to_ddmmyyyy(date)
    stored = get_cause_list_from_store(date_code)
    if not stored:
        stored = empty_mhc_cause_list(date_code, display_date)

    all_items = list(stored.get("items") or [])
    filtered_items = all_items

    # Optional server-side filtering
    if search and search.strip():
        q = search.strip().lower()
        filtered_items = [
            it for it in filtered_items
            if (
                q in it.get("caseNumber", "").lower()
                or q in it.get("parties", "").lower()
                or q in it.get("counsels", "").lower()
                or q in it.get("courtNumber", "").lower()
                or q in it.get("itemNumber", "").lower()
                or q in it.get("judge", "").lower()
            )
        ]

    if court and court != "all":
        filtered_items = [it for it in filtered_items if it.get("courtNumber") == court]

    if category and category != "all":
        c_lower = category.lower()
        filtered_items = [
            it for it in filtered_items
            if (
                ("motion" in it.get("category", "").lower() or "admission" in it.get("category", "").lower())
                if c_lower == "admission"
                else "order" in it.get("category", "").lower()
                if c_lower == "orders"
                else "final" in it.get("category", "").lower()
                if c_lower == "final"
                else "special" in it.get("category", "").lower()
                if c_lower == "special"
                else True
            )
        ]

    if session and session != "all":
        s_lower = session.lower()
        filtered_items = [
            it for it in filtered_items
            if (
                ("morning" in it.get("session", "").lower() or "10:30" in it.get("session", "").lower())
                if s_lower == "morning"
                else ("afternoon" in it.get("session", "").lower() or "02:15" in it.get("session", "").lower())
                if s_lower == "afternoon"
                else True
            )
        ]

    total_items = len(all_items)
    total_filtered = len(filtered_items)
    resolved_page_size = pageSize or page_size or 50

    # Summary statistics across full board
    admissions_count = sum(
        1 for it in all_items
        if "admission" in it.get("category", "").lower() or "motion" in it.get("category", "").lower()
    )
    orders_count = sum(1 for it in all_items if "order" in it.get("category", "").lower())
    final_count = sum(1 for it in all_items if "final" in it.get("category", "").lower())

    stats = {
        "total": total_items,
        "courtCount": len(stored.get("courts") or []),
        "admissions": admissions_count,
        "forOrders": orders_count,
        "finalHearings": final_count,
    }

    if page is not None:
        total_pages = max(1, (total_filtered + resolved_page_size - 1) // resolved_page_size) if total_filtered > 0 else 1
        current_page = max(1, page)
        start = (current_page - 1) * resolved_page_size
        end = start + resolved_page_size
        paged_items = filtered_items[start:end]
        has_more = current_page < total_pages
        has_prev = current_page > 1
    else:
        current_page = 1
        total_pages = 1
        paged_items = filtered_items
        resolved_page_size = total_filtered
        has_more = False
        has_prev = False

    return {
        **stored,
        "totalItems": total_items,
        "totalFiltered": total_filtered,
        "page": current_page,
        "pageSize": resolved_page_size,
        "totalPages": total_pages,
        "hasMore": has_more,
        "hasPrev": has_prev,
        "stats": stats,
        "items": paged_items,
    }


@router.get("/download")
async def download_cause_list_pdf(date: str | None = Query(default=None)) -> Response:
    """Streams the official / stored Madras High Court cause list PDF."""
    date_code, display_date = normalize_date_to_ddmmyyyy(date)
    pdf_bytes = get_cause_list_pdf_from_store(date_code)
    if not pdf_bytes:
        stored = get_cause_list_from_store(date_code)
        items = stored.get("items", []) if stored else []
        pdf_bytes = await run_in_threadpool(create_cause_list_pdf_from_items, items, date_code, display_date)
        save_cause_list_pdf_to_store(date_code, pdf_bytes)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cause_{date_code}.pdf"',
            "Content-Type": "application/pdf",
        },
    )


@router.post("/pipeline/trigger")
async def trigger_cause_list_pipeline(
    request: CauseListPipelineTriggerRequest | None = None,
) -> dict[str, Any]:
    """Manually triggers the daily Cause List download, OCR, and storage pipeline."""
    req_date = request.date if request else None
    return await execute_cause_list_pipeline(req_date, trigger_type="MANUAL")


@router.post("/pipeline/purge")
async def trigger_cause_list_purge() -> dict[str, Any]:
    """Manually triggers the 11:55 PM cause list deletion so storage strictly retains that day only."""
    return purge_all_cause_lists(trigger_type="MANUAL_PURGE")


@router.get("/pipeline/status")
async def get_cause_list_pipeline_status() -> dict[str, Any]:
    """Returns the current status of the 1:00 AM daily Cause List pipeline scheduler."""
    return get_pipeline_status()


@router.get("/pipeline/history")
async def get_cause_list_pipeline_history(
    limit: int = Query(default=20, ge=1, le=50),
) -> list[dict[str, Any]]:
    """Returns historical execution logs of the cause list pipeline."""
    return load_pipeline_history(limit=limit)


@router.post("/upload")
async def upload_cause_list_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    """Uploads a local cause list PDF and extracts court listings via PyMuPDF OCR."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        content = await file.read()
        extracted_text = await run_in_threadpool(extract_text_from_pdf_bytes, content)
        if not extracted_text.strip():
            raise HTTPException(status_code=422, detail="No readable text could be extracted from this PDF.")

        date_code, display_date = normalize_date_to_ddmmyyyy()
        items = await run_in_threadpool(parse_mhc_cause_list_text, extracted_text, display_date)

        if not items:
            return empty_mhc_cause_list(
                date_code,
                display_date,
                message=f"No court listings could be recognized in {file.filename}.",
            )

        courts = list({item["courtNumber"] for item in items})
        courts.sort()

        result = {
            "date": date_code,
            "dateFormatted": display_date,
            "courtName": "High Court of Judicature at Madras (Uploaded)",
            "officialPdfUrl": "",
            "source": f"Uploaded File: {file.filename}",
            "isLive": False,
            "totalItems": len(items),
            "courts": courts,
            "items": items,
        }

        # Store uploaded PDF and parsed data
        save_cause_list_pdf_to_store(date_code, content)
        save_cause_list_to_store(date_code, result)

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to parse uploaded cause list: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to process cause list PDF: {exc}")


@router.post("/ai-query")
async def query_cause_list_ai(request: CauseListAiQueryRequest) -> dict[str, Any]:
    """Answers natural language questions about the active cause list using the dedicated Court List Assistant pipeline."""
    date_code, _ = normalize_date_to_ddmmyyyy(request.date)
    items = request.items
    if not items:
        # Load from store if available without triggering live pipeline or embedding
        stored = get_cause_list_from_store(date_code)
        if stored and stored.get("items"):
            items = stored["items"]
        else:
            items = []

    return await execute_court_list_assistant_pipeline(
        query=request.query,
        date=request.date,
        items=items,
    )
