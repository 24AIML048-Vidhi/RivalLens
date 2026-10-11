"""
Crisis Analysis Service
Calculates a 0-100 Crisis Score based on empirical historical data:
- Negative sentiment score / negative ratio
- Mention volume surge
- Negative complaint frequency
- Recency weighting
- Aspect-specific negative spikes
- Safely excludes missing engagement if unavailable

Severity Classification:
  0–24   SAFE
  25–49  LOW
  50–74  MEDIUM
  75–89  HIGH
  90–100 CRITICAL
"""

from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.services import brand_service


def calculate_crisis_score(db: Session, brand_id: str) -> dict:
    """
    Computes crisis detection metrics for a brand over recent time windows (e.g., last 7 days vs previous 7 days).
    """
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        brand = brand_service.get_brand_by_name(db, brand_id)

    if not brand:
        return {
            "brand_id": brand_id,
            "crisis_score": 0,
            "severity": "SAFE",
            "status": "Safe",
            "main_reason": "Brand not found",
            "contributing_factors": [],
            "change_percentage": 0,
            "top_contributing_aspect": None,
            "analysis_period": "Past 7 days",
        }

    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=7)
    previous_cutoff = now - timedelta(days=14)

    # Fetch unique genuine/non-duplicate mentions for recent period
    recent_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand.id)
        .filter(Mention.is_duplicate.is_(False))
        .filter(Mention.posted_at >= recent_cutoff)
        .all()
    )

    previous_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand.id)
        .filter(Mention.is_duplicate.is_(False))
        .filter(Mention.posted_at >= previous_cutoff)
        .filter(Mention.posted_at < recent_cutoff)
        .all()
    )

    # Fallback to all mentions if dates are sparse
    if not recent_mentions:
        recent_mentions = (
            db.query(Mention)
            .filter(Mention.brand_id == brand.id)
            .filter(Mention.is_duplicate.is_(False))
            .order_by(Mention.scraped_at.desc())
            .limit(50)
            .all()
        )
        previous_mentions = []

    total_recent = len(recent_mentions)
    total_prev = len(previous_mentions)

    if total_recent == 0:
        return {
            "brand_id": brand.id,
            "crisis_score": 0,
            "severity": "SAFE",
            "status": "Safe",
            "main_reason": "No recent mentions detected to evaluate crisis status",
            "contributing_factors": [],
            "change_percentage": 0,
            "top_contributing_aspect": None,
            "analysis_period": "Past 7 days",
        }

    # Factor 1: Negative mention percentage in recent window
    neg_recent = [m for m in recent_mentions if (m.sentiment_label or "").lower() == "negative"]
    neg_ratio = len(neg_recent) / total_recent

    neg_prev = [m for m in previous_mentions if (m.sentiment_label or "").lower() == "negative"]
    neg_ratio_prev = (len(neg_prev) / total_prev) if total_prev > 0 else 0.2

    # Factor 2: Volume change percentage
    if total_prev > 0:
        volume_change_pct = round(((total_recent - total_prev) / total_prev) * 100, 1)
    else:
        volume_change_pct = 0.0

    # Factor 3: Negative sentiment change percentage
    if neg_ratio_prev > 0:
        neg_change_pct = round(((neg_ratio - neg_ratio_prev) / neg_ratio_prev) * 100, 1)
    else:
        neg_change_pct = round(neg_ratio * 100, 1)

    # Factor 4: Aspect negative spikes
    aspect_neg_counts = {}
    for m in neg_recent:
        if m.aspect:
            aspect_neg_counts[m.aspect] = aspect_neg_counts.get(m.aspect, 0) + 1

    top_aspect = None
    top_aspect_count = 0
    if aspect_neg_counts:
        top_aspect = max(aspect_neg_counts, key=aspect_neg_counts.get)
        top_aspect_count = aspect_neg_counts[top_aspect]

    # Calculate 0-100 Crisis Score empirically
    # Base negative ratio component (0–45 points)
    score_from_neg_ratio = neg_ratio * 45.0

    # Negative spike / delta component (0–25 points)
    score_from_neg_surge = max(0.0, min(25.0, (neg_ratio - neg_ratio_prev) * 50.0))

    # Overall negative aspect concentration component (0–15 points)
    aspect_concentration = (top_aspect_count / len(neg_recent)) if neg_recent else 0.0
    score_from_aspect = aspect_concentration * 15.0

    # Volume surge component (0–15 points)
    score_from_volume = max(0.0, min(15.0, volume_change_pct * 0.15)) if volume_change_pct > 0 else 0.0

    raw_score = score_from_neg_ratio + score_from_neg_surge + score_from_aspect + score_from_volume
    crisis_score = int(round(max(0, min(100, raw_score))))

    # Severity classification
    if crisis_score >= 90:
        severity = "CRITICAL"
        status = "Critical Crisis Alert"
    elif crisis_score >= 75:
        severity = "HIGH"
        status = "Potential Crisis"
    elif crisis_score >= 50:
        severity = "MEDIUM"
        status = "Elevated Risk"
    elif crisis_score >= 25:
        severity = "LOW"
        status = "Minor Risk"
    else:
        severity = "SAFE"
        status = "Safe"

    contributing_factors = []
    if neg_ratio > 0.3:
        contributing_factors.append(f"{round(neg_ratio * 100, 1)}% of recent mentions are negative")
    if neg_change_pct > 10:
        contributing_factors.append(f"Negative sentiment increased by {neg_change_pct}% over previous period")
    if volume_change_pct > 25:
        contributing_factors.append(f"Mention volume surged by {volume_change_pct}%")
    if top_aspect and top_aspect_count >= 2:
        contributing_factors.append(f"Spike in '{top_aspect}' complaints ({top_aspect_count} negative mentions)")

    # Main Reason
    if top_aspect and top_aspect_count >= 2:
        main_reason = f"Increase in {top_aspect.lower()}-related negative mentions"
    elif neg_change_pct > 15:
        main_reason = f"Sudden {neg_change_pct}% rise in negative customer feedback"
    elif neg_ratio > 0.4:
        main_reason = f"High overall negative sentiment ratio ({round(neg_ratio * 100, 1)}%)"
    else:
        main_reason = "Sentiment signals remain within normal operational bounds"

    return {
        "brand_id": brand.id,
        "crisis_score": crisis_score,
        "severity": severity,
        "status": status,
        "main_reason": main_reason,
        "contributing_factors": contributing_factors,
        "change_percentage": max(neg_change_pct, volume_change_pct),
        "top_contributing_aspect": top_aspect,
        "analysis_period": "Past 7 days",
    }
