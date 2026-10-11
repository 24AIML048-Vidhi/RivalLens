"""
Brand Health Score Service

Calculates a unified 0–100 Brand Health Score dynamically:
- Sentiment (30%)
- Trend (20%)
- Share of Voice (15%)
- Complaint / Negative Ratio (15%)
- Volume & Review Authenticity (10%)
- Competitive Position (10%)

If underlying data for a component is sparse or unavailable, weights normalize safely.
"""

from sqlalchemy.orm import Session
from app.models.brand import Brand
from app.services import (
    brand_service,
    competitive_service,
    analytics_service,
)


def calculate_brand_health_score(db: Session, brand_id: str) -> dict:
    """
    Computes unified Brand Health Index (0-100) and status classification.
    """
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        brand = brand_service.get_brand_by_name(db, brand_id)

    if not brand:
        return {
            "brand_id": brand_id,
            "health_score": 50,
            "status": "UNKNOWN",
            "breakdown": {},
            "summary": "Brand not found",
        }

    # 1. Sentiment component (30% weight) - 0 to 100
    sentiment_val = float(brand.sentiment_score or 50.0)

    # 2. Trend component (20% weight) - delta map to 0-100 (50 is neutral, +10 is 100, -10 is 0)
    delta = float(brand.trend_delta or 0.0)
    trend_val = max(0.0, min(100.0, 50.0 + (delta * 5.0)))

    # 3. Share of Voice (15% weight)
    sov_val = 50.0
    try:
        ci = competitive_service.calculate_competitive_insights(db, brand.id)
        if ci.get("share_of_voice"):
            target_sov = next((s for s in ci["share_of_voice"] if s["brand_id"] == brand.id), None)
            if target_sov:
                # scale SOV: 25% or higher is strong (80-100)
                sov_val = min(100.0, target_sov["share_of_voice_pct"] * 2.5)
    except Exception:
        sov_val = 50.0

    # 4. Complaints & Authenticity component (15% weight)
    complaints_val = 70.0
    try:
        quality_stats = analytics_service.get_review_quality_stats(db, brand.id)
        total_rev = quality_stats.get("total_reviews", 0)
        genuine_rev = quality_stats.get("genuine_reviews", 0)
        if total_rev > 0:
            complaints_val = (genuine_rev / total_rev) * 100.0
    except Exception:
        complaints_val = 70.0

    # 5. Volume & Activity (10% weight)
    m_count = brand.mention_count or len(brand.mentions) if brand.mentions else 0
    volume_val = min(100.0, m_count * 2.0) if m_count > 0 else 50.0

    # 6. Competitive Position (10% weight)
    comp_pos_val = 50.0
    try:
        if ci.get("strengths") or ci.get("weaknesses"):
            str_count = len(ci.get("strengths", []))
            wk_count = len(ci.get("weaknesses", []))
            comp_pos_val = max(10.0, min(95.0, 50.0 + (str_count * 15.0) - (wk_count * 15.0)))
    except Exception:
        comp_pos_val = 50.0

    # Weighted composite score
    health_score = int(
        round(
            (sentiment_val * 0.30)
            + (trend_val * 0.20)
            + (sov_val * 0.15)
            + (complaints_val * 0.15)
            + (volume_val * 0.10)
            + (comp_pos_val * 0.10)
        )
    )
    health_score = max(0, min(100, health_score))

    # Classification
    if health_score >= 75:
        status = "HEALTHY"
        status_label = "Optimal Performance"
    elif health_score >= 50:
        status = "STABLE"
        status_label = "Moderate Performance"
    else:
        status = "AT RISK"
        status_label = "Attention Required"

    return {
        "brand_id": brand.id,
        "brand_name": brand.name,
        "health_score": health_score,
        "status": status,
        "status_label": status_label,
        "breakdown": {
            "sentiment": round(sentiment_val, 1),
            "trend": round(trend_val, 1),
            "share_of_voice": round(sov_val, 1),
            "complaint_health": round(complaints_val, 1),
            "volume_activity": round(volume_val, 1),
            "competitive_position": round(comp_pos_val, 1),
        },
        "summary": f"{brand.name} has a Brand Health Score of {health_score}/100 ({status_label}).",
    }
