from datetime import datetime, timezone
import json
import logging
from pathlib import PurePosixPath
import re
from uuid import uuid4

import psycopg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from app import pipeline, postgres
from app.cause_list_db import fetch_mhc_cause_list_data, normalize_date_to_ddmmyyyy
from app.cause_list_pipeline import STORE_DIR, get_cause_list_from_store
from app.citator_db import LANDMARK_CITATIONS_DB, verify_citation_query
from app.storage import (
    StorageError,
    delete_file,
    download_file,
    storage_http_exception,
    upload_file,
)

logger = logging.getLogger(__name__)
def require_case_migration() -> None:
    if not postgres.case_migration_ready:
        raise HTTPException(
            status_code=503,
            detail=(
                "Case storage is unavailable until legacy case migration completes. "
                "Check MongoDB and PostgreSQL connectivity in the backend logs."
            ),
        )


router = APIRouter(
    prefix="/api/cases",
    tags=["cases"],
    dependencies=[Depends(require_case_migration)],
)
MAX_FILE_SIZE = 25 * 1024 * 1024


class CaseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    matterType: str = Field(min_length=1, max_length=80)
    parties: str = Field(default="", max_length=500)
    summary: str = Field(default="", max_length=5_000)
    status: str = Field(default="Open", min_length=1, max_length=40)


class CaseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=160)
    matterType: str | None = Field(default=None, min_length=1, max_length=80)
    parties: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, max_length=5_000)
    status: str | None = Field(default=None, min_length=1, max_length=40)


class CauseListUpdate(BaseModel):
    courtName: str | None = None
    courtNumber: str | None = None
    bench: str | None = None
    itemNumber: str | None = None
    listType: str | None = None
    hearingDate: str | None = None
    stage: str | None = None
    status: str | None = None
    lastMinuteAlert: str | None = None
    notes: str | None = None
    caseNumber: str | None = None
    courtHall: str | None = None


class CaseMatchRequest(BaseModel):
    caseNumber: str | None = None
    parties: str | None = None


class HearingRecordCreate(BaseModel):
    date: str = Field(min_length=1, max_length=30)
    courtNumber: str | None = None
    judge: str | None = None
    stage: str | None = None
    session: str | None = None
    arguments: str = Field(default="", max_length=15000)
    observations: str | None = Field(default="", max_length=5000)
    outcome: str | None = Field(default="", max_length=5000)
    nextDate: str | None = None
    audioTranscribed: bool = False


class CitationCheckRequest(BaseModel):
    citation: str = Field(min_length=2, max_length=250)


def safe_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "upload").replace("\\", "/")).name
    return name or "upload"


def _storage_unavailable(exc: Exception) -> HTTPException:
    logger.exception("PostgreSQL case storage is unavailable")
    return HTTPException(
        status_code=503,
        detail="Case storage is unavailable. Check POSTGRES_DSN and the Supabase PostgreSQL service.",
    )


@router.get("", response_model=list[dict])
async def list_cases() -> list[dict]:
    try:
        return await run_in_threadpool(postgres.list_cases)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_case(request: CaseCreate) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    case = {
        "id": str(uuid4()),
        "chatId": str(uuid4()),
        "title": request.title.strip(),
        "matterType": request.matterType.strip(),
        "parties": request.parties.strip(),
        "summary": request.summary.strip(),
        "status": request.status.strip(),
        "createdAt": now,
        "lastActivityAt": now,
    }
    if not case["title"] or not case["matterType"]:
        raise HTTPException(status_code=422, detail="Case title and matter type are required.")
    try:
        return await run_in_threadpool(postgres.create_case, case)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc


@router.get("/{case_id}", response_model=dict)
async def get_case(case_id: str) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


@router.put("/{case_id}", response_model=dict)
async def update_case(case_id: str, request: CaseUpdate) -> dict:
    updates = request.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one case field to update.")
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Case fields cannot be null.")
    updates = {
        field: value.strip() if isinstance(value, str) else value
        for field, value in updates.items()
    }
    if any(
        value == ""
        for field, value in updates.items()
        if field in {"title", "matterType", "status"}
    ):
        raise HTTPException(
            status_code=422,
            detail="Title, matter type, and status cannot be empty.",
        )
    try:
        case = await run_in_threadpool(postgres.update_case, case_id, updates)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(case_id: str) -> Response:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        documents = await run_in_threadpool(postgres.get_case_documents, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    try:
        for document in documents:
            if document.get("path"):
                try:
                    await delete_file(document["path"])
                except Exception as s_exc:
                    logger.warning("Could not delete file %s from storage: %s", document.get("path"), s_exc)
        deleted = await run_in_threadpool(postgres.delete_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Case not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{case_id}/documents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_case_document(
    case_id: str,
    file: UploadFile = File(...),
    source: str = Form(default="upload"),
) -> dict:
    if source not in {"upload", "camera", "case-intake"}:
        raise HTTPException(status_code=422, detail="Unsupported document source.")
    name = safe_filename(file.filename)
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Case files cannot exceed 25 MB.")

    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    document_id = str(uuid4())
    path = f"cases/{case_id}/{document_id}/{name}"
    content_type = file.content_type or "application/octet-stream"
    try:
        public_url = await upload_file(path, content, content_type)
    except StorageError as exc:
        raise storage_http_exception(exc) from exc

    document = {
        "id": document_id,
        "caseId": case_id,
        "name": name,
        "size": len(content),
        "type": content_type,
        "source": source,
        "path": path,
        "url": public_url,
        "addedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineStatus": "queued",
        "pipelineStage": "queued",
        "pipelineError": None,
    }
    try:
        saved = await run_in_threadpool(postgres.add_case_document, document)
        if saved is None:
            await delete_file(path)
            raise HTTPException(status_code=404, detail="Case not found.")
        pipeline.trigger_pipeline_processing()
        return saved
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        logger.exception("Could not save document metadata for case %s", case_id)
        try:
            await delete_file(path)
        except StorageError:
            logger.exception("Could not clean up an unindexed case document")
        raise HTTPException(
            status_code=503,
            detail="The file was uploaded but its metadata could not be saved. Please retry.",
        ) from exc


@router.delete(
    "/{case_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_case_document(case_id: str, document_id: str) -> Response:
    try:
        documents = await run_in_threadpool(postgres.get_case_documents, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    document = next((item for item in documents if item["id"] == document_id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        if document.get("path"):
            try:
                await delete_file(document["path"])
            except Exception as s_exc:
                logger.warning("Could not delete file %s from storage: %s", document.get("path"), s_exc)
        deleted = await run_in_threadpool(
            postgres.delete_case_document,
            case_id,
            document_id,
        )
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if deleted is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{case_id}/documents/{document_id}/file")
async def get_case_document_file(case_id: str, document_id: str) -> Response:
    try:
        documents = await run_in_threadpool(postgres.get_case_documents, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    document = next((item for item in documents if item["id"] == document_id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    path = document.get("path")
    if not path:
        raise HTTPException(status_code=404, detail="Document file path missing.")

    content_type = document.get("type") or "application/pdf"
    try:
        content = await download_file(path)
        return Response(content=content, media_type=content_type)
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
    except Exception as exc:
        logger.warning("Could not download case document file %s: %s", document_id, exc)
        raise HTTPException(status_code=404, detail="Document file not found.") from exc


@router.get("/{case_id}/pipeline", response_model=dict)
async def get_case_pipeline(case_id: str) -> dict:
    try:
        pipeline_status = await run_in_threadpool(postgres.get_pipeline_status, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if pipeline_status is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return pipeline_status


@router.post("/{case_id}/pipeline/retry", response_model=dict)
async def retry_case_pipeline(case_id: str) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        retried = await run_in_threadpool(postgres.retry_failed_documents, case_id)
        pipeline_status = await run_in_threadpool(postgres.get_pipeline_status, case_id)
        pipeline.trigger_pipeline_processing()
    except HTTPException:
        raise
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    return {
        **pipeline_status,
        "retriedDocuments": retried["documents"],
        "retriedSummary": retried["summary"],
    }


@router.post("/{case_id}/pipeline/restart", response_model=dict)
async def restart_case_pipeline(case_id: str) -> dict:
    try:
        restarted = await run_in_threadpool(postgres.restart_case_pipeline, case_id)
        if restarted is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        pipeline_status = await run_in_threadpool(postgres.get_pipeline_status, case_id)
        if pipeline_status is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        pipeline.trigger_pipeline_processing()
    except HTTPException:
        raise
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    return {
        **pipeline_status,
        "restartedDocuments": restarted["documents"],
        "cancelledJobs": restarted["cancelledJobs"],
    }


@router.get("/{case_id}/cause-list", response_model=dict)
async def get_case_cause_list(case_id: str) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case.get("causeList") or {}


@router.put("/{case_id}/cause-list", response_model=dict)
async def update_case_cause_list(case_id: str, request: CauseListUpdate) -> dict:
    updates = request.model_dump(exclude_unset=True)
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        current_cause_list = dict(case.get("causeList") or {})
        current_cause_list.update(updates)
        updated = await run_in_threadpool(postgres.update_case_cause_list, case_id, current_cause_list)
        return updated.get("causeList") if updated else current_cause_list
    except HTTPException:
        raise
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc


@router.post("/{case_id}/cause-list/sync", response_model=dict)
async def sync_case_cause_list(case_id: str) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        cause_data = case.get("causeList")
        if not cause_data or not isinstance(cause_data, dict):
            return {"status": "Unlisted", "message": "No cause list entry linked to this case."}
        current = dict(cause_data)
        item_num = int(current.get("itemNumber") or 18)
        current["status"] = "Listed"
        current["lastMinuteAlert"] = (
            f"Court {current.get('courtNumber', '14')} is currently taking Item #{max(1, item_num - 3)}. "
            f"Item #{item_num} expected in approx 35 minutes."
        )
        current["lastSyncedAt"] = datetime.now(timezone.utc).isoformat()
        updated = await run_in_threadpool(postgres.update_case_cause_list, case_id, current)
        return updated.get("causeList") if updated else current
    except HTTPException:
        raise
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc


@router.get("/{case_id}/judgment-validity", response_model=list[dict])
async def get_case_judgment_validity(case_id: str) -> list[dict]:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case.get("precedents") or []


@router.post("/{case_id}/judgment-validity/check", response_model=dict)
async def check_citation_validity(case_id: str, request: CitationCheckRequest) -> dict:
    match = verify_citation_query(request.citation.strip())

    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
        if case:
            precedents = list(case.get("precedents") or [])
            if not any(p.get("caseName", "").lower() == match["caseName"].lower() for p in precedents):
                precedents.insert(0, match)
                await run_in_threadpool(postgres.update_case_precedents, case_id, precedents)
    except Exception as exc:
        logger.warning("Could not persist precedent update: %s", exc)

    return match


@router.post("/{case_id}/cause-list/match", response_model=dict)
async def match_case_cause_list(case_id: str, request: CaseMatchRequest | None = None) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    current_cause = dict(case.get("causeList") or {})
    target_case_num = (request.caseNumber if request and request.caseNumber else "") or current_cause.get("caseNumber") or ""
    target_parties = (request.parties if request and request.parties else "") or case.get("parties") or ""

    date_code, display_date = normalize_date_to_ddmmyyyy()
    store_data = get_cause_list_from_store(date_code)
    items = store_data.get("items", []) if store_data else []

    if not items:
        # Check active store or fallback fetch
        try:
            live_data = await fetch_mhc_cause_list_data(date_code)
            items = live_data.get("items", [])
        except Exception as exc:
            logger.info("Could not fetch live cause list for match: %s", exc)

    # Fallback to latest available store file if items is still empty
    if not items:
        try:
            stored_files = sorted(STORE_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
            for f in stored_files:
                try:
                    with open(f, "r", encoding="utf-8") as s_fp:
                        alt_data = json.load(s_fp)
                        alt_items = alt_data.get("items", [])
                        if alt_items:
                            items = alt_items
                            display_date = alt_data.get("dateFormatted") or alt_data.get("displayDate") or display_date
                            break
                except Exception:
                    continue
        except Exception as exc:
            logger.debug("Could not fallback to latest store file: %s", exc)

    matched_item = None
    if target_case_num and items:
        clean_target = re.sub(r"[\s\W]+", "", target_case_num.lower())
        slashed_match = re.search(r"(\d+)/(\d{2,4})", target_case_num)
        slashed_str = slashed_match.group(0).lower() if slashed_match else ""

        # 1. Direct or normalized substring match
        for it in items:
            it_case = it.get("caseNumber") or ""
            it_clean = re.sub(r"[\s\W]+", "", it_case.lower())
            if clean_target and (clean_target == it_clean or (len(clean_target) >= 5 and clean_target in it_clean)):
                matched_item = it
                break
            if slashed_str and slashed_str in it_case.lower():
                matched_item = it
                break

        # 2. Slashed number match (e.g., 43747/2026 or 43747/26)
        if not matched_item and slashed_match:
            c_num, c_yr = slashed_match.groups()
            for it in items:
                it_case = (it.get("caseNumber") or "").lower()
                if f"{c_num}/{c_yr}" in it_case or (len(c_yr) == 4 and f"{c_num}/{c_yr[-2:]}" in it_case):
                    matched_item = it
                    break

        # 3. Numeric ID token match (e.g. 43747)
        if not matched_item:
            num_tokens = [
                tok for tok in re.findall(r"\d+", target_case_num)
                if len(tok) >= 4 and tok not in ("2023", "2024", "2025", "2026", "2027")
            ]
            if num_tokens:
                main_token = num_tokens[0]
                for it in items:
                    it_case = it.get("caseNumber") or ""
                    if re.search(rf"[/\.\s]{re.escape(main_token)}[/\.\s]", it_case) or it_case.endswith(f"/{main_token}"):
                        matched_item = it
                        break

    # Party fallback if case number did not match
    if not matched_item and target_parties and items:
        target_p_lower = target_parties.lower()
        parts = re.split(r"\s+(?:vs\.?|v\.?|versus)\s+", target_p_lower)
        pet_raw = parts[0].strip()
        pet_toks = [
            w for w in re.split(r"[\s\W]+", pet_raw)
            if len(w) >= 3 and w not in ["the", "and", "others", "another", "district", "collector", "state", "pvt", "ltd"]
        ]
        if pet_toks:
            for it in items:
                it_p = (it.get("parties") or "").lower()
                if all(t in it_p for t in pet_toks):
                    matched_item = it
                    break

    if matched_item:
        current_cause["isListed"] = True
        current_cause["status"] = "Listed"
        current_cause["caseNumber"] = matched_item.get("caseNumber") or target_case_num
        current_cause["courtNumber"] = matched_item.get("courtNumber")
        current_cause["itemNumber"] = str(matched_item.get("itemNumber"))
        current_cause["judge"] = matched_item.get("judge")
        current_cause["stage"] = matched_item.get("category")
        current_cause["session"] = matched_item.get("session")
        current_cause["counsels"] = matched_item.get("counsels")
        current_cause["parties"] = matched_item.get("parties")
        current_cause["listingDate"] = matched_item.get("date") or display_date
        current_cause["lastSyncedAt"] = datetime.now(timezone.utc).isoformat()
        current_cause["alert"] = (
            f"Listed as Item #{matched_item.get('itemNumber')} in {matched_item.get('courtNumber')} "
            f"before {matched_item.get('judge')} on {matched_item.get('date', display_date)}."
        )
    else:
        current_cause["isListed"] = False
        current_cause["status"] = "Unlisted"
        if target_case_num:
            current_cause["caseNumber"] = target_case_num
        current_cause["lastSyncedAt"] = datetime.now(timezone.utc).isoformat()
        current_cause["alert"] = f"Not listed on today's official Madras High Court cause list ({display_date})."

    updated = await run_in_threadpool(postgres.update_case_cause_list, case_id, current_cause)
    return {
        "isListed": bool(matched_item),
        "item": matched_item,
        "causeList": updated.get("causeList") if updated else current_cause,
        "listingDate": display_date,
    }


@router.post("/{case_id}/hearings", response_model=dict)
async def record_case_hearing(case_id: str, request: HearingRecordCreate) -> dict:
    try:
        case = await run_in_threadpool(postgres.get_case, case_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    current_cause = dict(case.get("causeList") or {})
    hearings = list(current_cause.get("hearings") or [])

    hearing_id = uuid4().hex[:12]
    hearing_entry = {
        "id": hearing_id,
        "date": request.date.strip(),
        "courtNumber": request.courtNumber or current_cause.get("courtNumber") or "Court Hall",
        "judge": request.judge or current_cause.get("judge") or "Hon'ble Presiding Judge",
        "stage": request.stage or current_cause.get("stage") or "Regular Board",
        "session": request.session or current_cause.get("session") or "Regular Session",
        "arguments": request.arguments.strip(),
        "observations": (request.observations or "").strip(),
        "outcome": (request.outcome or "").strip(),
        "nextDate": (request.nextDate or "").strip(),
        "audioTranscribed": request.audioTranscribed,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    # Prepend latest hearing to history
    hearings.insert(0, hearing_entry)
    current_cause["hearings"] = hearings
    current_cause["lastHearing"] = hearing_entry

    if request.nextDate:
        current_cause["nextHearingDate"] = request.nextDate.strip()

    await run_in_threadpool(postgres.update_case_cause_list, case_id, current_cause)

    # Ingest into Case Knowledge Base (pgvector)
    doc_id = None
    try:
        content_lines = [
            f"[COURT PROCEEDING & HEARING RECORD - {hearing_entry['date']}]",
            f"Case: {case.get('title')} ({current_cause.get('caseNumber', 'Case')})",
            f"Hearing Date: {hearing_entry['date']}",
            f"Court Hall: {hearing_entry['courtNumber']}",
            f"Coram / Presiding Judge: {hearing_entry['judge']}",
            f"Listing Stage: {hearing_entry['stage']}",
        ]
        if hearing_entry["arguments"]:
            content_lines.append(f"\nLawyer Arguments & Oral Submissions:\n{hearing_entry['arguments']}")
        if hearing_entry["observations"]:
            content_lines.append(f"\nCourt Observations & Bench Directions:\n{hearing_entry['observations']}")
        if hearing_entry["outcome"]:
            content_lines.append(f"\nOrder Passed & Outcome:\n{hearing_entry['outcome']}")
        if hearing_entry["nextDate"]:
            content_lines.append(f"\nNext Hearing Date: {hearing_entry['nextDate']}")

        hearing_text = "\n".join(content_lines)

        embs = await pipeline.create_embeddings([hearing_text], query=False)
        embedding = embs[0] if embs else [0.0] * postgres.EMBEDDING_DIMENSIONS

        doc_title = f"Hearing_Notes_{hearing_entry['date'].replace('-', '_').replace('/', '_')}.txt"
        doc_id = await run_in_threadpool(
            postgres.ingest_hearing_record_to_kb,
            case_id,
            hearing_id,
            doc_title,
            hearing_text,
            embedding,
        )
    except Exception as exc:
        logger.warning("Could not ingest hearing record into case KB: %s", exc)

    return {
        "success": True,
        "hearing": hearing_entry,
        "documentId": doc_id,
        "causeList": current_cause,
    }
