import asyncio
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import logging
import math
import re
from typing import Any
from uuid import uuid4

import httpx
from fastapi.concurrency import run_in_threadpool

from app import postgres
from app.config import get_settings
from app.model_manager import eject_model, load_model
from app.storage import download_file

logger = logging.getLogger(__name__)
MAX_CHUNK_CHARACTERS = 2800
CHUNK_OVERLAP_CHARACTERS = 400
EMBEDDING_BATCH_SIZE = 32
_job_event = asyncio.Event()
_processing_lock = asyncio.Lock()
CASE_SUMMARY_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "case_summary",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "detail": {"type": "string"},
                            "sources": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["title", "detail", "sources"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["summary", "findings"],
            "additionalProperties": False,
        },
    },
}


class PipelineJobCancelled(Exception):
    pass


def _set_job_stage(job: dict, stage: str, document_id: str | None = None) -> None:
    if not postgres.set_job_stage(
        job["id"],
        stage,
        document_id,
        attempts=job["attempts"],
    ):
        raise PipelineJobCancelled


class _HTMLTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def transcribe_audio_bytes(name: str, content: bytes) -> str | None:
    suffix = name.rsplit(".", 1)[-1].lower() if "." in name else "wav"
    settings = get_settings()

    # 1. API endpoint transcription (Whisper, Groq, OpenAI, or local whisper server)
    transcription_targets: list[tuple[str, str | None]] = []
    if getattr(settings, "transcription_api_base_url", None):
        transcription_targets.append((
            settings.transcription_api_base_url,
            getattr(settings, "transcription_api_key", None),
        ))
    if settings.llm_api_base_url and "1234" not in settings.llm_api_base_url:
        transcription_targets.append((settings.llm_api_base_url, settings.llm_api_key))

    import os
    groq_key = getattr(settings, "groq_api_key", None) or os.environ.get("GROQ_API_KEY")
    if groq_key:
        transcription_targets.append(("https://api.groq.com/openai/v1", groq_key))
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        transcription_targets.append(("https://api.openai.com/v1", openai_key))

    for base_url, api_key in transcription_targets:
        try:
            endpoint = f"{base_url.rstrip('/')}/audio/transcriptions"
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            model_name = "whisper-large-v3-turbo" if "groq" in base_url else "whisper-1"
            files = {"file": (name, content, f"audio/{suffix}" if suffix else "audio/wav")}
            data = {"model": model_name}
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(endpoint, headers=headers, files=files, data=data)
                if resp.status_code == 200:
                    text = resp.json().get("text")
                    if text and text.strip():
                        return text.strip()
        except Exception as exc:
            logger.debug("Whisper API transcription attempt at %s failed: %s", base_url, exc)

    # 2. Local Whisper CLI (whisper-cpp / whisper-cli) with Metal GPU acceleration
    import shutil, subprocess, tempfile
    whisper_bin = getattr(settings, "whisper_cli_path", None)
    if not whisper_bin:
        for candidate in ["whisper-cli", "whisper-cpp", "whisper"]:
            found = shutil.which(candidate)
            if found:
                whisper_bin = found
                break
        if not whisper_bin:
            for p in ["/opt/homebrew/bin/whisper-cli", "/opt/homebrew/bin/whisper-cpp", "/usr/local/bin/whisper-cli"]:
                if os.path.isfile(p):
                    whisper_bin = p
                    break

    whisper_model = getattr(settings, "whisper_model_path", None)
    if not whisper_model:
        from pathlib import Path
        model_candidates = [
            Path(__file__).resolve().parents[1] / "models" / "ggml-base.bin",
            Path(__file__).resolve().parents[1] / "models" / "ggml-tiny.bin",
            Path(__file__).resolve().parents[1] / "models" / "ggml-base.en.bin",
            Path.home() / ".cache" / "whisper" / "ggml-base.bin",
            Path.home() / ".cache" / "whisper" / "ggml-tiny.bin",
            Path("/opt/homebrew/share/whisper-cpp/models/ggml-base.bin"),
        ]
        for mc in model_candidates:
            if mc.is_file():
                whisper_model = str(mc)
                break

    if whisper_bin and whisper_model:
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_wav:
                conv = subprocess.run(
                    ["/opt/homebrew/bin/ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", temp_wav.name],
                    input=content,
                    capture_output=True,
                    timeout=15,
                )
                if conv.returncode == 0:
                    cmd = [whisper_bin, "-m", whisper_model, "-f", temp_wav.name, "--no-timestamps"]
                    proc = subprocess.run(cmd, capture_output=True, timeout=30)
                    if proc.returncode == 0 and proc.stdout:
                        out_text = proc.stdout.decode("utf-8", errors="replace").strip()
                        if out_text:
                            return out_text
        except Exception as exc:
            logger.debug("Local whisper-cli transcription failed: %s", exc)

    # 3. Python faster-whisper package (if installed)
    try:
        from faster_whisper import WhisperModel
        with tempfile.NamedTemporaryFile(suffix=f".{suffix}", delete=True) as temp_audio:
            temp_audio.write(content)
            temp_audio.flush()
            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, _ = model.transcribe(temp_audio.name)
            transcribed = " ".join(s.text for s in segments).strip()
            if transcribed:
                return transcribed
    except Exception as exc:
        logger.debug("Python faster-whisper transcription skipped/failed: %s", exc)

    # 4. Google Speech Recognition API via ffmpeg (free, no API key required)
    try:
        proc = subprocess.run(
            ["/opt/homebrew/bin/ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "flac", "pipe:1"],
            input=content,
            capture_output=True,
            timeout=15,
        )
        if proc.returncode == 0 and proc.stdout and len(proc.stdout) > 44:
            flac_bytes = proc.stdout
            url = "https://www.google.com/speech-api/v2/recognize?client=chromium&lang=en-US"
            headers = {"Content-Type": "audio/x-flac; rate=16000"}
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(url, headers=headers, content=flac_bytes)
                if resp.status_code == 200:
                    for line in resp.text.splitlines():
                        line = line.strip()
                        if line:
                            data = json.loads(line)
                            result = data.get("result", [])
                            if result and result[0].get("alternative"):
                                text = result[0]["alternative"][0].get("transcript")
                                if text and text.strip():
                                    return text.strip()
    except Exception as exc:
        logger.debug("Google speech recognition fallback failed: %s", exc)

    return None


def extract_document(name: str, content: bytes) -> list[dict[str, str | int]]:
    suffix = name.rsplit(".", 1)[-1].lower() if "." in name else ""

    IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "jfif", "heic"}
    AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "ogg", "aac", "flac", "wma", "weba"}
    VIDEO_EXTENSIONS = {"mp4", "mkv", "mov", "avi", "flv", "m4v"}

    if suffix == "pdf":
        import pymupdf

        pages = []
        with pymupdf.open(stream=content, filetype="pdf") as document:
            for index, page in enumerate(document):
                text = page.get_text("text").strip()
                if len(text) < 40:
                    try:
                        text_page = page.get_textpage_ocr(language="eng", dpi=200)
                        text = page.get_text("text", textpage=text_page).strip()
                    except Exception as exc:
                        logger.warning("OCR failed on PDF page %s of %s: %s", index + 1, name, exc)
                if text:
                    pages.append({"page": index + 1, "text": text})
        if not pages:
            logger.warning("No text found directly in PDF %s; attempting full fallback OCR", name)
            try:
                with pymupdf.open(stream=content, filetype="pdf") as document:
                    for index, page in enumerate(document):
                        pix = page.get_pixmap(dpi=150)
                        img_doc = pymupdf.open("pdf", pix.pdfocr_tobytes())
                        ocr_txt = img_doc[0].get_text().strip()
                        if ocr_txt:
                            pages.append({"page": index + 1, "text": ocr_txt})
            except Exception as e:
                logger.debug("Fallback PDF OCR could not extract text: %s", e)
        if not pages:
            pages = [{"page": 1, "text": f"[PDF Document Attachment: {name}] Uploaded PDF document for review and reference."}]
        return pages

    if suffix in IMAGE_EXTENSIONS:
        import pymupdf

        pages = []
        try:
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_image(page.rect, stream=content)
            pdf_bytes = doc.tobytes()

            with pymupdf.open("pdf", pdf_bytes) as d:
                for index, p in enumerate(d):
                    try:
                        text_page = p.get_textpage_ocr(language="eng", dpi=200)
                        ocr_text = p.get_text("text", textpage=text_page).strip()
                    except Exception as exc:
                        logger.warning("OCR failed on image %s: %s", name, exc)
                        ocr_text = ""
                    if ocr_text:
                        pages.append({"page": index + 1, "text": ocr_text})
        except Exception as exc:
            logger.warning("Could not convert image %s to PDF for OCR: %s", name, exc)

        if not pages:
            pages = [{"page": 1, "text": f"[Image Attachment: {name}] Uploaded image file (no readable text detected via OCR)."}]
        return pages

    if suffix == "docx":
        import io, zipfile, xml.etree.ElementTree as ET
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                paragraphs = []
                for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                    texts = [
                        node.text
                        for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")
                        if node.text
                    ]
                    if texts:
                        paragraphs.append("".join(texts))
                text = "\n\n".join(paragraphs).strip()
        except Exception as exc:
            raise ValueError(f"Could not parse DOCX document '{name}': {exc}") from exc
        if not text:
            raise ValueError(f"No text found in DOCX document '{name}'.")
        return [{"page": 1, "text": text}]

    if suffix == "doc":
        raw_strings = re.findall(rb"[\x20-\x7E\t\r\n]{4,}", content)
        decoded = " ".join(s.decode("latin-1", errors="ignore").strip() for s in raw_strings)
        cleaned = re.sub(r"\s+", " ", decoded).strip()
        text = cleaned or f"[Legacy Word Document: {name}]"
        return [{"page": 1, "text": text}]

    name_lower = name.lower()
    is_audio = suffix in AUDIO_EXTENSIONS or (
        suffix == "webm" and (
            any(k in name_lower for k in ["voice", "audio", "recording", "speech", "mic"])
            or not any(k in name_lower for k in ["video", "camera", "screen", "capture"])
        )
    )
    is_video = (suffix in VIDEO_EXTENSIONS) or (
        suffix == "webm" and not is_audio
    )

    if is_audio:
        metadata_str = ""
        try:
            import subprocess
            probe = subprocess.run(
                ["/opt/homebrew/bin/ffmpeg", "-i", "pipe:0", "-f", "ffmetadata", "pipe:1"],
                input=content,
                capture_output=True,
                timeout=5,
            )
            if probe.returncode == 0 and probe.stdout:
                metadata_str = probe.stdout.decode("utf-8", errors="ignore").strip()
        except Exception:
            pass

        transcription_text = transcribe_audio_bytes(name, content)
        if transcription_text and transcription_text.strip():
            text = f"[Audio Transcription: {name}]\n\n{transcription_text.strip()}"
        elif metadata_str:
            text = (
                f"[Audio File: {name}]\n"
                f"Notice: Spoken audio words could not be automatically transcribed from this file.\n"
                f"Audio Metadata:\n{metadata_str}"
            )
        else:
            text = (
                f"[Audio File: {name}]\n"
                "Notice: Spoken audio words could not be automatically transcribed from this file (no transcription service available or audio format unreadable)."
            )
        return [{"page": 1, "text": text}]

    if is_video:
        metadata_str = ""
        try:
            import subprocess
            probe = subprocess.run(
                ["/opt/homebrew/bin/ffmpeg", "-i", "pipe:0", "-f", "ffmetadata", "pipe:1"],
                input=content,
                capture_output=True,
                timeout=5,
            )
            if probe.returncode == 0 and probe.stdout:
                metadata_str = probe.stdout.decode("utf-8", errors="ignore").strip()
        except Exception:
            pass

        transcription_text = None
        try:
            import subprocess
            extract_audio = subprocess.run(
                ["/opt/homebrew/bin/ffmpeg", "-y", "-i", "pipe:0", "-vn", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
                input=content,
                capture_output=True,
                timeout=20,
            )
            if extract_audio.returncode == 0 and extract_audio.stdout and len(extract_audio.stdout) > 44:
                transcription_text = transcribe_audio_bytes(f"{name}.wav", extract_audio.stdout)
        except Exception as e:
            logger.debug("Video audio extraction/transcription failed: %s", e)

        if transcription_text and transcription_text.strip():
            text = f"[Video Transcription: {name}]\n\n{transcription_text.strip()}"
        elif metadata_str:
            text = (
                f"[Video File: {name}]\n"
                f"Notice: Spoken audio words could not be automatically transcribed from this video.\n"
                f"Video Metadata:\n{metadata_str}"
            )
        else:
            text = (
                f"[Video File: {name}]\n"
                "Notice: Spoken audio words could not be automatically transcribed from this video file."
            )
        return [{"page": 1, "text": text}]

    if suffix in {"txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "rtf"}:
        try:
            text = content.decode("utf-8-sig").strip()
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace").strip()
    elif suffix in {"html", "htm"}:
        parser = _HTMLTextParser()
        parser.feed(content.decode("utf-8", errors="replace"))
        text = " ".join(parser.parts).strip()
    else:
        raise ValueError(
            f"Unsupported file type '.{suffix or 'unknown'}'. Upload PDF, images (PNG, JPEG, WebP), audio (MP3, WAV, M4A), Word (DOCX), or plain text."
        )
    if not text:
        raise ValueError("No text could be extracted from the document.")
    return [{"page": 1, "text": text}]


def chunk_pages(pages: list[dict[str, str | int]]) -> list[dict[str, str | int]]:
    chunks: list[dict[str, str | int]] = []
    for page in pages:
        page_number = int(page["page"])
        paragraphs = [
            re.sub(r"[ \t]+", " ", paragraph).strip()
            for paragraph in re.split(r"\n\s*\n", str(page["text"]))
        ]
        page_text = "\n\n".join(paragraph for paragraph in paragraphs if paragraph)
        offset = 0
        while offset < len(page_text):
            end = min(offset + MAX_CHUNK_CHARACTERS, len(page_text))
            if end < len(page_text):
                lower_bound = offset + MAX_CHUNK_CHARACTERS // 2
                boundary = page_text.rfind("\n\n", lower_bound, end)
                if boundary < lower_bound:
                    boundary = page_text.rfind(". ", lower_bound, end)
                    if boundary >= lower_bound:
                        boundary += 1
                if boundary >= lower_bound:
                    end = boundary
            content = page_text[offset:end].strip()
            if content:
                chunks.append(
                    {
                        "id": str(uuid4()),
                        "ordinal": len(chunks),
                        "pageStart": page_number,
                        "pageEnd": page_number,
                        "content": content,
                    }
                )
            if end == len(page_text):
                break
            offset = max(offset + 1, end - CHUNK_OVERLAP_CHARACTERS)
    return chunks


async def _embed_single_batch(
    client: httpx.AsyncClient,
    endpoint: str,
    headers: dict[str, str],
    model: str,
    batch_texts: list[str],
    prefix: str,
) -> list[list[float]]:
    payload = {
        "model": model,
        "input": [f"{prefix}{text}" for text in batch_texts],
    }
    response = await client.post(endpoint, headers=headers, json=payload)
    response.raise_for_status()
    items = response.json().get("data", [])
    items.sort(key=lambda item: item.get("index", 0))
    embeddings = [item["embedding"] for item in items]
    if len(embeddings) != len(batch_texts):
        raise RuntimeError("The embedding provider returned an unexpected number of vectors.")
    return embeddings


async def create_embeddings(
    texts: list[str],
    *,
    query: bool = False,
    batch_size: int = 6,
) -> list[list[float]]:
    if not texts:
        return []
    settings = get_settings()
    if not settings.embedding_api_base_url or not settings.embedding_model:
        raise RuntimeError(
            "Embedding is not configured. Set EMBEDDING_MODEL and EMBEDDING_API_BASE_URL in backend/.env."
        )
    endpoint = f"{settings.embedding_api_base_url.rstrip('/')}/embeddings"
    headers = {}
    if settings.embedding_api_key:
        headers["Authorization"] = f"Bearer {settings.embedding_api_key}"
    prefix = "search_query: " if query else "search_document: "

    batch_len = 1 if query else max(1, batch_size)
    all_embeddings: list[list[float]] = []

    timeout_config = httpx.Timeout(
        connect=10.0,
        read=max(settings.embedding_timeout_seconds, 60.0),
        write=10.0,
        pool=10.0,
    )

    async with httpx.AsyncClient(timeout=timeout_config) as client:
        for i in range(0, len(texts), batch_len):
            chunk_slice = texts[i : i + batch_len]
            try:
                batch_res = await _embed_single_batch(
                    client=client,
                    endpoint=endpoint,
                    headers=headers,
                    model=settings.embedding_model,
                    batch_texts=chunk_slice,
                    prefix=prefix,
                )
                all_embeddings.extend(batch_res)
            except httpx.TimeoutException as exc:
                logger.warning(
                    "LM Studio embedding request timed out for batch of %d items (offset %d/%d). Using zero-vector fallback for this batch: %s",
                    len(chunk_slice),
                    i,
                    len(texts),
                    exc,
                )
                all_embeddings.extend([[0.0] * postgres.EMBEDDING_DIMENSIONS for _ in chunk_slice])
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Embedding provider returned HTTP %s for batch at %d. Using fallback.",
                    exc.response.status_code,
                    i,
                )
                all_embeddings.extend([[0.0] * postgres.EMBEDDING_DIMENSIONS for _ in chunk_slice])
            except Exception as exc:
                logger.debug(
                    "Error embedding batch at %d: %s. Using fallback.",
                    i,
                    exc,
                )
                all_embeddings.extend([[0.0] * postgres.EMBEDDING_DIMENSIONS for _ in chunk_slice])

    # Validate / repair any bad vectors
    for idx, embedding in enumerate(all_embeddings):
        if (
            len(embedding) != postgres.EMBEDDING_DIMENSIONS
            or any(not isinstance(val, (int, float)) or not math.isfinite(val) for val in embedding)
        ):
            all_embeddings[idx] = [0.0] * postgres.EMBEDDING_DIMENSIONS

    return all_embeddings


async def _process_document(job: dict) -> None:
    document = postgres.get_document_for_job(job["document_id"])
    if not document:
        raise ValueError("The document record for this job no longer exists.")
    _set_job_stage(job, "downloading", document["id"])
    content = await download_file(document["path"])
    _set_job_stage(job, "extracting", document["id"])
    pages = extract_document(document["name"], content)
    chunks = chunk_pages(pages)
    if not chunks:
        raise ValueError("No searchable text was extracted from the document.")
    embeddings: list[list[float]] = []
    for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        _set_job_stage(job, "embedding", document["id"])
        batch = chunks[start:start + EMBEDDING_BATCH_SIZE]
        embeddings.extend(
            await create_embeddings([str(chunk["content"]) for chunk in batch])
        )
    if not postgres.replace_document_chunks(job, document, pages, chunks, embeddings):
        raise PipelineJobCancelled


def _summary_payload(content: str) -> tuple[str, list[dict]]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError("The language model did not return valid JSON for the case summary.") from exc
    if not isinstance(payload, dict):
        raise ValueError("The language model returned an invalid case summary.")
    summary = payload.get("summary")
    findings = payload.get("findings")
    if not isinstance(summary, str) or not summary.strip() or not isinstance(findings, list):
        raise ValueError("The language model returned an incomplete case summary.")
    safe_findings = []
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        title = finding.get("title")
        detail = finding.get("detail")
        if isinstance(title, str) and title.strip() and isinstance(detail, str) and detail.strip():
            sources = finding.get("sources", [])
            safe_findings.append(
                {
                    "title": title.strip()[:200],
                    "detail": detail.strip()[:2_000],
                    "sources": [
                        str(source)[:300]
                        for source in sources[:10]
                        if isinstance(source, str)
                    ] if isinstance(sources, list) else [],
                }
            )
    return summary.strip()[:5_000], safe_findings[:30]


async def _process_summary(job: dict) -> None:
    documents = postgres.get_case_text_for_summary(job["case_id"])
    if not documents:
        raise ValueError("There are no successfully processed documents to summarize.")
    if not get_settings().llm_api_base_url or not get_settings().llm_model:
        raise RuntimeError(
            "Case summary generation is not configured. Set LLM_MODEL in backend/.env."
        )
    source_text = "\n\n".join(
        f"DOCUMENT: {document['name']}"
        f"{' (excerpt; full text is indexed separately)' if document['truncated'] else ''}\n"
        f"{document['text']}"
        for document in documents
    )
    endpoint = f"{get_settings().llm_api_base_url.rstrip('/')}/chat/completions"
    headers = {}
    if get_settings().llm_api_key:
        headers["Authorization"] = f"******"
    payload = {
        "model": get_settings().llm_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Create a cautious, source-grounded legal case summary and findings. "
                    "Do not infer facts or law absent from the documents. Return only valid JSON "
                    "with a summary string and findings array; each finding must have title, detail, "
                    "and sources (document name and page when available). Say when evidence is unclear. "
                    "Some document sections may be excerpts; do not claim exhaustive document review. "
                    "This is a draft for lawyer review, not legal advice."
                ),
            },
            {
                "role": "user",
                "content": f"Prepare a case summary and findings from these extracted documents:\n\n{source_text}",
            },
        ],
        "response_format": CASE_SUMMARY_RESPONSE_FORMAT,
    }
    try:
        async with httpx.AsyncClient(timeout=get_settings().llm_timeout_seconds) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError("The language model returned an invalid summary.")
    except httpx.TimeoutException as exc:
        raise RuntimeError("The case summary request timed out.") from exc
    except httpx.HTTPStatusError as exc:
        logger.warning("Summary provider returned HTTP %s", exc.response.status_code)
        raise RuntimeError("The language model could not generate the case summary.") from exc
    except httpx.RequestError as exc:
        logger.exception("Could not reach the configured summary provider")
        raise RuntimeError("Could not reach the language model for case summarization.") from exc
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("The language model returned an invalid case summary.") from exc
    summary, findings = _summary_payload(content)
    postgres.save_case_summary(job, summary, findings)


async def process_job(job: dict) -> None:
    if job["kind"] == "document":
        await _process_document(job)
    elif job["kind"] == "case_summary":
        _set_job_stage(job, "summarizing")
        await _process_summary(job)
    else:
        raise ValueError(f"Unsupported pipeline job kind: {job['kind']}")


def notify_job_available() -> None:
    """Signals that a new pipeline job is available to process."""
    try:
        _job_event.set()
    except Exception:
        pass


async def process_available_jobs() -> int:
    """
    Processes all currently available pipeline jobs in the database queue until empty.
    Loads models when processing begins and ejects/unloads them upon completion to free VRAM.
    Thread/task-safe via _processing_lock.
    """
    settings = get_settings()
    if _processing_lock.locked():
        return 0

    async with _processing_lock:
        processed_count = 0
        loaded_models = set()
        try:
            while True:
                try:
                    job = postgres.claim_next_job(settings.pipeline_max_attempts)
                except Exception as exc:
                    logger.debug("Could not claim next pipeline job: %s", exc)
                    break
                if not job:
                    break

                # Auto-load the required model for this job if not already loaded
                if job["kind"] == "document" and settings.embedding_model:
                    if settings.embedding_model not in loaded_models:
                        await load_model(
                            settings.embedding_model,
                            settings.embedding_api_base_url,
                            settings.embedding_api_key,
                        )
                        loaded_models.add(settings.embedding_model)
                elif job["kind"] == "case_summary" and settings.llm_model:
                    if settings.llm_model not in loaded_models:
                        await load_model(
                            settings.llm_model,
                            settings.llm_api_base_url,
                            settings.llm_api_key,
                        )
                        loaded_models.add(settings.llm_model)

                try:
                    await process_job(job)
                    processed_count += 1
                except PipelineJobCancelled:
                    logger.info("Case pipeline job %s was cancelled", job["id"])
                except Exception as exc:
                    logger.exception("Case pipeline job %s failed", job["id"])
                    try:
                        postgres.fail_job(job, str(exc), settings.pipeline_max_attempts)
                    except Exception:
                        pass
        finally:
            # Eject/unload models after completion to release GPU VRAM and system memory
            for model_name in list(loaded_models):
                if model_name == settings.embedding_model:
                    await eject_model(
                        settings.embedding_model,
                        settings.embedding_api_base_url,
                        settings.embedding_api_key,
                    )
                elif model_name == settings.llm_model:
                    await eject_model(
                        settings.llm_model,
                        settings.llm_api_base_url,
                        settings.llm_api_key,
                    )
            loaded_models.clear()

        return processed_count


def trigger_pipeline_processing() -> None:
    """Auto-triggers immediate background execution of the OCR and document pipeline."""
    notify_job_available()
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(process_available_jobs())
    except RuntimeError:
        pass


async def run_worker(stop_event: asyncio.Event | None = None) -> None:
    settings = get_settings()
    try:
        postgres.initialize_schema()
    except Exception:
        pass
    logger.info("Case pipeline worker started")
    while stop_event is None or not stop_event.is_set():
        await process_available_jobs()
        try:
            await asyncio.wait_for(_job_event.wait(), timeout=settings.pipeline_poll_seconds)
            _job_event.clear()
        except asyncio.TimeoutError:
            pass
        except Exception:
            break


async def process_chat_attachment(
    attachment_id: str,
    name: str,
    content: bytes,
    chat_id: str = "default-chat",
) -> dict[str, Any]:
    """
    Processes an uploaded chat attachment (image, audio, doc),
    extracts information via OCR/parsers, loads the model, generates embeddings,
    stores chunks in the chat's KB, and ejects the model upon completion.
    """
    settings = get_settings()
    logger.info("Processing chat attachment %s (%s) for chat %s", name, attachment_id, chat_id)
    model_loaded = False
    try:
        if settings.embedding_model and settings.embedding_api_base_url:
            try:
                await load_model(
                    settings.embedding_model,
                    settings.embedding_api_base_url,
                    settings.embedding_api_key,
                    timeout=10.0,
                )
                model_loaded = True
            except Exception:
                logger.debug("Could not automatically load model for chat attachment; continuing", exc_info=True)

        pages = extract_document(name, content)
        chunks = chunk_pages(pages)
        if not chunks:
            full_text = "\n\n".join(str(p["text"]) for p in pages if p.get("text"))
            if full_text.strip():
                chunks = [{
                    "id": str(uuid4()),
                    "ordinal": 0,
                    "pageStart": 1,
                    "pageEnd": len(pages),
                    "content": full_text.strip(),
                }]

        embeddings: list[list[float]] = []
        if chunks and settings.embedding_api_base_url and settings.embedding_model:
            try:
                embeddings = await asyncio.wait_for(
                    create_embeddings([c["content"] for c in chunks]),
                    timeout=15.0,
                )
            except Exception:
                logger.warning("Could not create embeddings for chat attachment %s", name, exc_info=True)
                embeddings = [[0.0] * 768 for _ in chunks]

        extracted_full_text = "\n\n".join(str(p["text"]) for p in pages)
        if postgres.case_migration_ready:
            try:
                await run_in_threadpool(
                    postgres.update_chat_attachment_status,
                    attachment_id,
                    "completed",
                    extracted_text=extracted_full_text,
                    page_count=len(pages),
                    chunk_count=len(chunks),
                )
                if chunks and embeddings:
                    await run_in_threadpool(
                        postgres.save_chat_chunks,
                        attachment_id,
                        chat_id,
                        chunks,
                        embeddings,
                    )
            except Exception:
                logger.debug("Could not store chat attachment in PostgreSQL", exc_info=True)

        try:
            from app.database import get_database
            db = get_database()
            await db["chat_attachments"].update_one(
                {"id": attachment_id},
                {
                    "$set": {
                        "pipeline_status": "completed",
                        "pipeline_stage": "completed",
                        "extracted_text": extracted_full_text,
                        "page_count": len(pages),
                        "chunk_count": len(chunks),
                        "chat_id": chat_id,
                        "chunks": [
                            {
                                "id": c["id"],
                                "ordinal": c["ordinal"],
                                "pageStart": c["pageStart"],
                                "pageEnd": c["pageEnd"],
                                "content": c["content"],
                            }
                            for c in chunks
                        ],
                    }
                },
            )
        except Exception:
            logger.debug("Could not update MongoDB chat_attachments", exc_info=True)

        return {
            "status": "completed",
            "pageCount": len(pages),
            "chunkCount": len(chunks),
            "chunks": chunks,
            "extractedText": extracted_full_text,
        }
    except Exception as exc:
        logger.exception("Failed to process chat attachment %s", name)
        try:
            if postgres.case_migration_ready:
                await run_in_threadpool(
                    postgres.update_chat_attachment_status,
                    attachment_id,
                    "failed",
                    error=str(exc),
                )
            from app.database import get_database
            db = get_database()
            await db["chat_attachments"].update_one(
                {"id": attachment_id},
                {
                    "$set": {
                        "pipeline_status": "failed",
                        "pipeline_stage": "failed",
                        "pipeline_error": str(exc),
                    }
                },
            )
        except Exception:
            pass
        raise
    finally:
        if model_loaded:
            try:
                await eject_model(
                    settings.embedding_model,
                    settings.embedding_api_base_url,
                    settings.embedding_api_key,
                )
            except Exception:
                logger.debug("Could not eject model after chat attachment processing", exc_info=True)


async def process_knowledge_base_document(
    document_id: str,
    name: str,
    content: bytes,
    folder_id: str = "default-folder",
    folder_name: str = "General",
    public_url: str | None = None,
) -> dict[str, Any]:
    """
    Processes an uploaded Knowledge Base document (scanned PDF, digital PDF, image, audio, docx, txt),
    extracts information via OCR/parsers, generates embeddings, stores chunks in PostgreSQL global_legal_chunks,
    and updates MongoDB metadata.
    """
    settings = get_settings()
    logger.info("Processing Knowledge Base document %s (%s) for folder %s", name, document_id, folder_name)

    async def _update_status(status_val: str, progress_val: int, extra: dict[str, Any] | None = None) -> None:
        try:
            from app.database import get_database
            db = get_database()
            payload: dict[str, Any] = {
                "status": status_val,
                "progress": progress_val,
            }
            if extra:
                payload.update(extra)
            await db["knowledge_base_documents"].update_one(
                {"id": document_id},
                {"$set": payload},
            )
        except Exception:
            logger.debug("Could not update intermediate status for %s", document_id, exc_info=True)

    model_loaded = False
    try:
        await _update_status("extracting", 25)

        if settings.embedding_model and settings.embedding_api_base_url:
            try:
                await load_model(
                    settings.embedding_model,
                    settings.embedding_api_base_url,
                    settings.embedding_api_key,
                    timeout=10.0,
                )
                model_loaded = True
            except Exception:
                logger.debug("Could not automatically load model for Knowledge Base document; continuing", exc_info=True)

        pages = extract_document(name, content)
        await _update_status("chunking", 50, {"pageCount": len(pages)})

        chunks = chunk_pages(pages)
        if not chunks:
            full_text = "\n\n".join(str(p["text"]) for p in pages if p.get("text"))
            if full_text.strip():
                chunks = [{
                    "id": str(uuid4()),
                    "ordinal": 0,
                    "pageStart": 1,
                    "pageEnd": len(pages),
                    "content": full_text.strip(),
                }]

        await _update_status("chunking", 75, {"chunkCount": len(chunks)})

        embeddings: list[list[float]] = []
        if chunks and settings.embedding_api_base_url and settings.embedding_model:
            try:
                embeddings = await create_embeddings([c["content"] for c in chunks], batch_size=6)
            except Exception as exc:
                logger.warning("Could not create embeddings for Knowledge Base document %s: %s", name, exc)
                embeddings = [[0.0] * 768 for _ in chunks]
        elif chunks:
            embeddings = [[0.0] * 768 for _ in chunks]

        extracted_full_text = "\n\n".join(str(p["text"]) for p in pages)

        # 1. Update PostgreSQL global_legal_documents & global_legal_chunks
        if postgres.case_migration_ready:
            try:
                await run_in_threadpool(
                    postgres.add_global_document,
                    {
                        "id": document_id,
                        "tenant_id": settings.postgres_tenant_id or None,
                        "title": name,
                        "document_type": "reference",
                        "jurisdiction": "India",
                        "source": folder_name or "Knowledge Base",
                        "url": public_url,
                        "publication_date": None,
                        "effective_date": None,
                        "content_summary": extracted_full_text[:500] if extracted_full_text else f"Uploaded in folder {folder_name}",
                        "created_at": datetime.now(timezone.utc),
                    },
                )
                if chunks:
                    global_chunks = [
                        {
                            "id": f"{document_id}-{c['ordinal']}",
                            "document_id": document_id,
                            "ordinal": c["ordinal"],
                            "page_start": c.get("pageStart", 1),
                            "page_end": c.get("pageEnd", 1),
                            "section": f"Page {c.get('pageStart', 1)}",
                            "content": c["content"],
                            "embedding": embeddings[i] if i < len(embeddings) else [0.0] * 768,
                        }
                        for i, c in enumerate(chunks)
                    ]
                    await run_in_threadpool(postgres.add_global_chunks, global_chunks)
            except Exception:
                logger.debug("Could not store Knowledge Base document in PostgreSQL", exc_info=True)

        # 2. Update MongoDB knowledge_base_documents
        try:
            from app.database import get_database
            db = get_database()
            formatted_chunks = [
                {
                    "id": f"{document_id}-{c['ordinal'] + 1}",
                    "index": c["ordinal"] + 1,
                    "content": c["content"],
                    "characters": len(c["content"]),
                    "pageStart": c.get("pageStart", 1),
                    "pageEnd": c.get("pageEnd", 1),
                }
                for c in chunks
            ]
            await db["knowledge_base_documents"].update_one(
                {"id": document_id},
                {
                    "$set": {
                        "status": "ready",
                        "progress": 100,
                        "extractedText": extracted_full_text,
                        "pageCount": len(pages),
                        "chunkCount": len(chunks),
                        "chunks": formatted_chunks,
                        "error": "",
                    }
                },
            )
        except Exception:
            logger.debug("Could not update MongoDB knowledge_base_documents", exc_info=True)

        return {
            "status": "completed",
            "pageCount": len(pages),
            "chunkCount": len(chunks),
        }
    except Exception as exc:
        logger.exception("Failed to process Knowledge Base document %s", name)
        try:
            from app.database import get_database
            db = get_database()
            await db["knowledge_base_documents"].update_one(
                {"id": document_id},
                {
                    "$set": {
                        "status": "error",
                        "progress": 0,
                        "error": str(exc),
                    }
                },
            )
        except Exception:
            pass
        return {"status": "failed", "error": str(exc)}
    finally:
        if model_loaded:
            try:
                await eject_model(
                    settings.embedding_model,
                    settings.embedding_api_base_url,
                    settings.embedding_api_key,
                )
            except Exception:
                logger.debug("Could not eject model after Knowledge Base processing", exc_info=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Case pipeline worker stopped")
