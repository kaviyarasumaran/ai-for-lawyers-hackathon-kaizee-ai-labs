import asyncio
from typing import Any

from app.retrieval.case_retriever import retrieve_case_knowledge
from app.retrieval.global_retriever import retrieve_global_knowledge


async def retrieve_combined_knowledge(
    case_id: str,
    query: str,
    tenant_id: str | None = None,
    embedding: list[float] | None = None,
    limit: int | None = None,
    min_score: float | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """
    Retrieves evidence from both Global Knowledge and Case-Specific Knowledge.
    Preserves source identity:
      - global_sources tagged strictly as 'global_legal_authority'
      - case_sources tagged strictly as 'case_document'
    """
    global_task = retrieve_global_knowledge(
        query=query,
        tenant_id=tenant_id,
        embedding=embedding,
        limit=limit,
        min_score=min_score,
    )
    case_task = retrieve_case_knowledge(
        case_id=case_id,
        query=query,
        embedding=embedding,
        limit=limit,
        min_score=min_score,
    )

    global_sources, case_sources = await asyncio.gather(global_task, case_task)

    # Double-check source tagging
    for src in global_sources:
        src["source_type"] = "global_legal_authority"
    for src in case_sources:
        src["source_type"] = "case_document"

    return {
        "global_sources": global_sources,
        "case_sources": case_sources,
        "all_sources": global_sources + case_sources,
    }
