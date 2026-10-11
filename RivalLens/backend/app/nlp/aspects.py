"""
Aspect extraction: figures out which product aspect (delivery, pricing,
support, etc.) a mention is actually about, so sentiment can be broken
down per-aspect instead of one blended score per brand.
Supports English + Hindi + Gujarati + Hinglish code-mixed text.
"""

import spacy
from app.services.language_detection import normalize_text

_nlp = None

# Multilingual Keyword → aspect bucket
ASPECT_KEYWORDS: dict[str, list[str]] = {
    "Delivery speed": [
        "delivery", "shipping", "arrived", "late", "fast", "slow", "eta", "speed",
        "pahucha", "aavyo", "fatafat", "jaldi", "der se", "time pe", "on time",
        "મોડું", "ડિલિવરી", "ડિલિવરી સ્પીડ"
    ],
    "Pricing": [
        "price", "pricing", "expensive", "cheap", "cost", "discount", "value for money",
        "paisa", "mehenga", "mahnga", "sasta", "loot", "charges", "rate", "paisa vasool",
        "overpriced", "fee", "bill", "કિંમત", "મોંઘું", "સસ્તું"
    ],
    "App experience": [
        "app", "ui", "interface", "crash", "bug", "glitch", "login", "hang", "update",
        "slow chal raha", "chaltu nathi", "open nahi", "ਐਪ", "એપ"
    ],
    "Customer support": [
        "support", "customer service", "refund", "complaint", "helpline", "response",
        "madad", "care", "agent", "call", "help", "customercare", "સપોર્ટ", "રીફંડ"
    ],
    "Product quality": [
        "quality", "packaging", "damaged", "fresh", "defective", "durable",
        "kharab", "tuta", "asli", "nakli", "sari quality", "condition", "ખોટું", "ક્વોલિટી"
    ],
}


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except Exception:
            _nlp = None
    return _nlp


def extract_aspect(text: str) -> str | None:
    """Returns the single best-matching aspect bucket for a mention."""
    if not text:
        return None

    normalized = normalize_text(text).lower()
    best_aspect = None
    best_hits = 0

    for aspect, keywords in ASPECT_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in normalized)
        if hits > best_hits:
            best_hits = hits
            best_aspect = aspect

    return best_aspect


def extract_all_aspects(text: str) -> list[str]:
    """Returns all matching aspect buckets found in the text."""
    if not text:
        return []

    normalized = normalize_text(text).lower()
    matched = []

    for aspect, keywords in ASPECT_KEYWORDS.items():
        if any(kw in normalized for kw in keywords):
            matched.append(aspect)

    return matched


def extract_noun_chunks(text: str) -> list[str]:
    """Utility for exploring un-matched mentions."""
    try:
        nlp_engine = _get_nlp()
        if nlp_engine:
            doc = nlp_engine(text)
            return [chunk.text.lower() for chunk in doc.noun_chunks]
    except Exception:
        pass
    return [w.lower() for w in text.split() if len(w) > 3]

