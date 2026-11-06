"""Automated Daily Cause List Pipeline, 1:00 AM Sync Scheduler, and 11:55 PM Daily Purge.

Performs:
1. Daily 1:00 AM IST scheduled auto-trigger: Downloads today's official Madras High Court PDF,
   runs PyMuPDF OCR extraction, and stores the structured daily board.
2. Daily 11:55 PM IST scheduled auto-purge: Deletes all cause lists from disk & storage so the
   system strictly retains only that particular active day.
3. Single-day retention enforcement on write operations.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import time
from typing import Any
import zoneinfo

import httpx

from app.cause_list_db import (
    create_cause_list_pdf_from_items,
    empty_mhc_cause_list,
    extract_text_from_pdf_bytes,
    get_latest_court_sitting_date,
    get_mhc_cause_list_url,
    is_weekend_date,
    normalize_date_to_ddmmyyyy,
    parse_date_code_to_datetime,
    parse_mhc_cause_list_text,
)
from app.court_list_assistant_pipeline import (
    index_cause_list_for_assistant,
    purge_court_list_assistant_cache,
)

logger = logging.getLogger(__name__)

# Base storage directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "cause_lists"
STORE_DIR = DATA_DIR / "store"
PDFS_DIR = DATA_DIR / "pdfs"
HISTORY_FILE = DATA_DIR / "pipeline_history.json"
STATE_FILE = DATA_DIR / "pipeline_state.json"

IST_TIMEZONE = zoneinfo.ZoneInfo("Asia/Kolkata")
SYNC_HOUR = 1  # 01:00 AM IST
SYNC_MINUTE = 0
PURGE_HOUR = 23  # 11:55 PM IST
PURGE_MINUTE = 55

_pipeline_lock = asyncio.Lock()
_is_running = False
_last_run_record: dict[str, Any] | None = None


def ensure_storage_directories() -> None:
    """Ensures that local storage directories exist."""
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    PDFS_DIR.mkdir(parents=True, exist_ok=True)


def enforce_single_day_retention(keep_date_code: str | None = None) -> list[str]:
    """Ensures that storage only contains that particular day only, deleting any older/other dates.
    On weekends (Saturday & Sunday), preserves the active Friday cause list so lawyers have access
    to the latest court board all weekend."""
    ensure_storage_directories()
    removed: list[str] = []

    now_ist = datetime.now(IST_TIMEZONE)
    preserve_friday_code = None
    if now_ist.weekday() in (5, 6):
        sitting_code, _ = get_latest_court_sitting_date(now_ist.strftime("%d%m%Y"))
        preserve_friday_code = sitting_code

    # Check JSON store
    for f in STORE_DIR.glob("*.json"):
        if keep_date_code is None or f.stem != keep_date_code:
            if preserve_friday_code and f.stem == preserve_friday_code:
                continue
            try:
                f.unlink(missing_ok=True)
                removed.append(str(f.name))
            except Exception as exc:
                logger.warning("Failed to delete stale cause list file %s: %s", f, exc)

    # Check PDFs store
    for p in PDFS_DIR.glob("*.pdf"):
        expected_name = f"cause_{keep_date_code}.pdf" if keep_date_code else None
        expected_friday = f"cause_{preserve_friday_code}.pdf" if preserve_friday_code else None
        if (expected_name is None or p.name != expected_name) and (expected_friday is None or p.name != expected_friday):
            try:
                p.unlink(missing_ok=True)
                removed.append(str(p.name))
            except Exception as exc:
                logger.warning("Failed to delete stale PDF file %s: %s", p, exc)

    if removed:
        logger.info("Enforced single-day retention. Purged %d stale files: %s", len(removed), removed)
    return removed


def purge_all_cause_lists(trigger_type: str = "SCHEDULED_1155PM_PURGE") -> dict[str, Any]:
    """Deletes all case lists at 11:55 PM (or on-demand) so storage only contains that particular day."""
    global _last_run_record
    removed = enforce_single_day_retention(keep_date_code=None)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(purge_court_list_assistant_cache(keep_date_code=None))
        else:
            loop.run_until_complete(purge_court_list_assistant_cache(keep_date_code=None))
    except Exception as exc:
        logger.debug("Purging court list assistant cache: %s", exc)
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "id": f"purge_{int(time.time())}",
        "triggeredAt": now_iso,
        "triggerType": trigger_type,
        "dateCode": "ALL",
        "displayDate": "11:55 PM Daily Purge",
        "status": "PURGED",
        "itemsCount": 0,
        "courtsCount": 0,
        "pdfSizeBytes": 0,
        "durationMs": 1,
        "source": "11:55 PM Daily Auto-Purge Service",
        "errorMessage": "",
        "message": f"Successfully deleted all case lists at 11:55 PM. Purged {len(removed)} files.",
    }
    _last_run_record = record
    record_pipeline_history_run(record)
    logger.info("11:55 PM Purge completed. Deleted all stored cause lists.")
    return {"success": True, "removedFiles": removed, "run": record}


def compute_schedule_events_info() -> dict[str, Any]:
    """Computes next timestamps and countdowns for 01:00 AM sync and 11:55 PM purge."""
    now_ist = datetime.now(IST_TIMEZONE)

    def next_for(h: int, m: int) -> tuple[datetime, float]:
        tgt = now_ist.replace(hour=h, minute=m, second=0, microsecond=0)
        if tgt <= now_ist:
            tgt += timedelta(days=1)
        return tgt, max(0.0, (tgt - now_ist).total_seconds())

    sync_tgt, sync_sec = next_for(SYNC_HOUR, SYNC_MINUTE)
    purge_tgt, purge_sec = next_for(PURGE_HOUR, PURGE_MINUTE)

    return {
        "currentTime": now_ist.isoformat(),
        "sync": {
            "scheduleRule": "Daily at 01:00 AM IST",
            "nextRunAt": sync_tgt.isoformat(),
            "secondsRemaining": round(sync_sec, 1),
            "targetTimeStr": f"{SYNC_HOUR:02d}:{SYNC_MINUTE:02d} AM IST",
        },
        "purge": {
            "scheduleRule": "Daily at 11:55 PM IST (Purge all lists)",
            "nextRunAt": purge_tgt.isoformat(),
            "secondsRemaining": round(purge_sec, 1),
            "targetTimeStr": "11:55 PM IST",
        },
    }


def compute_next_run_info(target_hour: int = SYNC_HOUR, target_minute: int = SYNC_MINUTE) -> dict[str, Any]:
    """Compatibility helper computing next run info for 1:00 AM sync."""
    events = compute_schedule_events_info()
    return {
        "currentTime": events["currentTime"],
        "nextRunAt": events["sync"]["nextRunAt"],
        "secondsRemaining": events["sync"]["secondsRemaining"],
        "targetTimeStr": events["sync"]["targetTimeStr"],
        "scheduleRule": events["sync"]["scheduleRule"],
    }


def save_cause_list_to_store(date_code: str, data: dict[str, Any]) -> None:
    """Persists structured cause list JSON to local disk store and enforces single-day retention."""
    try:
        ensure_storage_directories()
        # Enforce single-day retention so storage only contains that particular day only
        enforce_single_day_retention(keep_date_code=date_code)
        target_path = STORE_DIR / f"{date_code}.json"
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("Failed to persist cause list %s to store: %s", date_code, exc)


def get_cause_list_from_store(date_code: str) -> dict[str, Any] | None:
    """Retrieves structured cause list JSON from local disk store if present."""
    target_path = STORE_DIR / f"{date_code}.json"
    if target_path.exists():
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.warning("Could not read cause list file %s: %s", target_path, exc)
    return None


def save_cause_list_pdf_to_store(date_code: str, pdf_bytes: bytes) -> str:
    """Saves raw PDF bytes to local disk store and enforces single-day retention."""
    ensure_storage_directories()
    enforce_single_day_retention(keep_date_code=date_code)
    target_path = PDFS_DIR / f"cause_{date_code}.pdf"
    try:
        with open(target_path, "wb") as f:
            f.write(pdf_bytes)
        return str(target_path)
    except Exception as exc:
        logger.error("Failed to write PDF file %s: %s", target_path, exc)
        return ""


def get_cause_list_pdf_from_store(date_code: str) -> bytes | None:
    """Retrieves raw PDF bytes from local disk store if present."""
    target_path = PDFS_DIR / f"cause_{date_code}.pdf"
    if target_path.exists():
        try:
            with open(target_path, "rb") as f:
                return f.read()
        except Exception as exc:
            logger.warning("Could not read PDF file %s: %s", target_path, exc)
    return None


def load_pipeline_history(limit: int = 25) -> list[dict[str, Any]]:
    """Loads historical pipeline runs."""
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
                if isinstance(history, list):
                    return history[:limit]
        except Exception as exc:
            logger.warning("Failed to load pipeline history: %s", exc)
    return []


def record_pipeline_history_run(run_record: dict[str, Any]) -> None:
    """Appends an execution log record to pipeline history."""
    try:
        ensure_storage_directories()
        history: list[dict[str, Any]] = []
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        history = data
            except Exception:
                history = []

        history.insert(0, run_record)
        # Keep latest 50 runs
        history = history[:50]

        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("Failed to record pipeline run: %s", exc)


async def execute_cause_list_pipeline(
    date_str: str | None = None,
    trigger_type: str = "SCHEDULED",
) -> dict[str, Any]:
    """Executes full cause list pipeline:

    1. Computes DDMMYYYY date code.
    2. Downloads official MHC PDF.
    3. PyMuPDF OCR / text extraction into structured items.
    4. Persists structured data and PDF (enforcing single-day retention).
    5. Records run in pipeline history.
    """
    global _is_running, _last_run_record

    async with _pipeline_lock:
        _is_running = True
        start_time = time.time()
        date_code, display_date = normalize_date_to_ddmmyyyy(date_str)
        official_url = get_mhc_cause_list_url(date_code)

        pdf_bytes: bytes = b""
        source_label = "Madras High Court Official PDF (Live Download)"
        is_live = False
        error_msg = ""

        # Step 1: Download PDF
        download_headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/pdf,*/*",
        }
        try:
            async with httpx.AsyncClient(verify=False, timeout=35.0, follow_redirects=True, headers=download_headers) as client:
                resp = await client.get(official_url)
                if resp.status_code == 200 and resp.content and resp.content[:4] == b"%PDF":
                    pdf_bytes = resp.content
                    is_live = True
        except Exception as exc:
            logger.info("MHC live network fetch: %s", exc)

        parsed_items: list[dict[str, Any]] = []
        is_weekend = is_weekend_date(date_code) if not pdf_bytes else False
        sitting_code, sitting_disp = get_latest_court_sitting_date(date_code) if is_weekend else (None, None)

        if pdf_bytes:
            # Step 2: Store downloaded PDF bytes (purges older days)
            save_cause_list_pdf_to_store(date_code, pdf_bytes)

            # Step 3: PyMuPDF OCR / Text Extraction
            extracted_text = extract_text_from_pdf_bytes(pdf_bytes)
            parsed_items = parse_mhc_cause_list_text(extracted_text, display_date)
            source_label = "Madras High Court Official PDF (Live Download & OCR)"
        else:
            if is_weekend:
                dt = parse_date_code_to_datetime(date_code)
                day_name = dt.strftime("%A") if dt else "Weekend"
                source_label = f"Madras High Court ({day_name} Weekend Recess — Non-sitting Day)"
                error_msg = (
                    f"{display_date} is a {day_name} (Court Non-sitting Day / Weekend Recess). "
                    f"The Madras High Court does not publish daily cause lists on weekends. "
                    f"Active court board is Friday, {sitting_disp}."
                )
            else:
                source_label = "Madras High Court (Awaiting Listing Publication)"
                error_msg = f"Official cause list for {display_date} is not yet published on MHC portal (cause_{date_code}.pdf)."

        courts = list({item["courtNumber"] for item in parsed_items})
        courts.sort()

        # Step 4: Persist Structured Dataset (purges older days)
        now_iso = datetime.now(timezone.utc).isoformat()
        structured_data = {
            "date": date_code,
            "dateFormatted": display_date,
            "courtName": "High Court of Judicature at Madras",
            "source": source_label,
            "isLive": is_live,
            "isWeekend": is_weekend,
            "latestSittingDate": sitting_code,
            "latestSittingFormatted": sitting_disp,
            "totalItems": len(parsed_items),
            "courts": courts,
            "items": parsed_items,
            "extractedAt": now_iso,
            "lastSyncedAt": now_iso,
        }
        if parsed_items:
            save_cause_list_to_store(date_code, structured_data)
            # Embedding model is strictly called ONLY during scheduled time or manual trigger
            is_allowed_embed = (
                trigger_type == "MANUAL"
                or trigger_type.startswith("SCHEDULED")
            )
            if is_allowed_embed:
                try:
                    await index_cause_list_for_assistant(date_code, parsed_items, display_date, allow_embed=True)
                except Exception as exc:
                    logger.debug("Court List Assistant pre-indexing notice: %s", exc)

        # Step 5: Execution Metrics & History
        duration_ms = int((time.time() - start_time) * 1000)
        run_record = {
            "id": f"run_{date_code}_{int(time.time())}",
            "triggeredAt": now_iso,
            "triggerType": trigger_type,
            "dateCode": date_code,
            "displayDate": display_date,
            "status": "SUCCESS" if parsed_items else ("WEEKEND_RECESS" if is_weekend else "FAILED"),
            "itemsCount": len(parsed_items),
            "courtsCount": len(courts),
            "pdfSizeBytes": len(pdf_bytes),
            "durationMs": duration_ms,
            "source": source_label,
            "errorMessage": error_msg,
            "isWeekend": is_weekend,
            "latestSittingDate": sitting_code,
            "latestSittingFormatted": sitting_disp,
        }

        _last_run_record = run_record
        record_pipeline_history_run(run_record)
        _is_running = False

        logger.info(
            "Cause list pipeline completed for %s (%s items in %d ms, type=%s)",
            date_code,
            len(parsed_items),
            duration_ms,
            trigger_type,
        )
        return {
            "success": bool(parsed_items) or is_weekend,
            "isWeekend": is_weekend,
            "run": run_record,
            "data": structured_data,
        }


def get_pipeline_status() -> dict[str, Any]:
    """Returns complete state of the 1:00 AM sync and 11:55 PM purge pipeline."""
    events = compute_schedule_events_info()
    history = load_pipeline_history(limit=5)
    last_run = _last_run_record or (history[0] if history else None)

    return {
        "schedulerActive": True,
        "isExecuting": _is_running,
        "targetSchedule": events["sync"]["scheduleRule"],
        "targetTimeStr": events["sync"]["targetTimeStr"],
        "nextRunAt": events["sync"]["nextRunAt"],
        "secondsUntilNextRun": events["sync"]["secondsRemaining"],
        "purgeSchedule": events["purge"]["scheduleRule"],
        "nextPurgeAt": events["purge"]["nextRunAt"],
        "secondsUntilNextPurge": events["purge"]["secondsRemaining"],
        "retentionPolicy": "Particular day only (Auto-purged daily at 11:55 PM IST)",
        "lastRun": last_run,
        "recentRuns": history,
    }


async def run_cause_list_scheduler(stop_event: asyncio.Event) -> None:
    """Long-running background scheduler loop firing:
    1. At 01:00 AM IST: Automated download, OCR, and storage of today's cause list.
    2. At 11:55 PM IST: Automated purge of all cause lists so it only holds that particular day.
    Includes startup catch-up and retry logic between 1:00 AM and 6:00 AM if MHC has not yet published.
    """
    logger.info("Starting Daily Cause List Scheduler (01:00 AM Sync & 11:55 PM Purge IST)...")
    last_synced_date: str | None = None
    last_purged_date: str | None = None
    last_retry_attempt_time: float = 0.0

    while not stop_event.is_set():
        now_ist = datetime.now(IST_TIMEZONE)
        today_code = now_ist.strftime("%d%m%Y")
        hour = now_ist.hour
        minute = now_ist.minute

        # 1. Daily Purge Check at 11:55 PM IST (23:55)
        if hour == 23 and minute >= 55:
            if last_purged_date != today_code:
                logger.info("Executing scheduled 11:55 PM IST Cause List Purge (Daily Retention)...")
                try:
                    purge_all_cause_lists(trigger_type="SCHEDULED_1155PM_PURGE")
                    last_purged_date = today_code
                except Exception as exc:
                    logger.error("11:55 PM cause list purge failed: %s", exc)

        # 2. Daily Sync Check (1:00 AM IST onwards, before 11:55 PM)
        is_sync_window = (hour >= 1) and not (hour == 23 and minute >= 55)
        if is_sync_window:
            has_today_store = False
            stored = get_cause_list_from_store(today_code)
            if stored and (stored.get("items") or len(stored.get("items", [])) > 0):
                has_today_store = True
                last_synced_date = today_code

            need_sync = False
            if last_synced_date != today_code and not has_today_store:
                now_ts = time.time()
                # Run if not attempted yet for today, or retry every 15 min between 1:00 AM and 6:00 AM
                if last_retry_attempt_time == 0.0 or (now_ts - last_retry_attempt_time) >= 900.0:
                    need_sync = True

            if need_sync:
                logger.info("Executing scheduled 01:00 AM IST Cause List Pipeline for %s...", today_code)
                last_retry_attempt_time = time.time()
                try:
                    result = await execute_cause_list_pipeline(
                        date_str=today_code,
                        trigger_type="SCHEDULED_0100AM",
                    )
                    if (result.get("success") and result.get("data", {}).get("totalItems", 0) > 0) or result.get("isWeekend"):
                        last_synced_date = today_code
                        if result.get("isWeekend"):
                            logger.info("MHC is on weekend recess for %s; active court board preserved.", today_code)
                        else:
                            logger.info(
                                "Successfully auto-synced cause list for %s (%d items)",
                                today_code,
                                result["data"]["totalItems"],
                            )
                except Exception as exc:
                    logger.error("01:00 AM cause list pipeline run failed: %s", exc)

        # Sleep for up to 15 seconds, reactive to stop_event
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=15.0)
            break
        except asyncio.TimeoutError:
            pass

    logger.info("Cause list scheduler stopped.")
