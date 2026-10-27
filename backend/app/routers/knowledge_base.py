import asyncio
from datetime import datetime, timezone
import logging
from pathlib import PurePosixPath
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pymongo.errors import PyMongoError

from app import postgres
from app.database import get_database
from app.pipeline import process_knowledge_base_document
from app.storage import StorageError, delete_file, storage_http_exception, upload_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge-base/documents", tags=["knowledge base"])
MAX_FILE_SIZE = 20 * 1024 * 1024


def get_documents_collection():
    return get_database()["knowledge_base_documents"]


def safe_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "upload").replace("\\", "/")).name
    return name or "upload"


def serialize_document(document: dict) -> dict:
    document.pop("_id", None)
    return document


@router.get("", response_model=list[dict])
async def list_documents() -> list[dict]:
    try:
        cursor = get_documents_collection().find({}).sort("uploadedAt", -1)
        return [serialize_document(document) async for document in cursor]
    except PyMongoError as exc:
        logger.exception("Could not list Knowledge Base files")
        raise HTTPException(status_code=503, detail="Document storage is unavailable.") from exc


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: str = Form(...),
    folder_name: str = Form(...),
) -> dict:
    name = safe_filename(file.filename)
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Knowledge Base files cannot exceed 20 MB.")

    document_id = str(uuid4())
    path = f"knowledge-base/{folder_id}/{document_id}/{name}"
    content_type = file.content_type or "application/octet-stream"
    try:
        public_url = await upload_file(path, content, content_type)
    except StorageError as exc:
        raise storage_http_exception(exc) from exc

    document = {
        "id": document_id,
        "name": name,
        "size": len(content),
        "type": content_type,
        "folderId": folder_id,
        "folderName": folder_name.strip(),
        "path": path,
        "url": public_url,
        "status": "queued",
        "progress": 0,
        "chunks": [],
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await get_documents_collection().insert_one(document)
    except PyMongoError as exc:
        logger.exception("Could not save Knowledge Base file metadata")
        try:
            await delete_file(path)
        except StorageError:
            logger.exception("Could not clean up an unindexed Knowledge Base file")
        raise HTTPException(status_code=503, detail="Document storage is unavailable.") from exc

    # Auto-trigger OCR and extraction pipeline in the background
    asyncio.create_task(
        process_knowledge_base_document(
            document_id=document_id,
            name=name,
            content=content,
            folder_id=folder_id,
            folder_name=folder_name.strip(),
            public_url=public_url,
        )
    )

    return serialize_document(document)


@router.get("/{document_id}", response_model=dict)
async def get_document(document_id: str) -> dict:
    try:
        document = await get_documents_collection().find_one({"id": document_id})
    except PyMongoError as exc:
        logger.exception("Could not read Knowledge Base file %s", document_id)
        raise HTTPException(status_code=503, detail="Document storage is unavailable.") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return serialize_document(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str) -> None:
    try:
        document = await get_documents_collection().find_one({"id": document_id})
    except PyMongoError as exc:
        logger.exception("Could not read Knowledge Base file %s", document_id)
        raise HTTPException(status_code=503, detail="Document storage is unavailable.") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        await delete_file(document["path"])
        result = await get_documents_collection().delete_one({"id": document_id})
        if postgres.case_migration_ready:
            try:
                await run_in_threadpool(postgres.delete_global_document, document_id)
            except Exception:
                logger.debug("Could not delete document from PostgreSQL global_legal_documents", exc_info=True)
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
    except PyMongoError as exc:
        logger.exception("Could not delete Knowledge Base file metadata")
        raise HTTPException(status_code=503, detail="Document storage is unavailable.") from exc
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found.")
