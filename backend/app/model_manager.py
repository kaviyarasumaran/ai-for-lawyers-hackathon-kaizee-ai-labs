import asyncio
import logging
import shutil
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Tracks models known to be currently loaded in memory
_known_loaded_models: set[str] = set()

# Tracks models that were ALREADY loaded prior to our load requests.
# These are preserved in memory without being ejected after each request.
_preloaded_models: set[str] = set()


def _resolve_endpoints(base_url: str | None, action: str) -> list[str]:
    """Resolves potential LM Studio API endpoints for model lifecycle operations."""
    if not base_url:
        return []
    cleaned = base_url.rstrip("/")
    server_root = cleaned[:-3] if cleaned.endswith("/v1") else cleaned
    return [
        f"{server_root}/api/v1/models/{action}",
        f"{server_root}/v1/models/{action}",
    ]


def _resolve_model_list_endpoints(base_url: str | None) -> list[str]:
    """Resolves endpoints for querying currently loaded models."""
    if not base_url:
        return []
    cleaned = base_url.rstrip("/")
    server_root = cleaned[:-3] if cleaned.endswith("/v1") else cleaned
    return [
        f"{cleaned}/models",
        f"{server_root}/api/v1/models",
        f"{server_root}/v1/models",
    ]


def _matches_model_name(candidate_id: str, target_name: str) -> bool:
    if not candidate_id or not target_name:
        return False
    c_lower = candidate_id.strip().lower()
    t_lower = target_name.strip().lower()
    if c_lower == t_lower:
        return True
    c_base = c_lower.split("/")[-1].split(":")[-1]
    t_base = t_lower.split("/")[-1].split(":")[-1]
    return c_base == t_base or t_lower in c_lower or c_lower in t_lower


async def is_model_loaded(
    model_name: str | None,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 2.0,
) -> bool:
    """
    Checks if a model is currently loaded in memory on LM Studio / local server.
    Returns True if already loaded, avoiding redundant reload requests.
    """
    if not model_name:
        return False

    if model_name in _known_loaded_models:
        return True

    if not base_url:
        return False

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    endpoints = _resolve_model_list_endpoints(base_url)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if not hasattr(client, "get"):
                return False

            for url in endpoints:
                try:
                    response = await client.get(url, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        items = None
                        if isinstance(data, dict):
                            items = data.get("data")
                            if items is None:
                                items = data.get("models")
                        elif isinstance(data, list):
                            items = data

                        if isinstance(items, list):
                            for item in items:
                                if not isinstance(item, dict):
                                    continue
                                candidate_id = item.get("id") or item.get("name") or ""
                                state = str(item.get("state") or item.get("status") or "").lower()
                                is_loaded_flag = item.get("is_loaded")
                                if is_loaded_flag is False or state in ("unloaded", "not_loaded", "disabled"):
                                    continue

                                if _matches_model_name(candidate_id, model_name):
                                    logger.info(
                                        "Model '%s' is verified as already loaded in server (%s)",
                                        model_name,
                                        candidate_id,
                                    )
                                    _known_loaded_models.add(model_name)
                                    return True
                except Exception as exc:
                    logger.debug("Failed querying model list from %s: %s", url, exc)
    except Exception as exc:
        logger.debug("HTTP check for loaded models failed: %s", exc)

    if shutil.which("lms"):
        try:
            proc = await asyncio.create_subprocess_exec(
                "lms", "ps",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            if proc.returncode == 0 and stdout:
                output = stdout.decode(errors="replace").lower()
                target_base = model_name.split("/")[-1].split(":")[-1].lower()
                if model_name.lower() in output or target_base in output:
                    logger.info("Model '%s' is verified as already loaded via 'lms ps'", model_name)
                    _known_loaded_models.add(model_name)
                    return True
        except Exception as exc:
            logger.debug("CLI 'lms ps' check error: %s", exc)

    return False


async def load_model(
    model_name: str | None,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 3.0,
    force_reload: bool = False,
) -> bool:
    """
    Loads a model into memory before pipeline execution.
    If the model is ALREADY loaded, skips reload and returns True immediately.
    Only triggers a load if the model is not currently in memory.
    """
    if not model_name or not base_url:
        return False

    # Check if model is already loaded
    if not force_reload:
        try:
            if await is_model_loaded(model_name, base_url, api_key, timeout=timeout):
                logger.info("Model '%s' is already loaded; skipping redundant reload.", model_name)
                _known_loaded_models.add(model_name)
                _preloaded_models.add(model_name)
                return True
        except Exception:
            logger.debug("Pre-load check failed; proceeding with load attempt", exc_info=True)

    logger.info("Model '%s' is not loaded; loading into memory...", model_name)
    endpoints = _resolve_endpoints(base_url, "load")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model_name}

    async with httpx.AsyncClient(timeout=timeout) as client:
        for url in endpoints:
            try:
                response = await client.post(url, headers=headers, json=payload)
                status = getattr(response, "status_code", None)
                resp_text = getattr(response, "text", "")
                if status in {200, 201, 204}:
                    logger.info("Successfully loaded model '%s' via %s", model_name, url)
                    _known_loaded_models.add(model_name)
                    return True
                elif (status in (400, 409) or "already" in resp_text.lower()) and ("loaded" in resp_text.lower() or "active" in resp_text.lower()):
                    logger.info("Model '%s' is already loaded in memory", model_name)
                    _known_loaded_models.add(model_name)
                    _preloaded_models.add(model_name)
                    return True
            except httpx.RequestError as exc:
                logger.debug("Could not reach model load endpoint %s: %s", url, exc)
            except Exception as exc:
                logger.warning("Error loading model '%s' at %s: %s", model_name, url, exc)

    # CLI fallback if `lms` is installed
    if shutil.which("lms"):
        try:
            proc = await asyncio.create_subprocess_exec(
                "lms", "load", model_name, "-y",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            if proc.returncode == 0:
                logger.info("Loaded model '%s' via 'lms load' CLI", model_name)
                _known_loaded_models.add(model_name)
                return True
        except Exception as exc:
            logger.debug("CLI model load fallback error: %s", exc)

    _known_loaded_models.add(model_name)
    logger.debug("Model load request sent for '%s' (auto-managed if endpoint inactive)", model_name)
    return False


async def eject_model(
    model_name: str | None,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 3.0,
    force: bool = False,
) -> bool:
    """
    Ejects (unloads) a model from memory after pipeline processing completes
    to release GPU VRAM and system memory.
    If the model was already loaded prior to the request, it is preserved in memory
    so that ongoing user interactions and future requests don't suffer reload delays.
    """
    if not model_name or not base_url:
        return False

    # If the model was already loaded before the request, keep it loaded
    if not force and model_name in _preloaded_models:
        logger.info(
            "Model '%s' was already loaded prior to request; keeping loaded in memory.",
            model_name,
        )
        return True

    _known_loaded_models.discard(model_name)
    _preloaded_models.discard(model_name)

    endpoints = _resolve_endpoints(base_url, "unload")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model_name,
        "instance_id": model_name,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        for url in endpoints:
            try:
                response = await client.post(url, headers=headers, json=payload)
                status = getattr(response, "status_code", None)
                resp_text = getattr(response, "text", "")
                if status in {200, 204}:
                    logger.info("Successfully ejected model '%s' via %s", model_name, url)
                    return True
                elif status == 404 and "not loaded" in resp_text.lower():
                    logger.debug("Model '%s' was already not in memory", model_name)
                    return True
            except httpx.RequestError as exc:
                logger.debug("Could not reach model unload endpoint %s: %s", url, exc)
            except Exception as exc:
                logger.warning("Error ejecting model '%s' at %s: %s", model_name, url, exc)

    # CLI fallback if `lms` is installed
    if shutil.which("lms"):
        try:
            proc = await asyncio.create_subprocess_exec(
                "lms", "unload", model_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            if proc.returncode == 0:
                logger.info("Ejected model '%s' via 'lms unload' CLI", model_name)
                return True
        except Exception as exc:
            logger.debug("CLI model load fallback error: %s", exc)

    logger.debug("Model eject request sent for '%s'", model_name)
    return False
