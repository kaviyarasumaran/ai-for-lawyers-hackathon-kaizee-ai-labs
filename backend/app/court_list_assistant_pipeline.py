"""Dedicated Court List Assistant Pipeline for Madras High Court daily cause lists.

Performs:
1. Semantic chunking of cause list items into granular case listing chunks and bench summary chunks.
2. Embedding vector generation and in-memory date-partitioned vector indexing.
3. Hybrid retrieval combining semantic vector similarity with legal keyword token matching.
4. Grounded LLM generation via configured LLM provider with source citations and follow-up prompts.
5. Highlighting of matched item IDs for the live interactive court board.
6. Single-day retention enforcement and purge management.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import json
import logging
import math
import re
import time
from typing import Any

import httpx

from app.cause_list_db import (
    answer_cause_list_query,
    empty_mhc_cause_list,
    normalize_date_to_ddmmyyyy,
)
from app.config import get_settings
from app.pipeline import create_embeddings

logger = logging.getLogger(__name__)


@dataclass
class CauseListChunk:
    chunk_id: str
    chunk_type: str  # "case_listing" | "bench_summary"
    court_number: str
    judge: str
    session: str
    category: str
    item_number: str | None
    case_number: str | None
    parties: str | None
    counsels: str | None
    item_id: str | None
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


def chunk_cause_list_items(
    items: list[dict[str, Any]],
    display_date: str = "",
) -> list[CauseListChunk]:
    """Chunks structured cause list records into granular listing chunks and bench summary chunks."""
    chunks: list[CauseListChunk] = []

    # 1. Granular listing chunks for each case item
    for idx, item in enumerate(items):
        item_id = str(item.get("id") or f"item_{idx}")
        item_num = str(item.get("itemNumber") or "")
        case_num = str(item.get("caseNumber") or "Unspecified")
        court_num = str(item.get("courtNumber") or "Court Hall")
        judge = str(item.get("judge") or "Hon'ble Judge")
        parties = str(item.get("parties") or "Parties not specified")
        counsels = str(item.get("counsels") or "Advocates on Record")
        category = str(item.get("category") or "General List")
        session = str(item.get("session") or "Regular Session")
        notes = str(item.get("notes") or "")

        content_parts = [
            "[MADRAS HIGH COURT - CASE LISTING]",
            f"Date: {display_date}",
            f"Court Hall: {court_num}",
            f"Coram / Presiding Judge: {judge}",
            f"Session: {session}",
            f"Listing Stage / Category: {category}",
            f"Item Number: {item_num}",
            f"Case Number: {case_num}",
            f"Parties: {parties}",
            f"Advocates & Counsel: {counsels}",
        ]
        if notes:
            content_parts.append(f"Notes: {notes}")

        chunk_content = "\n".join(content_parts)

        chunks.append(
            CauseListChunk(
                chunk_id=f"chunk_case_{item_id}",
                chunk_type="case_listing",
                court_number=court_num,
                judge=judge,
                session=session,
                category=category,
                item_number=item_num,
                case_number=case_num,
                parties=parties,
                counsels=counsels,
                item_id=item_id,
                content=chunk_content,
                metadata={
                    "item_id": item_id,
                    "item_number": item_num,
                    "court_number": court_num,
                    "case_number": case_num,
                    "judge": judge,
                    "parties": parties,
                    "counsels": counsels,
                    "category": category,
                    "session": session,
                },
            )
        )

    # 2. Bench summary chunks grouped by Court Hall
    court_groups: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        c_num = str(item.get("courtNumber") or "Court Hall")
        court_groups.setdefault(c_num, []).append(item)

    for court_num, court_items in court_groups.items():
        first_item = court_items[0]
        judge = str(first_item.get("judge") or "Hon'ble Judge")
        sessions = list({str(it.get("session") or "") for it in court_items if it.get("session")})
        categories = list({str(it.get("category") or "") for it in court_items if it.get("category")})

        # Window cases into batches of 15 to stay within optimal chunk token bounds
        batch_size = 15
        for b_idx in range(0, len(court_items), batch_size):
            batch = court_items[b_idx : b_idx + batch_size]
            item_lines = [
                f"- Item {it.get('itemNumber')}: {it.get('caseNumber')} | {it.get('parties')} | Counsel: {it.get('counsels')} | Stage: {it.get('category')} ({it.get('session')})"
                for it in batch
            ]
            batch_item_ids = [str(it.get("id")) for it in batch if it.get("id")]

            summary_content = (
                f"[MADRAS HIGH COURT - BENCH SUMMARY]\n"
                f"Court Hall: {court_num}\n"
                f"Coram: {judge}\n"
                f"Date: {display_date}\n"
                f"Total Matters in Bench: {len(court_items)}\n"
                f"Sessions: {', '.join(sessions)}\n"
                f"Listing Stages: {', '.join(categories)}\n"
                f"Board Cases (Items {batch[0].get('itemNumber')} to {batch[-1].get('itemNumber')}):\n"
                + "\n".join(item_lines)
            )

            chunks.append(
                CauseListChunk(
                    chunk_id=f"chunk_bench_{court_num.replace(' ', '_')}_{b_idx}",
                    chunk_type="bench_summary",
                    court_number=court_num,
                    judge=judge,
                    session=", ".join(sessions),
                    category=", ".join(categories),
                    item_number=None,
                    case_number=None,
                    parties=None,
                    counsels=None,
                    item_id=None,
                    content=summary_content,
                    metadata={
                        "court_number": court_num,
                        "judge": judge,
                        "item_ids": batch_item_ids,
                    },
                )
            )

    return chunks


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculates cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for a, b in zip(vec_a, vec_b):
        dot += a * b
        norm_a += a * a
        norm_b += b * b
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


class CourtListVectorStore:
    """In-memory date-partitioned vector store supporting single-day retention."""

    def __init__(self) -> None:
        self._indices: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def get_index(self, date_code: str) -> dict[str, Any] | None:
        async with self._lock:
            return self._indices.get(date_code)

    async def set_index(
        self,
        date_code: str,
        chunks: list[CauseListChunk],
        embeddings: list[list[float]],
        items: list[dict[str, Any]],
        display_date: str = "",
    ) -> None:
        async with self._lock:
            self._indices[date_code] = {
                "date_code": date_code,
                "display_date": display_date,
                "chunks": chunks,
                "embeddings": embeddings,
                "items": items,
                "indexed_at": time.time(),
            }

    async def purge(self, keep_date_code: str | None = None) -> list[str]:
        """Prunes cached vector indices enforcing single-day retention."""
        async with self._lock:
            removed: list[str] = []
            for d in list(self._indices.keys()):
                if keep_date_code is None or d != keep_date_code:
                    self._indices.pop(d, None)
                    removed.append(d)
            if removed:
                logger.info("Purged Court List Assistant vector indices: %s", removed)
            return removed


# Global vector store instance
_vector_store = CourtListVectorStore()


async def purge_court_list_assistant_cache(keep_date_code: str | None = None) -> list[str]:
    """Purges the assistant's cached vector indices, enforcing single-day retention."""
    return await _vector_store.purge(keep_date_code)


async def index_cause_list_for_assistant(
    date_code: str,
    items: list[dict[str, Any]],
    display_date: str = "",
    allow_embed: bool = False,
) -> dict[str, Any]:
    """Indexes cause list items into semantic chunks and creates vector embeddings ONLY when allow_embed is True."""
    existing = await _vector_store.get_index(date_code)
    if existing and len(existing.get("items", [])) == len(items) and len(items) > 0:
        existing_embs = existing.get("embeddings") or []
        has_embs = bool(existing_embs and any(any(v != 0.0 for v in e) for e in existing_embs))
        if not allow_embed or has_embs:
            return existing

    chunks = chunk_cause_list_items(items, display_date)
    embeddings: list[list[float]] = []

    if chunks and allow_embed:
        texts = [c.content for c in chunks]
        try:
            embeddings = await create_embeddings(texts, query=False, batch_size=8)
        except Exception as exc:
            logger.warning("Could not generate embeddings for cause list chunks: %s. Using fallback.", exc)
            embeddings = [[0.0] * 768 for _ in chunks]
    else:
        embeddings = [[0.0] * 768 for _ in chunks]

    await _vector_store.set_index(date_code, chunks, embeddings, items, display_date)
    return {
        "date_code": date_code,
        "display_date": display_date,
        "chunks": chunks,
        "embeddings": embeddings,
        "items": items,
    }


LEGAL_STOP_WORDS = {
    "the", "and", "or", "of", "in", "at", "to", "for", "on", "by", "with",
    "vs", "vs.", "v.", "v", "versus", "others", "other", "another", "anr", "ors",
    "district", "collector", "state", "government", "govt", "dept", "department",
    "union", "territory", "rep", "represented", "secretary", "principal", "officer",
    "item", "case", "cases", "court", "hall", "today", "show", "what", "which",
    "list", "listed", "matter", "matters", "hearing", "session", "number", "no",
    "hon'ble", "honble", "justice", "mr", "mrs", "ms", "advocate", "counsel",
    "before", "bench", "is", "are", "find", "search", "check", "details",
    "ltd", "limited", "pvt", "private", "co", "corp", "corporation", "inc", "llp",
}


def _extract_lexical_tokens(query: str) -> dict[str, Any]:
    """Extracts legal inquiry tokens and entities from user query."""
    q_lower = query.lower()

    # Match item number e.g. "item 24", "item no 1", "item number 1", "item #5", "#5"
    item_matches = re.findall(r"(?:item\s*(?:no\.?|#|number)?\s*|#\s*)(\d+)", q_lower)

    # Match case words (WP/43363/2026, 1386/2025, or 3+ digit case numbers - NEVER single digit party counts like '5')
    slashed = re.findall(r"\b[a-zA-Z]*/?\d{1,6}/\d{2,4}\b", q_lower)
    prefixed = re.findall(r"\b(?:wp|wa|crlop|crl\.?op|osa|cma|slp|arbi|contp|op|rca|tca|crp|as|sa)[/\s-]*\d+\b", q_lower)
    long_nums = re.findall(r"\b\d{3,6}\b", q_lower)
    case_words = list(set(slashed + prefixed + long_nums))

    # Party extraction
    party_tokens: list[str] = []
    party_phrases: list[str] = []
    petitioner_tokens: list[str] = []
    respondent_tokens: list[str] = []

    has_vs = any(sep in q_lower for sep in [" vs.", " vs ", " v. ", " v ", " versus "])
    if has_vs:
        parts = re.split(r"\s+(?:vs\.?|v\.?|versus)\s+", q_lower)
        if len(parts) >= 2:
            pet_raw = parts[0].strip()
            resp_raw = parts[1].strip()
            pet_toks = [w for w in re.split(r"[\s\W]+", pet_raw) if len(w) >= 3 and w not in LEGAL_STOP_WORDS]
            resp_toks = [w for w in re.split(r"[\s\W]+", resp_raw) if len(w) >= 3 and w not in LEGAL_STOP_WORDS]
            petitioner_tokens = pet_toks
            respondent_tokens = resp_toks
            if len(pet_toks) >= 2:
                party_phrases.append(" ".join(pet_toks))

    raw_words = [w for w in re.split(r"[\s\W]+", q_lower) if len(w) >= 3 and w not in LEGAL_STOP_WORDS]
    party_tokens = list(set(raw_words))
    if len(raw_words) >= 2 and not party_phrases:
        party_phrases.append(" ".join(raw_words[:3]))

    # Match stage terms
    stage_terms = [
        s for s in ["admission", "motion", "orders", "final hearing", "special list"]
        if s in q_lower
    ]

    return {
        "raw": q_lower,
        "item_numbers": item_matches,
        "case_words": case_words,
        "party_tokens": party_tokens,
        "party_phrases": party_phrases,
        "petitioner_tokens": petitioner_tokens,
        "respondent_tokens": respondent_tokens,
        "stage_terms": stage_terms,
        "has_vs": has_vs,
    }


async def retrieve_relevant_cause_list_chunks(
    query: str,
    date_code: str,
    items: list[dict[str, Any]],
    display_date: str = "",
    top_k: int = 6,
) -> tuple[list[CauseListChunk], list[str]]:
    """Performs hybrid retrieval (semantic vector search + legal lexical matching) across cause list chunks."""
    index = await _vector_store.get_index(date_code)
    if not index or len(index.get("items", [])) != len(items):
        index = await index_cause_list_for_assistant(date_code, items, display_date, allow_embed=False)

    chunks: list[CauseListChunk] = index.get("chunks", [])
    embeddings: list[list[float]] = index.get("embeddings", [])

    if not chunks:
        return [], []

    # 1. Semantic Embedding Search (only query embedding if chunk embeddings exist from schedule or manual trigger)
    query_vec: list[float] | None = None
    has_chunk_embeddings = bool(embeddings and any(any(v != 0.0 for v in emb) for emb in embeddings))
    if has_chunk_embeddings:
        try:
            query_embs = await create_embeddings([query], query=True)
            if query_embs and any(v != 0.0 for v in query_embs[0]):
                query_vec = query_embs[0]
        except Exception as exc:
            logger.debug("Could not generate query embedding: %s", exc)

    # 2. Lexical scoring
    tokens = _extract_lexical_tokens(query)
    q_words = [w for w in re.split(r"[\s\W]+", tokens["raw"]) if len(w) > 2]

    scored_chunks: list[tuple[float, CauseListChunk]] = []

    for idx, chunk in enumerate(chunks):
        # Semantic score
        sem_score = 0.0
        if query_vec and idx < len(embeddings):
            sem_score = _cosine_similarity(query_vec, embeddings[idx])

        # Lexical score
        lex_score = 0.0
        content_lower = chunk.content.lower()

        # 1. Party name match (HIGHEST PRIORITY when searching for a party)
        if chunk.parties:
            p_lower = chunk.parties.lower()
            p_clean = re.sub(r"[\s\W]+", " ", p_lower).strip()
            q_clean = re.sub(r"[\s\W]+", " ", tokens["raw"]).strip()

            # Exact or substring match of entire party string
            if p_clean and q_clean and (p_clean in q_clean or q_clean in p_clean):
                lex_score += 60.0

            # Party phrase match
            for phrase in tokens["party_phrases"]:
                if phrase in p_lower:
                    lex_score += 40.0

            # If user queried "A vs B"
            if tokens["has_vs"]:
                matched_pet = [t for t in tokens["petitioner_tokens"] if t in p_lower]
                matched_resp = [t for t in tokens["respondent_tokens"] if t in p_lower]
                pet_matched = (len(matched_pet) >= 2) if len(tokens["petitioner_tokens"]) >= 2 else (len(matched_pet) == len(tokens["petitioner_tokens"]) and len(tokens["petitioner_tokens"]) > 0)
                resp_matched = (len(matched_resp) >= 2) if len(tokens["respondent_tokens"]) >= 2 else (len(matched_resp) == len(tokens["respondent_tokens"]) and len(tokens["respondent_tokens"]) > 0)

                if pet_matched and resp_matched:
                    lex_score += 80.0
                elif pet_matched:
                    lex_score += 50.0 + 10.0 * len(matched_pet)
                elif resp_matched:
                    lex_score += 35.0 + 10.0 * len(matched_resp)
            else:
                # Distinctive party tokens match
                matched_pty = [t for t in tokens["party_tokens"] if t in p_lower]
                if len(matched_pty) >= 2:
                    lex_score += 25.0 * len(matched_pty)
                elif len(matched_pty) == 1:
                    lex_score += 10.0

        # 2. Item number match (very high signal)
        if tokens["item_numbers"] and chunk.item_number in tokens["item_numbers"]:
            lex_score += 30.0

        # 3. Case number match
        if chunk.case_number and tokens["case_words"]:
            c_norm = chunk.case_number.lower().replace(" ", "")
            for cw in tokens["case_words"]:
                cw_norm = cw.replace(" ", "")
                if "/" in cw_norm and cw_norm in c_norm:
                    lex_score += 35.0
                elif len(cw_norm) >= 3 and cw_norm in c_norm:
                    lex_score += 20.0

        # 4. Counsel name match
        if chunk.counsels:
            c_lower = chunk.counsels.lower()
            for w in tokens["party_tokens"]:
                if w in c_lower:
                    lex_score += 12.0

        # 5. Judge / Coram match
        if chunk.judge:
            j_lower = chunk.judge.lower()
            if "chief" in tokens["raw"] and "chief" in j_lower:
                lex_score += 8.0
            for w in tokens["party_tokens"]:
                if w in ["justice", "venkatesh", "suresh", "krishnan", "subramanian", "manikumar"] and w in j_lower:
                    lex_score += 8.0

        # 6. Court number match
        if chunk.court_number:
            c_num_clean = chunk.court_number.lower().replace(" ", "")
            q_clean = tokens["raw"].replace(" ", "")
            if c_num_clean in q_clean:
                lex_score += 6.0

        # 7. Stage match
        for st in tokens["stage_terms"]:
            if st in content_lower:
                lex_score += 4.0

        # 8. Keyword overlaps (excluding legal stop words; only if not explicit A vs B search)
        if not tokens["has_vs"]:
            for w in q_words:
                if w not in LEGAL_STOP_WORDS and w in content_lower:
                    lex_score += 1.0

        # Hybrid score combination
        has_vectors = query_vec is not None
        if has_vectors and sem_score > 0.0:
            hybrid_score = (0.55 * sem_score) + (0.45 * min(lex_score / 15.0, 1.0))
            if lex_score >= 5.0:
                hybrid_score += lex_score
        else:
            hybrid_score = lex_score

        scored_chunks.append((hybrid_score, chunk))

    # Rank descending by hybrid score
    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    is_targeted_query = bool(
        tokens["has_vs"]
        or tokens["item_numbers"]
        or tokens["case_words"]
        or (tokens["party_tokens"] and len(tokens["party_tokens"]) >= 2)
    )

    if not scored_chunks or (is_targeted_query and scored_chunks[0][0] < 5.0):
        # No relevant chunk matched the targeted query
        return [], []

    top_score = scored_chunks[0][0]
    if top_score >= 30.0:
        top_chunks = [chunk for score, chunk in scored_chunks if score >= 0.5 * top_score][:top_k]
    else:
        top_chunks = [chunk for score, chunk in scored_chunks if score >= 4.0][:top_k]

    if not top_chunks and not is_targeted_query:
        top_chunks = [chunk for _, chunk in scored_chunks[:top_k]]

    # Extract matching item IDs
    matching_ids: list[str] = []
    for chunk in top_chunks:
        if chunk.chunk_type == "case_listing" and chunk.item_id:
            if chunk.item_id not in matching_ids:
                matching_ids.append(chunk.item_id)
        elif chunk.chunk_type == "bench_summary":
            batch_ids = chunk.metadata.get("item_ids", [])
            for bid in batch_ids:
                if bid not in matching_ids:
                    matching_ids.append(bid)

    return top_chunks, matching_ids


COURT_LIST_ASSISTANT_SYSTEM_PROMPT = (
    "You are the official Court List AI Assistant for the High Court of Judicature at Madras on the Kaizee AI Labs platform.\n"
    "Your objective is to answer legal professionals' and advocates' questions accurately about today's official daily court cause list.\n\n"
    "STRICT GROUNDING & BEHAVIOR RULES:\n"
    "1. Ground your answers strictly in the retrieved cause list excerpts provided.\n"
    "2. Be concise, authoritative, and direct. When identifying cases, clearly specify:\n"
    "   - Item Number\n"
    "   - Court Hall Number (e.g., Court No. 01)\n"
    "   - Presiding Judge / Coram\n"
    "   - Case Number (formatted in backticks, e.g., `W.P. No. 10293 / 2026`)\n"
    "   - Parties & Counsels\n"
    "   - Stage & Session\n"
    "3. Use clean markdown with bullet points for multiple matters.\n"
    "4. If a case, advocate, or judge is not present in the excerpts, explicitly state that it is not listed on today's board.\n"
    "5. Never invent or hallucinate case numbers, judges, or listings absent from the excerpts.\n"
    "6. At the very end of your response, provide 2 or 3 suggested follow-up questions under 'Suggested Follow-ups:'."
)


async def generate_court_list_llm_response(
    query: str,
    date_code: str,
    display_date: str,
    chunks: list[CauseListChunk],
    all_items: list[dict[str, Any]],
    matching_ids: list[str],
) -> dict[str, Any]:
    """Invokes configured LLM with retrieved cause list chunks to synthesize an intelligent response."""
    settings = get_settings()

    # Determine highlight court
    highlight_court = ""
    if chunks:
        highlight_court = chunks[0].court_number

    # If no relevant chunks retrieved, do not invoke LLM to prevent hallucinations
    if not chunks:
        return _synthesize_deterministic_response(query, date_code, display_date, [], all_items, [])

    # If no LLM endpoint or model configured, fall back to grounded deterministic synthesizer
    if not settings.llm_api_base_url or not settings.llm_model:
        return _synthesize_deterministic_response(query, date_code, display_date, chunks, all_items, matching_ids)

    # Format retrieved excerpts
    formatted_excerpts = "\n\n".join(
        f"--- EXCERPT {i + 1} ({c.chunk_type.upper()}) ---\n{c.content}"
        for i, c in enumerate(chunks)
    )

    user_prompt = (
        f"Date of Cause List: {display_date} ({date_code})\n"
        f"Total Matters Listed Today: {len(all_items)}\n\n"
        f"RETRIEVED CAUSE LIST EXCERPTS:\n{formatted_excerpts}\n\n"
        f"USER QUESTION: {query}\n\n"
        f"Please provide an accurate, grounded legal assistant response based on the excerpts."
    )

    endpoint = f"{settings.llm_api_base_url.rstrip('/')}/chat/completions"
    headers: dict[str, str] = {}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": COURT_LIST_ASSISTANT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 800,
    }

    try:
        async with httpx.AsyncClient(timeout=min(settings.llm_timeout_seconds, 30.0)) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                if content and isinstance(content, str):
                    parsed_answer, follow_ups = _parse_llm_content_and_followups(content, chunks, all_items)
                    return {
                        "answer": parsed_answer,
                        "matchingItemIds": matching_ids[:10],
                        "highlightCourt": highlight_court,
                        "suggestedFollowUps": follow_ups,
                    }
    except Exception as exc:
        logger.info("LLM completion in Court List Assistant unavailable (%s); using deterministic fallback.", exc)

    return _synthesize_deterministic_response(query, date_code, display_date, chunks, all_items, matching_ids)


def _parse_llm_content_and_followups(
    content: str,
    chunks: list[CauseListChunk],
    all_items: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    """Splits LLM response into main text and follow-up suggestion chips."""
    follow_ups: list[str] = []
    lines = content.split("\n")
    cleaned_lines: list[str] = []
    is_in_followups = False

    for line in lines:
        if any(h in line.lower() for h in ["suggested follow-ups:", "suggested followups:", "follow-up questions:"]):
            is_in_followups = True
            continue
        if is_in_followups:
            s = line.strip().lstrip("-*123456789. ")
            if s and len(s) > 5:
                follow_ups.append(s)
        else:
            cleaned_lines.append(line)

    answer_text = "\n".join(cleaned_lines).strip()

    if not follow_ups:
        # Generate default dynamic follow-ups
        first_c = chunks[0] if chunks else None
        if first_c and first_c.court_number:
            follow_ups.append(f"Show all cases in {first_c.court_number}")
        if first_c and first_c.item_number:
            follow_ups.append(f"What stage is Item {first_c.item_number} listed for?")
        follow_ups.append("Show cases listed for admission today")

    return answer_text, follow_ups[:4]


def _synthesize_deterministic_response(
    query: str,
    date_code: str,
    display_date: str,
    chunks: list[CauseListChunk],
    all_items: list[dict[str, Any]],
    matching_ids: list[str],
) -> dict[str, Any]:
    """Generates an accurate, grounded fallback response using the retrieved chunks and items."""
    # Check if empty state
    if not all_items:
        return answer_cause_list_query(query, date_code, [])

    # Check if query is about pipeline / sync
    q = query.strip().lower()
    if any(k in q for k in ["pipeline", "1 am", "sync", "ocr", "automated", "schedule", "trigger", "downloaded"]):
        return answer_cause_list_query(query, date_code, all_items)

    # Check if query is an explicit "A vs B" search and no chunks matched
    tokens = _extract_lexical_tokens(query)
    if tokens["has_vs"] and not chunks:
        return {
            "answer": (
                f"No listed matter(s) found for **\"{query.strip()}\"** on **{display_date}**.\n\n"
                f"Please verify the case number, party names, or advocate name, or explore the active court halls on the live board."
            ),
            "matchingItemIds": [],
            "highlightCourt": all_items[0].get("courtNumber", "Court No. 01") if all_items else "Court No. 01",
            "suggestedFollowUps": [
                "Show cases listed for admission today",
                "Which matters are listed in Court No. 01?",
                "What is the status of the 1:00 AM pipeline?",
            ],
        }

    highlight_court = chunks[0].court_number if chunks else (all_items[0].get("courtNumber", "Court No. 01"))

    # If we found case listings
    case_chunks = [c for c in chunks if c.chunk_type == "case_listing"]
    if case_chunks:
        lines: list[str] = []
        for c in case_chunks[:5]:
            lines.append(
                f"- **Item No. {c.item_number}** in **{c.court_number}** before **{c.judge}**:\n"
                f"  - Case: `{c.case_number}`\n"
                f"  - Stage: {c.category} ({c.session})\n"
                f"  - Parties: {c.parties}\n"
                f"  - Counsel: {c.counsels}"
            )
        answer = (
            f"Here are the listed matter(s) on **{display_date}** matching your inquiry:\n\n"
            + "\n\n".join(lines)
        )
        return {
            "answer": answer,
            "matchingItemIds": matching_ids[:10],
            "highlightCourt": highlight_court,
            "suggestedFollowUps": [
                f"Which other matters are listed in {highlight_court}?",
                "Show cases listed for admission today",
                "What is the status of the 1:00 AM pipeline?",
            ],
        }

    # If we found bench summaries
    bench_chunks = [c for c in chunks if c.chunk_type == "bench_summary"]
    if bench_chunks:
        b = bench_chunks[0]
        answer = (
            f"**{b.court_number}** ({b.judge}) has active listings on **{display_date}**.\n\n"
            f"- **Sessions:** {b.session}\n"
            f"- **Stages:** {b.category}\n\n"
            f"{b.content.split('Board Cases')[0].strip()}"
        )
        return {
            "answer": answer,
            "matchingItemIds": matching_ids[:10],
            "highlightCourt": b.court_number,
            "suggestedFollowUps": [
                f"Show all cases in {b.court_number}",
                "Are there any final hearing cases today?",
            ],
        }

    # Fallback to general answer helper
    fallback_res = answer_cause_list_query(query, date_code, all_items)
    if "The Daily Court Cause List contains" in fallback_res.get("answer", ""):
        # Check if the query was an explicit search inquiry rather than a general summary question
        tokens = _extract_lexical_tokens(query)
        if tokens["has_vs"] or tokens["item_numbers"] or tokens["case_words"] or len(tokens["party_tokens"]) >= 2:
            return {
                "answer": (
                    f"No listed matter(s) found for **\"{query.strip()}\"** on **{display_date}**.\n\n"
                    f"Please verify the case number, party names, or advocate name, or explore the active court halls on the live board."
                ),
                "matchingItemIds": [],
                "highlightCourt": all_items[0].get("courtNumber", "Court No. 01") if all_items else "Court No. 01",
                "suggestedFollowUps": [
                    "Show cases listed for admission today",
                    "Which matters are listed in Court No. 01?",
                    "What is the status of the 1:00 AM pipeline?",
                ],
            }
    return fallback_res


async def execute_court_list_assistant_pipeline(
    query: str,
    date: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """End-to-end execution of the Court List Assistant pipeline:
    1. Normalizes date.
    2. Chunks items into case listings & bench summaries.
    3. Generates vector embeddings & in-memory index.
    4. Retrieves top semantic & lexical matches.
    5. Calls LLM with grounded prompt to synthesize an intelligent response.
    6. Returns response, matching item IDs, and suggested follow-ups.
    """
    date_code, display_date = normalize_date_to_ddmmyyyy(date)
    all_items = items or []

    if not all_items:
        return _synthesize_deterministic_response(
            query=query,
            date_code=date_code,
            display_date=display_date,
            chunks=[],
            all_items=[],
            matching_ids=[],
        )

    # 1. Hybrid Retrieval (semantic chunks + lexical matches)
    top_chunks, matching_ids = await retrieve_relevant_cause_list_chunks(
        query=query,
        date_code=date_code,
        items=all_items,
        display_date=display_date,
        top_k=6,
    )

    # 2. Grounded LLM Response Generation
    return await generate_court_list_llm_response(
        query=query,
        date_code=date_code,
        display_date=display_date,
        chunks=top_chunks,
        all_items=all_items,
        matching_ids=matching_ids,
    )
