import sys
import logging
from app.database import SessionLocal
from app.models.brand import Brand
from app.services.forecast_service import calculate_7day_forecast
from app.services.competitive_service import calculate_competitive_insights

logging.basicConfig(level=logging.INFO)

def test_phase2():
    db = SessionLocal()
    try:
        brands = db.query(Brand).all()
        print(f"Testing Phase 2 services on {len(brands)} brands...")
        for b in brands:
            fc = calculate_7day_forecast(db, b.id)
            ci = calculate_competitive_insights(db, b.id)
            print(f"\nBrand: {b.name} ({b.id})")
            print(f"  Current Sentiment: {fc['current_sentiment']} | Predicted: {fc['predicted_sentiment']} | Delta: {fc['expected_change']} pts")
            print(f"  Forecast Days: {len(fc['forecast'])}")
            print(f"  SOV Count: {len(ci['share_of_voice'])} | Strengths: {len(ci['strengths'])} | Weaknesses: {len(ci['weaknesses'])} | Opps: {len(ci['opportunities'])}")

            assert "forecast" in fc
            assert len(fc["forecast"]) == 7
            assert "share_of_voice" in ci
            assert "strengths" in ci
        print("\nPHASE 2 BACKEND VERIFICATION SUCCESSFUL!")
    finally:
        db.close()

if __name__ == "__main__":
    test_phase2()
