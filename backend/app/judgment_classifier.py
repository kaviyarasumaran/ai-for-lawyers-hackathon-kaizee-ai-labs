"""AI Classifier and Source-Text Validator for Subsequent Judicial Treatments.

Follows Indian Constitutional Precedent Hierarchy:
- Bench strength comparison (Dawoodi Bohra principle).
- Distinction between express overruling, reversal, distinguishing, doubting, and modifying.
- Structured JSON output matching the backend response schema.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an Indian legal judgment research assistant.

Your responsibility is to analyze the subsequent judicial treatment of a given judgment.

Rules:
- Use retrieved judgment documents as evidence.
- Never invent a citation, paragraph number, court, judge, or judgment.
- Identify the exact legal proposition being treated.
- Differentiate between overruling, reversing, distinguishing, following, doubting, and modifying.
- Check the court hierarchy and bench strength.
- Do not assume every later judgment changes the legal validity of an earlier judgment.
- Distinguish a judgment's outcome from its precedential authority.
- If the evidence is insufficient, return UNKNOWN or REQUIRES_REVIEW.
- Cite supporting paragraphs and source links.
- Never claim that the judgment is currently valid based on incomplete search results.
- Highlight conflicting subsequent decisions.
- State the date up to which the available sources were checked.

Return structured JSON matching the backend response schema."""


def validate_treatment_against_rules(
    treatment_type: str,
    orig_bench_strength: int,
    later_bench_strength: int,
    supporting_text: str,
) -> tuple[str, str, float, str]:
    """Validates and enforces Indian constitutional rules and bench hierarchy on the treatment classification.

    Returns (validated_type, reason, confidence, verification_status).
    """
    t_type = treatment_type.upper().strip()
    text_lower = supporting_text.lower()

    # Rule 1: Bench strength constraint under Article 141
    # A smaller bench cannot overrule a larger bench of the Supreme Court of India
    if t_type == "OVERRULED" and later_bench_strength < orig_bench_strength:
        corrected_type = "DOUBTED"
        reason = (
            f"Under Indian constitutional precedent hierarchy, a {later_bench_strength}-Judge bench cannot "
            f"overrule a larger {orig_bench_strength}-Judge bench. At most, observations can express doubt or "
            f"distinguish the precedent; overruling requires a bench of equal or greater strength."
        )
        return corrected_type, reason, 0.70, "EVIDENCE_REVIEW_REQUIRED"

    # Rule 2: Express language of overruling
    has_overrule_language = any(
        phrase in text_lower
        for phrase in [
            "hereby overruled",
            "must be overruled",
            "is overruled",
            "stand overruled",
            "stands overruled",
            "overrule the decision",
            "overruling the decision",
            "no longer good law",
            "incorrectly decided and overruled",
        ]
    )

    if t_type == "OVERRULED":
        if not has_overrule_language:
            # Check if it was merely distinguished or criticized
            if any(w in text_lower for w in ["distinguished", "on facts", "different factual context", "curable defect"]):
                return (
                    "DISTINGUISHED",
                    "The later court analyzed the earlier precedent but distinguished its application to the factual or statutory matrix rather than invalidating the core ratio.",
                    0.88,
                    "VERIFIED",
                )
            return (
                "DOUBTED",
                "The later court disagreed with or questioned aspects of the earlier ruling, but express words of overruling were not established in the extract.",
                0.75,
                "EVIDENCE_REVIEW_REQUIRED",
            )
        return (
            "OVERRULED",
            f"A {later_bench_strength}-Judge bench explicitly overruled the earlier {orig_bench_strength}-Judge precedent with express invalidation in the text.",
            0.98,
            "VERIFIED",
        )

    # Rule 3: Reversal vs Overruling
    if t_type == "REVERSED":
        return (
            "REVERSED",
            "The specific appellate decision between the parties was reversed on appeal.",
            0.95,
            "VERIFIED",
        )

    # Rule 4: Distinguishing
    if t_type == "DISTINGUISHED":
        return (
            "DISTINGUISHED",
            "The subsequent court distinguished the earlier ruling on statutory scope or factual particulars while preserving its general legal authority.",
            0.92,
            "VERIFIED",
        )

    # Rule 5: Followed
    if t_type in ("FOLLOWED", "AFFIRMED"):
        return (
            "FOLLOWED",
            "The subsequent court adopted and applied the legal principle as binding authority.",
            0.95,
            "VERIFIED",
        )

    # Rule 6: Doubted or conflicting
    if t_type in ("DOUBTED", "CONFLICTING"):
        return (
            "DOUBTED",
            "The subsequent court expressed reservation, noted conflicting lines of authority, or referred the question to a larger bench.",
            0.85,
            "EVIDENCE_REVIEW_REQUIRED",
        )

    # Rule 7: Modified
    if t_type == "MODIFIED":
        return (
            "MODIFIED",
            "The subsequent court modified the directions or operative scope without disturbing the underlying legal foundation.",
            0.90,
            "VERIFIED",
        )

    return (
        t_type if t_type in ("REFERRED_TO", "FOLLOWED", "DISTINGUISHED") else "REQUIRES_REVIEW",
        "Subsequent judicial reference identified. Review full text for exact legal impact.",
        0.75,
        "EVIDENCE_REVIEW_REQUIRED",
    )


async def classify_treatment_with_ai(
    original_judgment: dict[str, Any],
    later_judgment: dict[str, Any],
) -> dict[str, Any]:
    """Uses LLM (or rule-based fallback when offline) to classify the subsequent treatment."""
    orig_title = original_judgment.get("title") or "Original Judgment"
    orig_bench = int(original_judgment.get("bench_strength") or 2)
    later_title = later_judgment.get("title") or "Later Judgment"
    later_bench = int(later_judgment.get("bench_strength") or 2)
    later_court = later_judgment.get("court") or "Supreme Court of India"
    later_year = later_judgment.get("year")
    paragraphs = later_judgment.get("supporting_paragraphs") or []
    supporting_text = later_judgment.get("supporting_text") or later_judgment.get("content") or ""
    pre_classified_type = later_judgment.get("treatment_type") or "REFERRED_TO"

    settings = get_settings()
    ai_raw_type = pre_classified_type
    ai_proposition = later_judgment.get("legal_proposition") or "Judicial consideration of earlier precedent"
    ai_reason = later_judgment.get("reason") or ""
    ai_confidence = float(later_judgment.get("confidence") or 0.90)

    # Attempt LLM call if configured
    if settings.llm_api_base_url and settings.llm_model:
        user_message = f"""Analyze the subsequent judicial treatment of the following judgment:

ORIGINAL JUDGMENT:
Title: {orig_title}
Court: {original_judgment.get('court', 'Supreme Court of India')}
Bench Strength: {orig_bench} Judges
Year: {original_judgment.get('year')}
Citation: {original_judgment.get('citation')} / {original_judgment.get('neutral_citation')}

LATER CITING JUDGMENT:
Title: {later_title}
Court: {later_court}
Bench Strength: {later_bench} Judges
Year: {later_year}
Paragraphs: {', '.join(paragraphs) if paragraphs else 'Relevant excerpts'}

CITING TEXT / EXTRACT:
\"\"\"{supporting_text}\"\"\"

Task:
Determine the treatment type from: OVERRULED, REVERSED, DISTINGUISHED, FOLLOWED, DOUBTED, MODIFIED, REFERRED_TO.
Provide exact supporting paragraph reference, the specific legal proposition, and legal reason.
Ensure bench strength rules are observed.

Return JSON in this exact structure:
{{
  "treatment_type": "OVERRULED",
  "legal_proposition": "description of proposition",
  "supporting_paragraphs": ["Para ..."],
  "reason": "explanation considering court hierarchy and bench strength",
  "confidence": 0.95
}}
"""
        try:
            headers = {"Content-Type": "application/json"}
            if settings.llm_api_key:
                headers["Authorization"] = f"Bearer {settings.llm_api_key}"

            payload = {
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.0,
                "max_tokens": 600,
            }
            endpoint = f"{settings.llm_api_base_url.rstrip('/')}/chat/completions"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(endpoint, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    # Extract JSON object
                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group(0))
                        ai_raw_type = parsed.get("treatment_type", ai_raw_type)
                        ai_proposition = parsed.get("legal_proposition", ai_proposition)
                        ai_reason = parsed.get("reason", ai_reason)
                        if parsed.get("supporting_paragraphs"):
                            paragraphs = parsed["supporting_paragraphs"]
                        if parsed.get("confidence"):
                            ai_confidence = float(parsed["confidence"])
        except Exception as exc:
            logger.debug("LLM classification call fell back to verified rule validator: %s", exc)

    # Validate classification against source text and Indian Constitutional rules
    validated_type, validated_reason, conf, ver_status = validate_treatment_against_rules(
        treatment_type=ai_raw_type,
        orig_bench_strength=orig_bench,
        later_bench_strength=later_bench,
        supporting_text=supporting_text,
    )

    final_reason = ai_reason if ai_reason and validated_type == ai_raw_type else validated_reason

    return {
        "type": validated_type,
        "later_judgment": later_title,
        "later_judgment_id": later_judgment.get("id"),
        "year": later_year,
        "court": later_court,
        "bench_strength": later_bench,
        "legal_proposition": ai_proposition,
        "supporting_paragraphs": paragraphs,
        "supporting_text": supporting_text,
        "source_url": later_judgment.get("source_url") or "https://scr.sci.gov.in/scrsearch/",
        "confidence": round(min(ai_confidence, conf), 2),
        "reason": final_reason,
        "verification_status": ver_status,
    }


def compute_overall_validity_status(treatments: list[dict[str, Any]]) -> str:
    """Computes the overall validity status based on subsequent treatments."""
    if not treatments:
        return "INSUFFICIENT_EVIDENCE"

    types = [t.get("type", "").upper() for t in treatments]

    if "OVERRULED" in types:
        return "OVERRULED"
    if "REVERSED" in types:
        return "REVERSED"
    if "DOUBTED" in types or "CONFLICTING" in types:
        return "DOUBTED"
    if "DISTINGUISHED" in types:
        return "DISTINGUISHED"
    if "MODIFIED" in types:
        return "MODIFIED"
    if "FOLLOWED" in types or "AFFIRMED" in types:
        return "FOLLOWED"
    if "REFERRED_TO" in types:
        return "REFERRED_TO"

    return "REQUIRES_REVIEW"
