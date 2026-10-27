import logging
from typing import Any

from app import postgres
from app.config import get_settings
from app.pipeline import create_embeddings

logger = logging.getLogger(__name__)


async def retrieve_global_knowledge(
    query: str,
    tenant_id: str | None = None,
    embedding: list[float] | None = None,
    limit: int | None = None,
    min_score: float | None = None,
) -> list[dict[str, Any]]:
    """
    Retrieves authorized global legal authorities (statutes, regulations, precedents).
    Ensures no case-specific documents are retrieved in this scope.
    """
    settings = get_settings()
    k = limit or settings.retrieval_top_k
    threshold = min_score if min_score is not None else settings.retrieval_relevance_threshold

    if embedding is None:
        try:
            embeddings = await create_embeddings([query], query=True)
            embedding = embeddings[0]
        except Exception as exc:
            logger.warning("Could not generate query embedding for global retrieval: %s", exc)
            return []

    try:
        raw_chunks = postgres.search_global_chunks(
            query=query,
            embedding=embedding,
            tenant_id=tenant_id,
            limit=k,
        )
    except Exception as exc:
        logger.warning("Could not search global chunks: %s", exc)
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

        doc_id = chunk.get("document_id") or chunk.get("id") or "global-authority"
        chunk_id = chunk.get("chunk_id") or f"global-chunk-{len(results) + 1}"
        title = chunk.get("name") or chunk.get("title") or "Legal Authority"

        results.append(
            {
                "source_id": str(chunk_id),
                "document_id": str(doc_id),
                "document_title": title,
                "name": title,
                "source_type": "global_legal_authority",
                "jurisdiction": chunk.get("jurisdiction", "Federal"),
                "publication_date": str(chunk.get("publication_date")) if chunk.get("publication_date") else None,
                "effective_date": str(chunk.get("effective_date")) if chunk.get("effective_date") else None,
                "source": chunk.get("source", "official"),
                "url": chunk.get("url"),
                "page": chunk.get("page_start", 1),
                "section": chunk.get("section") or f"Page {chunk.get('page_start', 1)}",
                "content": content,
                "score": score,
                "quote": content[:300] + ("..." if len(content) > 300 else ""),
            }
        )

    return results
