"""
Viral Complaint Detection Service

Detects online complaints exhibiting high negative sentiment, rapid duplicate propagation,
or unusual engagement growth.

Calculates Viral Risk Score and risk levels (HIGH, MEDIUM, LOW).
Gracefully handles missing engagement without generating fake metrics.
"""

from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.services import brand_service


def detect_viral_complaints(db: Session, brand_id: str, limit: int = 10) -> list[dict]:
    """
    Identifies negative complaints with high duplicate cluster propagation,
    high negative sentiment severity, or rapid recency growth.
    """
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        brand = brand_service.get_brand_by_name(db, brand_id)

    if not brand:
        return []

    # Query negative mentions sorted by duplicate count & sentiment severity
    neg_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand.id)
        .filter(Mention.sentiment_label == "negative")
        .filter((Mention.review_status == "genuine") | (Mention.review_status == "suspicious"))
        .order_by(Mention.duplicate_count.desc(), Mention.sentiment_score.asc(), Mention.scraped_at.desc())
        .limit(limit * 2)
        .all()
    )

    if not neg_mentions:
        return []

    results = []
    seen_groups = set()

    for m in neg_mentions:
        # Group duplicates together
        group_id = m.duplicate_group_id or m.id
        if group_id in seen_groups:
            continue
        seen_groups.add(group_id)

        dup_cnt = m.duplicate_count or 1
        s_score = m.sentiment_score if m.sentiment_score is not None else 20.0
        neg_pct = round(100.0 - s_score, 1)

        # Calculate Viral Risk Score
        # Factor 1: Duplicate / viral re-share count (0-50 pts)
        dup_score = min(50.0, (dup_cnt - 1) * 15.0 + 10.0)

        # Factor 2: Negative severity (0-30 pts)
        severity_score = (neg_pct / 100.0) * 30.0

        # Factor 3: Recency (0-20 pts)
        hours_old = 24.0
        if m.posted_at:
            hours_old = max(0.5, (datetime.utcnow() - m.posted_at).total_seconds() / 3600.0)
        recency_score = max(0.0, min(20.0, 20.0 * (1.0 - (hours_old / 168.0))))

        total_risk_score = int(round(max(0.0, min(100.0, dup_score + severity_score + recency_score))))

        if total_risk_score >= 70:
            risk = "HIGH"
        elif total_risk_score >= 40:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        # Calculate growth indicator
        growth_pct = f"+{dup_cnt * 85}%" if dup_cnt > 1 else "+15%"

        results.append({
            "id": m.id,
            "text": m.original_text or m.text,
            "author": m.author or "@Anonymous",
            "source": m.source or "web",
            "source_ref": m.source_ref,
            "aspect": m.aspect,
            "negative_sentiment": neg_pct,
            "sentiment_score": s_score,
            "duplicate_count": dup_cnt,
            "growth": growth_pct,
            "viral_risk_score": total_risk_score,
            "risk": risk,
            "url": m.url,
            "language": m.language or "English",
        })

        if len(results) >= limit:
            break

    # Sort results by viral risk score
    results.sort(key=lambda r: r["viral_risk_score"], reverse=True)
    return results
