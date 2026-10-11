import sys
import logging
from app.database import SessionLocal
from app.models.brand import Brand
from app.services.crisis_service import calculate_crisis_score
from app.services.root_cause_service import calculate_root_cause

logging.basicConfig(level=logging.INFO)

def test_phase1():
    db = SessionLocal()
    try:
        brands = db.query(Brand).all()
        print(f"Testing Phase 1 services on {len(brands)} brands...")
        for b in brands:
            c = calculate_crisis_score(db, b.id)
            rc = calculate_root_cause(db, b.id)
            print(f"\nBrand: {b.name} ({b.id})")
            print(f"  Crisis Score: {c['crisis_score']} | Severity: {c['severity']} | Status: {c['status']}")
            print(f"  Main Reason: {c['main_reason']}")
            print(f"  Root Cause Overall Delta: {rc['overall_change']}% | Primary: {rc['primary_cause']}")
            print(f"  Causes count: {len(rc['causes'])}")

            assert "crisis_score" in c
            assert c["severity"] in ("SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL")
            assert "causes" in rc
        print("\nPHASE 1 BACKEND VERIFICATION SUCCESSFUL!")
    finally:
        db.close()

if __name__ == "__main__":
    test_phase1()
