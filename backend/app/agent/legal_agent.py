from datetime import datetime, timezone
import logging
import re
from typing import Any
from uuid import uuid4

import httpx
from fastapi import HTTPException, status

from app import postgres
from app.agent.citation_validator import validate_citations
from app.auth import AuthContext, verify_case_authorization
from app.config import get_settings
from app.models.chat import (
    ChatMessage,
    ChatRequestV1,
    ChatResponseV1,
    CitationItem,
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


def classify_legal_question(query: str) -> str:
    """Classifies user inquiry into standard legal task categories."""
    q = query.lower()
    if any(k in q for k in ["deadline", "limitation", "due date", "calendar", "timeline", "sol", "when must", "statute of limitation"]):
        return "deadline_action_items"
    if any(k in q for k in ["summary", "overview", "summarize", "what is this case about", "case status"]):
        return "case_summary"
    if any(k in q for k in ["parties", "plaintiff", "defendant", "judge", "counsel", "represented by", "parties involved"]):
        return "parties_dates_events"
    if any(k in q for k in ["statute", "precedent", "doctrine", "standard of review", "rule of law", "case law", "test for", "elements of"]):
        return "legal_research"
    if any(k in q for k in ["apply", "comply with", "violate", "consistent with", "under the statute", "elements met"]):
        return "fact_law_comparison"
    return "document_qa"


def determine_knowledge_scope(
    request: ChatRequestV1,
    question_type: str,
) -> str:
    """Determines effective knowledge scope based on parameters and query semantics."""
    if request.knowledge_scope:
        return request.knowledge_scope

    # If case_id is provided
    if request.case_id:
        if question_type in {"legal_research", "fact_law_comparison"}:
            return "combined"
        return "case"

    return "global"


def generate_suggested_questions(question_type: str, case_id: str | None) -> list[str]:
    """Generates context-aware follow-up legal questions."""
    if question_type == "deadline_action_items":
        return [
            "What procedural triggering events determine these deadlines?",
            "Are there any tolling provisions or extensions that apply?",
            "What are the upcoming required filing obligations?",
        ]
    elif question_type == "case_summary":
        return [
            "What are the key risks identified in the case documents?",
            "Who are the principal parties and opposing counsel?",
            "What relief or damages are requested in the pleadings?",
        ]
    elif question_type == "legal_research":
        return [
            "What are the controlling precedents in this jurisdiction?",
            "Have any of these authorities been modified or superseded?",
            "How do recent court rulings interpret this standard?",
        ]
    elif case_id:
        return [
            "What exhibits or contracts support these claims?",
            "What are the potential legal defenses available?",
            "What additional evidence is required before filing?",
        ]
    return [
        "What jurisdiction applies to this legal matter?",
        "What are the statutory requirements under applicable law?",
        "What precedent governs this issue?",
    ]


async def run_legal_agent(
    request: ChatRequestV1,
    auth: AuthContext,
    client_ip: str | None = None,
) -> ChatResponseV1:
    """
    Deterministic multi-step legal AI agent orchestrator:
    1. Validate request and authorization
    2. Identify question type and resolve knowledge scope
    3. Resolve conversation context and history
    4. Retrieve authorized documents
    5. Check relevance & sufficiency
    6. Generate grounded response with prompt-injection defense
    7. Programmatically validate citations against retrieved chunks
    8. Persist conversation and audit log
    """
    settings = get_settings()
    user_query = request.get_query_text()
    question_type = classify_legal_question(user_query)
    effective_scope = determine_knowledge_scope(request, question_type)

    # Validate scope constraints
    if effective_scope in {"case", "combined"} and not request.case_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Knowledge scope '{effective_scope}' requires a valid 'case_id'.",
        )

    # Enforce case authorization before any retrieval
    if request.case_id:
        verify_case_authorization(auth, request.case_id)

    # Resolve or create conversation
    conv_id = request.conversation_id or str(uuid4())
    existing_conv = None
    try:
        existing_conv = postgres.get_conversation(conv_id, auth.tenant_id)
    except Exception as exc:
        logger.warning("Could not read conversation from DB: %s", exc)

    if not existing_conv:
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

    # Load conversation history for context
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
            logger.warning("Could not fetch messages from DB: %s", exc)

    # Query Rewriting
    rewritten_query = rewrite_legal_query(user_query, history_messages)

    # Retrieval based on scope
    global_sources: list[dict[str, Any]] = []
    case_sources: list[dict[str, Any]] = []

    if effective_scope == "global":
        global_sources = await retrieve_global_knowledge(
            query=rewritten_query,
            tenant_id=auth.tenant_id,
        )
    elif effective_scope == "case":
        if request.case_id:
            case_sources = await retrieve_case_knowledge(
                case_id=request.case_id,
                query=rewritten_query,
            )
    elif effective_scope == "combined":
        if request.case_id:
            combined = await retrieve_combined_knowledge(
                case_id=request.case_id,
                query=rewritten_query,
                tenant_id=auth.tenant_id,
            )
            global_sources = combined["global_sources"]
            case_sources = combined["case_sources"]

    all_sources = global_sources + case_sources
    insufficient_evidence = len(all_sources) == 0

    # Build prompt messages
    system_prompt = build_system_prompt(effective_scope)
    evidence_context = format_evidence_context(
        global_sources=global_sources,
        case_sources=case_sources,
        insufficient_evidence=insufficient_evidence,
    )

    llm_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": evidence_context},
        *history_messages[-settings.chat_history_window:],
        {"role": "user", "content": user_query},
    ]

    # Model configuration check
    if not settings.llm_api_base_url or not settings.llm_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat is not configured. Set LLM_MODEL on the backend to the model identifier loaded in LM Studio.",
        )

    endpoint = f"{settings.llm_api_base_url.rstrip('/')}/chat/completions"
    headers: dict[str, str] = {}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"

    payload = {
        "model": settings.llm_model,
        "messages": llm_messages,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_reply = result["choices"][0]["message"]["content"]
        if not isinstance(raw_reply, str) or not raw_reply.strip():
            raise ValueError("The model returned an empty response.")
        answer = raw_reply.strip()
    except httpx.TimeoutException as exc:
        logger.warning("LLM request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The chat service timed out. Please try again.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.warning("LLM provider returned HTTP %s", exc.response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The chat provider could not complete the request. Please try again.",
        ) from exc
    except httpx.RequestError as exc:
        logger.exception("Could not reach the configured LLM provider")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the chat provider.",
        ) from exc

    # Citation Validation: programmatically ground against actual retrieved chunks
    validated_citations = validate_citations(answer, all_sources)

    # Persist user & assistant messages
    user_msg_id = str(uuid4())
    assistant_msg_id = str(uuid4())
    now = datetime.now(timezone.utc)

    metadata_obj = ResponseMetadata(
        knowledge_scope=effective_scope,
        case_id=request.case_id,
        retrieval_performed=True,
        insufficient_evidence=insufficient_evidence,
        question_type=question_type,
    )

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
                "content": answer,
                "citations": [c.model_dump() for c in validated_citations],
                "metadata": metadata_obj.model_dump(),
                "created_at": now,
            }
        )
    except Exception as exc:
        logger.warning("Could not persist messages to PostgreSQL: %s", exc)

    # Audit logging
    postgres.log_audit_event(
        user_id=auth.user_id,
        tenant_id=auth.tenant_id,
        action="chat_completion",
        resource_type="case" if request.case_id else "global_knowledge",
        resource_id=request.case_id or conv_id,
        details={
            "conversation_id": conv_id,
            "scope": effective_scope,
            "question_type": question_type,
            "citations_count": len(validated_citations),
            "insufficient_evidence": insufficient_evidence,
        },
        ip_address=client_ip,
    )

    suggested = generate_suggested_questions(question_type, request.case_id)

    return ChatResponseV1(
        conversation_id=conv_id,
        answer=answer,
        citations=validated_citations,
        metadata=metadata_obj,
        suggested_questions=suggested,
        model=settings.llm_model,
        chatId=conv_id,
        reply=answer,
    )
