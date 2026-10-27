from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=20_000)


class CitationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    source_id: str = Field(default="", description="Unique identifier for the source or citation")
    document_id: str = Field(default="", description="Underlying document identifier")
    document_title: str = Field(default="Legal Document", description="Human-readable title or filename of the document")
    source_type: Literal[
        "global_legal_authority",
        "case_document",
        "reference",
        "attachment",
        "unknown",
    ] = Field(
        default="case_document",
        description="Whether this source is general legal authority or specific case evidence",
    )
    page: int | None = Field(default=None, description="Page number if applicable")
    pageStart: int | None = Field(default=None, description="Starting page number")
    pageEnd: int | None = Field(default=None, description="Ending page number")
    name: str | None = Field(default=None, description="Legacy document name alias")
    section: str | None = Field(default=None, description="Section or article number if applicable")
    chunk_id: str | None = Field(default=None, description="Specific chunk ID used in retrieval")
    quote: str | None = Field(default=None, description="Supporting excerpt or quote from the source")

    @model_validator(mode="before")
    @classmethod
    def _normalize_citation(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            # Map name / title -> document_title and name
            doc_title = (
                data.get("document_title")
                or data.get("name")
                or data.get("title")
                or data.get("source_name")
                or "Legal Document"
            )
            data["document_title"] = doc_title
            if not data.get("name"):
                data["name"] = doc_title

            # Map source_id / document_id
            sid = str(data.get("source_id") or data.get("document_id") or data.get("id") or uuid4())
            data["source_id"] = sid
            data["document_id"] = str(data.get("document_id") or sid)

            # Map source_type
            valid_types = {"global_legal_authority", "case_document", "reference", "attachment", "unknown"}
            stype = data.get("source_type")
            if not stype or stype not in valid_types:
                data["source_type"] = "case_document"

            # Map page / pageStart / pageEnd
            p_start = data.get("pageStart") if data.get("pageStart") is not None else data.get("page_start")
            if p_start is None:
                p_start = data.get("page")
            p_end = data.get("pageEnd") if data.get("pageEnd") is not None else data.get("page_end")
            if p_end is None:
                p_end = p_start

            if p_start is not None:
                try:
                    val = int(p_start)
                    data["page"] = val
                    data["pageStart"] = val
                except (ValueError, TypeError):
                    pass
            if p_end is not None:
                try:
                    data["pageEnd"] = int(p_end)
                except (ValueError, TypeError):
                    pass
        return data


class ResponseMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    knowledge_scope: Literal["global", "case", "combined"]
    case_id: str | None = None
    retrieval_performed: bool = True
    insufficient_evidence: bool = False
    question_type: str | None = None


class ChatRequestV1(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str | None = None
    message: str | None = Field(default=None, max_length=20_000)
    messages: list[ChatMessage] | None = Field(default=None, max_length=40)
    case_id: str | None = None
    knowledge_scope: Literal["global", "case", "combined"] | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    stream: bool = False

    @model_validator(mode="before")
    @classmethod
    def _remap_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            if "conversation_id" not in data:
                if "chatId" in data:
                    data["conversation_id"] = data["chatId"]
                elif "chat_id" in data:
                    data["conversation_id"] = data["chat_id"]
            if "case_id" not in data and "caseId" in data:
                data["case_id"] = data["caseId"]
        return data
    knowledge_scope: Literal["global", "case", "combined"] | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    stream: bool = False

    def get_query_text(self) -> str:
        """Extract user question from either `message` or `messages` list."""
        if self.message and self.message.strip():
            return self.message.strip()
        if self.messages:
            for msg in reversed(self.messages):
                if msg.role == "user" and msg.content.strip():
                    return msg.content.strip()
        raise ValueError("At least one non-empty user message is required.")


class ChatResponseV1(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str
    answer: str
    citations: list[CitationItem] = Field(default_factory=list)
    metadata: ResponseMetadata
    suggested_questions: list[str] = Field(default_factory=list)

    # Legacy/frontend compatibility fields
    reply: str | None = None
    chatId: str | None = None
    model: str | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)

    def model_post_init(self, __context: Any) -> None:
        if self.reply is None:
            self.reply = self.answer
        if self.chatId is None:
            self.chatId = self.conversation_id
        if not self.sources and self.citations:
            self.sources = [
                {
                    "name": citation.document_title,
                    "pageStart": citation.page or 1,
                    "pageEnd": citation.page or 1,
                }
                for citation in self.citations
            ]


class UpdateConversationRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    pinned: bool | None = None
    knowledge_scope: Literal["global", "case", "combined"] | None = None


class ConversationSummary(BaseModel):
    id: str
    user_id: str
    tenant_id: str
    case_id: str | None = None
    title: str
    knowledge_scope: Literal["global", "case", "combined"]
    pinned: bool = False
    created_at: str
    updated_at: str


class ConversationMessageRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    id: str
    conversation_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    citations: list[CitationItem] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    created_at: str

    @model_validator(mode="before")
    @classmethod
    def _normalize_message(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            raw_citations = data.get("citations")
            if not isinstance(raw_citations, list):
                data["citations"] = []
            meta = data.get("metadata")
            if not isinstance(meta, dict):
                data["metadata"] = {}
                meta = {}
            if "attachments" not in data or not isinstance(data.get("attachments"), list):
                data["attachments"] = meta.get("attachments", []) if isinstance(meta.get("attachments"), list) else []
        return data
