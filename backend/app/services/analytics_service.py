"""
Analytics Service
Generates deep analytics across mentions, sentiments, sources, aspects, and historical trends.
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


def get_analytics(
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

    mentions = query.all()
    total = len(mentions)

    if total == 0:
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
        )

    # 1. Sentiment Distribution
    pos_count = sum(1 for m in mentions if m.sentiment_label == "positive")
    neg_count = sum(1 for m in mentions if m.sentiment_label == "negative")
    neu_count = sum(1 for m in mentions if m.sentiment_label == "neutral" or not m.sentiment_label)

    sentiment_dist = SentimentDistribution(
        positive=pos_count,
        negative=neg_count,
        neutral=neu_count,
        positivePct=round(pos_count / total * 100, 1),
        negativePct=round(neg_count / total * 100, 1),
        neutralPct=round(neu_count / total * 100, 1),
    )

    scored = [m.sentiment_score for m in mentions if m.sentiment_score is not None]
    avg_sentiment = round(sum(scored) / len(scored), 1) if scored else 50.0

    # 2. Source Breakdown
    source_counts = defaultdict(int)
    for m in mentions:
        src = (m.source or "web").lower()
        source_counts[src] += 1

    source_breakdown = [
        SourceBreakdown(
            source=src.capitalize(),
            count=cnt,
            percentage=round(cnt / total * 100, 1),
        )
        for src, cnt in source_counts.items()
    ]

    # 3. Aspects Breakdown
    aspect_sentiment = defaultdict(lambda: {"positive": 0, "negative": 0, "neutral": 0})
    for m in mentions:
        if m.aspect:
            lbl = m.sentiment_label if m.sentiment_label in ("positive", "negative", "neutral") else "neutral"
            aspect_sentiment[m.aspect][lbl] += 1

    aspects_list = []
    topics_list = []
    for aspect, counts in aspect_sentiment.items():
        asp_total = sum(counts.values()) or 1
        pos_p = round(counts["positive"] / asp_total * 100, 1)
        neg_p = round(counts["negative"] / asp_total * 100, 1)
        neu_p = round(counts["neutral"] / asp_total * 100, 1)

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

    # 4. Trend
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
        totalMentions=total,
        averageSentiment=avg_sentiment,
        sentimentDistribution=sentiment_dist,
        sourceBreakdown=source_breakdown,
        aspects=aspects_list,
        trend=trend_points,
        topTopics=topics_list,
    )
