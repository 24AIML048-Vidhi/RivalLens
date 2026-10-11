"""
Language Detection and Text Normalization Service
Handles English, Hindi (Devanagari & Romanized), Gujarati (Gujarati script & Romanized),
and Hinglish / Code-mixed social review comments.
"""

import re
import unicodedata

# Common Romanized Hindi / Hinglish vocabulary tokens
HINGLISH_KEYWORDS = {
    "bahut", "bohot", "bahot", "bahu", "achha", "accha", "acha", "bura", "thoda", "thodi",
    "mast", "bekar", "bakwas", "bkwash", "yaar", "kaisa", "kaisi", "nahi", "nhi", "nahin",
    "hota", "hoti", "gaya", "gayi", "badhiya", "badiya", "karo", "kare", "karna", "sahi",
    "ekdum", "ekdam", "ekdm", "hai", "hain", "tha", "thi", "the", "wala", "wali", "wale",
    "bhai", "kya", "bhi", "toh", "to", "lekin", "parantu", "par", "dhansu", "zabardast",
    "lajawab", "paisa", "vasool", "barbaad", "lut", "loot", "chor", "dhokha", "ghatiya",
    "fatafat", "jaldi", "samay", "mehenga", "mahnga", "sasta", "tuta", "khush", "pareshan",
    "faltu", "chal", "chalta", "chalti", "kuch", "kuchh", "aisa", "aisi", "waise", "aaj",
    "kal", "shandar", "shandaar", "tagda", "gazab", "bawal", "jhakaas", "kamal"
}

# Common Romanized Gujarati vocabulary tokens
GUJARATI_ROMAN_KEYWORDS = {
    "che", "chhe", "nathi", "nthi", "saras", "aavyo", "aavi", "kem", "su", "shu",
    "majama", "maja", "bahu", "saroj", "vadhare", "khotu", "khrab", "kharab",
    "pan", "mane", "tamne", "aapde", "joiye", "aavse", "karyu", "didhu", "lidhu"
}

# Slang and spelling normalization map
SPELLING_NORMALIZATIONS = {
    r"\b(bohot|bahot|bahuuut|bahoot)\b": "bahut",
    r"\b(ekdm|ekdam)\b": "ekdum",
    r"\b(accha|acha|achaa)\b": "achha",
    r"\b(plzz+|plz|pls)\b": "please",
    r"\b(bkwash|bakwass+)\b": "bakwas",
    r"\b(badiya|badia)\b": "badhiya",
    r"\b(thnx|tysm|thx)\b": "thank you",
    r"\b(nhi|nhn)\b": "nahi",
    r"\b(chhe)\b": "che",
    r"\b(shandaar)\b": "shandar",
    r"\b(mahnga|mehnga)\b": "mehenga",
    r"\b(yrr|yaaar)\b": "yaar",
    r"\b(vry|veri)\b": "very",
    r"\b(gud|gd)\b": "good",
    r"\b(gr8)\b": "great",
    r"\b(awsm|awesom)\b": "awesome",
}

# Regular expressions for scripts
DEVANAGARI_REGEX = re.compile(r"[\u0900-\u097F]")
GUJARATI_SCRIPT_REGEX = re.compile(r"[\u0A80-\u0AFF]")
LATIN_REGEX = re.compile(r"[a-zA-Z]")


def normalize_text(text: str) -> str:
    """
    Normalizes informal review text:
    - Normalizes unicode characters.
    - Reduces repeated elongated letters (e.g., 'sooooo' -> 'so', 'fastttt' -> 'fast').
    - Maps common informal / Hinglish spelling shortcuts to standard tokens.
    - Strips excess whitespace.
    """
    if not text:
        return ""

    # 1. Normalize unicode
    normalized = unicodedata.normalize("NFKC", text)

    # 2. Reduce excessive character elongations (3+ repeated characters down to max 2)
    normalized = re.sub(r"(.)\1{2,}", r"\1\1", normalized)

    # 3. Apply common informal spelling replacements
    for pattern, replacement in SPELLING_NORMALIZATIONS.items():
        normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)

    # 4. Collapse whitespace
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def detect_language(text: str) -> tuple[str, list[str]]:
    """
    Detects language and scripts present in the review.
    Returns:
      (primary_language, list_of_detected_languages)
      where primary_language is one of: "English", "Hindi", "Gujarati", "Hinglish", "Mixed"
      and list_of_detected_languages contains codes: ["en", "hi", "gu"]
    """
    if not text or not text.strip():
        return "English", ["en"]

    clean = text.strip()
    detected_codes: set[str] = set()

    # Script-level checks
    has_devanagari = bool(DEVANAGARI_REGEX.search(clean))
    has_gujarati_script = bool(GUJARATI_SCRIPT_REGEX.search(clean))
    has_latin = bool(LATIN_REGEX.search(clean))

    if has_devanagari:
        detected_codes.add("hi")
    if has_gujarati_script:
        detected_codes.add("gu")
    if has_latin:
        detected_codes.add("en")

    # If native scripts are dominant without latin
    if has_devanagari and not has_latin:
        return "Hindi", ["hi"]
    if has_gujarati_script and not has_latin:
        return "Gujarati", ["gu"]

    # If Latin script is present, analyze tokens for code-mixed / Hinglish / Romanized Gujarati
    words = re.findall(r"\b[a-z']+\b", clean.lower())
    if not words:
        if has_devanagari:
            return "Hindi", ["hi"]
        if has_gujarati_script:
            return "Gujarati", ["gu"]
        return "English", ["en"]

    total_words = len(words)
    hinglish_matches = sum(1 for w in words if w in HINGLISH_KEYWORDS)
    gujarati_matches = sum(1 for w in words if w in GUJARATI_ROMAN_KEYWORDS)

    # Check for Gujarati indicators (e.g. "che", "nathi", "saras", "aavyo")
    if gujarati_matches >= 1 or has_gujarati_script:
        detected_codes.add("gu")
        if total_words > 0 and (gujarati_matches / total_words >= 0.15 or gujarati_matches >= 2):
            return "Gujarati", sorted(list(detected_codes))
        elif gujarati_matches >= 1 and hinglish_matches >= 1:
            return "Mixed", sorted(list(detected_codes))

    # Check for Hinglish / Romanized Hindi indicators
    if hinglish_matches >= 1 or has_devanagari:
        detected_codes.add("hi")
        # If there are Hinglish words mixed with English
        if total_words > 0 and (hinglish_matches / total_words >= 0.15 or hinglish_matches >= 2 or has_devanagari):
            return "Hinglish", sorted(list(detected_codes))
        elif hinglish_matches >= 1:
            return "Hinglish", sorted(list(detected_codes))

    if len(detected_codes) > 1:
        return "Mixed", sorted(list(detected_codes))

    return "English", ["en"]
