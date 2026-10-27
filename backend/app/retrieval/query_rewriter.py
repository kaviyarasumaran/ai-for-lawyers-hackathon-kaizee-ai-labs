import re


def rewrite_legal_query(query: str, history: list[dict] | None = None) -> str:
    """
    Expands ambiguous abbreviations, resolves pronouns based on recent conversation history,
    and constructs a normalized legal search query.
    """
    cleaned = query.strip()
    if not cleaned:
        return query

    # If the query is very short or pronoun-heavy (e.g. "What about its notice period?"),
    # extract context from the last user/assistant message in history
    if history and len(cleaned.split()) <= 8:
        lower_q = cleaned.lower()
        has_pronoun = any(word in lower_q.split() for word in ["it", "its", "they", "this", "that", "these", "those"])
        if has_pronoun or lower_q.startswith(("what about", "and the", "when was")):
            for msg in reversed(history):
                content = msg.get("content", "")
                if content and len(content) > 10:
                    # Look for legal document or subject references
                    matches = re.findall(
                        r"(?:agreement|contract|lease|pleading|motion|brief|affidavit|statute|act|section\s+\d+|clause\s+\d+|rule\s+\d+)",
                        content,
                        re.IGNORECASE,
                    )
                    if matches:
                        context_subject = matches[0]
                        cleaned = f"{cleaned} (in reference to {context_subject})"
                        break

    # Standardize legal shorthand
    shorthand_map = {
        r"\bSOL\b": "statute of limitations",
        r"\bNDA\b": "non-disclosure agreement",
        r"\bMSA\b": "master service agreement",
        r"\bM&A\b": "mergers and acquisitions",
        r"\bTRO\b": "temporary restraining order",
        r"\bPI\b": "preliminary injunction",
        r"\bSJ\b": "summary judgment",
    }
    for pattern, replacement in shorthand_map.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    return cleaned
