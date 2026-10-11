"""
Root-Cause Analysis Service
Determines the primary drivers for sentiment changes across brand aspects.
Reuses existing app.nlp.aspects logic to avoid duplicate NLP processing.
"""

from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.services import brand_service


def calculate_root_cause(db: Session, brand_id: str) -> dict:
    """
    Analyzes sentiment deltas per aspect across current vs previous time window to determine root causes.
    """
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        brand = brand_service.get_brand_by_name(db, brand_id)

    if not brand:
        return {
            "overall_change": 0.0,
            "primary_cause": "N/A",
            "causes": [],
        }

    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=7)
    previous_cutoff = now - timedelta(days=14)

    # Fetch unique mentions
    recent_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand.id)
        .filter(Mention.is_duplicate.is_(False))
        .filter(Mention.posted_at >= recent_cutoff)
        .all()
    )

    prev_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand.id)
        .filter(Mention.is_duplicate.is_(False))
        .filter(Mention.posted_at >= previous_cutoff)
        .filter(Mention.posted_at < recent_cutoff)
        .all()
    )

    if not recent_mentions:
        all_mentions = (
            db.query(Mention)
            .filter(Mention.brand_id == brand.id)
            .filter(Mention.is_duplicate.is_(False))
            .all()
        )
        mid = len(all_mentions) // 2
        recent_mentions = all_mentions[mid:] if mid > 0 else all_mentions
        prev_mentions = all_mentions[:mid] if mid > 0 else []

    # Overall sentiment average
    rec_scores = [m.sentiment_score for m in recent_mentions if m.sentiment_score is not None]
    prev_scores = [m.sentiment_score for m in prev_mentions if m.sentiment_score is not None]

    avg_rec = (sum(rec_scores) / len(rec_scores)) if rec_scores else (brand.sentiment_score or 50.0)
    avg_prev = (sum(prev_scores) / len(prev_scores)) if prev_scores else (brand.sentiment_score or 50.0)
    overall_change = round(avg_rec - avg_prev, 1)

    # Group mentions by aspect
    recent_aspect_map = {}
    for m in recent_mentions:
        asp = m.aspect or "General / Other"
        recent_aspect_map.setdefault(asp, []).append(m)

    prev_aspect_map = {}
    for m in prev_mentions:
        asp = m.aspect or "General / Other"
        prev_aspect_map.setdefault(asp, []).append(m)

    all_aspect_keys = set(recent_aspect_map.keys()) | set(prev_aspect_map.keys())
    aspect_stats = []

    total_negative_drop = 0.0

    for aspect in all_aspect_keys:
        rec_list = recent_aspect_map.get(aspect, [])
        prev_list = prev_aspect_map.get(aspect, [])

        m_count = len(rec_list)
        prev_count = len(prev_list)

        pos_c = sum(1 for m in rec_list if (m.sentiment_label or "").lower() == "positive")
        neg_c = sum(1 for m in rec_list if (m.sentiment_label or "").lower() == "negative")

        prev_pos_c = sum(1 for m in prev_list if (m.sentiment_label or "").lower() == "positive")
        prev_neg_c = sum(1 for m in prev_list if (m.sentiment_label or "").lower() == "negative")

        r_scores = [m.sentiment_score for m in rec_list if m.sentiment_score is not None]
        p_scores = [m.sentiment_score for m in prev_list if m.sentiment_score is not None]

        asp_score = round(sum(r_scores) / len(r_scores), 1) if r_scores else 50.0
        prev_asp_score = round(sum(p_scores) / len(p_scores), 1) if p_scores else 50.0

        sentiment_change = round(asp_score - prev_asp_score, 1)
        mention_change = round(((m_count - prev_count) / prev_count * 100), 1) if prev_count > 0 else (m_count * 10.0)

        neg_growth = (neg_c - prev_neg_c) if prev_count > 0 else neg_c
        drop_impact = max(0.0, -sentiment_change * m_count) + max(0.0, neg_growth * 5.0)
        total_negative_drop += drop_impact

        aspect_stats.append({
            "aspect": aspect,
            "mention_count": m_count,
            "positive_count": pos_c,
            "negative_count": neg_c,
            "sentiment_score": asp_score,
            "sentiment_change": sentiment_change,
            "mention_change": mention_change,
            "raw_impact": drop_impact,
        })

    # Calculate contribution percentage
    causes = []
    for stat in aspect_stats:
        if total_negative_drop > 0:
            contrib = round((stat["raw_impact"] / total_negative_drop) * 100)
        else:
            contrib = round(100 / max(1, len(aspect_stats)))

        causes.append({
            "aspect": stat["aspect"],
            "contribution": contrib,
            "sentiment_change": stat["sentiment_change"],
            "mention_change": stat["mention_change"],
            "mention_count": stat["mention_count"],
            "positive_count": stat["positive_count"],
            "negative_count": stat["negative_count"],
            "sentiment_score": stat["sentiment_score"],
        })

    causes.sort(key=lambda c: c["contribution"], reverse=True)
    primary_cause = causes[0]["aspect"] if causes else "None"

    return {
        "overall_change": overall_change,
        "primary_cause": primary_cause,
        "causes": causes,
    }
