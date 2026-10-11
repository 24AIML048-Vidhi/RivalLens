"""
Mention Service
Handles querying, filtering, manual creation, quality assessment, and deletion of brand mentions.
"""

from datetime import datetime
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.schemas.mention import MentionCreate, MentionOut, MentionListResponse
from app.services.sentiment_service import analyze_text
from app.nlp.aspects import extract_aspect
from app.services.language_detection import detect_language, normalize_text
from app.services.duplicate_detection import check_and_group_new_mention
from app.services.review_quality import calculate_spam_score
from app.services.brand_service import recompute_brand_rollup
from app.utils.time_format import relative_time


def get_mentions(
    db: Session,
    brand_id: str | None = None,
    sentiment: str | None = None,
    source: str | None = None,
    query_text: str | None = None,
    status: str | None = None,
    language: str | None = None,
    duplicates: str | None = None,
    limit: int = 50,
    offset: int = 0
) -> MentionListResponse:
    query = db.query(Mention)

    if brand_id:
        query = query.filter(Mention.brand_id == brand_id)
    if sentiment and sentiment.lower() != "all":
        query = query.filter(func.lower(Mention.sentiment_label) == sentiment.lower())
    if source and source.lower() != "all":
        query = query.filter(func.lower(Mention.source) == source.lower())
    if status and status.lower() != "all":
        query = query.filter(func.lower(Mention.review_status) == status.lower())
    if language and language.lower() != "all":
        query = query.filter(func.lower(Mention.language) == language.lower())

    if duplicates == "unique_only":
        query = query.filter(Mention.is_duplicate.is_(False))
    elif duplicates == "duplicates_only":
        query = query.filter(Mention.is_duplicate.is_(True))

    if query_text and query_text.strip():
        search = f"%{query_text.strip()}%"
        query = query.filter(
            or_(
                Mention.text.ilike(search),
                Mention.original_text.ilike(search),
                Mention.normalized_text.ilike(search),
                Mention.author.ilike(search)
            )
        )

    # Calculate overall counts for quality dashboard metrics
    base_count_query = db.query(Mention)
    if brand_id:
        base_count_query = base_count_query.filter(Mention.brand_id == brand_id)

    total_all = base_count_query.count()
    unique_count = base_count_query.filter(Mention.is_duplicate.is_(False)).count()
    dup_count = base_count_query.filter(Mention.is_duplicate.is_(True)).count()
    suspicious_count = base_count_query.filter(func.lower(Mention.review_status) == "suspicious").count()
    spam_count = base_count_query.filter(func.lower(Mention.review_status) == "spam").count()

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
        offset=offset,
        uniqueCount=unique_count,
        duplicateCount=dup_count,
        suspiciousCount=suspicious_count,
        spamCount=spam_count,
    )


def create_mention(
    db: Session,
    payload: MentionCreate
) -> MentionOut:
    raw_text = payload.text.strip()

    # 1. Language Detection & Text Normalization
    lang, detected_codes = detect_language(raw_text)
    norm_text = normalize_text(raw_text)

    # 2. Duplicate Detection
    is_dup, dup_group_id, dup_count = check_and_group_new_mention(db, payload.brand_id, raw_text)

    # 3. Spam & Review Quality Scoring
    spam_score, review_status, _ = calculate_spam_score(
        text=raw_text,
        author=payload.author,
        is_duplicate=is_dup,
        dup_count=dup_count
    )

    # Override if payload explicitly provided
    if payload.review_status:
        review_status = payload.review_status
    if payload.spam_score is not None:
        spam_score = payload.spam_score
    if payload.language:
        lang = payload.language

    # 4. Sentiment Analysis
    if not payload.sentiment_label or payload.sentiment_score is None:
        sentiment_label, sentiment_score = analyze_text(norm_text)
    else:
        sentiment_label = payload.sentiment_label
        sentiment_score = payload.sentiment_score

    # 5. Aspect Extraction
    aspect = payload.aspect or extract_aspect(norm_text)

    # 6. Create record
    mention = Mention(
        brand_id=payload.brand_id,
        source=payload.source or "manual",
        author=payload.author or "User Feedback",
        text=raw_text,
        original_text=raw_text,
        normalized_text=norm_text,
        url=payload.url,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        aspect=aspect,
        spam_score=spam_score,
        review_status=review_status,
        is_duplicate=is_dup,
        duplicate_group_id=dup_group_id,
        duplicate_count=dup_count,
        language=lang,
        detected_languages=",".join(detected_codes),
        posted_at=datetime.utcnow(),
    )

    db.add(mention)
    db.commit()
    db.refresh(mention)

    # 7. Recompute brand statistics (using unique reviews)
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

