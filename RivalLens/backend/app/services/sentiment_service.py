"""
Multilingual & Mixed-Language Sentiment Service
Supports English, Hindi (Devanagari & Romanized), Gujarati (Gujarati script & Romanized),
and Hinglish / Code-mixed social review comments.
Provides continuous 0-100 scoring and classification:
- Positive
- Negative
- Neutral
- Mixed
"""

import re
import logging
from app.services.language_detection import normalize_text

logger = logging.getLogger(__name__)

# Curated positive words across English, Hindi/Hinglish, and Gujarati
POSITIVE_WORDS = {
    # English
    "good", "great", "excellent", "awesome", "fast", "quick", "speedy", "amazing",
    "love", "loved", "loving", "best", "superb", "helpful", "friendly", "satisfied",
    "happy", "smooth", "reliable", "cheap", "affordable", "discount", "fresh", "quality",
    "clean", "recommend", "recommended", "perfect", "worth", "on time", "faster",
    "impressed", "super", "prompt", "easy", "flawless", "favorite", "fantastic", "top",
    "solid", "nice", "finest", "wonderful", "delighted", "brilliant",
    # Hindi / Hinglish
    "mast", "badhiya", "badiya", "ekdum", "shandar", "zabardast", "lajawab", "sahi",
    "tagda", "gazab", "bawal", "jhakaas", "kamal", "paisa vasool", "vasool", "dhansu",
    "fatafat", "khush", "accha", "achha", "sasta", "bahut fast", "bahu saras",
    # Devanagari Hindi
    "अच्छा", "बढ़िया", "शानदार", "ज़बरदस्त", "मस्त", "सस्ता", "खुश", "उत्कृष्ट", "लाजवाब", "तेज़",
    # Gujarati (Romanized & Gujarati script)
    "saras", "saru", "saroj", "maja", "majama", "vadhare", "saru che", "mast che", "best che",
    "સરસ", "સારું", "મજા", "ઉત્તમ"
}

# Curated negative words across English, Hindi/Hinglish, and Gujarati
NEGATIVE_WORDS = {
    # English
    "bad", "terrible", "horrible", "worst", "slow", "delayed", "late", "poor",
    "hate", "scam", "waste", "useless", "broken", "damaged", "expired", "spoiled",
    "complaint", "rude", "buggy", "crash", "expensive", "overpriced", "disappointed",
    "annoying", "frustrated", "fake", "stolen", "fail", "failed", "unhappy", "pathetic",
    "never", "lost", "missing", "glitch", "error", "horrendous", "unacceptable", "terribly",
    "ridiculous", "poorly", "lag", "headache", "trouble",
    # Hindi / Hinglish
    "bakwas", "bkwash", "bekar", "kharab", "ghatiya", "lut", "loot", "chor", "dhokha",
    "bogus", "pareshan", "faltu", "barbaad", "mehenga", "mahnga", "tuta", "thoda high",
    "problem", "bekaar", "kachra", "bekhud", "galti", "nuksan", "chori", "fraud",
    # Devanagari Hindi
    "बुरा", "खराब", "बकवास", "बेकार", "घटिया", "महंगा", "धोखा", "लूट", "परेशान", "धीमा",
    # Gujarati (Romanized & Gujarati script)
    "kharab che", "khrab", "nathi saru", "bekar che", "late aavyo", "paisa barbad",
    "khotu", "khotu che", "chaltu nathi", "બરાબર નથી", "ખરાબ", "મોડું"
}

# Negation words
NEGATION_WORDS = {
    "not", "never", "no", "hardly", "barely", "without", "isnt", "wasnt", "arent",
    "dont", "cant", "couldnt", "wont", "nahi", "nhi", "nahin", "na", "mat", "nathi",
    "નથી", "નહીં"
}

# Intensifiers
INTENSIFIERS = {
    "very", "extremely", "super", "really", "incredibly", "highly", "absolutely",
    "too", "so", "bahut", "bohot", "bahot", "bahu", "ekdum", "ghano", "ખૂબ", "બહુ"
}

# Contrastive conjunctions (indicate potential Mixed sentiment)
CONTRASTIVE_WORDS = {
    "but", "however", "although", "though", "yet", "still",
    "lekin", "parantu", "par", "magar", "kintu", "pan", "પરંતુ", "પણ"
}


def analyze_text(text: str) -> tuple[str, float]:
    """
    Classifies review text across English, Hindi, Gujarati, and Hinglish.
    Returns: (label, score)
      label: 'positive' | 'negative' | 'neutral' | 'mixed'
      score: 0.0 - 100.0 continuous polarity index
    """
    if not text or not text.strip():
        return "neutral", 50.0

    normalized = normalize_text(text)
    clean_lower = normalized.lower()

    # Extract tokens including Unicode words (Devanagari, Gujarati, Latin)
    words = re.findall(r"\b[a-zA-Z\u0900-\u097F\u0A80-\u0AFF']+\b", clean_lower)
    if not words:
        return "neutral", 50.0

    pos_score = 0.0
    neg_score = 0.0
    has_contrast = any(w in CONTRASTIVE_WORDS for w in words)

    # Check multi-word positive/negative phrases
    for phrase in ["paisa vasool", "bahut fast", "ekdum best", "thoda high", "late aavyo", "nathi saru", "best che", "saru che"]:
        if phrase in clean_lower:
            if phrase in ("paisa vasool", "bahut fast", "ekdum best", "best che", "saru che"):
                pos_score += 2.0
            else:
                neg_score += 2.0

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
                neg_score += 1.2 * multiplier
            else:
                pos_score += 1.2 * multiplier
        elif word in NEGATIVE_WORDS:
            if is_negated:
                pos_score += 0.9 * multiplier
            else:
                neg_score += 1.2 * multiplier

    # If review has both distinct positive and negative aspects, especially with contrastive conjunction
    if pos_score >= 1.0 and neg_score >= 1.0:
        if has_contrast or abs(pos_score - neg_score) <= 1.5:
            # Continuous score around middle ~50
            net = (pos_score - neg_score) / (pos_score + neg_score)
            mixed_score = round(50.0 + (net * 15.0), 1)
            return "mixed", mixed_score

    net_score = pos_score - neg_score
    total_matches = pos_score + neg_score

    if total_matches == 0:
        return "neutral", 50.0

    scaled_diff = max(-1.0, min(1.0, net_score / (total_matches + 1)))
    raw_score = 50.0 + (scaled_diff * 40.0)
    score = round(max(5.0, min(95.0, raw_score)), 1)

    if score >= 58.0:
        label = "positive"
    elif score <= 42.0:
        label = "negative"
    else:
        label = "neutral"

    return label, score


def analyze_batch(texts: list[str]) -> list[tuple[str, float]]:
    """Batch sentiment analysis."""
    return [analyze_text(t) for t in texts]


analyze_multilingual_sentiment = analyze_text


