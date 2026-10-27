from datetime import datetime, timezone
import logging
from pathlib import PurePosixPath
from uuid import uuid4

import psycopg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from app import pipeline, postgres
from app.storage import (
    StorageError,
    delete_file,
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
            await delete_file(document["path"])
        deleted = await run_in_threadpool(postgres.delete_case, case_id)
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
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
        await delete_file(document["path"])
        deleted = await run_in_threadpool(
            postgres.delete_case_document,
            case_id,
            document_id,
        )
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise _storage_unavailable(exc) from exc
    if deleted is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
