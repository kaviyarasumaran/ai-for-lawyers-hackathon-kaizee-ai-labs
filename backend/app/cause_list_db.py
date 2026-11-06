"""Madras High Court Cause List Parser and Intelligence Engine.

Provides fetching, OCR/text extraction from Madras High Court Daily Cause List PDFs:
https://mhc.tn.gov.in/judis/clists/clists-madras/causelists/pdf/cause_{DDMMYYYY}.pdf
along with structured listing extraction, filtering, and a natural language AI agent.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import io
import logging
import re
from typing import Any
import zoneinfo

import httpx
import pymupdf

logger = logging.getLogger(__name__)

MHC_BASE_URL = "https://mhc.tn.gov.in/judis/clists/clists-madras/causelists/pdf/cause_{date_str}.pdf"
IST_TIMEZONE = zoneinfo.ZoneInfo("Asia/Kolkata")


def parse_date_code_to_datetime(date_code: str | None) -> datetime | None:
    """Parses DDMMYYYY date code into a datetime object in IST."""
    if not date_code:
        return None
    try:
        cleaned = date_code.strip().replace("-", "").replace("/", "")
        if len(cleaned) == 8 and cleaned.isdigit():
            d = int(cleaned[:2])
            m = int(cleaned[2:4])
            y = int(cleaned[4:8])
            return datetime(y, m, d, tzinfo=IST_TIMEZONE)
    except Exception:
        pass
    return None


def is_weekend_date(date_code: str | None) -> bool:
    """Returns True if the given DDMMYYYY date code falls on a Saturday (5) or Sunday (6)."""
    dt = parse_date_code_to_datetime(date_code)
    return bool(dt and dt.weekday() in (5, 6))


def get_latest_court_sitting_date(date_code: str | None = None) -> tuple[str, str]:
    """Given a DDMMYYYY date code, returns the most recent court sitting working day (DDMMYYYY, DD-MM-YYYY).
    If the date is a Saturday or Sunday, rolls back to Friday."""
    dt = parse_date_code_to_datetime(date_code) if date_code else None
    if not dt:
        dt = datetime.now(IST_TIMEZONE)
    if dt.weekday() == 5:  # Saturday -> Friday
        dt -= timedelta(days=1)
    elif dt.weekday() == 6:  # Sunday -> Friday
        dt -= timedelta(days=2)
    return dt.strftime("%d%m%Y"), dt.strftime("%d-%m-%Y")


def normalize_date_to_ddmmyyyy(raw_date: str | None = None) -> tuple[str, str]:
    """Normalizes input date (DDMMYYYY, YYYY-MM-DD, or DD/MM/YYYY) into (ddmmyyyy, display_date)."""
    now = datetime.now(IST_TIMEZONE)
    if not raw_date or not raw_date.strip():
        return now.strftime("%d%m%Y"), now.strftime("%d-%m-%Y")

    cleaned = raw_date.strip().replace("-", "").replace("/", "")
    if len(cleaned) == 8:
        # Check if YYYYMMDD
        if cleaned.startswith("20") and int(cleaned[4:6]) <= 12 and int(cleaned[6:8]) <= 31:
            # YYYYMMDD -> DDMMYYYY
            d = cleaned[6:8]
            m = cleaned[4:6]
            y = cleaned[:4]
            return f"{d}{m}{y}", f"{d}-{m}-{y}"
        # Assume DDMMYYYY
        d = cleaned[:2]
        m = cleaned[2:4]
        y = cleaned[4:]
        return f"{d}{m}{y}", f"{d}-{m}-{y}"

    # Try parsing ISO
    try:
        dt = datetime.fromisoformat(raw_date.strip())
        return dt.strftime("%d%m%Y"), dt.strftime("%d-%m-%Y")
    except Exception:
        return now.strftime("%d%m%Y"), now.strftime("%d-%m-%Y")


def get_mhc_cause_list_url(date_code: str) -> str:
    """Returns official Madras High Court Cause List URL for given DDMMYYYY."""
    return MHC_BASE_URL.format(date_str=date_code)


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts raw text from PDF stream using PyMuPDF."""
    text_chunks: list[str] = []
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_text = page.get_text("text")
            if page_text:
                text_chunks.append(page_text)
        doc.close()
    except Exception as exc:
        logger.warning("PyMuPDF text extraction failed: %s", exc)
    return "\n".join(text_chunks)


def parse_mhc_cause_list_text(text: str, default_date: str = "") -> list[dict[str, Any]]:
    """Parses cause list text and extracts court halls, judges, items, cases, parties, and counsels."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    items: list[dict[str, Any]] = []

    current_court = "Court No. 01"
    current_judge = "The Hon'ble The Chief Justice"
    current_category = "Motion Cases / Admission"
    current_session = "Morning Session (10:30 AM)"

    same_line_regex = re.compile(
        r"^(?:Item\s*)?(\d{1,3})\.?\s+([A-Za-z.\s]+\d+\s*/\s*\d{4}|[A-Za-z.]+/\d+/\d{4})",
        re.IGNORECASE,
    )
    court_regex = re.compile(r"COURT\s+NO\.?\s*(\d{1,2})", re.IGNORECASE)
    bench_regex = re.compile(r"(HON'?BLE|JUSTICE)", re.IGNORECASE)
    category_regex = re.compile(
        r"(FOR ADMISSION|MOTION CASES|FOR ORDERS|FOR DISMISSAL|FINAL HEARING|SPECIALLY ORDERED|CONTEMPT PETITIONS)",
        re.IGNORECASE,
    )

    idx = 0
    item_counter = 1
    while idx < len(lines):
        line = lines[idx]

        court_match = court_regex.search(line)
        if court_match:
            current_court = f"Court No. {int(court_match.group(1)):02d}"

        if bench_regex.search(line) and len(line) < 120 and not same_line_regex.search(line):
            if not any(ch.isdigit() for ch in line):
                current_judge = line

        cat_match = category_regex.search(line)
        if cat_match:
            current_category = cat_match.group(1).title()

        if "AFTERNOON" in line.upper() or "02.15" in line.upper() or "2.15 P.M" in line.upper():
            current_session = "Afternoon Session (02:15 PM)"
        elif "10.30" in line.upper() or "FORENOON" in line.upper() or "MORNING" in line.upper():
            current_session = "Morning Session (10:30 AM)"

        item_no = None
        case_no = None

        same_m = same_line_regex.match(line)
        if same_m:
            item_no = same_m.group(1)
            case_no = same_m.group(2).replace(" ", "")
            idx += 1
        elif line.isdigit() and 1 <= int(line) <= 500 and idx + 1 < len(lines):
            next_l = lines[idx + 1]
            if "/" in next_l and any(c.isdigit() for c in next_l) and not next_l.upper().startswith("NOTIFICATION"):
                item_no = line
                case_no = next_l.replace(" ", "")
                idx += 2
            else:
                idx += 1
        else:
            idx += 1
            continue

        if item_no and case_no and not case_no.upper().startswith("NOTIFICATION"):
            # Look ahead for party & counsel info
            peek = idx
            pet_lines: list[str] = []
            resp_lines: list[str] = []
            counsel_lines: list[str] = []
            is_resp = False

            while peek < min(len(lines), idx + 12):
                pl = lines[peek]
                if pl.isdigit() or court_regex.search(pl) or same_line_regex.match(pl) or "COURT NO" in pl.upper():
                    break
                if pl.upper() in ["VS", "V.", "VERSUS"]:
                    is_resp = True
                    peek += 1
                    continue
                if pl.startswith("M/S.") or any(k in pl.upper() for k in ["PLEADER", "ADVOCATE", "COUNSEL", "GOVERNMENT", "SPECIAL"]):
                    counsel_lines.append(pl)
                elif not is_resp and len(pet_lines) < 2 and not pl.startswith("(") and not pl.startswith("-"):
                    pet_lines.append(pl)
                elif is_resp and len(resp_lines) < 2 and not pl.startswith("(") and not pl.startswith("-"):
                    resp_lines.append(pl)
                peek += 1

            pet = " ".join(pet_lines).strip() or "Petitioner"
            resp = " ".join(resp_lines).strip() or "Respondent"
            parties = f"{pet[:80]} Vs. {resp[:80]}"
            counsels = " · ".join(counsel_lines[:2]) or "Advocate on Record"

            items.append({
                "id": f"mhc_item_{item_counter}",
                "itemNumber": item_no,
                "caseNumber": case_no,
                "courtNumber": current_court,
                "judge": current_judge,
                "parties": parties,
                "counsels": counsels,
                "category": current_category,
                "session": current_session,
                "date": default_date,
            })
            item_counter += 1

    return items


def empty_mhc_cause_list(date_code: str, display_date: str, message: str = "") -> dict[str, Any]:
    """Returns an empty cause list structure when no real PDF has been processed yet.
    Provides clear non-sitting day guidance for weekends and court recess."""
    is_weekend = is_weekend_date(date_code)
    sitting_code, sitting_disp = get_latest_court_sitting_date(date_code)

    resolved_message = message
    if not resolved_message:
        if is_weekend:
            dt = parse_date_code_to_datetime(date_code)
            day_name = dt.strftime("%A") if dt else "Weekend"
            resolved_message = (
                f"{display_date} is a {day_name} (Court Non-sitting Day / Weekend Recess). "
                f"The Madras High Court does not publish daily cause lists on weekends. "
                f"Active court board is from Friday, {sitting_disp}."
            )
        else:
            resolved_message = f"No cause list items extracted for {display_date}."

    return {
        "date": date_code,
        "dateFormatted": display_date,
        "courtName": "High Court of Judicature at Madras",
        "officialPdfUrl": get_mhc_cause_list_url(date_code),
        "source": (
            "Madras High Court (Weekend Recess — Non-sitting Day)"
            if is_weekend
            else "Madras High Court Daily Cause List"
        ),
        "isLive": False,
        "isWeekend": is_weekend,
        "latestSittingDate": sitting_code if is_weekend else None,
        "latestSittingFormatted": sitting_disp if is_weekend else None,
        "totalItems": 0,
        "courts": [],
        "items": [],
        "message": resolved_message,
    }


def create_cause_list_pdf_from_items(items: list[dict[str, Any]], date_code: str, display_date: str) -> bytes:
    """Builds a PDF from actual extracted cause list items using PyMuPDF."""
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Header styling
    page.insert_text(
        (130, 45),
        "IN THE HIGH COURT OF JUDICATURE AT MADRAS",
        fontsize=13,
        fontname="helv",
        color=(0.1, 0.2, 0.15),
    )
    page.insert_text(
        (165, 62),
        f"DAILY CAUSE LIST FOR {display_date}",
        fontsize=11,
        fontname="helv",
        color=(0.2, 0.35, 0.2),
    )
    page.draw_line((50, 75), (545, 75), color=(0.7, 0.75, 0.7), width=1)

    y = 95
    if not items:
        page.insert_text((55, 120), f"No listed cases recorded for {display_date}.", fontsize=10, fontname="helv", color=(0.4, 0.4, 0.4))
    else:
        current_court = ""
        for item in items:
            if y > 780:
                page = doc.new_page(width=595, height=842)
                y = 50
            if item.get("courtNumber") != current_court:
                current_court = item.get("courtNumber", "")
                page.draw_rect(pymupdf.Rect(50, y - 2, 545, y + 16), color=(0.92, 0.95, 0.92), fill=(0.92, 0.95, 0.92))
                page.insert_text((55, y + 11), f"{current_court} — {item.get('judge', '')}", fontsize=9, fontname="helv", color=(0.15, 0.35, 0.2))
                y += 24

            page.insert_text((55, y), f"Item {item.get('itemNumber', '')}.  {item.get('caseNumber', '')}  [{item.get('category', '')}]", fontsize=8.5, fontname="helv", color=(0.1, 0.1, 0.1))
            page.insert_text((55, y + 11), f"Parties: {item.get('parties', '')}", fontsize=8, fontname="helv", color=(0.3, 0.3, 0.3))
            page.insert_text((55, y + 21), f"Counsel: {item.get('counsels', '')}", fontsize=7.5, fontname="helv", color=(0.4, 0.4, 0.4))
            page.draw_line((50, y + 26), (545, y + 26), color=(0.9, 0.9, 0.9), width=0.5)
            y += 34

    page.insert_text((50, 810), f"Official MHC URL: {get_mhc_cause_list_url(date_code)}", fontsize=7, color=(0.5, 0.5, 0.5))
    pdf_bytes: bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


async def fetch_mhc_cause_list_data(date_str: str | None = None) -> dict[str, Any]:
    """Fetches cause list from MHC URL or extracts via PyMuPDF. If unavailable, returns empty dataset."""
    date_code, display_date = normalize_date_to_ddmmyyyy(date_str)
    url = get_mhc_cause_list_url(date_code)

    parsed_items: list[dict[str, Any]] = []
    is_live_download = False

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/pdf,*/*",
    }
    try:
        async with httpx.AsyncClient(verify=False, timeout=35.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and resp.content and resp.content[:4] == b"%PDF":
                extracted_text = extract_text_from_pdf_bytes(resp.content)
                parsed_items = parse_mhc_cause_list_text(extracted_text, display_date)
                if parsed_items:
                    is_live_download = True
    except Exception as exc:
        logger.info("MHC live network fetch: %s", exc)

    if not parsed_items:
        return empty_mhc_cause_list(
            date_code,
            display_date,
            f"No cause list currently published for {display_date}. Click 'Run Pipeline Now' or upload an official PDF.",
        )

    courts = list({item["courtNumber"] for item in parsed_items})
    courts.sort()

    return {
        "date": date_code,
        "dateFormatted": display_date,
        "courtName": "High Court of Judicature at Madras",
        "officialPdfUrl": url,
        "source": "Madras High Court Official PDF (Live OCR)",
        "isLive": is_live_download,
        "totalItems": len(parsed_items),
        "courts": courts,
        "items": parsed_items,
    }


def answer_cause_list_query(query: str, date_code: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    """Dedicated AI Agent engine to answer natural language questions about the cause list."""
    q = query.strip().lower()
    matching_ids: list[str] = []
    highlight_court = ""

    # Match Pipeline / Sync queries
    if any(k in q for k in ["pipeline", "1 am", "sync", "ocr", "automated", "schedule", "trigger", "downloaded"]):
        answer = (
            f"The **Madras High Court Cause List Pipeline** is scheduled to auto-trigger daily at **01:00 AM IST**.\n\n"
            f"**Pipeline Workflow:**\n"
            f"1. **Download:** Automatically downloads the official MHC cause list PDF (`cause_{date_code}.pdf`).\n"
            f"2. **PyMuPDF OCR:** Extracts court halls, judges, morning & afternoon sessions, item numbers, case types, and counsel.\n"
            f"3. **Persistent Store:** Persists structured records to disk and database cache.\n"
            f"4. **Live Board & AI:** Powers instantaneous search, category filtering, and conversational legal query answering.\n\n"
            f"Currently **{len(items)} cases** are indexed and ready for search or export."
        )
        return {
            "answer": answer,
            "matchingItemIds": [items[0]["id"]] if items else [],
            "highlightCourt": "Court No. 01",
            "suggestedFollowUps": [
                "Which court is hearing Writ Petitions today?",
                "Show items listed in Court No. 01",
                "Are there any final hearing cases today?",
            ],
        }

    # Match item number, e.g. "item 24", "item no 1", "item number 1", "item #5"
    item_match = re.search(r"item\s*(?:no\.?|#|number)?\s*(\d+)", q)
    if item_match:
        target_item = item_match.group(1)
        found = [it for it in items if it.get("itemNumber") == target_item]
        if found:
            match = found[0]
            matching_ids = [match["id"]]
            highlight_court = match["courtNumber"]
            answer = (
                f"**Item No. {match['itemNumber']}** is listed in **{match['courtNumber']}** before "
                f"**{match['judge']}**.\n\n"
                f"- **Case:** `{match['caseNumber']}`\n"
                f"- **Stage:** {match['category']}\n"
                f"- **Session:** {match['session']}\n"
                f"- **Parties:** {match['parties']}\n"
                f"- **Counsel:** {match['counsels']}\n"
                f"- **Notes:** {match.get('notes', 'Scheduled for hearing.')}"
            )
            return {
                "answer": answer,
                "matchingItemIds": matching_ids,
                "highlightCourt": highlight_court,
                "suggestedFollowUps": [
                    f"Who is the opposing counsel in {match['caseNumber']}?",
                    f"Show all cases in {match['courtNumber']}",
                    "What other matters are in morning session?",
                ],
            }

    # Match party names (e.g. "A.JOHN BOSCO Vs. THE DISTRICT COLLECTOR", "Kulandhaivel", "John Bosco")
    legal_stop_words = {
        "the", "and", "or", "of", "in", "at", "to", "for", "on", "by", "with",
        "vs", "vs.", "v.", "v", "versus", "others", "other", "another", "anr", "ors",
        "district", "collector", "state", "government", "govt", "dept", "department",
        "union", "territory", "rep", "represented", "secretary", "principal", "officer",
        "item", "case", "cases", "court", "hall", "today", "show", "what", "which",
        "list", "listed", "matter", "matters", "hearing", "session", "number", "no",
        "hon'ble", "honble", "justice", "mr", "mrs", "ms", "advocate", "counsel",
        "ltd", "limited", "pvt", "private", "co", "corp", "corporation", "inc", "llp",
    }
    has_vs = any(sep in q for sep in [" vs.", " vs ", " v. ", " v ", " versus "])
    pet_tokens: list[str] = []
    resp_tokens: list[str] = []
    if has_vs:
        parts = re.split(r"\s+(?:vs\.?|v\.?|versus)\s+", q)
        if len(parts) >= 2:
            pet_tokens = [w for w in re.split(r"[\s\W]+", parts[0]) if len(w) >= 3 and w not in legal_stop_words]
            resp_tokens = [w for w in re.split(r"[\s\W]+", parts[1]) if len(w) >= 3 and w not in legal_stop_words]

    distinctive_party_tokens = [
        w for w in re.split(r"[\s\W]+", q)
        if len(w) >= 3 and w not in legal_stop_words
    ]

    if has_vs or len(distinctive_party_tokens) >= 2:
        scored_party_matches: list[tuple[float, dict[str, Any]]] = []
        q_clean = re.sub(r"[\s\W]+", " ", q).strip()
        for it in items:
            parties_val = it.get("parties", "")
            if not parties_val:
                continue
            p_lower = parties_val.lower()
            p_clean = re.sub(r"[\s\W]+", " ", p_lower).strip()
            score = 0.0

            # Exact or substring match of full party string
            if p_clean and q_clean and (p_clean in q_clean or q_clean in p_clean):
                score += 80.0

            if has_vs:
                matched_pet = [t for t in pet_tokens if t in p_lower]
                matched_resp = [t for t in resp_tokens if t in p_lower]
                pet_matched = (len(matched_pet) >= 2) if len(pet_tokens) >= 2 else (len(matched_pet) == len(pet_tokens) and len(pet_tokens) > 0)
                resp_matched = (len(matched_resp) >= 2) if len(resp_tokens) >= 2 else (len(matched_resp) == len(resp_tokens) and len(resp_tokens) > 0)

                if pet_matched and resp_matched:
                    score += 80.0
                elif pet_matched:
                    score += 50.0 + 10.0 * len(matched_pet)
                elif resp_matched:
                    score += 35.0 + 10.0 * len(matched_resp)
            else:
                # Distinctive token overlap
                matched_distinct = [t for t in distinctive_party_tokens if t in p_lower]
                if len(matched_distinct) >= 2:
                    score += 25.0 * len(matched_distinct)
                elif len(matched_distinct) == 1:
                    score += 10.0

            if score >= 35.0:
                scored_party_matches.append((score, it))

        if scored_party_matches:
            scored_party_matches.sort(key=lambda x: x[0], reverse=True)
            top_score = scored_party_matches[0][0]
            top_matches = [m[1] for m in scored_party_matches if m[0] >= 0.5 * top_score][:5]
            matching_ids = [m["id"] for m in top_matches]
            first_m = top_matches[0]
            if len(top_matches) == 1:
                answer = (
                    f"Found case **{first_m['caseNumber']}** listed as **Item No. {first_m['itemNumber']}** "
                    f"in **{first_m['courtNumber']}** before **{first_m['judge']}**.\n\n"
                    f"- **Parties:** {first_m['parties']}\n"
                    f"- **Stage:** {first_m['category']} ({first_m['session']})\n"
                    f"- **Advocates:** {first_m['counsels']}\n"
                    f"- **Date:** {first_m.get('date', date_code)}"
                )
            else:
                lines = [
                    f"- **Item {m['itemNumber']}** in **{m['courtNumber']}**: `{m['caseNumber']}` — {m['parties']}"
                    for m in top_matches
                ]
                answer = (
                    f"Found **{len(top_matches)} matter(s)** matching party inquiry:\n\n"
                    + "\n".join(lines)
                )
            return {
                "answer": answer,
                "matchingItemIds": matching_ids,
                "highlightCourt": first_m["courtNumber"],
                "suggestedFollowUps": [
                    f"Who is the counsel in Item {first_m['itemNumber']}?",
                    f"Show all cases in {first_m['courtNumber']}",
                    "What other matters are in morning session?",
                ],
            }
        elif has_vs:
            # Query was an explicit "A vs B" search and no matters matched
            return {
                "answer": (
                    f"No listed matter(s) found for **\"{query.strip()}\"** on **{date_code}**.\n\n"
                    f"Please verify the party names or case number, or browse the active court halls on the live board."
                ),
                "matchingItemIds": [],
                "highlightCourt": items[0].get("courtNumber", "Court No. 01") if items else "Court No. 01",
                "suggestedFollowUps": [
                    "Show cases listed for admission today",
                    "Which matters are listed in Court No. 01?",
                    "What is the status of the 1:00 AM pipeline?",
                ],
            }

    # Match case number, e.g. "WP/43363/2026", "1386/2025", "24891", "WP"
    slashed = re.findall(r"\b[a-zA-Z]*/?\d{1,6}/\d{2,4}\b", q)
    prefixed = re.findall(r"\b(?:wp|wa|crlop|crl\.?op|osa|cma|slp|arbi|contp|op|rca|tca|crp|as|sa)[/\s-]*\d+\b", q)
    long_nums = re.findall(r"\b\d{3,6}\b", q)
    case_words = list(set(slashed + prefixed + long_nums))
    if case_words:
        matches = [
            it for it in items
            if any(cw.lower().replace(" ", "") in it.get("caseNumber", "").lower().replace(" ", "") for cw in case_words)
        ]
        if matches:
            matching_ids = [m["id"] for m in matches]
            m = matches[0]
            answer = (
                f"Found case **{m['caseNumber']}** listed as **Item No. {m['itemNumber']}** in **{m['courtNumber']}**.\n\n"
                f"- **Coram:** {m['judge']}\n"
                f"- **Stage:** {m['category']} ({m['session']})\n"
                f"- **Parties:** {m['parties']}\n"
                f"- **Advocates:** {m['counsels']}"
            )
            return {
                "answer": answer,
                "matchingItemIds": matching_ids,
                "highlightCourt": m["courtNumber"],
                "suggestedFollowUps": [
                    f"Check item details for Item {m['itemNumber']}",
                    f"View all cases in {m['courtNumber']}",
                ],
            }

    # Match advocate / counsel names, e.g. "Sundaram", "Muthukumar", "Jayaraman"
    advocate_matches = [
        it for it in items
        if any(token in it.get("counsels", "").lower() for token in q.split() if len(token) > 3 and token not in ["what", "when", "court", "which", "cases", "list"])
    ]
    if advocate_matches:
        matching_ids = [m["id"] for m in advocate_matches]
        lines = [
            f"- **Item {m['itemNumber']}** in **{m['courtNumber']}**: `{m['caseNumber']}` ({m['parties']})"
            for m in advocate_matches
        ]
        answer = (
            f"Found **{len(advocate_matches)} listing(s)** for the specified counsel:\n\n"
            + "\n".join(lines)
            + f"\n\nAll matters are scheduled for hearing on this date."
        )
        return {
            "answer": answer,
            "matchingItemIds": matching_ids,
            "highlightCourt": advocate_matches[0]["courtNumber"],
            "suggestedFollowUps": [
                "Which matters are listed before Court No. 01?",
                "Are there any final hearing cases today?",
            ],
        }

    # Match Court / Judge, e.g. "court 1", "chief justice", "court no 7", "anand venkatesh"
    if "court" in q or "chief" in q or "justice" in q or "venkatesh" in q or "suresh" in q:
        court_matches = [
            it for it in items
            if ("court" in q and it["courtNumber"].lower().replace(" ", "") in q.replace(" ", ""))
            or ("chief" in q and "chief justice" in it["judge"].lower())
            or ("venkatesh" in q and "venkatesh" in it["judge"].lower())
            or ("suresh" in q and "suresh" in it["judge"].lower())
        ]
        if court_matches:
            matching_ids = [m["id"] for m in court_matches]
            c_name = court_matches[0]["courtNumber"]
            c_judge = court_matches[0]["judge"]
            lines = [
                f"- **Item {m['itemNumber']}** [{m['category']}]: `{m['caseNumber']}` — {m['parties']}"
                for m in court_matches
            ]
            answer = (
                f"**{c_name}** ({c_judge}) has **{len(court_matches)} listed matter(s)**:\n\n"
                + "\n".join(lines)
            )
            return {
                "answer": answer,
                "matchingItemIds": matching_ids,
                "highlightCourt": c_name,
                "suggestedFollowUps": [
                    f"What is Item {court_matches[0]['itemNumber']} about?",
                    "Show cases listed for final hearing",
                ],
            }

    # Match Stage, e.g. "admission", "motion", "final hearing", "orders"
    for cat in ["admission", "motion", "orders", "final hearing"]:
        if cat in q:
            stage_matches = [it for it in items if cat in it["category"].lower()]
            if stage_matches:
                matching_ids = [m["id"] for m in stage_matches]
                lines = [
                    f"- **Item {m['itemNumber']}** in **{m['courtNumber']}**: `{m['caseNumber']}` ({m['parties']})"
                    for m in stage_matches
                ]
                answer = (
                    f"There are **{len(stage_matches)} case(s)** under **{cat.title()}**:\n\n"
                    + "\n".join(lines)
                )
                return {
                    "answer": answer,
                    "matchingItemIds": matching_ids,
                    "highlightCourt": stage_matches[0]["courtNumber"],
                    "suggestedFollowUps": [
                        "Who is the judge for Court No. 01?",
                        "Check morning session timings",
                    ],
                }

    # Dynamic General Overview based on actual items
    total = len(items)
    courts = list({it["courtNumber"] for it in items if it.get("courtNumber")})
    courts.sort()

    if total == 0:
        return {
            "answer": (
                f"There are currently **no listed cases** in the database for **{date_code}**.\n\n"
                f"You can click **'Run Pipeline Now'** to trigger the 1:00 AM download & OCR pipeline, "
                f"or upload an official Madras High Court cause list PDF."
            ),
            "matchingItemIds": [],
            "highlightCourt": "",
            "suggestedFollowUps": [
                "What is the status of the 1:00 AM pipeline?",
                "How do I upload a cause list PDF?",
            ],
        }

    court_preview = ", ".join(courts[:4])
    answer = (
        f"The Daily Court Cause List contains **{total} listed matter(s)** across **{len(courts)} Court Bench(es)** "
        f"({court_preview}).\n\n"
        f"Ask me about any specific item number, case number, advocate name, or court hall!"
    )
    return {
        "answer": answer,
        "matchingItemIds": [items[0]["id"]],
        "highlightCourt": items[0].get("courtNumber", ""),
        "suggestedFollowUps": [
            f"Which court is item number {items[0].get('itemNumber', 1)} listed in?",
            "What matters are before the Chief Justice?",
            "Show cases listed for admission",
        ],
    }
