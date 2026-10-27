from datetime import datetime, timezone
import json
import logging
from typing import AsyncGenerator
from uuid import uuid4

import httpx

from app import postgres
from app.agent.citation_validator import validate_citations
from app.agent.legal_agent import (
    classify_legal_question,
    determine_knowledge_scope,
    generate_suggested_questions,
)
from app.auth import AuthContext, verify_case_authorization
from app.config import get_settings
from app.models.chat import (
    ChatRequestV1,
    ChatResponseV1,
    ResponseMetadata,
)
from app.prompts.system_prompt import (
    build_system_prompt,
    format_evidence_context,
)
from app.retrieval.case_retriever import retrieve_case_knowledge
from app.retrieval.combined_retriever import retrieve_combined_knowledge
from app.retrieval.global_retriever import retrieve_global_knowledge
from app.retrieval.query_rewriter import rewrite_legal_query

logger = logging.getLogger(__name__)


def sse_event(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


async def stream_legal_agent(
    request: ChatRequestV1,
    auth: AuthContext,
    client_ip: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streams legal agent response using Server-Sent Events (SSE).
    Emits start, delta, citations, complete, and error events.
    """
    settings = get_settings()

    try:
        user_query = request.get_query_text()
    except Exception as exc:
        yield sse_event("error", {"error": "Invalid request", "detail": str(exc)})
        return

    question_type = classify_legal_question(user_query)
    effective_scope = determine_knowledge_scope(request, question_type)

    if effective_scope in {"case", "combined"} and not request.case_id:
        yield sse_event(
            "error",
            {"error": "Validation error", "detail": f"Knowledge scope '{effective_scope}' requires 'case_id'."},
        )
        return

    if request.case_id:
        try:
            verify_case_authorization(auth, request.case_id)
        except Exception as exc:
            yield sse_event("error", {"error": "Authorization error", "detail": str(exc)})
            return

    conv_id = request.conversation_id or str(uuid4())
    try:
        postgres.create_conversation(
            {
                "id": conv_id,
                "user_id": auth.user_id,
                "tenant_id": auth.tenant_id,
                "case_id": request.case_id,
                "title": user_query[:60],
                "knowledge_scope": effective_scope,
                "pinned": False,
            }
        )
    except Exception as exc:
        logger.warning("Could not persist conversation header: %s", exc)

    # Load history
    history_messages: list[dict[str, str]] = []
    if request.messages:
        for msg in request.messages[:-1]:
            if msg.role in {"user", "assistant"}:
                history_messages.append({"role": msg.role, "content": msg.content})
    else:
        try:
            db_msgs = postgres.get_conversation_messages(conv_id, limit=settings.chat_history_window)
            for m in db_msgs:
                history_messages.append({"role": m["role"], "content": m["content"]})
        except Exception as exc:
            logger.warning("Could not fetch messages: %s", exc)

    rewritten_query = rewrite_legal_query(user_query, history_messages)

    # Retrieval
    global_sources = []
    case_sources = []
    if effective_scope == "global":
        global_sources = await retrieve_global_knowledge(
            query=rewritten_query,
            tenant_id=auth.tenant_id,
        )
    elif effective_scope == "case" and request.case_id:
        case_sources = await retrieve_case_knowledge(
            case_id=request.case_id,
            query=rewritten_query,
        )
    elif effective_scope == "combined" and request.case_id:
        combined = await retrieve_combined_knowledge(
            case_id=request.case_id,
            query=rewritten_query,
            tenant_id=auth.tenant_id,
        )
        global_sources = combined["global_sources"]
        case_sources = combined["case_sources"]

    all_sources = global_sources + case_sources
    insufficient_evidence = len(all_sources) == 0

    metadata_obj = ResponseMetadata(
        knowledge_scope=effective_scope,
        case_id=request.case_id,
        retrieval_performed=True,
        insufficient_evidence=insufficient_evidence,
        question_type=question_type,
    )

    # Yield start event
    yield sse_event(
        "start",
        {
            "conversation_id": conv_id,
            "metadata": metadata_obj.model_dump(),
        },
    )

    system_prompt = build_system_prompt(effective_scope)
    evidence_context = format_evidence_context(global_sources, case_sources, insufficient_evidence)

    llm_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": evidence_context},
        *history_messages[-settings.chat_history_window:],
        {"role": "user", "content": user_query},
    ]

    endpoint = f"{settings.llm_api_base_url.rstrip('/')}/chat/completions"
    headers = {}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"

    payload = {
        "model": settings.llm_model,
        "messages": llm_messages,
        "stream": True,
    }

    full_answer_parts: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as stream_resp:
                stream_resp.raise_for_status()
                async for line in stream_resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data_str)
                            delta = chunk_data["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                full_answer_parts.append(delta)
                                yield sse_event("delta", {"delta": delta})
                        except Exception:
                            continue
    except Exception as exc:
        logger.exception("Streaming provider error")
        yield sse_event("error", {"error": "LLM streaming error", "detail": str(exc)})
        return

    full_answer = "".join(full_answer_parts).strip()
    if not full_answer:
        full_answer = "The legal assistant returned an empty response."

    # Validate citations
    validated_citations = validate_citations(full_answer, all_sources)
    yield sse_event("citations", {"citations": [c.model_dump() for c in validated_citations]})

    # Persist records
    user_msg_id = str(uuid4())
    assistant_msg_id = str(uuid4())
    now = datetime.now(timezone.utc)

    try:
        postgres.add_message(
            {
                "id": user_msg_id,
                "conversation_id": conv_id,
                "role": "user",
                "content": user_query,
                "citations": [],
                "metadata": {"scope": effective_scope},
                "created_at": now,
            }
        )
        postgres.add_message(
            {
                "id": assistant_msg_id,
                "conversation_id": conv_id,
                "role": "assistant",
                "content": full_answer,
                "citations": [c.model_dump() for c in validated_citations],
                "metadata": metadata_obj.model_dump(),
                "created_at": now,
            }
        )
    except Exception as exc:
        logger.warning("Could not persist streamed messages to DB: %s", exc)

    postgres.log_audit_event(
        user_id=auth.user_id,
        tenant_id=auth.tenant_id,
        action="chat_stream_completion",
        resource_type="case" if request.case_id else "global_knowledge",
        resource_id=request.case_id or conv_id,
        details={"conversation_id": conv_id, "scope": effective_scope},
        ip_address=client_ip,
    )

    suggested = generate_suggested_questions(question_type, request.case_id)
    complete_resp = ChatResponseV1(
        conversation_id=conv_id,
        answer=full_answer,
        citations=validated_citations,
        metadata=metadata_obj,
        suggested_questions=suggested,
        model=settings.llm_model,
        chatId=conv_id,
        reply=full_answer,
    )

    yield sse_event("complete", complete_resp.model_dump())
