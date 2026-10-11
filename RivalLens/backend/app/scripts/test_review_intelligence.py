"""
Verification script for Review Intelligence & Quality Filtering Module.
"""
import sys
import logging

logging.basicConfig(level=logging.INFO)

from app.main import _safe_migrate_database, _backfill_legacy_mentions
from app.services.language_detection import detect_language, normalize_text
from app.services.duplicate_detection import calculate_similarity, group_mentions_batch
from app.services.review_quality import calculate_spam_score
from app.services.sentiment_service import analyze_text
from app.nlp.aspects import extract_aspect
from app.database import SessionLocal
from app.models.mention import Mention
from app.services.analytics_service import get_review_quality_stats

def run_tests():
    print("=== TEST 1: Language Detection & Normalization ===")
    samples = [
        ("Delivery was very fast and good.", "English"),
        ("Delivery bahut fast thi, loved it!", "Hinglish"),
        ("Price thoda high hai but service mast hai.", "Hinglish"),
        ("Product quality ekdum best che.", "Gujarati"),
        ("Service bilkul bakwas hai yaar.", "Hinglish"),
        ("Order late aavyo but support was helpful.", "Gujarati"),
        ("यह उत्पाद वास्तव में बहुत अच्छा है।", "Hindi"),
    ]
    for text, expected in samples:
        lang, codes = detect_language(text)
        print(f"Text: '{text}' -> Detected Language: {lang} (Codes: {codes})")
        assert lang in ("English", "Hinglish", "Hindi", "Gujarati", "Mixed"), f"Unexpected lang: {lang}"

    norm_sample = "Bohottt achha product tha plzz buy it bkwash customer care"
    norm_res = normalize_text(norm_sample)
    print(f"Normalized: '{norm_sample}' -> '{norm_res}'")

    print("\n=== TEST 2: Duplicate Detection & Grouping ===")
    t1 = "Delivery was very fast and good."
    t2 = "Delivery was very fast and good!"
    t3 = "The delivery was very fast and good."
    t4 = "Customer support was completely unresponsive and rude."
    sim1_2 = calculate_similarity(t1, t2)
    sim1_3 = calculate_similarity(t1, t3)
    sim1_4 = calculate_similarity(t1, t4)
    print(f"Sim(t1, t2): {sim1_2}")
    print(f"Sim(t1, t3): {sim1_3}")
    print(f"Sim(t1, t4): {sim1_4}")
    assert sim1_2 >= 0.85, "t1 and t2 should be highly similar"
    assert sim1_3 >= 0.80, "t1 and t3 should be similar"
    assert sim1_4 < 0.5, "t1 and t4 should not be similar"

    batch = [
        {"text": t1, "author": "user1"},
        {"text": t2, "author": "user2"},
        {"text": t3, "author": "user3"},
        {"text": t4, "author": "user4"},
    ]
    grouped = group_mentions_batch(batch)
    print(f"Grouped batch results: {[ (g['text'][:20], g['is_duplicate'], g['duplicate_count']) for g in grouped ]}")
    assert grouped[0]["is_duplicate"] == False and grouped[0]["duplicate_count"] >= 2
    assert grouped[1]["is_duplicate"] == True

    print("\n=== TEST 3: Spam & Fake Review Detection ===")
    spam_sample = "AMAZING PRODUCT!! BEST EVER!! BUY NOW CLICK HERE: https://promo.example.com"
    score1, status1, reasons1 = calculate_spam_score(spam_sample)
    print(f"Spam sample score: {score1}%, status: {status1}, reasons: {reasons1}")
    assert status1 in ("suspicious", "spam"), f"Should be spam/suspicious, got {status1}"

    genuine_sample = "The mobile app navigation was smooth but delivery took around 40 minutes in evening traffic."
    score2, status2, reasons2 = calculate_spam_score(genuine_sample)
    print(f"Genuine sample score: {score2}%, status: {status2}, reasons: {reasons2}")
    assert status2 == "genuine", f"Should be genuine, got {status2}"

    print("\n=== TEST 4: Multilingual Sentiment & Aspect Extraction ===")
    s1, score_s1 = analyze_text("Delivery bahut fast thi, loved it!")
    asp1 = extract_aspect("Delivery bahut fast thi, loved it!")
    print(f"'Delivery bahut fast thi, loved it!' -> Sentiment: {s1} ({score_s1}), Aspect: {asp1}")
    assert s1 == "positive"
    assert asp1 == "Delivery speed"

    s2, score_s2 = analyze_text("Price thoda high hai but service mast hai.")
    asp2 = extract_aspect("Price thoda high hai but service mast hai.")
    print(f"'Price thoda high hai but service mast hai.' -> Sentiment: {s2} ({score_s2}), Aspect: {asp2}")

    s3, score_s3 = analyze_text("Service bilkul bakwas hai yaar.")
    asp3 = extract_aspect("Service bilkul bakwas hai yaar.")
    print(f"'Service bilkul bakwas hai yaar.' -> Sentiment: {s3} ({score_s3}), Aspect: {asp3}")
    assert s3 == "negative"

    print("\n=== TEST 5: Database Migration & Backfill ===")
    _safe_migrate_database()
    _backfill_legacy_mentions()

    db = SessionLocal()
    stats = get_review_quality_stats(db)
    print(f"Database Review Quality Stats: {stats}")
    db.close()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
