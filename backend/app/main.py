import asyncio
from contextlib import asynccontextmanager
import json
import logging
import re
from typing import Any, AsyncGenerator, Literal
import uuid

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from fastapi.middleware.cors import CORSMiddleware

from app import pipeline, postgres
from app.config import get_settings
from app.database import close_database, get_database
from app.model_manager import is_model_loaded, load_model
from app.pipeline import create_embeddings
from app.routers.cases import router as cases_router
from app.routers.chat_files import router as chat_files_router
from app.routers.chat_v1 import router as chat_v1_router
from app.routers.knowledge_base import router as knowledge_base_router

settings = get_settings()
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=20_000)
    attachments: list[dict[str, Any]] | None = Field(default=None)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    messages: list[ChatMessage] | None = None
    message: str | None = None
    chatId: str | None = None
    chat_id: str | None = None
    conversation_id: str | None = None
    caseId: str | None = None
    case_id: str | None = None
    attachment_ids: list[str] | None = None
    knowledge_scope: str | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    stream: bool = False

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            cid = data.get("chatId") or data.get("chat_id") or data.get("conversation_id")
            data["chatId"] = str(cid).strip() if cid and str(cid).strip() else None

            case = data.get("caseId") or data.get("case_id")
            data["caseId"] = str(case).strip() if case and str(case).strip() else None

            msg = data.get("message")
            raw_messages = data.get("messages")
            if not raw_messages and msg and str(msg).strip():
                data["messages"] = [{
                    "role": "user",
                    "content": str(msg).strip(),
                    "attachments": data.get("attachments") or [],
                }]
            elif isinstance(raw_messages, list):
                cleaned = []
                for m in raw_messages:
                    if isinstance(m, dict):
                        content = str(m.get("content") or "").strip()
                        if content:
                            role = m.get("role", "user")
                            if role not in {"user", "assistant", "system"}:
                                role = "user"
                            cleaned.append({
                                "role": role,
                                "content": content,
                                "attachments": m.get("attachments") or [],
                            })
                data["messages"] = cleaned
        return data


class ChatSource(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    pageStart: int
    pageEnd: int
    id: str | None = None
    document_id: str | None = None
    section: str | None = None
    sourceType: str | None = None
    url: str | None = None
    snippet: str | None = None


def _format_sources(raw_sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    formatted: list[dict[str, Any]] = []
    seen: set[tuple[str, str, int]] = set()
    for s in raw_sources:
        name = str(s.get("name") or s.get("document_title") or "Legal Authority")
        section = str(s.get("section") or "").strip()
        p_start = s.get("page_start") or s.get("pageStart") or 1
        p_end = s.get("page_end") or s.get("pageEnd") or p_start
        try:
            p_start = int(p_start)
        except (ValueError, TypeError):
            p_start = 1
        try:
            p_end = int(p_end)
        except (ValueError, TypeError):
            p_end = p_start

        key = (name.lower(), section.lower(), p_start)
        if key in seen:
            continue
        seen.add(key)

        doc_id = str(s.get("document_id") or s.get("attachment_id") or s.get("id") or "")
        source_type = s.get("source_type") or s.get("sourceType")
        if not source_type:
            if s.get("attachment_id"):
                source_type = "chat_attachment"
            elif s.get("case_id"):
                source_type = "case_document"
            else:
                source_type = "global_legal_authority"

        url = s.get("url") or ""
        if not url and doc_id:
            if source_type == "chat_attachment":
                url = f"/api/chat/attachments/{doc_id}/file"
            elif source_type == "global_legal_authority":
                url = f"/api/knowledge-base/documents/{doc_id}/file"

        raw_snippet = s.get("snippet") or s.get("content") or s.get("quote") or ""
        clean_snippet = raw_snippet.strip()[:450] if isinstance(raw_snippet, str) else ""

        formatted.append({
            "id": str(s.get("id") or s.get("chunk_id") or doc_id or uuid.uuid4()),
            "document_id": doc_id,
            "name": name,
            "section": section,
            "pageStart": p_start,
            "pageEnd": p_end,
            "sourceType": source_type,
            "url": url,
            "snippet": clean_snippet,
        })
    return formatted


def strip_source_citation_blocks(text: str) -> str:
    """Removes trailing 'Source Citation:' or 'Document: ... Section: ... Page: ...' blocks generated by LLM."""
    if not text:
        return ""
    # 1. Remove explicit Source Citation: / Sources: trailing block
    p1 = r"(?is)\n*(?:---\s*\n*)?(?:#{1,6}\s*|\*{1,2}\s*)?(?:Source\s+Citations?|Sources?|Source\s+Reference|References?)(?::\*{1,2}|\*{1,2}:?|:)?\s*\n+.*?(?:Document|Section|Page|Act|Article|Doc).*$"
    cleaned = re.sub(p1, "", text).strip()
    # 2. Also remove naked trailing Document: ... Section: ... Page(s): ... blocks
    p2 = r"(?is)\n*(?:---\s*\n*)?Document\s*:\s*[^\n]+\n+Section\s*:\s*[^\n]+.*$"
    cleaned = re.sub(p2, "", cleaned).strip()
    return cleaned


class ChatResponse(BaseModel):
    reply: str
    model: str
    chatId: str | None = None
    sources: list[ChatSource] = Field(default_factory=list)


LEGAL_TYPO_MAP = {
    r"\bpetitionar\b": "petitioner",
    r"\bpetitionars\b": "petitioners",
    r"\brespondant\b": "respondent",
    r"\brespondants\b": "respondents",
    r"\bplaintif\b": "plaintiff",
    r"\bplaintifs\b": "plaintiffs",
    r"\bdefendent\b": "defendant",
    r"\bdefendents\b": "defendants",
    r"\bapellant\b": "appellant",
    r"\bapellants\b": "appellants",
    r"\bjurisdition\b": "jurisdiction",
    r"\bafridavit\b": "affidavit",
    r"\baffidavite\b": "affidavit",
}


def normalize_legal_query(text: str) -> str:
    result = text
    for pattern, replacement in LEGAL_TYPO_MAP.items():
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result


def should_skip_chat_query_embedding() -> bool:
    """
    Checks whether generating a query embedding during chat should be skipped.
    When the embedding model and chat LLM share the same local server endpoint
    (e.g. LM Studio on localhost:1234), generating an embedding for every chat prompt
    causes LM Studio to evict the LLM to load the embedding model, and then immediately
    evict the embedding model to reload the LLM for chat completions.
    In such setups, we skip query embedding and use PostgreSQL's indexed full-text
    search (ts_rank_cd / plainto_tsquery), avoiding model reload loops and delays.
    """
    if not settings.embedding_api_base_url or not settings.embedding_model:
        return True
    if getattr(settings, "chat_query_embeddings", False):
        return False
    cleaned_embed = settings.embedding_api_base_url.rstrip("/").lower()
    cleaned_llm = (settings.llm_api_base_url or "").rstrip("/").lower()
    return (
        cleaned_embed == cleaned_llm
        and settings.embedding_model.strip().lower() != (settings.llm_model or "").strip().lower()
    )


LEGAL_ASSISTANT_INSTRUCTIONS = (
    "You are an expert legal counsel assistant answering questions accurately, practically, and cautiously. "
    "Maintain full conversational context and continuity: faithfully retain and apply all facts, parties, "
    "claims, timelines, and legal points established across all previous conversation messages. "
    "When answering specific questions (such as identifying who the petitioner, respondent, or parties are, "
    "or explaining procedural history), combine the conversation context, the case information and parties, "
    "and the provided document excerpts to give a direct, accurate, and comprehensive answer.\n\n"
    "Instructions:\n"
    "1. Context & Continuity: Always retain and utilize knowledge from previous messages in the chat. "
    "If the petitioner, respondent, or factual background was established in earlier turns or in the case information, "
    "directly use that knowledge to answer the question without claiming lack of knowledge.\n"
    "2. Completeness: When asked what was promised, agreed, or transferred, state BOTH the exact subject matter "
    "(specific goods, services, or actions) AND the operational terms (dates, tranches, amounts, and deadlines). "
    "Do not mention only one.\n"
    "3. Procedural Chain: When asked about jurisdiction, maintain the full procedural chain "
    "(e.g., mention police complaints, NCR numbers, and statutory sections like BNSS/CrPC rather than general statements).\n"
    "4. Grounding: Cite specific page/section markers for every primary assertion when referencing source documents. "
    "If a specific detail is not found in the conversation, case information, or documents, state what is known and clarify what is missing.\n"
    "5. Physical Addresses / Event Locations: Whenever answering questions about an event location ('Where did it happen?'), "
    "provide both the informal reference (e.g., 'the office') and resolve the full physical address (building, suite, street, locality) "
    "from the party profile sections of the document if available.\n"
    "6. Statutory Requirements & Legal Definitions: When a query asks about legal definitions, statutory requirements "
    "(e.g., under BNS, BNSS, BSA), or admissibility criteria alongside case facts, retrieve the case specifics from the "
    "case record and supplement the statutory requirements from the Indian Law Knowledge Base rather than claiming statutory procedure is outside the scope.\n"
    "7. Problem Statement & Case Analysis Framework: Whenever the user shares a problem statement, factual dispute, "
    "transcribed audio recording, complaint, or legal situation, systematically structure your response under clear markdown headers:\n"
    "   - ### 1. Case Classification & Nature of Matter: Clearly categorize the matter (e.g., Criminal Breach of Trust, Cheating/Fraud under BNS, Theft, Consumer Dispute, Civil Recovery, Negotiable Instruments Section 138, Domestic Dispute, Property/Injunction, Employment dispute, Cyber Crime), summarize the core dispute, and identify the parties.\n"
    "   - ### 2. Statutory Analysis & Governing Sections: Cross-examine the situation against the common Indian Law Knowledge Base and relevant enactments. Explicitly cite the operative Acts and Sections (e.g., Bharatiya Nyaya Sanhita (BNS) 2023, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, Bharatiya Sakshya Adhiniyam (BSA) 2023, Consumer Protection Act 2019, Negotiable Instruments Act 1881, etc.). Break down the essential ingredients required under each section and evaluate how the client's facts satisfy or lack them.\n"
    "   - ### 3. Actionable Sequential Steps to Solve: Outline concrete, practical steps (e.g., evidentiary preservation, Section 63 BSA certificate for digital messages/call logs, formal demand notice, filing complaint under Section 173 BNSS, escalation to SP under Section 173(4) BNSS, application to Judicial Magistrate under Section 175(3) BNSS, or consumer forum/civil court filing, limitation periods, and territorial jurisdiction).\n"
    "   - ### 4. Evidentiary Checklist & Strategic Advice: List critical proof needed and key legal cautions.\n"
    "8. Provide clear, practical, cautious legal information. Explain that your response is informational and not a substitute "
    "for advice from a qualified lawyer. Do not output private chain-of-thought; give concise, structured conclusions and explanations.\n"
    "9. Do NOT output a 'Source Citation:', 'Sources:', or document metadata block (e.g. 'Document: ... Section: ... Page(s): ...') "
    "at the end of your response text. Supporting sources and legal references are automatically extracted and rendered by the application UI in the interactive Sources drawer."
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = get_database()
    postgres.case_migration_ready = False
    postgres_ready = False
    try:
        await run_in_threadpool(postgres.initialize_schema)
        postgres_ready = True
    except Exception:
        logger.exception("Could not initialize the Supabase PostgreSQL case schema")
    try:
        await db.command("ping")
        if postgres_ready:
            legacy_cases = await db["cases"].find({}).to_list(length=None)
            migrated = await run_in_threadpool(postgres.migrate_legacy_cases, legacy_cases)
            if migrated:
                logger.info("Migrated %s legacy cases from MongoDB to PostgreSQL", migrated)
            postgres.case_migration_ready = True
    except Exception:
        logger.exception("Could not migrate legacy MongoDB cases; source records were preserved")
    pipeline_stop_event = asyncio.Event()
    pipeline_worker_task = None
    if postgres_ready:
        pipeline_worker_task = asyncio.create_task(pipeline.run_worker(pipeline_stop_event))
    if settings.llm_model and settings.llm_api_base_url:
        try:
            if not await is_model_loaded(settings.llm_model, settings.llm_api_base_url, settings.llm_api_key):
                await load_model(settings.llm_model, settings.llm_api_base_url, settings.llm_api_key)
        except Exception:
            logger.debug("Startup chat LLM pre-check deferred", exc_info=True)
    yield
    if pipeline_worker_task:
        pipeline_stop_event.set()
        pipeline.notify_job_available()
        pipeline_worker_task.cancel()
        try:
            await pipeline_worker_task
        except asyncio.CancelledError:
            pass
    close_database()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cache-Control", "Accept"],
)
app.include_router(cases_router)
app.include_router(chat_files_router)
app.include_router(knowledge_base_router)
app.include_router(chat_v1_router)


@app.get("/")
async def root() -> dict:
    return {"message": f"{settings.app_name} is running"}


@app.get("/health")
async def healthcheck() -> dict:
    try:
        await run_in_threadpool(postgres.ping)
        if not postgres.case_migration_ready:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "degraded",
                    "caseDatabase": "connected",
                    "legacyCaseMigration": "incomplete",
                },
            )
        return {
            "status": "ok",
            "caseDatabase": "connected",
            "legacyCaseMigration": "complete",
        }
    except Exception:
        logger.exception("PostgreSQL health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "caseDatabase": "disconnected",
                "error": "PostgreSQL case storage is unavailable.",
            },
        )


@app.get("/mongo-status")
async def mongo_status() -> dict:
    try:
        db = get_database()
        await db.command("ping")
        return {"status": "connected", "database": settings.mongodb_db}
    except Exception:
        logger.exception("MongoDB health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "disconnected", "database": settings.mongodb_db},
        )

async def _persist_conversation_turn(
    chat_id: str,
    case_id: str | None,
    messages: list[ChatMessage],
    reply: str,
    sources: list[dict[str, Any]],
) -> None:
    try:
        last_user_obj = next(
            (m for m in reversed(messages) if m.role == "user"),
            None,
        )
        last_user_msg = last_user_obj.content if last_user_obj else None
        user_attachments = getattr(last_user_obj, "attachments", None) or []
        if last_user_msg:
            title = (last_user_msg[:50] + "...") if len(last_user_msg) > 50 else last_user_msg
            await run_in_threadpool(
                postgres.create_conversation,
                {
                    "id": chat_id,
                    "user_id": "default-user",
                    "tenant_id": settings.postgres_tenant_id or "default-tenant",
                    "case_id": case_id,
                    "title": title,
                    "knowledge_scope": "case" if case_id else "global",
                },
            )
            await run_in_threadpool(
                postgres.add_message,
                {
                    "id": str(uuid.uuid4()),
                    "conversation_id": chat_id,
                    "role": "user",
                    "content": last_user_msg,
                    "metadata": {"attachments": user_attachments},
                },
            )
            await run_in_threadpool(
                postgres.add_message,
                {
                    "id": str(uuid.uuid4()),
                    "conversation_id": chat_id,
                    "role": "assistant",
                    "content": strip_source_citation_blocks(reply.strip()),
                    "citations": [
                        {
                            "source_id": str(source.get("source_id") or source.get("id") or uuid.uuid4()),
                            "document_id": str(source.get("document_id") or source.get("id") or uuid.uuid4()),
                            "document_title": source.get("name", "Document"),
                            "source_type": source.get("source_type") or ("case_document" if case_id else "global_legal_authority"),
                            "page": source.get("page_start", 1),
                            "pageStart": source.get("page_start", 1),
                            "pageEnd": source.get("page_end", 1),
                            "name": source.get("name", "Document"),
                            "section": source.get("section") or "",
                            "url": source.get("url") or "",
                            "quote": (source.get("snippet") or source.get("content") or "")[:400],
                        }
                        for source in sources
                    ],
                },
            )
    except Exception:
        logger.debug("Could not persist conversation to PostgreSQL", exc_info=True)


class RenameChatRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@app.patch("/api/chat/conversations/{chat_id}")
async def rename_chat_conversation(chat_id: str, payload: RenameChatRequest) -> dict[str, Any]:
    clean_title = payload.title.strip()
    if not clean_title:
        raise HTTPException(status_code=422, detail="Title cannot be empty.")
    if postgres.case_migration_ready:
        try:
            updated = await run_in_threadpool(
                postgres.update_conversation,
                chat_id,
                {"title": clean_title[:120]},
            )
            if updated:
                return {
                    "id": updated.get("id", chat_id),
                    "title": updated.get("title", clean_title),
                    "status": "success",
                }
        except Exception:
            logger.debug("Could not rename conversation in PostgreSQL", exc_info=True)
    return {"id": chat_id, "title": clean_title, "status": "success"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, raw_request: Request) -> Any:
    if not request.messages or not any(message.role == "user" for message in request.messages):
        raise HTTPException(status_code=422, detail="At least one user message is required.")
    if not settings.llm_api_base_url or not settings.llm_model:
        raise HTTPException(
            status_code=503,
            detail="Chat is not configured. Set LLM_MODEL on the backend to the model identifier loaded in LM Studio.",
        )

    # Ensure model is loaded in memory without reloading if already loaded
    try:
        if not await is_model_loaded(settings.llm_model, settings.llm_api_base_url, settings.llm_api_key):
            await load_model(settings.llm_model, settings.llm_api_base_url, settings.llm_api_key)
    except Exception:
        logger.debug("Chat LLM load check skipped or handled by server", exc_info=True)

    sources = []
    context_messages = []
    effective_chat_id = request.chatId or (request.caseId if request.caseId else "default-chat")

    # 1. ATTACHMENT EXTRACTION & DIRECT CONTEXT INJECTION
    # Extract any staged or explicitly referenced attachments when the user clicks Send
    direct_attachment_sources: list[dict[str, Any]] = []
    try:
        from app.routers.chat_files import get_attachment_bytes

        target_attachment_ids: set[str] = set()
        if request.attachment_ids:
            target_attachment_ids.update(request.attachment_ids)

        last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
        if last_user_msg and last_user_msg.attachments:
            for att in last_user_msg.attachments:
                if isinstance(att, dict) and att.get("id"):
                    target_attachment_ids.add(str(att["id"]))

        # Gather attachments from PostgreSQL and MongoDB
        candidate_attachments: list[dict[str, Any]] = []
        if postgres.case_migration_ready:
            try:
                candidate_attachments = postgres.get_staged_chat_attachments(
                    effective_chat_id,
                    list(target_attachment_ids) if target_attachment_ids else None,
                )
            except Exception:
                logger.debug("PostgreSQL get_staged_chat_attachments skipped", exc_info=True)

        if not candidate_attachments:
            try:
                db = get_database()
                stage_filter: dict[str, Any] = {
                    "chat_id": effective_chat_id,
                    "pipeline_status": "staged",
                }
                if target_attachment_ids:
                    stage_filter = {
                        "chat_id": effective_chat_id,
                        "$or": [
                            {"id": {"$in": list(target_attachment_ids)}},
                            {"pipeline_status": "staged"},
                        ],
                    }
                cursor = db["chat_attachments"].find(stage_filter)
                candidate_attachments = [doc async for doc in cursor]
            except Exception:
                logger.debug("MongoDB chat_attachments staged search skipped", exc_info=True)

        # Also add any attachments passed in last_user_msg.attachments not already in candidate_attachments
        # Ensure strict chat isolation: never allow attachments belonging to a different chat session
        known_ids = {str(a.get("id")) for a in candidate_attachments if a.get("id")}
        if last_user_msg and last_user_msg.attachments:
            for att in last_user_msg.attachments:
                if isinstance(att, dict) and att.get("id"):
                    att_chat_id = att.get("chat_id")
                    if att_chat_id and att_chat_id != effective_chat_id:
                        continue
                    if str(att.get("id")) not in known_ids:
                        candidate_attachments.append(att)
                        known_ids.add(str(att.get("id")))

        # Process each attachment with OCR/extraction if not completed, and extract its chunks
        for att in candidate_attachments:
            att_id = str(att.get("id") or "")
            att_chat_id = att.get("chat_id")
            if att_chat_id and att_chat_id != effective_chat_id:
                continue
            att_name = att.get("name", "attachment")
            att_path = att.get("path")
            pipeline_status = att.get("pipeline_status") or att.get("pipelineStatus")

            chunks_for_att: list[dict[str, Any]] = []
            extracted_text = att.get("extracted_text") or att.get("extractedText") or ""

            if pipeline_status != "completed" or not extracted_text:
                try:
                    att_content = await get_attachment_bytes(att_id, att_name, att_path)
                    proc_res = await pipeline.process_chat_attachment(
                        attachment_id=att_id,
                        name=att_name,
                        content=att_content,
                        chat_id=effective_chat_id,
                    )
                    if proc_res and proc_res.get("chunks"):
                        chunks_for_att = proc_res["chunks"]
                    if proc_res and proc_res.get("extractedText"):
                        extracted_text = proc_res["extractedText"]
                except Exception as exc:
                    logger.warning("Could not process staged chat attachment %s: %s", att_id, exc)

            if not chunks_for_att and postgres.case_migration_ready and att_id:
                try:
                    chunks_for_att = postgres.get_attachment_chunks(att_id)
                except Exception:
                    pass

            if not chunks_for_att and isinstance(att.get("chunks"), list):
                chunks_for_att = att["chunks"]

            if chunks_for_att:
                for c in chunks_for_att[:10]:
                    direct_attachment_sources.append({
                        "id": str(c.get("id") or att_id or uuid.uuid4()),
                        "document_id": att_id,
                        "name": att_name,
                        "section": c.get("section") or "",
                        "page_start": c.get("page_start") or c.get("pageStart", 1),
                        "page_end": c.get("page_end") or c.get("pageEnd", 1),
                        "content": c.get("content", ""),
                        "source_type": "chat_attachment",
                        "url": f"/api/chat/attachments/{att_id}/file" if att_id else "",
                    })
            elif extracted_text:
                direct_attachment_sources.append({
                    "id": str(att_id or uuid.uuid4()),
                    "document_id": att_id,
                    "name": att_name,
                    "section": "",
                    "page_start": 1,
                    "page_end": 1,
                    "content": extracted_text[:4000],
                    "source_type": "chat_attachment",
                    "url": f"/api/chat/attachments/{att_id}/file" if att_id else "",
                })
    except Exception as exc:
        logger.warning("Error processing staged chat attachments: %s", exc, exc_info=True)

    if direct_attachment_sources:
        attachment_context = "\n\n".join(
            f"Attached Document: {s['name']} (Page {s['page_start']}-{s['page_end']}):\n{s['content']}"
            for s in direct_attachment_sources
        )
        context_messages.append(
            {
                "role": "system",
                "content": (
                    "Attached Document(s) and Media Uploaded by User in this conversation:\n"
                    f"{attachment_context}\n\n"
                    "CRITICAL INSTRUCTION: The user has attached the document(s) above for this query. "
                    "Directly analyze and answer the user's question using the content and text of these attached documents. "
                    "Under NO circumstances should you ask the user to upload or attach the document; its full content is provided right above.\n"
                    "Audio/Media Guidance: If an attached audio or video file contains an '[Audio Transcription]' or '[Video Transcription]', "
                    "treat that transcribed text as the exact spoken content of the recording and analyze it directly. "
                    "If an audio or video file indicates that spoken words could not be transcribed (e.g. 'Notice: Spoken audio words could not be automatically transcribed'), "
                    "clearly and politely inform the user that the audio file was received but could not be transcribed automatically, and invite them to share what was said "
                    "or summarize the question so you can assist them, instead of repeatedly asking for questions without explanation."
                ),
            }
        )

    if request.caseId:
        case_record = None
        try:
            case_record = await run_in_threadpool(postgres.get_case, request.caseId)
        except Exception:
            logger.debug("Could not retrieve case record for %s", request.caseId, exc_info=True)

        try:
            pipeline_status = await run_in_threadpool(
                postgres.get_pipeline_status,
                request.caseId,
            )
            if pipeline_status is None and case_record is None:
                raise HTTPException(status_code=404, detail="Case not found.")

            user_question = next(
                message.content
                for message in reversed(request.messages)
                if message.role == "user"
            )
            clean_question = normalize_legal_query(user_question)
            is_party_query = bool(re.search(
                r"\b(petitioner|respondent|plaintiff|defendant|appellant|accused|complainant|party|parties|cause title|memo of parties|who filed)\b",
                clean_question,
                re.IGNORECASE,
            ))

            search_query = clean_question
            if is_party_query:
                search_query = f"{clean_question} petitioner respondent parties cause title memo"

            if pipeline_status and pipeline_status.get("processedDocuments"):
                query_embedding = None
                if not should_skip_chat_query_embedding():
                    try:
                        query_embedding = (await asyncio.wait_for(
                            create_embeddings([search_query], query=True),
                            timeout=3.0,
                        ))[0]
                    except Exception:
                        logger.debug("Case embedding creation timed out or failed; falling back to keyword search", exc_info=True)
                sources = await run_in_threadpool(
                    postgres.search_case_chunks,
                    request.caseId,
                    search_query,
                    query_embedding,
                )

                if is_party_query or len(sources) < 2:
                    try:
                        header_chunks = await run_in_threadpool(postgres.get_case_header_chunks, request.caseId, 2)
                        existing_ids = {s.get("chunk_id") for s in sources if s.get("chunk_id")}
                        merged = [h for h in header_chunks if h.get("chunk_id") not in existing_ids]
                        merged.extend(sources)
                        sources = merged[:5]
                    except Exception:
                        pass

                # Supplement with Common Indian Law Knowledge Base chunks for statutory analysis
                if len(sources) < 6:
                    try:
                        global_kb_sources = await run_in_threadpool(
                            postgres.search_global_chunks,
                            search_query,
                            query_embedding,
                            settings.postgres_tenant_id or None,
                            3,
                        )
                        for g_source in global_kb_sources:
                            sources.append({
                                "id": str(g_source.get("chunk_id") or g_source.get("document_id") or uuid.uuid4()),
                                "document_id": str(g_source.get("document_id") or ""),
                                "name": g_source.get("name") or "Indian Law Knowledge Base",
                                "section": g_source.get("section") or "",
                                "page_start": g_source.get("page_start", 1),
                                "page_end": g_source.get("page_end", 1),
                                "content": g_source.get("content", ""),
                                "source_type": "global_legal_authority",
                                "url": g_source.get("url") or (f"/api/knowledge-base/documents/{g_source.get('document_id')}/file" if g_source.get("document_id") else ""),
                            })
                    except Exception:
                        logger.debug("Global knowledge base search skipped in case mode", exc_info=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Could not retrieve case documents for case %s", request.caseId)
            raise HTTPException(
                status_code=503,
                detail="Case document search is unavailable. Check PostgreSQL and LM Studio embeddings.",
            ) from exc

        case_meta_parts = []
        if case_record:
            if case_record.get("title"):
                case_meta_parts.append(f"Case Title: {case_record['title']}")
            if case_record.get("parties"):
                case_meta_parts.append(f"Parties (Petitioner / Respondent): {case_record['parties']}")
            if case_record.get("matterType"):
                case_meta_parts.append(f"Matter Type: {case_record['matterType']}")
            if case_record.get("summary"):
                case_meta_parts.append(f"Case Summary / Background: {case_record['summary']}")

        case_info_block = ""
        if case_meta_parts:
            case_info_block = "Case Information & Key Parties:\n" + "\n".join(f"- {p}" for p in case_meta_parts) + "\n\n"

        if direct_attachment_sources:
            sources = direct_attachment_sources + sources

        if sources:
            context = "\n\n".join(
                f"Source: {source.get('name', 'Document')}"
                + (f", Section: {source['section']}" if source.get("section") else "")
                + f", page(s) {source.get('page_start') or source.get('pageStart', 1)}-{source.get('page_end') or source.get('pageEnd', 1)}\n"
                + f"{source.get('content', '')}"
                for source in sources
            )
            context_messages.append(
                {
                    "role": "system",
                    "content": (
                        f"{case_info_block}"
                        "Retrieved case documents:\n"
                        f"{context}\n\n"
                        "Instruction: Use the case information, conversation history, and retrieved document "
                        "excerpts above to answer the user's question directly. If asked about parties (such as who is the "
                        "petitioner or respondent), state their names and roles clearly based on the case details, "
                        "cause title, or document excerpts. Do not append a trailing 'Source Citation:' metadata block."
                    ),
                }
            )
        else:
            context_messages.append(
                {
                    "role": "system",
                    "content": (
                        f"{case_info_block}"
                        "Instruction: Answer the user's question directly using the case information and previous "
                        "conversation history above. If asked who the petitioner or respondent is, provide their names "
                        "from the case information or conversation context."
                    ),
                }
            )
    else:
        effective_chat_id = request.chatId or "default-chat"

        try:
            user_question = next(
                message.content
                for message in reversed(request.messages)
                if message.role == "user"
            )
            clean_question = normalize_legal_query(user_question)
            is_party_query = bool(re.search(
                r"\b(petitioner|respondent|plaintiff|defendant|appellant|accused|complainant|party|parties|cause title|memo of parties|who filed)\b",
                clean_question,
                re.IGNORECASE,
            ))
            search_query = clean_question
            if is_party_query:
                search_query = f"{clean_question} petitioner respondent parties cause title memo"

            if postgres.case_migration_ready:
                query_embedding = None
                if not should_skip_chat_query_embedding():
                    try:
                        query_embedding = (await asyncio.wait_for(
                            create_embeddings([search_query], query=True),
                            timeout=3.0,
                        ))[0]
                    except Exception:
                        logger.debug("Chat chunk embedding creation timed out or failed; falling back to keyword search", exc_info=True)
                try:
                    sources = await run_in_threadpool(
                        postgres.search_chat_chunks,
                        effective_chat_id,
                        search_query,
                        query_embedding,
                    )
                    if is_party_query or len(sources) < 2:
                        try:
                            header_chunks = await run_in_threadpool(postgres.get_chat_header_chunks, effective_chat_id, 2)
                            existing_ids = {s.get("chunk_id") for s in sources if s.get("chunk_id")}
                            merged = [h for h in header_chunks if h.get("chunk_id") not in existing_ids]
                            merged.extend(sources)
                            sources = merged[:5]
                        except Exception:
                            pass

                    # Supplement with uploaded Knowledge Base global legal chunks
                    if len(sources) < 5:
                        try:
                            global_kb_sources = await run_in_threadpool(
                                postgres.search_global_chunks,
                                search_query,
                                query_embedding,
                                settings.postgres_tenant_id or None,
                                5 - len(sources),
                            )
                            for g_source in global_kb_sources:
                                sources.append({
                                    "id": str(g_source.get("chunk_id") or g_source.get("document_id") or uuid.uuid4()),
                                    "document_id": str(g_source.get("document_id") or ""),
                                    "name": g_source.get("name") or "Indian Law Knowledge Base",
                                    "section": g_source.get("section") or "",
                                    "page_start": g_source.get("page_start", 1),
                                    "page_end": g_source.get("page_end", 1),
                                    "content": g_source.get("content", ""),
                                    "source_type": "global_legal_authority",
                                    "url": g_source.get("url") or (f"/api/knowledge-base/documents/{g_source.get('document_id')}/file" if g_source.get("document_id") else ""),
                                })
                        except Exception:
                            logger.debug("Global knowledge base search skipped", exc_info=True)

                    if len(sources) < 5:
                        try:
                            db = get_database()
                            kb_cursor = db["knowledge_base_documents"].find({"status": "completed"})
                            stopwords = {
                                "what", "kind", "case", "this", "that", "with", "from", "have", "been",
                                "will", "like", "find", "step", "steps", "solve", "check", "share",
                                "audio", "voice", "recording", "under", "tell", "show", "help", "please",
                                "about", "there", "their", "where", "which", "could", "would", "should"
                            }
                            meaningful_words = [
                                w.lower() for w in clean_question.split()
                                if len(w) > 3 and w.lower() not in stopwords
                            ]
                            if meaningful_words:
                                async for kb_doc in kb_cursor:
                                    for kb_chunk in kb_doc.get("chunks", []):
                                        content_text = kb_chunk.get("content", "")
                                        if any(w in content_text.lower() for w in meaningful_words):
                                            sources.append({
                                                "id": str(kb_chunk.get("id") or kb_doc.get("id") or uuid.uuid4()),
                                                "document_id": kb_doc.get("id"),
                                                "name": kb_doc.get("name", "Knowledge Base Document"),
                                                "section": kb_chunk.get("section", ""),
                                                "page_start": kb_chunk.get("pageStart", 1),
                                                "page_end": kb_chunk.get("pageEnd", 1),
                                                "content": content_text,
                                                "source_type": "global_legal_authority",
                                                "url": f"/api/knowledge-base/documents/{kb_doc.get('id')}/file" if kb_doc.get("id") else "",
                                            })
                                            if len(sources) >= 5:
                                                break
                                    if len(sources) >= 5:
                                        break
                        except Exception:
                            pass
                except Exception:
                    logger.debug("PostgreSQL chat chunks search unavailable; trying MongoDB", exc_info=True)

            if not sources:
                try:
                    db = get_database()
                    cursor = db["chat_attachments"].find({
                        "chat_id": effective_chat_id,
                        "pipeline_status": "completed",
                    })
                    async for doc in cursor:
                        for chunk in doc.get("chunks", []):
                            content_text = chunk.get("content", "")
                            words = [w.lower() for w in clean_question.split() if len(w) > 3]
                            if not words or any(w in content_text.lower() for w in words):
                                sources.append({
                                    "id": str(chunk.get("id") or doc.get("id") or uuid.uuid4()),
                                    "document_id": doc.get("id"),
                                    "name": doc.get("name", "Chat Attachment"),
                                    "section": chunk.get("section", ""),
                                    "page_start": chunk.get("pageStart", 1),
                                    "page_end": chunk.get("pageEnd", 1),
                                    "content": content_text,
                                    "source_type": "chat_attachment",
                                    "url": f"/api/chat/attachments/{doc.get('id')}/file" if doc.get("id") else "",
                                })
                                if len(sources) >= 5:
                                    break
                        if len(sources) >= 5:
                            break
                except Exception:
                    pass
        except Exception as exc:
            logger.debug("Chat attachment retrieval skipped: %s", exc)

        if direct_attachment_sources:
            sources = direct_attachment_sources + sources

        if sources:
            context = "\n\n".join(
                f"Source: {source.get('name', 'Document')}"
                + (f", Section: {source['section']}" if source.get("section") else "")
                + f", page(s) {source.get('page_start') or source.get('pageStart', 1)}-{source.get('page_end') or source.get('pageEnd', 1)}\n"
                + f"{source.get('content', '')}"
                for source in sources
            )
            context_messages.append(
                {
                    "role": "system",
                    "content": (
                        "Retrieved chat knowledge base documents & media:\n"
                        f"{context}\n\n"
                        "Instruction: Answer the user's question directly using the retrieved excerpts above along with "
                        "the previous conversation history. Faithfully maintain all context, facts, parties, and details "
                        "established in earlier messages. Do not append a trailing 'Source Citation:' metadata block."
                    ),
                }
            )
        else:
            context_messages.append(
                {
                    "role": "system",
                    "content": (
                        "Instruction: Answer the user's question maintaining the full context, facts, parties, "
                        "and legal knowledge established throughout the previous conversation. If the user refers to facts, "
                        "people, or documents discussed earlier, incorporate them seamlessly into your response."
                    ),
                }
            )

    clean_history_messages = [
        {"role": message.role, "content": message.content}
        for message in request.messages
    ]
    endpoint = f"{settings.llm_api_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": LEGAL_ASSISTANT_INSTRUCTIONS},
            *context_messages,
            *clean_history_messages,
        ],
    }

    is_stream = request.stream or "text/event-stream" in raw_request.headers.get("accept", "")

    if is_stream:
        async def event_generator() -> AsyncGenerator[str, None]:
            formatted_sources = _format_sources(sources)
            if formatted_sources:
                yield f"data: {json.dumps({'type': 'sources', 'sources': formatted_sources})}\n\n"

            stream_payload = {**payload, "stream": True}
            collected_chunks: list[str] = []
            headers = {}
            if settings.llm_api_key:
                headers["Authorization"] = f"Bearer {settings.llm_api_key}"

            try:
                timeout_config = httpx.Timeout(
                    connect=10.0,
                    read=settings.llm_timeout_seconds,
                    write=10.0,
                    pool=10.0,
                )
                async with httpx.AsyncClient(timeout=timeout_config) as client:
                    async with client.stream("POST", endpoint, headers=headers, json=stream_payload) as response:
                        if response.status_code != 200:
                            err_body = await response.aread()
                            logger.warning(
                                "LLM streaming failed with %s: %s",
                                response.status_code,
                                err_body.decode(errors="replace"),
                            )
                            yield f"data: {json.dumps({'type': 'error', 'detail': 'The chat provider returned an error.'})}\n\n"
                            return

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk_data = json.loads(data_str)
                                    choices = chunk_data.get("choices", [])
                                    if choices:
                                        delta_text = choices[0].get("delta", {}).get("content", "")
                                        if delta_text:
                                            collected_chunks.append(delta_text)
                                            yield f"data: {json.dumps({'type': 'delta', 'delta': delta_text})}\n\n"
                                except Exception:
                                    pass
            except httpx.TimeoutException:
                logger.warning("LLM streaming timed out")
                yield f"data: {json.dumps({'type': 'error', 'detail': 'The chat service timed out. Please try again.'})}\n\n"
                return
            except Exception as exc:
                logger.exception("Error during LLM stream: %s", exc)
                yield f"data: {json.dumps({'type': 'error', 'detail': 'Failed to stream response.'})}\n\n"
                return

            full_reply = strip_source_citation_blocks("".join(collected_chunks).strip())
            if not full_reply:
                yield f"data: {json.dumps({'type': 'error', 'detail': 'The model returned an empty response.'})}\n\n"
                return

            if request.chatId and postgres.case_migration_ready:
                await _persist_conversation_turn(
                    chat_id=request.chatId,
                    case_id=request.caseId,
                    messages=request.messages,
                    reply=full_reply,
                    sources=sources,
                )

            yield f"data: {json.dumps({'type': 'done', 'reply': full_reply, 'chatId': request.chatId, 'sources': formatted_sources})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        timeout_config = httpx.Timeout(
            connect=10.0,
            read=settings.llm_timeout_seconds,
            write=10.0,
            pool=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            headers = {}
            if settings.llm_api_key:
                headers["Authorization"] = f"Bearer {settings.llm_api_key}"
            response = await client.post(
                endpoint,
                headers=headers,
                json=payload,
            )
        response.raise_for_status()
        result = response.json()
        reply = strip_source_citation_blocks(result["choices"][0]["message"]["content"])
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError("The model returned an empty response.")

        if request.chatId and postgres.case_migration_ready:
            await _persist_conversation_turn(
                chat_id=request.chatId,
                case_id=request.caseId,
                messages=request.messages,
                reply=reply,
                sources=sources,
            )

        formatted_sources = _format_sources(sources)
        return ChatResponse(
            reply=reply.strip(),
            model=settings.llm_model,
            chatId=request.chatId,
            sources=formatted_sources,
        )
    except httpx.TimeoutException as exc:
        logger.warning("LLM request timed out")
        raise HTTPException(status_code=504, detail="The chat service timed out. Please try again.") from exc
    except httpx.HTTPStatusError as exc:
        logger.warning("LLM provider returned HTTP %s", exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail="The chat provider could not complete the request. Please try again.",
        ) from exc
    except httpx.RequestError as exc:
        logger.exception("Could not reach the configured LLM provider")
        raise HTTPException(status_code=502, detail="Could not reach the chat provider.") from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.exception("LLM provider returned an invalid response")
        raise HTTPException(status_code=502, detail="The chat provider returned an invalid response.") from exc
