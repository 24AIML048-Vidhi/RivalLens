"""
Mention Service
Handles querying, filtering, manual creation, and deletion of brand mentions.
"""

from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.schemas.mention import MentionCreate, MentionOut, MentionListResponse
from app.services.sentiment_service import analyze_text
from app.nlp.aspects import extract_aspect
from app.services.brand_service import recompute_brand_rollup
from app.utils.time_format import relative_time


def get_mentions(
    db: Session,
    brand_id: str | None = None,
    sentiment: str | None = None,
    source: str | None = None,
    query_text: str | None = None,
    limit: int = 50,
    offset: int = 0
) -> MentionListResponse:
    query = db.query(Mention)

    if brand_id:
        query = query.filter(Mention.brand_id == brand_id)
    if sentiment:
        query = query.filter(func.lower(Mention.sentiment_label) == sentiment.lower())
    if source:
        query = query.filter(func.lower(Mention.source) == source.lower())
    if query_text and query_text.strip():
        search = f"%{query_text.strip()}%"
        query = query.filter(Mention.text.ilike(search))

    total = query.count()

    rows = (
        query
        .order_by(Mention.posted_at.desc(), Mention.scraped_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        MentionOut.from_orm_mention(
            m,
            relative_time(m.posted_at or m.scraped_at)
        )
        for m in rows
    ]

    return MentionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


def create_mention(
    db: Session,
    payload: MentionCreate
) -> MentionOut:
    # 1. Automatic sentiment analysis if not explicitly provided
    if not payload.sentiment_label or payload.sentiment_score is None:
        sentiment_label, sentiment_score = analyze_text(payload.text)
    else:
        sentiment_label = payload.sentiment_label
        sentiment_score = payload.sentiment_score

    # 2. Automatic aspect extraction if not provided
    aspect = payload.aspect or extract_aspect(payload.text)

    # 3. Create record
    mention = Mention(
        brand_id=payload.brand_id,
        source=payload.source or "manual",
        author=payload.author or "User Feedback",
        text=payload.text.strip(),
        url=payload.url,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        aspect=aspect,
        posted_at=datetime.utcnow(),
    )

    db.add(mention)
    db.commit()
    db.refresh(mention)

    # 4. Recompute brand statistics
    recompute_brand_rollup(db, payload.brand_id)

    brand = db.query(Brand).filter(Brand.id == payload.brand_id).first()
    brand_name = brand.name if brand else None

    return MentionOut.from_orm_mention(
        mention,
        relative_time(mention.posted_at),
        brand_name=brand_name
    )


def delete_mention(db: Session, mention_id: str) -> bool:
    mention = db.query(Mention).filter(Mention.id == mention_id).first()
    if not mention:
        return False

    brand_id = mention.brand_id
    db.delete(mention)
    db.commit()

    if brand_id:
        recompute_brand_rollup(db, brand_id)

    return True
