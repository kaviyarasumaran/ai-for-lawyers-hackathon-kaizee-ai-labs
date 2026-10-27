import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse

from app import postgres
from app.agent.legal_agent import run_legal_agent
from app.auth import AuthContext, get_current_user
from app.models.chat import (
    ChatRequestV1,
    ChatResponseV1,
    ConversationMessageRecord,
    ConversationSummary,
    UpdateConversationRequest,
)
from app.streaming import stream_legal_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["legal chat v1"])


@router.post("/chat", response_model=ChatResponseV1)
async def chat_v1(
    request_data: ChatRequestV1,
    raw_request: Request,
    auth: AuthContext = Depends(get_current_user),
) -> Any:
    client_ip = raw_request.client.host if raw_request.client else "unknown"
    if request_data.stream:
        return StreamingResponse(
            stream_legal_agent(request_data, auth, client_ip),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    return await run_legal_agent(request_data, auth, client_ip)


@router.post("/chat/stream")
async def chat_stream_v1(
    request_data: ChatRequestV1,
    raw_request: Request,
    auth: AuthContext = Depends(get_current_user),
) -> StreamingResponse:
    client_ip = raw_request.client.host if raw_request.client else "unknown"
    return StreamingResponse(
        stream_legal_agent(request_data, auth, client_ip),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations_v1(
    auth: AuthContext = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        return postgres.list_conversations(auth.user_id, auth.tenant_id)
    except Exception as exc:
        logger.exception("Could not list conversations")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is unavailable.",
        ) from exc


@router.get("/conversations/{conversation_id}/messages", response_model=list[ConversationMessageRecord])
async def get_conversation_messages_v1(
    conversation_id: str,
    auth: AuthContext = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        conv = postgres.get_conversation(conversation_id, auth.tenant_id)
    except Exception as exc:
        logger.exception("Could not retrieve conversation %s", conversation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is unavailable.",
        ) from exc

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    # Conversation ownership check
    if conv["user_id"] != auth.user_id and not auth.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this conversation.")

    try:
        return postgres.get_conversation_messages(conversation_id)
    except Exception as exc:
        logger.exception("Could not retrieve conversation messages")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Message storage is unavailable.",
        ) from exc


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
async def update_conversation_v1(
    conversation_id: str,
    payload: UpdateConversationRequest,
    auth: AuthContext = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        conv = postgres.get_conversation(conversation_id, auth.tenant_id)
    except Exception as exc:
        logger.exception("Could not check conversation %s", conversation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is unavailable.",
        ) from exc

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    if conv["user_id"] != auth.user_id and not auth.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this conversation.")

    updates: dict[str, Any] = {}
    if payload.title is not None:
        clean_title = payload.title.strip()
        if not clean_title:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title cannot be empty.")
        updates["title"] = clean_title[:120]
    if payload.pinned is not None:
        updates["pinned"] = payload.pinned
    if payload.knowledge_scope is not None:
        updates["knowledge_scope"] = payload.knowledge_scope

    if not updates:
        return conv

    try:
        updated = postgres.update_conversation(conversation_id, updates)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        postgres.log_audit_event(
            user_id=auth.user_id,
            tenant_id=auth.tenant_id,
            action="update_conversation",
            resource_type="conversation",
            resource_id=conversation_id,
        )
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not update conversation %s", conversation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is unavailable.",
        ) from exc


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation_v1(
    conversation_id: str,
    auth: AuthContext = Depends(get_current_user),
) -> Response:
    try:
        conv = postgres.get_conversation(conversation_id, auth.tenant_id)
    except Exception as exc:
        logger.exception("Could not check conversation %s", conversation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is unavailable.",
        ) from exc

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    if conv["user_id"] != auth.user_id and not auth.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this conversation.")

    deleted = postgres.delete_conversation(
        conversation_id,
        user_id=None if auth.is_admin else auth.user_id,
        tenant_id=auth.tenant_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    postgres.log_audit_event(
        user_id=auth.user_id,
        tenant_id=auth.tenant_id,
        action="delete_conversation",
        resource_type="conversation",
        resource_id=conversation_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
