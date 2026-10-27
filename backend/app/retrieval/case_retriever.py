import logging
from typing import Any

from app import postgres
from app.config import get_settings
from app.pipeline import create_embeddings

logger = logging.getLogger(__name__)


async def retrieve_case_knowledge(
    case_id: str,
    query: str,
    embedding: list[float] | None = None,
    limit: int | None = None,
    min_score: float | None = None,
) -> list[dict[str, Any]]:
    """
    Retrieves authorized case documents and evidence for the selected case.
    Strictly filters by case_id before vector retrieval to prevent data leakage.
    """
    settings = get_settings()
    k = limit or settings.retrieval_top_k
    threshold = min_score if min_score is not None else settings.retrieval_relevance_threshold

    # Check case pipeline status
    try:
        status = postgres.get_pipeline_status(case_id)
        if not status or not status.get("processedDocuments"):
            logger.info("Case %s has no processed documents for retrieval", case_id)
            return []
    except Exception as exc:
        logger.warning("Could not check pipeline status for case %s: %s", case_id, exc)

    # Compute query embedding if not provided
    if embedding is None:
        try:
            embeddings = await create_embeddings([query], query=True)
            embedding = embeddings[0]
        except Exception as exc:
            logger.warning("Could not generate query embedding: %s", exc)
            return []

    try:
        raw_chunks = postgres.search_case_chunks(
            case_id=case_id,
            query=query,
            embedding=embedding,
            limit=k,
        )
    except Exception as exc:
        logger.exception("Error executing search_case_chunks for case %s", case_id)
        return []

    results = []
    seen_contents = set()

    for chunk in raw_chunks:
        score = chunk.get("score", 0.0)
        content = chunk.get("content", "").strip()

        # Deduplication
        if content in seen_contents:
            continue
        seen_contents.add(content)

        # Relevance threshold
        if score < threshold:
            continue

        doc_id = chunk.get("document_id") or chunk.get("documentId") or f"case-doc-{case_id}"
        chunk_id = chunk.get("chunk_id") or chunk.get("id") or f"case-chunk-{len(results) + 1}"
        doc_name = chunk.get("name") or "Case Document"

        results.append(
            {
                "source_id": str(chunk_id),
                "document_id": str(doc_id),
                "document_title": doc_name,
                "name": doc_name,
                "source_type": "case_document",
                "page_start": chunk.get("page_start", 1),
                "page_end": chunk.get("page_end", 1),
                "page": chunk.get("page_start", 1),
                "section": f"Page {chunk.get('page_start', 1)}",
                "content": content,
                "score": score,
                "quote": content[:300] + ("..." if len(content) > 300 else ""),
            }
        )

    return results
