"""
Sentiment Service
Provides fast, modular sentiment scoring and classification (Positive / Negative / Neutral)
with a 0-100 continuous score.

Architecture:
- Default: Fast, lexicon-backed sentiment engine with negation and intensity awareness.
- Modular: Pluggable transformer pipeline support for future deep learning model integration.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Curated positive and negative polarity words for social & consumer review text
POSITIVE_WORDS = {
    "good", "great", "excellent", "awesome", "fast", "quick", "speedy", "amazing",
    "love", "best", "superb", "helpful", "friendly", "satisfied", "happy", "smooth",
    "reliable", "cheap", "affordable", "discount", "fresh", "quality", "clean",
    "recommend", "perfect", "worth", "on time", "faster", "impressed", "super",
    "prompt", "easy", "flawless", "favorite", "fantastic", "top", "solid", "nice"
}

NEGATIVE_WORDS = {
    "bad", "terrible", "horrible", "worst", "slow", "delayed", "late", "poor",
    "hate", "scam", "waste", "useless", "broken", "damaged", "expired", "spoiled",
    "complaint", "rude", "buggy", "crash", "expensive", "overpriced", "disappointed",
    "annoying", "frustrated", "fake", "stolen", "fail", "failed", "unhappy", "pathetic",
    "never", "lost", "missing", "glitch", "error", "horrendous", "unacceptable"
}

NEGATION_WORDS = {"not", "never", "no", "hardly", "barely", "scarcely", "without", "isnt", "wasnt", "arent", "dont", "cant", "couldnt", "wont"}
INTENSIFIERS = {"very", "extremely", "super", "really", "incredibly", "highly", "absolutely", "too", "so"}


def _lexicon_analyze(text: str) -> tuple[str, float]:
    """
    Fast rule-based sentiment classification that works offline instantly without
    downloading heavy multi-gigabyte models.
    Returns: (label, score) where label is 'positive'|'negative'|'neutral' and score is 0.0 - 100.0.
    """
    if not text or not text.strip():
        return "neutral", 50.0

    words = re.findall(r"\b[a-z']+\b", text.lower())
    if not words:
        return "neutral", 50.0

    pos_score = 0.0
    neg_score = 0.0

    for i, word in enumerate(words):
        multiplier = 1.0
        # Check preceding word for intensifiers
        if i > 0 and words[i - 1] in INTENSIFIERS:
            multiplier = 1.5

        # Check preceding 1-2 words for negation
        is_negated = False
        if i > 0 and words[i - 1] in NEGATION_WORDS:
            is_negated = True
        elif i > 1 and words[i - 2] in NEGATION_WORDS:
            is_negated = True

        if word in POSITIVE_WORDS:
            if is_negated:
                neg_score += 1.0 * multiplier
            else:
                pos_score += 1.0 * multiplier
        elif word in NEGATIVE_WORDS:
            if is_negated:
                pos_score += 0.8 * multiplier
            else:
                neg_score += 1.0 * multiplier

    net_score = pos_score - neg_score
    total_matches = pos_score + neg_score

    if total_matches == 0:
        # Default neutral for text without polarized cues
        return "neutral", 50.0

    # Map net difference to 0 - 100 continuous score
    # Score 50 is neutral, > 50 positive, < 50 negative
    scaled_diff = max(-1.0, min(1.0, net_score / (total_matches + 1)))
    raw_score = 50.0 + (scaled_diff * 38.0)
    score = round(max(5.0, min(95.0, raw_score)), 1)

    if score >= 58.0:
        label = "positive"
    elif score <= 42.0:
        label = "negative"
    else:
        label = "neutral"

    return label, score


def analyze_text(text: str) -> tuple[str, float]:
    """
    Classifies a mention text and returns (sentiment_label, sentiment_score).
    """
    return _lexicon_analyze(text)


def analyze_batch(texts: list[str]) -> list[tuple[str, float]]:
    """
    Batch sentiment analysis for multiple texts.
    """
    return [_lexicon_analyze(t) for t in texts]
