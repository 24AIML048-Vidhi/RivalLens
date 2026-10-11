"""
Analytics Service
Generates deep analytics across mentions, sentiments, sources, aspects, and historical trends.
Filters duplicates so duplicate/spam chatter does not inflate sentiment, mention counts, or aspect metrics.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.schemas.analytics import (
    AnalyticsResponse,
    SentimentDistribution,
    SourceBreakdown,
    TopicItem,
)
from app.schemas.brand import AspectBreakdown, TrendPoint
from app.services.brand_service import _format_day


def get_review_quality_stats(
    db: Session,
    brand_id: str | None = None
) -> dict:
    """
    Calculates review quality filtering metadata:
    - total_reviews
    - unique_reviews
    - duplicate_reviews
    - suspicious_reviews
    - spam_reviews
    - genuine_reviews
    - languages distribution
    """
    query = db.query(Mention)
    if brand_id:
        query = query.filter(Mention.brand_id == brand_id)

    all_mentions = query.all()
    total = len(all_mentions)
    
    unique_count = sum(1 for m in all_mentions if not m.is_duplicate)
    dup_count = sum(1 for m in all_mentions if m.is_duplicate)
    
    suspicious_count = sum(1 for m in all_mentions if (m.review_status or "").lower() == "suspicious")
    spam_count = sum(1 for m in all_mentions if (m.review_status or "").lower() == "spam")
    genuine_count = sum(1 for m in all_mentions if (m.review_status or "").lower() == "genuine" or not m.review_status)

    lang_counts = defaultdict(int)
    for m in all_mentions:
        lang = m.language or "English"
        lang_counts[lang] += 1

    return {
        "total_reviews": total,
        "unique_reviews": unique_count,
        "duplicate_reviews": dup_count,
        "suspicious_reviews": suspicious_count,
        "spam_reviews": spam_count,
        "genuine_reviews": genuine_count,
        "languages": dict(lang_counts),
    }


def get_brand_analytics(
    db: Session,
    brand_id: str | None = None,
    days: int | None = None
) -> AnalyticsResponse:
    query = db.query(Mention)
    brand_name = None

    if brand_id:
        query = query.filter(Mention.brand_id == brand_id)
        brand = db.query(Brand).filter(Brand.id == brand_id).first()
        if brand:
            brand_name = brand.name

    if days is not None and days > 0:
        since = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Mention.posted_at >= since)

    all_mentions = query.all()
    total_reviews = len(all_mentions)

    # Review quality breakdown
    quality_stats = get_review_quality_stats(db, brand_id=brand_id)

    # Core analytics calculated on UNIQUE reviews to avoid duplicate bot distortion
    unique_mentions = [m for m in all_mentions if not m.is_duplicate]
    if not unique_mentions and all_mentions:
        unique_mentions = all_mentions

    total_unique = len(unique_mentions)

    if total_unique == 0:
        return AnalyticsResponse(
            brandId=brand_id,
            brandName=brand_name,
            totalMentions=0,
            averageSentiment=50.0,
            sentimentDistribution=SentimentDistribution(),
            sourceBreakdown=[],
            aspects=[],
            trend=[],
            topTopics=[],
            totalReviews=quality_stats["total_reviews"],
            uniqueReviews=quality_stats["unique_reviews"],
            duplicateReviews=quality_stats["duplicate_reviews"],
            suspiciousReviews=quality_stats["suspicious_reviews"],
            spamReviews=quality_stats["spam_reviews"],
            genuineReviews=quality_stats["genuine_reviews"],
            languages=quality_stats["languages"],
        )

    # 1. Sentiment Distribution (on unique reviews)
    pos_count = sum(1 for m in unique_mentions if (m.sentiment_label or "").lower() == "positive")
    neg_count = sum(1 for m in unique_mentions if (m.sentiment_label or "").lower() == "negative")
    mixed_count = sum(1 for m in unique_mentions if (m.sentiment_label or "").lower() == "mixed")
    neu_count = sum(1 for m in unique_mentions if (m.sentiment_label or "").lower() == "neutral" or not m.sentiment_label)

    sentiment_dist = SentimentDistribution(
        positive=pos_count,
        negative=neg_count,
        neutral=neu_count,
        mixed=mixed_count,
        positivePct=round(pos_count / total_unique * 100, 1) if total_unique > 0 else 0.0,
        negativePct=round(neg_count / total_unique * 100, 1) if total_unique > 0 else 0.0,
        neutralPct=round(neu_count / total_unique * 100, 1) if total_unique > 0 else 0.0,
        mixedPct=round(mixed_count / total_unique * 100, 1) if total_unique > 0 else 0.0,
    )

    scored = [m.sentiment_score for m in unique_mentions if m.sentiment_score is not None]
    avg_sentiment = round(sum(scored) / len(scored), 1) if scored else 50.0

    # 2. Source Breakdown (on unique reviews)
    source_counts = defaultdict(int)
    for m in unique_mentions:
        src = (m.source or "web").lower()
        source_counts[src] += 1

    source_breakdown = [
        SourceBreakdown(
            source=src.capitalize(),
            count=cnt,
            percentage=round(cnt / total_unique * 100, 1) if total_unique > 0 else 0.0,
        )
        for src, cnt in source_counts.items()
    ]

    # 3. Aspects Breakdown (on unique reviews)
    aspect_sentiment = defaultdict(lambda: {"positive": 0, "negative": 0, "neutral": 0, "mixed": 0})
    for m in unique_mentions:
        if m.aspect:
            lbl = (m.sentiment_label or "neutral").lower()
            if lbl not in ("positive", "negative", "neutral", "mixed"):
                lbl = "neutral"
            aspect_sentiment[m.aspect][lbl] += 1

    aspects_list = []
    topics_list = []
    for aspect, counts in aspect_sentiment.items():
        asp_total = sum(counts.values()) or 1
        pos_p = round(counts["positive"] / asp_total * 100, 1)
        neg_p = round(counts["negative"] / asp_total * 100, 1)
        neu_p = round((counts["neutral"] + counts["mixed"]) / asp_total * 100, 1)

        aspects_list.append(
            AspectBreakdown(
                aspect=aspect,
                positive=pos_p,
                negative=neg_p,
                neutral=neu_p,
                mentionCount=asp_total,
            )
        )

        asp_score = round(50 + (pos_p - neg_p) * 0.4, 1)
        lbl = "Positive" if asp_score >= 58 else ("Negative" if asp_score <= 42 else "Neutral")
        topics_list.append(
            TopicItem(
                topic=aspect,
                count=asp_total,
                sentimentScore=asp_score,
                sentimentLabel=lbl,
            )
        )

    aspects_list.sort(key=lambda a: a.mentionCount, reverse=True)
    topics_list.sort(key=lambda t: t.count, reverse=True)

    # 4. Trend (on unique reviews)
    trend_query = (
        db.query(
            func.date(Mention.posted_at).label("day"),
            func.avg(Mention.sentiment_score).label("avg_score"),
            func.count(Mention.id).label("cnt"),
            func.sum(case((Mention.sentiment_label == "positive", 1), else_=0)).label("pos"),
            func.sum(case((Mention.sentiment_label == "negative", 1), else_=0)).label("neg"),
            func.sum(case((Mention.sentiment_label == "neutral", 1), else_=0)).label("neu"),
        )
        .filter(Mention.posted_at.isnot(None))
        .filter(Mention.is_duplicate.is_(False))
    )
    if brand_id:
        trend_query = trend_query.filter(Mention.brand_id == brand_id)
    if days is not None and days > 0:
        since = datetime.utcnow() - timedelta(days=days)
        trend_query = trend_query.filter(Mention.posted_at >= since)

    trend_rows = trend_query.group_by("day").order_by("day").all()

    trend_points = [
        TrendPoint(
            date=_format_day(row.day),
            score=round(float(row.avg_score or 50.0), 1),
            mentionCount=int(row.cnt or 0),
            positiveCount=int(row.pos or 0),
            negativeCount=int(row.neg or 0),
            neutralCount=int(row.neu or 0),
        )
        for row in trend_rows
    ]

    return AnalyticsResponse(
        brandId=brand_id,
        brandName=brand_name,
        totalMentions=total_unique,
        averageSentiment=avg_sentiment,
        sentimentDistribution=sentiment_dist,
        sourceBreakdown=source_breakdown,
        aspects=aspects_list,
        trend=trend_points,
        topTopics=topics_list,
        totalReviews=quality_stats["total_reviews"],
        uniqueReviews=quality_stats["unique_reviews"],
        duplicateReviews=quality_stats["duplicate_reviews"],
        suspiciousReviews=quality_stats["suspicious_reviews"],
        spamReviews=quality_stats["spam_reviews"],
        genuineReviews=quality_stats["genuine_reviews"],
        languages=quality_stats["languages"],
    )


# Alias for backwards compatibility
get_analytics = get_brand_analytics

