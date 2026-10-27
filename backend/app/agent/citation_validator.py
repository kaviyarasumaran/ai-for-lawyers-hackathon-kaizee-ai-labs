import re
from typing import Any

from app.models.chat import CitationItem


def validate_citations(
    answer: str,
    retrieved_sources: list[dict[str, Any]],
) -> list[CitationItem]:
    """
    Validates citation references programmatically against actual retrieved sources.
    Never trusts the LLM to invent its own citation IDs or non-existent document sources.
    Only sources genuinely retrieved and referenced or relevant are emitted.
    """
    if not retrieved_sources:
        return []

    validated_citations: list[CitationItem] = []
    seen_source_ids = set()
    normalized_answer = answer.lower()

    for src in retrieved_sources:
        src_id = str(src.get("source_id") or src.get("chunk_id") or src.get("id"))
        doc_id = str(src.get("document_id") or src.get("id"))
        title = src.get("document_title") or src.get("name") or "Document"
        source_type = src.get("source_type", "case_document")
        page = src.get("page") or src.get("page_start")

        # Check if title, doc_id, or source_id is referenced in the text, or if this is the primary retrieved excerpt
        title_words = [w for w in re.split(r"[\s._-]+", title.lower()) if len(w) > 3]
        is_referenced = (
            title.lower() in normalized_answer
            or any(word in normalized_answer for word in title_words)
            or src_id.lower() in normalized_answer
            or f"page {page}" in normalized_answer if page else False
        )

        # In legal RAG, if the answer was generated from retrieved chunks and references evidence,
        # ground the citation against the verified source
        if is_referenced or len(retrieved_sources) == 1 or src.get("score", 0) > 0.05:
            if src_id not in seen_source_ids:
                seen_source_ids.add(src_id)
                validated_citations.append(
                    CitationItem(
                        source_id=src_id,
                        document_id=doc_id,
                        document_title=title,
                        source_type=source_type,
                        page=page,
                        section=src.get("section"),
                        chunk_id=src_id,
                        quote=src.get("quote") or (src.get("content", "")[:250] + "..."),
                    )
                )

    return validated_citations
