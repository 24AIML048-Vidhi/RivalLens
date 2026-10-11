"""
Brand Service

Handles:
- Brand CRUD operations
- Competitor management
- Brand summaries
- Sentiment trends
- Aspect breakdowns
- Recent mentions
- Brand metric rollups

RivalLens competitor behavior:

An active brand can have selected competitors.

Example:

    Zomato
        ├── Swiggy
        └── Blinkit

The Comparison page should compare the active brand
only with its selected/saved competitors.

Other brands in the database are NOT automatically
included in the comparison.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, or_, case
from sqlalchemy.orm import Session

from app.models.brand import Brand, brand_competitors
from app.models.mention import Mention

from app.schemas.brand import (
    TrendPoint,
    AspectBreakdown,
    BrandSummary,
    BrandOut,
)

from app.schemas.mention import MentionOut
from app.utils.time_format import relative_time


# ============================================================
# GET ALL BRANDS
# ============================================================

def get_all_brands(
    db: Session,
    only_search_brands: bool = True,
) -> list[Brand]:
    """
    Return all tracked brands.
    If only_search_brands is True, returns only user-searched / primary brands.
    Ordered by newest brand first.
    """
    query = db.query(Brand)
    if only_search_brands:
        query = query.filter(Brand.is_search_brand.is_(True))

    return (
        query
        .order_by(
            Brand.created_at.desc()
        )
        .all()
    )


# ============================================================
# GET SINGLE BRAND
# ============================================================

def get_brand(
    db: Session,
    brand_id: str,
) -> Brand | None:
    """
    Return a single brand by ID.
    """

    if not brand_id:
        return None

    return (
        db.query(Brand)
        .filter(
            Brand.id == brand_id
        )
        .first()
    )


# ============================================================
# GET BRAND BY NAME
# ============================================================

def get_brand_by_name(
    db: Session,
    name: str,
) -> Brand | None:
    """
    Case-insensitive search by brand name.
    """

    if not name:
        return None

    clean_name = name.strip()

    if not clean_name:
        return None

    return (
        db.query(Brand)
        .filter(
            func.lower(Brand.name)
            == clean_name.lower()
        )
        .first()
    )


# ============================================================
# GET MULTIPLE BRANDS BY ID
# ============================================================

def get_brands_by_ids(
    db: Session,
    brand_ids: list[str],
) -> list[Brand]:
    """
    Return all brands whose ID is in `brand_ids`.
    """
    if not brand_ids:
        return []

    return (
        db.query(Brand)
        .filter(Brand.id.in_(brand_ids))
        .all()
    )


# ============================================================
# CREATE BRAND
# ============================================================

def create_brand(
    db: Session,
    name: str,
    category: str = "",
    competitor_names: list[str] | None = None,
    is_search_brand: bool = True,
) -> Brand:
    """
    Create a new brand or promote an existing competitor brand to search brand.

    competitor_names:
        Names of brands to save as competitors.
    """

    if not name:
        raise ValueError(
            "Brand name is required."
        )

    cleaned_name = name.strip()

    if not cleaned_name:
        raise ValueError(
            "Brand name cannot be empty."
        )

    # --------------------------------------------------------
    # Check for existing brand
    # --------------------------------------------------------

    existing = get_brand_by_name(
        db,
        cleaned_name,
    )

    if existing:
        if not existing.is_search_brand and is_search_brand:
            # Promote competitor-only brand to primary searched brand
            existing.is_search_brand = True
            if category and category.strip():
                existing.category = category.strip()
            db.commit()
            db.refresh(existing)
            if competitor_names:
                _set_competitors_by_names(
                    db=db,
                    brand=existing,
                    competitor_names=competitor_names,
                )
                db.commit()
                db.refresh(existing)
            return existing
        else:
            raise ValueError(
                f"Brand '{cleaned_name}' already exists."
            )

    # --------------------------------------------------------
    # Create brand
    # --------------------------------------------------------

    brand = Brand(
        name=cleaned_name,
        category=(
            category.strip()
            if category and category.strip()
            else "General"
        ),
        is_search_brand=is_search_brand,
        sentiment_score=50.0,
        mention_count=0,
        trend="flat",
        trend_delta=0.0,
    )

    db.add(brand)

    db.commit()
    db.refresh(brand)

    # --------------------------------------------------------
    # Save selected competitors
    # --------------------------------------------------------

    if competitor_names:

        _set_competitors_by_names(
            db=db,
            brand=brand,
            competitor_names=competitor_names,
        )

        db.commit()
        db.refresh(brand)

    return brand


# ============================================================
# SET COMPETITORS BY NAMES
# ============================================================

def _set_competitors_by_names(
    db: Session,
    brand: Brand,
    competitor_names: list[str],
) -> None:
    """
    Replace the current competitor list.

    Only existing brands are linked.

    Unknown competitor names are NOT automatically
    created as brands.

    The active brand can never be its own competitor.
    """

    # --------------------------------------------------------
    # Remove existing competitors
    # --------------------------------------------------------

    brand.competitors.clear()

    if not competitor_names:
        return

    # --------------------------------------------------------
    # Clean competitor names
    # --------------------------------------------------------

    clean_comps: list[str] = []
    seen: set[str] = set()

    for competitor_name in competitor_names:

        if not isinstance(
            competitor_name,
            str,
        ):
            continue

        clean_name = (
            competitor_name.strip()
        )

        if not clean_name:
            continue

        key = clean_name.lower()

        if key in seen:
            continue

        seen.add(key)

        clean_comps.append(
            clean_name
        )

    if not clean_comps:
        return

    # --------------------------------------------------------
    # Find existing brands or create missing competitors
    # --------------------------------------------------------

    filters = [
        func.lower(Brand.name)
        == competitor_name.lower()
        for competitor_name in clean_comps
    ]

    existing_competitors = (
        db.query(Brand)
        .filter(
            Brand.id != brand.id,
            or_(*filters),
        )
        .all()
    )

    existing_map = {c.name.lower(): c for c in existing_competitors}

    for comp_name in clean_comps:
        if comp_name.lower() == brand.name.lower():
            continue

        comp_brand = existing_map.get(comp_name.lower())
        if not comp_brand:
            # Create competitor brand in DB with is_search_brand=False
            comp_brand = Brand(
                name=comp_name,
                category=brand.category or "General",
                is_search_brand=False,
                sentiment_score=50.0,
                mention_count=0,
                trend="flat",
                trend_delta=0.0,
            )
            db.add(comp_brand)
            db.flush()
            existing_map[comp_name.lower()] = comp_brand

        if comp_brand.id != brand.id and not any(
            existing.id == comp_brand.id for existing in brand.competitors
        ):
            brand.competitors.append(comp_brand)


# ============================================================
# UPDATE BRAND
# ============================================================

def update_brand(
    db: Session,
    brand_id: str,
    name: str | None = None,
    category: str | None = None,
    competitor_names: list[str] | None = None,
) -> Brand | None:
    """
    Update an existing brand.

    If competitor_names is provided:
        Existing competitors are replaced.

    If competitor_names is None:
        Existing competitors remain unchanged.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return None

    # --------------------------------------------------------
    # Update name
    # --------------------------------------------------------

    if name is not None:

        clean_name = name.strip()

        if not clean_name:
            raise ValueError(
                "Brand name cannot be empty."
            )

        existing = get_brand_by_name(
            db,
            clean_name,
        )

        if (
            existing
            and existing.id != brand.id
        ):
            raise ValueError(
                f"Brand '{clean_name}' already exists."
            )

        brand.name = clean_name

    # --------------------------------------------------------
    # Update category
    # --------------------------------------------------------

    if category is not None:

        clean_category = (
            category.strip()
        )

        brand.category = (
            clean_category
            if clean_category
            else "General"
        )

    # --------------------------------------------------------
    # Update competitors
    # --------------------------------------------------------

    if competitor_names is not None:

        _set_competitors_by_names(
            db=db,
            brand=brand,
            competitor_names=competitor_names,
        )

    db.commit()
    db.refresh(brand)

    return brand


# ============================================================
# ADD COMPETITOR
# ============================================================

def add_competitor(
    db: Session,
    brand_id: str,
    competitor_id: str,
) -> Brand | None:
    """
    Add an existing brand as a competitor.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return None

    competitor = get_brand(
        db,
        competitor_id,
    )

    if not competitor:
        raise ValueError(
            "Competitor brand not found."
        )

    # --------------------------------------------------------
    # Prevent self-competition
    # --------------------------------------------------------

    if brand.id == competitor.id:
        raise ValueError(
            "A brand cannot be its own competitor."
        )

    # --------------------------------------------------------
    # Prevent duplicate competitor
    # --------------------------------------------------------

    already_exists = any(
        existing.id == competitor.id
        for existing in brand.competitors
    )

    if not already_exists:

        brand.competitors.append(
            competitor
        )

    db.commit()
    db.refresh(brand)

    return brand


# ============================================================
# REMOVE COMPETITOR
# ============================================================

def remove_competitor(
    db: Session,
    brand_id: str,
    competitor_id: str,
) -> Brand | None:
    """
    Remove a competitor relationship.

    The competitor brand itself is NOT deleted.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return None

    brand.competitors = [
        competitor
        for competitor in brand.competitors
        if competitor.id != competitor_id
    ]

    db.commit()
    db.refresh(brand)

    return brand


# ============================================================
# GET SAVED COMPETITORS
# ============================================================

def get_competitors(
    db: Session,
    brand_id: str,
) -> list[Brand]:
    """
    Return only competitors saved for the specified brand.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return []

    return [
        competitor
        for competitor in (
            brand.competitors or []
        )
        if competitor.id != brand.id
    ]


# ============================================================
# GET COMPETITOR IDS
# ============================================================

def get_competitor_ids(
    db: Session,
    brand_id: str,
) -> list[str]:
    """
    Return IDs of saved competitors.
    """

    competitors = get_competitors(
        db,
        brand_id,
    )

    return [
        competitor.id
        for competitor in competitors
    ]


# ============================================================
# DELETE BRAND
# ============================================================

def delete_brand(
    db: Session,
    brand_id: str,
) -> bool:
    """
    Delete a brand.

    Also removes:
    - outgoing competitor relationships
    - incoming competitor relationships
    - associated mentions
    - brand record
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return False

    # --------------------------------------------------------
    # Clear outgoing competitor relationships
    # --------------------------------------------------------

    brand.competitors = []

    db.flush()

    # --------------------------------------------------------
    # Clear incoming competitor relationships
    # --------------------------------------------------------

    db.execute(
        brand_competitors.delete().where(
            brand_competitors.c.competitor_id
            == brand_id
        )
    )

    # --------------------------------------------------------
    # Delete mentions
    # --------------------------------------------------------

    db.query(Mention).filter(
        Mention.brand_id == brand_id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # Delete brand
    # --------------------------------------------------------

    db.delete(brand)

    db.commit()

    return True


# ============================================================
# GET BRAND SUMMARY
# ============================================================

def get_brand_summary(
    db: Session,
    brand_id: str,
) -> BrandSummary | None:
    """
    Return complete summary information for a brand.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return None

    mentions = (
        db.query(Mention)
        .filter(
            Mention.brand_id == brand_id
        )
        .all()
    )

    total = len(mentions)

    # --------------------------------------------------------
    # Sentiment counts
    # --------------------------------------------------------

    pos_count = sum(
        1
        for mention in mentions
        if (
            mention.sentiment_label
            and mention.sentiment_label.lower()
            == "positive"
        )
    )

    neg_count = sum(
        1
        for mention in mentions
        if (
            mention.sentiment_label
            and mention.sentiment_label.lower()
            == "negative"
        )
    )

    neu_count = (
        total
        - pos_count
        - neg_count
    )

    # --------------------------------------------------------
    # Percentages
    # --------------------------------------------------------

    pos_pct = (
        round(
            pos_count
            / total
            * 100,
            1,
        )
        if total > 0
        else 0.0
    )

    neg_pct = (
        round(
            neg_count
            / total
            * 100,
            1,
        )
        if total > 0
        else 0.0
    )

    neu_pct = (
        round(
            neu_count
            / total
            * 100,
            1,
        )
        if total > 0
        else 0.0
    )

    # --------------------------------------------------------
    # Sentiment label
    # --------------------------------------------------------

    score = (
        brand.sentiment_score
        if brand.sentiment_score is not None
        else 50.0
    )

    if score >= 58.0:
        sentiment_label = "Positive"

    elif score <= 42.0:
        sentiment_label = "Negative"

    else:
        sentiment_label = "Neutral"

    # --------------------------------------------------------
    # Return schema object
    # --------------------------------------------------------

    return BrandSummary(
        id=brand.id,
        name=brand.name,
        category=brand.category,

        sentimentScore=round(
            score,
            1,
        ),

        sentimentLabel=sentiment_label,

        mentionCount=total,

        positiveMentions=pos_count,
        negativeMentions=neg_count,
        neutralMentions=neu_count,

        positivePct=pos_pct,
        negativePct=neg_pct,
        neutralPct=neu_pct,

        trend=(
            brand.trend
            or "flat"
        ),

        trendDelta=round(
            brand.trend_delta
            or 0.0,
            1,
        ),

        competitorCount=len(
            brand.competitors
            if brand.competitors
            else []
        ),
    )


# ============================================================
# GET TREND OVER TIME
# ============================================================

def get_trend(
    db: Session,
    brand_id: str,
    days: int | None = None,
) -> list[TrendPoint]:
    """
    Returns daily aggregated sentiment scores and
    mention counts.

    days=None
        All historical records.

    days=7
        Last 7 days.

    days=14
        Last 14 days.

    days=30
        Last 30 days.

    days=90
        Last 90 days.

    Any positive number is supported.
    """

    query = (
        db.query(
            func.date(
                Mention.posted_at
            ).label("day"),

            func.avg(
                Mention.sentiment_score
            ).label("avg_score"),

            func.count(
                Mention.id
            ).label("mention_count"),

            func.sum(
                case(
                    (
                        Mention.sentiment_label
                        == "positive",
                        1,
                    ),
                    else_=0,
                )
            ).label("pos_count"),

            func.sum(
                case(
                    (
                        Mention.sentiment_label
                        == "negative",
                        1,
                    ),
                    else_=0,
                )
            ).label("neg_count"),

            func.sum(
                case(
                    (
                        Mention.sentiment_label
                        == "neutral",
                        1,
                    ),
                    else_=0,
                )
            ).label("neu_count"),
        )
        .filter(
            Mention.brand_id == brand_id,
            Mention.posted_at.isnot(None),
        )
    )

    # --------------------------------------------------------
    # Optional date filter
    # --------------------------------------------------------

    if days is not None:

        try:
            days = int(days)
        except (
            TypeError,
            ValueError,
        ):
            days = None

    if (
        days is not None
        and days > 0
    ):

        since = (
            datetime.utcnow()
            - timedelta(
                days=days
            )
        )

        query = query.filter(
            Mention.posted_at >= since
        )

    # --------------------------------------------------------
    # Group by day
    # --------------------------------------------------------

    rows = (
        query
        .group_by("day")
        .order_by("day")
        .all()
    )

    result = []

    for row in rows:

        avg_score = (
            float(row.avg_score)
            if row.avg_score is not None
            else 50.0
        )

        result.append(
            TrendPoint(
                date=_format_day(
                    row.day
                ),

                score=round(
                    avg_score,
                    1,
                ),

                mentionCount=int(
                    row.mention_count
                    or 0
                ),

                positiveCount=int(
                    row.pos_count
                    or 0
                ),

                negativeCount=int(
                    row.neg_count
                    or 0
                ),

                neutralCount=int(
                    row.neu_count
                    or 0
                ),
            )
        )

    return result


# ============================================================
# FORMAT TREND DATE
# ============================================================

def _format_day(
    day,
) -> str:
    """
    Format YYYY-MM-DD to 'Mon DD'.

    Example:
        2026-08-12
        -> Aug 12
    """

    if hasattr(
        day,
        "strftime",
    ):
        return day.strftime(
            "%b %d"
        )

    try:
        return datetime.strptime(
            str(day),
            "%Y-%m-%d",
        ).strftime(
            "%b %d"
        )

    except ValueError:
        return str(day)


# ============================================================
# GET ASPECT BREAKDOWN
# ============================================================

def get_aspects(
    db: Session,
    brand_id: str,
) -> list[AspectBreakdown]:
    """
    Percentage breakdown of positive/negative/neutral
    mentions per aspect.
    """

    rows = (
        db.query(
            Mention.aspect,
            Mention.sentiment_label,
            func.count(
                Mention.id
            ).label("count"),
        )
        .filter(
            Mention.brand_id == brand_id,
            Mention.aspect.isnot(None),
        )
        .group_by(
            Mention.aspect,
            Mention.sentiment_label,
        )
        .all()
    )

    counts: dict[
        str,
        dict[str, int],
    ] = defaultdict(
        lambda: {
            "positive": 0,
            "negative": 0,
            "neutral": 0,
        }
    )

    for (
        aspect,
        label,
        count,
    ) in rows:

        lbl = (
            label
            if label
            in (
                "positive",
                "negative",
                "neutral",
            )
            else "neutral"
        )

        counts[aspect][lbl] += count

    result = []

    for (
        aspect,
        breakdown,
    ) in counts.items():

        total = (
            sum(
                breakdown.values()
            )
            or 1
        )

        result.append(
            AspectBreakdown(
                aspect=aspect,

                positive=round(
                    100
                    * breakdown["positive"]
                    / total,
                    1,
                ),

                negative=round(
                    100
                    * breakdown["negative"]
                    / total,
                    1,
                ),

                neutral=round(
                    100
                    * breakdown["neutral"]
                    / total,
                    1,
                ),

                mentionCount=total,
            )
        )

    return sorted(
        result,
        key=lambda item: item.mentionCount,
        reverse=True,
    )


# ============================================================
# GET RECENT MENTIONS
# ============================================================

def get_recent_mentions(
    db: Session,
    brand_id: str,
    limit: int = 10,
    sentiment: str | None = None,
    source: str | None = None,
) -> list[MentionOut]:
    """
    Return recent mentions for a brand.

    Optional filters:
        sentiment
        source
    """

    query = (
        db.query(Mention)
        .filter(
            Mention.brand_id == brand_id
        )
    )

    # --------------------------------------------------------
    # Sentiment filter
    # --------------------------------------------------------

    if sentiment:

        query = query.filter(
            func.lower(
                Mention.sentiment_label
            )
            == sentiment.lower()
        )

    # --------------------------------------------------------
    # Source filter
    # --------------------------------------------------------

    if source:

        query = query.filter(
            func.lower(
                Mention.source
            )
            == source.lower()
        )

    # --------------------------------------------------------
    # Latest first
    # --------------------------------------------------------

    rows = (
        query
        .order_by(
            Mention.posted_at.desc(),
            Mention.scraped_at.desc(),
        )
        .limit(limit)
        .all()
    )

    # --------------------------------------------------------
    # Brand name
    # --------------------------------------------------------

    brand = get_brand(
        db,
        brand_id,
    )

    brand_name = (
        brand.name
        if brand
        else None
    )

    # --------------------------------------------------------
    # Convert to response objects
    # --------------------------------------------------------

    return [
        MentionOut.from_orm_mention(
            mention,
            relative_time(
                mention.posted_at
                or mention.scraped_at
            ),
            brand_name=brand_name,
        )
        for mention in rows
    ]


# ============================================================
# RECOMPUTE BRAND ROLLUP
# ============================================================

def recompute_brand_rollup(
    db: Session,
    brand_id: str,
) -> None:
    """
    Recalculate a brand's:

        - sentiment_score
        - mention_count
        - trend
        - trend_delta

    Trend calculation:

        Last 7 days
            VS
        Previous 7 days

    This function is intentionally named
    `recompute_brand_rollup` because mention_service.py
    imports this exact function.
    """

    brand = get_brand(
        db,
        brand_id,
    )

    if not brand:
        return

    # --------------------------------------------------------
    # Get all mentions
    # --------------------------------------------------------

    mentions = (
        db.query(Mention)
        .filter(
            Mention.brand_id == brand_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Sentiment scores
    # --------------------------------------------------------

    scored = [
        mention.sentiment_score
        for mention in mentions
        if mention.sentiment_score
        is not None
    ]

    # --------------------------------------------------------
    # Mention count
    # --------------------------------------------------------

    brand.mention_count = len(
        mentions
    )

    # --------------------------------------------------------
    # Average sentiment
    # --------------------------------------------------------

    if scored:

        brand.sentiment_score = round(
            sum(scored)
            / len(scored),
            1,
        )

    else:

        brand.sentiment_score = 50.0

    # --------------------------------------------------------
    # Trend calculation
    #
    # Last 7 days vs previous 7 days
    # --------------------------------------------------------

    now = datetime.utcnow()

    seven_days_ago = (
        now
        - timedelta(days=7)
    )

    fourteen_days_ago = (
        now
        - timedelta(days=14)
    )

    # --------------------------------------------------------
    # Recent 7 days
    # --------------------------------------------------------

    recent = [
        mention.sentiment_score
        for mention in mentions
        if (
            mention.posted_at
            and mention.posted_at
            >= seven_days_ago
            and mention.sentiment_score
            is not None
        )
    ]

    # --------------------------------------------------------
    # Previous 7 days
    # --------------------------------------------------------

    prior = [
        mention.sentiment_score
        for mention in mentions
        if (
            mention.posted_at
            and fourteen_days_ago
            <= mention.posted_at
            < seven_days_ago
            and mention.sentiment_score
            is not None
        )
    ]

    # --------------------------------------------------------
    # Calculate delta
    # --------------------------------------------------------

    if recent and prior:

        recent_avg = (
            sum(recent)
            / len(recent)
        )

        prior_avg = (
            sum(prior)
            / len(prior)
        )

        delta = round(
            recent_avg
            - prior_avg,
            1,
        )

        brand.trend_delta = delta

        # ----------------------------------------------------
        # Trend direction
        # ----------------------------------------------------

        if delta > 0.5:

            brand.trend = "up"

        elif delta < -0.5:

            brand.trend = "down"

        else:

            brand.trend = "flat"

    else:

        brand.trend_delta = 0.0
        brand.trend = "flat"

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    db.commit()


# ============================================================
# COMPATIBILITY ALIAS
# ============================================================

def recompute_brand_metrics(
    db: Session,
    brand_id: str,
) -> None:
    """
    Compatibility alias.

    Some newer service code may call:

        recompute_brand_metrics()

    while the existing mention_service.py calls:

        recompute_brand_rollup()

    Both now use the same calculation.
    """

    recompute_brand_rollup(
        db,
        brand_id,
    )