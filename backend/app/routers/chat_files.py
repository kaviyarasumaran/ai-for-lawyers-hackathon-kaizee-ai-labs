from datetime import datetime, timezone
import logging
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from pymongo.errors import PyMongoError

from app import postgres
from app.database import get_database
from app.pipeline import process_chat_attachment
from app.storage import StorageError, delete_file, storage_http_exception, upload_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat/attachments", tags=["chat attachments"])
MAX_FILE_SIZE = 25 * 1024 * 1024
ATTACHMENT_CACHE_DIR = Path("/tmp/chat_attachment_cache")


def save_to_cache(attachment_id: str, name: str, content: bytes) -> Path:
    cache_path = ATTACHMENT_CACHE_DIR / attachment_id / name
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(content)
    return cache_path


async def get_attachment_bytes(attachment_id: str, name: str | None = None, path: str | None = None) -> bytes:
    att_dir = ATTACHMENT_CACHE_DIR / attachment_id
    if att_dir.exists():
        if name:
            target_file = att_dir / name
            if target_file.exists():
                return target_file.read_bytes()
        for f in att_dir.iterdir():
            if f.is_file():
                return f.read_bytes()

    if path:
        from app.storage import download_file
        content = await download_file(path)
        if content:
            save_to_cache(attachment_id, name or "file", content)
            return content

    raise FileNotFoundError(f"Attachment content not found for attachment {attachment_id}")


def get_attachments_collection():
    return get_database()["chat_attachments"]


def safe_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "upload").replace("\\", "/")).name
    return name or "upload"


def serialize_attachment(attachment: dict) -> dict:
    attachment.pop("_id", None)
    return attachment


@router.get("", response_model=list[dict])
async def list_chat_attachments(chat_id: str | None = Query(default=None)) -> list[dict]:
    clean_chat_id = (chat_id or "default-chat").strip()
    try:
        # Chat-level security: strictly return attachments belonging to this specific chat
        if postgres.case_migration_ready:
            try:
                records = postgres.get_chat_attachments(clean_chat_id)
                if records is not None:
                    return records
            except Exception:
                logger.debug("PostgreSQL get_chat_attachments failed; falling back to MongoDB", exc_info=True)

        cursor = get_attachments_collection().find({"chat_id": clean_chat_id}).sort("addedAt", -1)
        return [serialize_attachment(item) async for item in cursor]
    except PyMongoError as exc:
        logger.exception("Could not list chat attachments for chat %s", clean_chat_id)
        raise HTTPException(status_code=503, detail="File metadata storage is unavailable.") from exc


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_chat_attachment(
    file: UploadFile = File(...),
    source: str = Form(default="upload"),
    chat_id: str = Form(default="default-chat"),
) -> dict:
    if source not in {"upload", "camera"}:
        raise HTTPException(status_code=422, detail="Unsupported attachment source.")
    clean_chat_id = (chat_id or "").strip() or "default-chat"
    name = safe_filename(file.filename)
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Chat attachments cannot exceed 25 MB.")

    attachment_id = str(uuid4())
    path = f"chat-attachments/{attachment_id}/{name}"
    content_type = file.content_type or "application/octet-stream"
    name_lower = name.lower()
    if name_lower.endswith(".weba") or (name_lower.endswith(".webm") and any(k in name_lower for k in ["voice", "audio"])):
        content_type = "audio/webm"
    elif name_lower.endswith(".webm") and any(k in name_lower for k in ["video", "camera"]):
        content_type = "video/webm"

    # Save to local disk cache immediately so extraction never fails even if remote storage is offline
    save_to_cache(attachment_id, name, content)

    public_url = ""
    try:
        public_url = await upload_file(path, content, content_type)
    except StorageError as exc:
        logger.warning("Supabase storage upload failed; using local attachment route: %s", exc)
        public_url = f"/api/chat/attachments/{attachment_id}/file"

    attachment = {
        "id": attachment_id,
        "chat_id": clean_chat_id,
        "name": name,
        "size": len(content),
        "type": content_type,
        "source": source,
        "path": path,
        "url": public_url,
        "addedAt": datetime.now(timezone.utc).isoformat(),
        "pipeline_status": "staged",
        "pipeline_stage": "staged",
    }
    try:
        await get_attachments_collection().insert_one(dict(attachment))
        if postgres.case_migration_ready:
            try:
                postgres.save_chat_attachment(attachment)
            except Exception:
                logger.debug("Could not record chat attachment in PostgreSQL", exc_info=True)
    except PyMongoError as exc:
        logger.exception("Could not save chat attachment metadata")
        try:
            await delete_file(path)
        except StorageError:
            logger.exception("Could not clean up an unindexed chat attachment")
        raise HTTPException(status_code=503, detail="File metadata storage is unavailable.") from exc

    return serialize_attachment(attachment)


@router.get("/{attachment_id}/file")
async def get_attachment_file_content(
    attachment_id: str,
    chat_id: str | None = Query(default=None),
) -> Response:
    attachment = None
    if postgres.case_migration_ready:
        try:
            attachment = postgres.get_chat_attachment(attachment_id)
        except Exception:
            pass
    if not attachment:
        try:
            attachment = await get_attachments_collection().find_one({"id": attachment_id})
        except PyMongoError:
            pass

    clean_chat_id = (chat_id or "").strip()
    if attachment and clean_chat_id and attachment.get("chat_id") and attachment["chat_id"] != clean_chat_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This media file belongs to a different chat session.",
        )

    name = attachment.get("name") if attachment else None
    path = attachment.get("path") if attachment else None
    content_type = (attachment.get("type") or attachment.get("content_type") if attachment else None) or "application/octet-stream"

    try:
        data = await get_attachment_bytes(attachment_id, name, path)
        return Response(content=data, media_type=content_type)
    except Exception as exc:
        logger.warning("Could not read attachment file %s: %s", attachment_id, exc)
        raise HTTPException(status_code=404, detail="Attachment file not found.") from exc


@router.post("/{attachment_id}/process", response_model=dict)
async def process_attachment_on_demand(
    attachment_id: str,
    chat_id: str | None = Query(default=None),
) -> dict:
    attachment = None
    if postgres.case_migration_ready:
        try:
            attachment = postgres.get_chat_attachment(attachment_id)
        except Exception:
            pass
    if not attachment:
        try:
            attachment = await get_attachments_collection().find_one({"id": attachment_id})
        except PyMongoError:
            pass

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    clean_chat_id = (chat_id or attachment.get("chat_id") or "default-chat").strip()
    try:
        content = await get_attachment_bytes(attachment_id, attachment.get("name"), attachment.get("path"))
        result = await process_chat_attachment(
            attachment_id=attachment_id,
            name=attachment["name"],
            content=content,
            chat_id=clean_chat_id,
        )
        return {"status": "success", "result": result}
    except Exception as exc:
        logger.exception("Could not process attachment %s on demand", attachment_id)
        raise HTTPException(status_code=500, detail=f"Attachment processing failed: {exc}") from exc


@router.get("/{attachment_id}", response_model=dict)
async def get_single_chat_attachment(
    attachment_id: str,
    chat_id: str | None = Query(default=None),
) -> dict:
    attachment = None
    if postgres.case_migration_ready:
        try:
            attachment = postgres.get_chat_attachment(attachment_id)
        except Exception:
            pass
    if not attachment:
        try:
            attachment = await get_attachments_collection().find_one({"id": attachment_id})
        except PyMongoError:
            pass

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    clean_chat_id = (chat_id or "").strip()
    if clean_chat_id and attachment.get("chat_id") and attachment["chat_id"] != clean_chat_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This media file belongs to a different chat session.",
        )

    return serialize_attachment(dict(attachment))


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_attachment(
    attachment_id: str,
    chat_id: str | None = Query(default=None),
) -> None:
    try:
        attachment = await get_attachments_collection().find_one({"id": attachment_id})
        att_chat_id = attachment.get("chat_id") if attachment else None

        if attachment is None and postgres.case_migration_ready:
            try:
                pg_att = postgres.get_chat_attachment(attachment_id)
                if pg_att:
                    att_chat_id = pg_att.get("chat_id")
            except Exception:
                pass

        if attachment is None and att_chat_id is None:
            raise HTTPException(status_code=404, detail="Attachment not found.")

        # Chat-level permission check: verify caller is authorized for this chat's media
        clean_chat_id = (chat_id or "").strip()
        if clean_chat_id and att_chat_id and att_chat_id != clean_chat_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to delete media from another chat session.",
            )

        if attachment and attachment.get("path"):
            await delete_file(attachment["path"])

        result = await get_attachments_collection().delete_one({"id": attachment_id})
        if postgres.case_migration_ready:
            try:
                postgres.delete_chat_attachment_record(attachment_id)
            except Exception:
                pass
    except StorageError as exc:
        raise storage_http_exception(exc) from exc
    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("Could not delete chat attachment %s", attachment_id)
        raise HTTPException(status_code=503, detail="File metadata storage is unavailable.") from exc
    if result.deleted_count == 0 and not postgres.case_migration_ready:
        raise HTTPException(status_code=404, detail="Attachment not found.")
