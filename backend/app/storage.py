import logging
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.config import get_settings

logger = logging.getLogger(__name__)


class StorageError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _storage_config() -> tuple[str, str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise StorageError(
            "File storage is not configured. Set SUPABASE_URL and "
            "SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in backend/.env.",
            status_code=503,
        )
    return (
        settings.supabase_url.rstrip("/"),
        settings.supabase_secret_key,
        settings.supabase_bucket,
    )


def public_file_url(path: str) -> str:
    base_url, _, bucket = _storage_config()
    return (
        f"{base_url}/storage/v1/object/public/"
        f"{quote(bucket, safe='')}/{quote(path, safe='/')}"
    )


def _raise_storage_error(response: httpx.Response, bucket: str, action: str) -> None:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if isinstance(payload, dict) and payload.get("code") == "NoSuchBucket":
        raise StorageError(
            f"Supabase Storage bucket '{bucket}' does not exist. "
            "Create it in the Supabase Storage dashboard."
        )

    logger.error("Supabase Storage %s failed with HTTP %s", action, response.status_code)
    raise StorageError(f"Supabase Storage could not {action} the file.")


async def upload_file(path: str, content: bytes, content_type: str) -> str:
    base_url, secret_key, bucket = _storage_config()
    url = f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/{quote(path, safe='/')}"
    settings = get_settings()
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": content_type,
        "x-upsert": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.supabase_timeout_seconds) as client:
            response = await client.post(url, content=content, headers=headers)
    except httpx.RequestError as exc:
        logger.exception("Could not reach Supabase Storage")
        raise StorageError("Could not reach Supabase Storage.") from exc

    if response.status_code not in {200, 201}:
        _raise_storage_error(response, bucket, "save")
    return public_file_url(path)


async def download_file(path: str) -> bytes:
    base_url, secret_key, bucket = _storage_config()
    url = (
        f"{base_url}/storage/v1/object/"
        f"{quote(bucket, safe='')}/{quote(path, safe='/')}"
    )
    settings = get_settings()
    headers = {
        "apikey": secret_key,
        "Authorization": f"******",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.supabase_timeout_seconds) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        logger.exception("Could not reach Supabase Storage")
        raise StorageError("Could not reach Supabase Storage.") from exc

    if response.status_code != 200:
        _raise_storage_error(response, bucket, "download")
    return response.content


async def delete_file(path: str) -> None:
    base_url, secret_key, bucket = _storage_config()
    url = f"{base_url}/storage/v1/object/{quote(bucket, safe='')}"
    settings = get_settings()
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.supabase_timeout_seconds) as client:
            response = await client.request(
                "DELETE",
                url,
                headers=headers,
                json={"prefixes": [path]},
            )
    except httpx.RequestError as exc:
        logger.exception("Could not reach Supabase Storage")
        raise StorageError("Could not reach Supabase Storage.") from exc

    if response.status_code not in {200, 204}:
        _raise_storage_error(response, bucket, "delete")


def storage_http_exception(error: StorageError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=str(error))
