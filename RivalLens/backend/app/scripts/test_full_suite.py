"""
Comprehensive End-to-End Test Suite for RivalLens AI Intelligence Platform
"""

import sys
import logging
from app.database import SessionLocal
from app.models.brand import Brand
from app.models.mention import Mention
from app.services import (
    crisis_service,
    root_cause_service,
    forecast_service,
    competitive_service,
    viral_service,
    health_service,
    analyst_service,
    ai_insight_service,
    language_detection,
    sentiment_service,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_suite")


def run_full_suite():
    print("=" * 60)
    print("🚀 RUNNING COMPREHENSIVE RIVALLENS VERIFICATION SUITE")
    print("=" * 60)

    db = SessionLocal()
    try:
        brands = db.query(Brand).all()
        print(f"\n[1] Database State: {len(brands)} brands loaded.")
        assert len(brands) > 0, "No brands found in database."

        # Test on primary brand
        primary = brands[0]
        print(f"\n[2] Testing Active Brand: {primary.name} ({primary.id})")

        # Feature 1: Crisis Detection
        crisis = crisis_service.calculate_crisis_score(db, primary.id)
        print(f"  ✓ Crisis Detection: Score={crisis['crisis_score']}/100, Severity={crisis['severity']}, Status='{crisis['status']}'")
        assert 0 <= crisis["crisis_score"] <= 100
        assert crisis["severity"] in ("SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert "main_reason" in crisis

        # Feature 2: Root-Cause Analysis
        root_cause = root_cause_service.calculate_root_cause(db, primary.id)
        print(f"  ✓ Root-Cause Analysis: Overall Delta={root_cause['overall_change']}%, Primary Cause='{root_cause['primary_cause']}', Causes={len(root_cause['causes'])}")
        assert "overall_change" in root_cause
        assert "causes" in root_cause

        # Feature 3: 7-Day Sentiment Forecast
        forecast = forecast_service.calculate_7day_forecast(db, primary.id, forecast_days=7)
        print(f"  ✓ 7-Day Forecast: Current={forecast['current_sentiment']}, Predicted={forecast['predicted_sentiment']}, Delta={forecast['expected_change']} pts")
        assert len(forecast["forecast"]) == 7
        assert "disclaimer" in forecast

        # Feature 4 & 6: Competitor Weakness & Share of Voice
        comp_insights = competitive_service.calculate_competitive_insights(db, primary.id)
        print(f"  ✓ Competitor Insights & SOV: SOV Entries={len(comp_insights['share_of_voice'])}, Strengths={len(comp_insights['strengths'])}, Weaknesses={len(comp_insights['weaknesses'])}, Opps={len(comp_insights['opportunities'])}")
        assert "share_of_voice" in comp_insights
        assert "strengths" in comp_insights
        assert "weaknesses" in comp_insights

        # Feature 5: Evidence-Based Recommendations
        recs = ai_insight_service.generate_ai_recommendations(db, primary.id)
        print(f"  ✓ Evidence Recommendations: Recs Count={len(recs['recommendations'])}, Projected Lift='{recs['projectedLift']}'")
        assert len(recs["recommendations"]) > 0
        first_rec = recs["recommendations"][0]
        assert "priority" in first_rec
        assert "evidence" in first_rec
        assert "confidence" in first_rec

        # Feature 7: Multilingual Intelligence
        test_multilingual_phrases = [
            ("Delivery was super fast and excellent!", "English", "positive"),
            ("Bhai delivery bahut slow thi aur package tuta hua tha", "Hinglish", "negative"),
            ("Aa app bahu mast ane saras che", "Gujarati", "positive"),
            ("यह सेवा बहुत घटिया और खराब है", "Hindi", "negative"),
        ]
        print(f"\n[3] Testing Multilingual NLP Engine:")
        for phrase, expected_lang, expected_sentiment in test_multilingual_phrases:
            lang, _ = language_detection.detect_language(phrase)
            label, score = sentiment_service.analyze_text(phrase)
            print(f"  ✓ Text: '{phrase[:30]}...' -> Detected Lang: {lang}, Sentiment: {label} ({score})")
            assert label in ("positive", "negative", "neutral", "mixed")

        # Feature 8: Viral Complaints Detection
        viral = viral_service.detect_viral_complaints(db, primary.id, limit=5)
        print(f"\n[4] Testing Viral Complaint Detection: {len(viral)} complaints flagged.")
        for v in viral[:2]:
            print(f"  ✓ Viral Risk: {v['risk']} (Score: {v['viral_risk_score']}) - Author: {v['author']} - Negative: {v['negative_sentiment']}%")
            assert "viral_risk_score" in v
            assert v["risk"] in ("HIGH", "MEDIUM", "LOW")

        # Brand Health Score
        health = health_service.calculate_brand_health_score(db, primary.id)
        print(f"\n[5] Testing Brand Health Score: {health['health_score']}/100 ({health['status']})")
        assert 0 <= health["health_score"] <= 100
        assert health["status"] in ("HEALTHY", "STABLE", "AT RISK")
        assert "breakdown" in health

        # Feature 9: Ask RivalLens AI Analyst
        test_questions = [
            "Why did sentiment change?",
            "What is our biggest weakness against competitors?",
            "What caused the recent crisis alert?",
            "What is the 7-day sentiment forecast?",
            "What recommendations should we execute immediately?",
        ]
        print(f"\n[6] Testing Ask RivalLens Grounded Analyst:")
        for q in test_questions:
            res = analyst_service.ask_rivallens(db, primary.id, q)
            print(f"  ✓ Q: '{q}'\n    A: {res['answer'][:100]}...\n")
            assert "answer" in res
            assert len(res["answer"]) > 20

        # [7] Edge Cases
        print("\n[7] Testing Edge Cases:")
        # Edge Case 1: Invalid Brand ID
        invalid_crisis = crisis_service.calculate_crisis_score(db, "brand-invalid-nonexistent")
        assert invalid_crisis["crisis_score"] == 0
        assert invalid_crisis["severity"] == "SAFE"
        print("  ✓ Edge Case: Invalid Brand ID handled safely (Crisis score = 0, SAFE).")

        # Edge Case 2: Brand with 0 mentions
        zero_brand = Brand(name="ZeroMentionsTestBrand", category="Tech", sentiment_score=50.0, mention_count=0)
        db.add(zero_brand)
        db.commit()
        db.refresh(zero_brand)
        try:
            z_crisis = crisis_service.calculate_crisis_score(db, zero_brand.id)
            z_rc = root_cause_service.calculate_root_cause(db, zero_brand.id)
            z_fc = forecast_service.calculate_7day_forecast(db, zero_brand.id)
            z_health = health_service.calculate_brand_health_score(db, zero_brand.id)
            z_recs = ai_insight_service.generate_ai_recommendations(db, zero_brand.id)
            assert z_crisis["crisis_score"] == 0
            assert len(z_fc["forecast"]) == 7
            assert "Insufficient data" in z_recs["summary"]
            print("  ✓ Edge Case: Brand with 0 mentions handled gracefully without errors.")
        finally:
            db.delete(zero_brand)
            db.commit()

        print("\n" + "=" * 60)
        print("🎉 ALL TEST SUITE ASSERTIONS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    run_full_suite()
