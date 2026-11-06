import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app import postgres
from app.citator_db import (
    LANDMARK_CITATIONS_DB,
    extract_potential_citations,
    lookup_citation,
    verify_citation_query,
)

logger = logging.getLogger(__name__)


def require_case_migration() -> None:
    if not postgres.case_migration_ready:
        raise HTTPException(
            status_code=503,
            detail="Storage is unavailable until legacy database initialization completes.",
        )


router = APIRouter(
    prefix="/api/judgment-validity",
    tags=["judgment-validity"],
    dependencies=[Depends(require_case_migration)],
)


class VerifyCitationRequest(BaseModel):
    citation: str = Field(min_length=1, max_length=500)
    caseId: str | None = Field(default=None, max_length=120)


class BatchVerifyRequest(BaseModel):
    text: str | None = Field(default=None, max_length=50_000)
    citations: list[str] | None = Field(default=None)
    caseId: str | None = Field(default=None, max_length=120)


class LinkCaseRequest(BaseModel):
    caseId: str = Field(min_length=1, max_length=120)
    precedent: dict[str, Any]


@router.get("", response_model=dict)
async def get_judgment_validity_overview(
    status: str | None = None,
    q: str | None = None,
) -> dict:
    all_cases: list[dict[str, Any]] = []
    try:
        all_cases = await run_in_threadpool(postgres.list_cases)
    except Exception as exc:
        logger.warning("Could not load cases for citator library: %s", exc)

    seen_citations: dict[str, dict[str, Any]] = {}

    for key, data in LANDMARK_CITATIONS_DB.items():
        entry = dict(data)
        entry["id"] = key
        entry["linkedCaseIds"] = []
        entry["isLandmark"] = True
        cit_key = (entry.get("citation") or entry.get("caseName") or "").strip().lower()
        seen_citations[cit_key] = entry

    for c in all_cases:
        c_id = c.get("id")
        c_title = c.get("title")
        precedents = c.get("precedents") or []
        for p in precedents:
            cit_key = (p.get("citation") or p.get("caseName") or "").strip().lower()
            if not cit_key:
                continue
            if cit_key in seen_citations:
                if c_id and c_id not in seen_citations[cit_key]["linkedCaseIds"]:
                    seen_citations[cit_key]["linkedCaseIds"].append(c_id)
            else:
                entry = dict(p)
                entry["id"] = f"case-{len(seen_citations)}"
                entry["linkedCaseIds"] = [c_id] if c_id else []
                entry["isLandmark"] = False
                seen_citations[cit_key] = entry

    library = list(seen_citations.values())

    if status and status.lower() != "all":
        target = status.lower()
        library = [p for p in library if p.get("status", "").lower() == target]

    if q and q.strip():
        term = q.strip().lower()
        library = [
            p
            for p in library
            if term in p.get("caseName", "").lower()
            or term in p.get("citation", "").lower()
            or term in p.get("court", "").lower()
            or term in p.get("ratio", "").lower()
            or term in p.get("treatment", "").lower()
        ]

    stats = {
        "total": len(seen_citations),
        "goodLaw": sum(1 for p in seen_citations.values() if p.get("status") == "good_law"),
        "overruled": sum(1 for p in seen_citations.values() if p.get("status") == "overruled"),
        "distinguished": sum(
            1 for p in seen_citations.values() if p.get("status") in ("distinguished", "caution")
        ),
        "casesImpacted": len({cid for p in seen_citations.values() for cid in p.get("linkedCaseIds", [])}),
    }

    return {
        "stats": stats,
        "precedents": library,
    }


@router.post("/verify", response_model=dict)
async def verify_citation(request: VerifyCitationRequest) -> dict:
    query = request.citation.strip()
    result = verify_citation_query(query)

    if request.caseId:
        case_id = request.caseId.strip()
        try:
            case = await run_in_threadpool(postgres.get_case, case_id)
            if case:
                current_precedents = list(case.get("precedents") or [])
                if not any(
                    p.get("caseName", "").lower() == result["caseName"].lower()
                    for p in current_precedents
                ):
                    current_precedents.insert(0, result)
                    await run_in_threadpool(
                        postgres.update_case_precedents, case_id, current_precedents
                    )
        except Exception as exc:
            logger.warning("Could not attach precedent to case %s: %s", case_id, exc)

    return result


@router.post("/batch", response_model=list[dict])
async def batch_verify_citations(request: BatchVerifyRequest) -> list[dict]:
    to_verify: list[str] = []
    if request.citations:
        to_verify.extend([c.strip() for c in request.citations if c.strip()])
    if request.text:
        extracted = extract_potential_citations(request.text)
        for ext in extracted:
            if ext not in to_verify:
                to_verify.append(ext)

    results: list[dict] = []
    for item in to_verify:
        verified = verify_citation_query(item)
        results.append(verified)

    if request.caseId and results:
        case_id = request.caseId.strip()
        try:
            case = await run_in_threadpool(postgres.get_case, case_id)
            if case:
                current_precedents = list(case.get("precedents") or [])
                existing_names = {p.get("caseName", "").lower() for p in current_precedents}
                added_count = 0
                for r in results:
                    if r.get("caseName", "").lower() not in existing_names:
                        current_precedents.append(r)
                        existing_names.add(r.get("caseName", "").lower())
                        added_count += 1
                if added_count > 0:
                    await run_in_threadpool(
                        postgres.update_case_precedents, case_id, current_precedents
                    )
        except Exception as exc:
            logger.warning("Could not batch attach precedents to case %s: %s", case_id, exc)

    return results


@router.post("/link-case", response_model=dict)
async def link_precedent_to_case(request: LinkCaseRequest) -> dict:
    case_id = request.caseId.strip()
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")
        current_precedents = list(case.get("precedents") or [])
        target_name = request.precedent.get("caseName", "").strip().lower()
        if not any(p.get("caseName", "").strip().lower() == target_name for p in current_precedents):
            current_precedents.insert(0, request.precedent)
            await run_in_threadpool(postgres.update_case_precedents, case_id, current_precedents)
        return {"status": "linked", "caseId": case_id, "caseTitle": case.get("title")}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to link precedent to case: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to link precedent.") from exc
