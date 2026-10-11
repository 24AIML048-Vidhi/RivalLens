"""
Aspect extraction: figures out which product aspect (delivery, pricing,
support, etc.) a mention is actually about, so sentiment can be broken
down per-aspect instead of one blended score per brand.

Approach: spaCy noun-chunk extraction + keyword matching against a curated
aspect vocabulary. This is intentionally simple (not a trained classifier) —
good enough for an MVP, and every aspect bucket is easy to explain in a demo.
Swap in a trained classifier later if the keyword lists stop covering enough
of the mention volume.
"""

import spacy

_nlp = None

# Keyword → aspect bucket. Extend this list as you see real mention text
# that isn't matching — it's the main lever for improving coverage.
ASPECT_KEYWORDS: dict[str, list[str]] = {
    "Delivery speed": ["delivery", "shipping", "arrived", "late", "fast", "slow", "eta"],
    "Pricing": ["price", "pricing", "expensive", "cheap", "cost", "discount", "value for money"],
    "App experience": ["app", "ui", "interface", "crash", "bug", "glitch", "login"],
    "Customer support": ["support", "customer service", "refund", "complaint", "helpline", "response"],
    "Product quality": ["quality", "packaging", "damaged", "fresh", "defective", "durable"],
}


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def extract_aspect(text: str) -> str | None:
    """Returns the single best-matching aspect bucket for a mention, or None
    if no known aspect keyword appears (still stored as a general mention,
    just excluded from the per-aspect breakdown)."""
    if not text:
        return None

    lowered = text.lower()
    best_aspect = None
    best_hits = 0

    for aspect, keywords in ASPECT_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in lowered)
        if hits > best_hits:
            best_hits = hits
            best_aspect = aspect

    return best_aspect


def extract_noun_chunks(text: str) -> list[str]:
    """Utility for exploring un-matched mentions — run this over mentions
    with aspect=None to spot new keywords worth adding to ASPECT_KEYWORDS."""
    try:
        doc = _get_nlp()(text)
        return [chunk.text.lower() for chunk in doc.noun_chunks]
    except Exception:
        # Fallback to simple word splitting if spacy model is unavailable
        return [w.lower() for w in text.split() if len(w) > 3]