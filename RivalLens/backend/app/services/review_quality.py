"""
Review Quality and Fake/Spam Detection Service
Computes Review Authenticity / Spam Score (0-100%) and classifies into:
- Genuine
- Suspicious
- Spam
Combines NLP signals, promotional indicators, repetitive phrase detection,
and duplicate frequency patterns.
"""

import re
from app.services.language_detection import detect_language, normalize_text
from app.services.duplicate_detection import group_mentions_batch

# Promotional and spam triggers
SPAM_PATTERNS = [
    r"\b(click here|buy now|discount code|promo code|voucher code|coupon code)\b",
    r"\b(earn money|make money|work from home|guaranteed profit|investment returns|crypto)\b",
    r"\b(dm me|dm for|whatsapp me|telegram|contact\s*:\s*\+?\d+)\b",
    r"\b(free gift|100% free|win iphone|giveaway entry|cashback guaranteed)\b",
    r"\b(check bio|link in bio|follow back|sub4sub|like4like)\b",
    r"\b(100% genuine|real followers|instant followers|grow account)\b",
    r"https?://\S+",  # suspicious link
]

# Exaggerated / bot template patterns
EXAGGERATED_TEMPLATES = [
    r"^(best product ever|amazing product|superb|awesome|very good|nice|good)\s*[!.]*$",
    r"^(10/10|100% recommended|must buy|loved it)\s*[!.]*$",
]


def calculate_spam_score(
    text: str,
    author: str | None = None,
    is_duplicate: bool = False,
    dup_count: int = 1
) -> tuple[float, str, list[str]]:
    """
    Calculates the Review Authenticity / Spam Score (0.0 - 100.0)
    and classifies into: 'genuine' | 'suspicious' | 'spam'.
    Returns:
      (spam_score, review_status, reasons)
    """
    if not text or not text.strip():
        return 50.0, "suspicious", ["Empty review content"]

    clean_text = text.strip()
    norm = normalize_text(clean_text)
    reasons: list[str] = []
    score = 5.0  # baseline genuine score

    # 1. Promotional & Clickbait phrases
    promotional_hits = 0
    for pat in SPAM_PATTERNS:
        if re.search(pat, clean_text, re.IGNORECASE):
            promotional_hits += 1

    if promotional_hits >= 2:
        score += 55.0
        reasons.append("High promotional / spam phrases detected")
    elif promotional_hits == 1:
        score += 35.0
        reasons.append("Contains promotional keywords or links")

    # 2. Excessive capitalization (e.g., "AMAZING PRODUCT!! BEST EVER!!")
    letters = [c for c in clean_text if c.isalpha()]
    if len(letters) >= 12:
        caps_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
        if caps_ratio >= 0.70:
            score += 25.0
            reasons.append("Excessive uppercase lettering")
        elif caps_ratio >= 0.45:
            score += 15.0
            reasons.append("High uppercase usage")

    # 3. Excessive exclamation / repeated punctuation (e.g., "!!!!", "????", "🔥🔥🔥🔥🔥")
    excessive_punct = len(re.findall(r"[!?.]{2,}", clean_text))
    if excessive_punct >= 2 or len(re.findall(r"[!]", clean_text)) >= 5:
        score += 20.0
        reasons.append("Excessive emotional punctuation / emphasis")

    # 4. Short repetitive phrases (e.g., "good good good", "best best best")
    words = re.findall(r"\b\w+\b", norm.lower())
    if len(words) >= 3:
        unique_words = set(words)
        repeat_ratio = len(words) / len(unique_words)
        if repeat_ratio >= 2.0:
            score += 30.0
            reasons.append("Repetitive keyword stuffing")

    # 5. Very short generic / boilerplate template review
    if len(words) <= 3:
        for template in EXAGGERATED_TEMPLATES:
            if re.match(template, clean_text.lower()):
                score += 35.0
                reasons.append("Very short generic template phrase")
                break

    # 6. Duplication frequency signal
    if is_duplicate:
        score += 25.0
        reasons.append("Duplicate of existing review")
    elif dup_count >= 5:
        score += 30.0
        reasons.append(f"Highly repeated review pattern ({dup_count} instances)")
    elif dup_count >= 2:
        score += 15.0
        reasons.append("Repeated comment pattern across users")

    # 7. Author suspicious naming pattern (e.g., bot names like user983419823)
    if author and re.search(r"\d{5,}", author):
        score += 10.0
        reasons.append("Suspicious bot-like account handle")

    # Final bounded score
    final_score = round(max(2.0, min(98.0, score)), 1)

    # Classification threshold
    if final_score >= 70.0:
        status = "spam"
    elif final_score >= 40.0:
        status = "suspicious"
    else:
        status = "genuine"

    return final_score, status, reasons


def classify_review_quality(spam_score: float) -> str:
    """Helper to classify status from score."""
    if spam_score >= 70.0:
        return "spam"
    elif spam_score >= 40.0:
        return "suspicious"
    return "genuine"

