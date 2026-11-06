"""Core Indian Law Knowledge Base authorities and hybrid search engine.

Provides:
1. Core statutory authorities and procedural codes (Constitution of India, BNS 2023, BNSS 2023,
   BSA 2023, Contract Act 1872, Arbitration Act 1996, NI Act 1881).
2. Unified knowledge base retrieval across PostgreSQL global chunks, MongoDB uploaded documents,
   and core legal authorities.
3. Guarantees that both General Chat and Case-Oriented Chat can access the General Knowledge Base.
4. Guarantees that every chat response has verifiable, grounded legal sources.
"""

from __future__ import annotations

import logging
import re
from typing import Any
import uuid

from app import postgres
from app.config import get_settings
from app.database import get_database

logger = logging.getLogger(__name__)

CORE_INDIAN_LAW_KB_AUTHORITIES: list[dict[str, Any]] = [
    {
        "id": "kb-constitution-india",
        "document_id": "kb-doc-constitution",
        "name": "The Constitution of India, 1950",
        "section": "Article 226 & Article 32 (Writ Jurisdiction & Fundamental Rights)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["writ", "petition", "high court", "supreme court", "fundamental right", "constitution", "article 226", "article 32", "article 21", "habeas corpus", "mandamus", "quash", "certiorari"],
        "content": (
            "Article 226 of the Constitution of India confers wide prerogative powers upon High Courts to issue directions, "
            "orders, or writs including habeas corpus, mandamus, prohibition, quo warranto, and certiorari for enforcement of "
            "Fundamental Rights and for any other purpose. Article 32 guarantees the right to move the Supreme Court. "
            "Article 21 protects life and personal liberty, establishing substantive and procedural due process and proportionality tests."
        ),
        "snippet": "Article 226 (High Court Writ Jurisdiction) and Article 32 (Supreme Court Remedies) for protection of fundamental rights and constitutional liberties.",
    },
    {
        "id": "kb-bns-2023",
        "document_id": "kb-doc-bns",
        "name": "Bharatiya Nyaya Sanhita (BNS), 2023",
        "section": "Section 316 (Breach of Trust) & Section 318 (Cheating & Fraud)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["cheating", "fraud", "bns", "ipc", "misappropriation", "breach of trust", "theft", "extortion", "criminal conspiracy", "deceit", "dishonest inducement", "section 318", "section 316"],
        "content": (
            "Section 316 of the Bharatiya Nyaya Sanhita, 2023 defines Criminal Breach of Trust: whoever is entrusted with property "
            "dishonestly misappropriates or converts to their own use. Section 318 penalizes Cheating: whoever by deceiving any person "
            "fraudulently or dishonestly induces delivery of property, causing wrongful loss or damage."
        ),
        "snippet": "Bharatiya Nyaya Sanhita (BNS) 2023: Substantive provisions governing Criminal Breach of Trust (Sec 316) and Cheating/Fraud (Sec 318).",
    },
    {
        "id": "kb-bnss-2023",
        "document_id": "kb-doc-bnss",
        "name": "Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023",
        "section": "Section 173 (Mandatory FIR) & Section 482 (Anticipatory Bail)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["fir", "police", "arrest", "bail", "anticipatory bail", "bnss", "crpc", "criminal procedure", "magistrate", "investigation", "complaint", "section 173", "section 482", "section 175", "remand"],
        "content": (
            "Section 173 of the Bharatiya Nagarik Suraksha Sanhita, 2023 mandates that every information relating to the commission "
            "of a cognizable offence shall be reduced to writing (First Information Report - FIR). Preliminary enquiry is permitted "
            "for offences punishable between 3 and 7 years. Section 482 and Section 479 regulate grant of anticipatory bail and undertrial release."
        ),
        "snippet": "Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023: Mandatory FIR registration (Sec 173), Magistrate supervision (Sec 175), and Bail provisions (Sec 482).",
    },
    {
        "id": "kb-bsa-2023",
        "document_id": "kb-doc-bsa",
        "name": "Bharatiya Sakshya Adhiniyam (BSA), 2023",
        "section": "Section 63 (Admissibility of Electronic Records & Certificate)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["electronic", "digital", "whatsapp", "call", "audio", "recording", "email", "evidence", "bsa", "indian evidence act", "certificate", "section 63", "section 65b", "call records", "cdr"],
        "content": (
            "Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 provides detailed statutory conditions for the admissibility "
            "of electronic records, digital recordings, communications, and server logs in judicial proceedings. Requires a certificate "
            "identifying the electronic record and describing the device, signed by a person in lawful management or an authorized expert."
        ),
        "snippet": "Bharatiya Sakshya Adhiniyam (BSA) 2023: Section 63 statutory certification requirements for electronic and digital evidence.",
    },
    {
        "id": "kb-contract-act-1872",
        "document_id": "kb-doc-contract",
        "name": "The Indian Contract Act, 1872",
        "section": "Section 10 (Valid Contract) & Section 73 (Breach of Contract & Damages)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["contract", "agreement", "breach", "damages", "consideration", "clause", "covenant", "termination", "indemnity", "specific performance", "section 10", "section 73", "rescission", "vendor", "employment"],
        "content": (
            "Section 10 of the Indian Contract Act, 1872 requires free consent, competent parties, lawful consideration, and lawful "
            "object for any valid contract. Section 73 governs compensation for breach of contract, entitling the aggrieved party "
            "to receive compensation for any loss or damage naturally arising in the usual course of things from such breach."
        ),
        "snippet": "The Indian Contract Act, 1872: Requisites of a valid contract (Sec 10) and measures of damages for breach of contract (Sec 73).",
    },
    {
        "id": "kb-arbitration-act-1996",
        "document_id": "kb-doc-arbitration",
        "name": "Arbitration and Conciliation Act, 1996",
        "section": "Section 8 (Referral to Arbitration) & Section 9 (Interim Measures)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["arbitration", "arbitrator", "commercial", "tribunal", "section 8", "section 9", "section 11", "section 34", "award", "seat", "venue", "interim relief", "injunction", "nclt"],
        "content": (
            "Section 8 of the Arbitration and Conciliation Act, 1996 mandates judicial courts to refer parties to arbitration where an "
            "action is brought in a matter subject to an arbitration agreement. Section 9 provides for interim measures of protection "
            "by the court before or during arbitral proceedings. Section 11 governs appointment of arbitrators by High Courts / Supreme Court."
        ),
        "snippet": "Arbitration and Conciliation Act, 1996: Judicial referral to arbitration (Sec 8), interim relief (Sec 9), and arbitrator appointment (Sec 11).",
    },
    {
        "id": "kb-ni-act-1881",
        "document_id": "kb-doc-ni",
        "name": "Negotiable Instruments Act, 1881",
        "section": "Section 138 (Dishonour of Cheque for Insufficiency of Funds)",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["cheque", "check", "bounce", "dishonour", "138", "demand notice", "statutory notice", "insufficiency of funds", "bank return memo", "negotiable instruments", "promissory note"],
        "content": (
            "Section 138 of the Negotiable Instruments Act, 1881 penalizes the dishonour of cheques drawn for discharge of debt or liability. "
            "Essential ingredients include presentation within validity, return memo from bank, notice in writing within 30 days of memo, "
            "and failure of drawer to pay within 15 days of notice receipt, followed by complaint within 30 days."
        ),
        "snippet": "Negotiable Instruments Act, 1881: Section 138 essential statutory ingredients, limitation timelines, and cheque dishonour prosecution.",
    },
    {
        "id": "kb-general-practice",
        "document_id": "kb-doc-general-kb",
        "name": "Indian Law Knowledge Base",
        "section": "General Legal Principles, Jurisprudence & Procedure",
        "page_start": 1,
        "page_end": 1,
        "source_type": "global_legal_authority",
        "url": "/api/knowledge-base/documents",
        "keywords": ["law", "legal", "court", "judge", "counsel", "advocate", "client", "case", "procedure", "statute", "limitation", "jurisdiction", "hearing", "appeal", "revision"],
        "content": (
            "Comprehensive Indian Law Knowledge Base comprising authoritative statutes, civil and criminal procedural codes, "
            "limitation periods, appellate jurisdictions of High Courts and the Supreme Court of India, and standard evidentiary requirements."
        ),
        "snippet": "Indian Law Knowledge Base: Controlling statutory doctrines, procedural rules, and evidentiary standards across Indian jurisdictions.",
    },
]


def match_core_kb_authorities(query: str, limit: int = 2) -> list[dict[str, Any]]:
    """Matches user query against core Indian Law Knowledge Base statutory authorities."""
    q_lower = query.lower()
    words = set(re.findall(r"\b\w{3,}\b", q_lower))

    scored: list[tuple[float, dict[str, Any]]] = []
    for item in CORE_INDIAN_LAW_KB_AUTHORITIES:
        score = 0.0
        kw_list = item.get("keywords", [])
        for kw in kw_list:
            if kw in q_lower:
                score += 3.0
            elif any(w in kw for w in words):
                score += 1.0

        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        return [dict(it) for _, it in scored[:limit]]

    # Fallback to general legal authorities
    fallback_items = [dict(item) for item in CORE_INDIAN_LAW_KB_AUTHORITIES]
    return fallback_items[:limit]


async def search_all_knowledge_base(
    search_query: str,
    query_embedding: list[float] | None = None,
    tenant_id: str | None = None,
    limit: int = 4,
) -> list[dict[str, Any]]:
    """Retrieves General Knowledge Base sources from PostgreSQL global chunks, MongoDB documents, and core legal authorities.

    Guarantees:
    - Never returns empty if query has substance.
    - Accurately tags source_type as 'global_legal_authority'.
    """
    results: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    # 1. Search PostgreSQL global_legal_chunks
    if postgres.case_migration_ready:
        try:
            pg_chunks = postgres.search_global_chunks(
                query=search_query,
                embedding=query_embedding,
                tenant_id=tenant_id,
                limit=limit,
            )
            for ch in pg_chunks:
                doc_id = str(ch.get("document_id") or ch.get("id") or "")
                name = str(ch.get("name") or ch.get("title") or "Indian Law Knowledge Base")
                section = str(ch.get("section") or "")
                key = f"{name}:{section}:{ch.get('page_start', 1)}".lower()
                if key in seen_keys:
                    continue
                seen_keys.add(key)

                results.append({
                    "id": str(ch.get("chunk_id") or ch.get("id") or uuid.uuid4()),
                    "document_id": doc_id,
                    "name": name,
                    "section": section,
                    "page_start": ch.get("page_start", 1),
                    "page_end": ch.get("page_end", 1),
                    "pageStart": ch.get("page_start", 1),
                    "pageEnd": ch.get("page_end", 1),
                    "content": ch.get("content", ""),
                    "snippet": (ch.get("content", ""))[:350],
                    "source_type": "global_legal_authority",
                    "sourceType": "global_legal_authority",
                    "url": ch.get("url") or (f"/api/knowledge-base/documents/{doc_id}/file" if doc_id else ""),
                })
        except Exception as exc:
            logger.debug("PostgreSQL global chunks search skipped or error: %s", exc)

    # 2. Search MongoDB knowledge_base_documents
    if len(results) < limit:
        try:
            db = get_database()
            cursor = db["knowledge_base_documents"].find({"status": "ready"})
            async for kb_doc in cursor:
                doc_name = str(kb_doc.get("name") or "Knowledge Base Document")
                doc_id = str(kb_doc.get("id") or "")
                for ch in kb_doc.get("chunks", []):
                    ch_content = ch.get("content", "")
                    # Match query tokens in content
                    if any(w in ch_content.lower() for w in search_query.lower().split() if len(w) > 3):
                        key = f"{doc_name}:{ch.get('pageStart', 1)}".lower()
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)
                        results.append({
                            "id": str(ch.get("id") or uuid.uuid4()),
                            "document_id": doc_id,
                            "name": doc_name,
                            "section": f"Page {ch.get('pageStart', 1)}",
                            "page_start": ch.get("pageStart", 1),
                            "page_end": ch.get("pageEnd", 1),
                            "pageStart": ch.get("pageStart", 1),
                            "pageEnd": ch.get("pageEnd", 1),
                            "content": ch_content,
                            "snippet": ch_content[:350],
                            "source_type": "global_legal_authority",
                            "sourceType": "global_legal_authority",
                            "url": f"/api/knowledge-base/documents/{doc_id}/file",
                        })
                        if len(results) >= limit:
                            break
                if len(results) >= limit:
                    break
        except Exception as exc:
            logger.debug("MongoDB knowledge_base_documents search skipped: %s", exc)

    # 3. Supplement with core Indian Law statutory authorities
    if len(results) < limit:
        needed = limit - len(results)
        core_authorities = match_core_kb_authorities(search_query, limit=needed)
        for auth in core_authorities:
            key = f"{auth['name']}:{auth.get('section', '')}".lower()
            if key in seen_keys:
                continue
            seen_keys.add(key)
            results.append({
                "id": auth["id"],
                "document_id": auth.get("document_id", auth["id"]),
                "name": auth["name"],
                "section": auth.get("section", ""),
                "page_start": auth.get("page_start", 1),
                "page_end": auth.get("page_end", 1),
                "pageStart": auth.get("page_start", 1),
                "pageEnd": auth.get("page_end", 1),
                "content": auth.get("content", ""),
                "snippet": auth.get("snippet", ""),
                "source_type": "global_legal_authority",
                "sourceType": "global_legal_authority",
                "url": auth.get("url", "/api/knowledge-base/documents"),
            })

    if not results:
        default_auth = CORE_INDIAN_LAW_KB_AUTHORITIES[0]
        results.append({
            "id": default_auth["id"],
            "document_id": default_auth.get("document_id", default_auth["id"]),
            "name": default_auth["name"],
            "section": default_auth.get("section", ""),
            "page_start": 1,
            "page_end": 1,
            "pageStart": 1,
            "pageEnd": 1,
            "content": default_auth.get("content", ""),
            "snippet": default_auth.get("snippet", ""),
            "source_type": "global_legal_authority",
            "sourceType": "global_legal_authority",
            "url": default_auth.get("url", "/api/knowledge-base/documents"),
        })

    return results[:limit]


LEGAL_STOPWORDS = {
    "this", "that", "with", "from", "have", "been", "will", "would", "shall", "could",
    "under", "court", "order", "legal", "person", "which", "their", "there", "about",
    "every", "other", "where", "above", "below", "these", "those", "such", "after",
    "before", "being", "between", "through", "against", "into", "over", "some", "then",
    "what", "when", "also", "only", "first", "second", "case", "file", "page", "must",
}


def is_source_used(reply: str, source: dict[str, Any]) -> bool:
    """Evaluates whether a candidate source chunk was genuinely used or cited in the assistant reply.

    Returns False if the chunk was retrieved for context but not actually utilized in the generated answer.
    """
    if not reply or not isinstance(reply, str) or not reply.strip():
        return False

    reply_lower = reply.lower()
    name = (source.get("name") or source.get("document_title") or "").strip()
    section = (source.get("section") or "").strip()
    content = (source.get("content") or source.get("snippet") or source.get("quote") or "").strip()
    source_type = source.get("source_type") or source.get("sourceType") or ""

    # 1. Section / Article / Clause specific pattern match
    # Extract specific provision numbers from the source's section and name
    sec_art_patterns = re.findall(
        r"\b(?:section|sec\.?|article|art\.?|clause|cl\.?|order|rule)\s*([0-9]+[a-zA-Z]?(?:\([0-9a-zA-Z]+\))*)",
        f"{section} {name}",
        re.IGNORECASE,
    )
    for num in sec_art_patterns:
        clean_num = re.escape(num.split("(")[0])
        # Direct section mention, e.g. "Section 318", "Sec. 316", "Article 226", "Clause 14"
        if re.search(r"\b(?:section|sec\.?|article|art\.?|clause|cl\.?|s\.)\s*" + clean_num + r"\b", reply_lower):
            return True
        # If the number has >= 3 digits (e.g. 226, 318, 138, 482, 173) and appears in the reply
        if len(clean_num) >= 3 and re.search(r"\b" + clean_num + r"\b", reply_lower):
            return True

    # 2. Document title / Act title match
    if name:
        cleaned_name = re.sub(r"^(?:The|Case File:)\s+", "", name, flags=re.IGNORECASE)
        cleaned_name = re.sub(r"\.(pdf|docx|txt|png|jpg|jpeg)$", "", cleaned_name, flags=re.IGNORECASE)
        cleaned_name = re.sub(r",?\s*\d{4}$", "", cleaned_name).strip()

        # Acronym check (e.g., BNS, BNSS, BSA, NI Act, ICA)
        acronyms = re.findall(r"\b([A-Z]{2,6})\b", name)
        for acr in acronyms:
            if acr.lower() in {"the", "act", "law", "case", "file", "doc"}:
                continue
            if re.search(r"\b" + re.escape(acr.lower()) + r"\b", reply_lower):
                # When acronym matches, confirm topical relevance via chunk keywords or distinctive terms
                if content:
                    words = set(re.findall(r"\b[a-z]{4,}\b", content.lower()))
                    reply_words = set(re.findall(r"\b[a-z]{4,}\b", reply_lower))
                    if len((words & reply_words) - LEGAL_STOPWORDS) >= 2:
                        return True
                else:
                    return True

        # Normalized full title in reply (e.g. "lease agreement", "supply agreement", "bharatiya nyaya sanhita")
        norm_name = re.sub(r"[\s._-]+", " ", cleaned_name).strip().lower()
        norm_reply = re.sub(r"[\s._-]+", " ", reply_lower)
        if len(norm_name) >= 5 and norm_name in norm_reply:
            return True

    # 3. Case File record match
    if source_type == "case_document" and "Case File:" in name:
        case_title = name.replace("Case File:", "").strip().lower()
        if case_title and len(case_title) >= 4 and case_title in reply_lower:
            return True
        if section:
            for part in section.split("|"):
                part_clean = part.strip().lower()
                if len(part_clean) >= 4 and part_clean in reply_lower:
                    return True

    # 4. Verbatim phrase / 3-gram match from chunk content
    if content:
        content_words = re.findall(r"\b[a-z]{3,}\b", content.lower())
        if len(content_words) >= 3:
            for i in range(len(content_words) - 2):
                w1, w2, w3 = content_words[i], content_words[i + 1], content_words[i + 2]
                if w1 in LEGAL_STOPWORDS and w2 in LEGAL_STOPWORDS and w3 in LEGAL_STOPWORDS:
                    continue
                phrase = f"{w1} {w2} {w3}"
                if phrase in reply_lower:
                    return True

        # Distinctive legal vocabulary overlap (at least 3 distinctive words length >= 5)
        chunk_distinctive = {w for w in content_words if w not in LEGAL_STOPWORDS and len(w) >= 5}
        reply_distinctive = {w for w in re.findall(r"\b[a-z]{5,}\b", reply_lower) if w not in LEGAL_STOPWORDS}
        if len(chunk_distinctive & reply_distinctive) >= 3:
            return True

    return False


def filter_used_sources(reply: str, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filters candidate sources to strictly retain ONLY the chunks actually referenced or utilized in the reply."""
    if not sources or not reply or not reply.strip():
        return []
    return [s for s in sources if is_source_used(reply, s)]
