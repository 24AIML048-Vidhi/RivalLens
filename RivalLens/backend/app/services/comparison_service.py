"""
Competitor Comparison Service

Aggregates metrics for multiple brands to enable side-by-side
benchmarking.

Important RivalLens behavior:
- compare_brands() compares ONLY the supplied brand IDs.
- It does NOT automatically compare every tracked brand.
- The Comparison page can therefore pass:
      active brand + selected competitors
- Previously searched/tracked brands are not included unless
  their IDs are explicitly supplied.
"""

from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.schemas.comparison import (
    BrandComparisonItem,
    ComparisonResponse,
)


# ============================================================
# COMPARE SELECTED BRANDS
# ============================================================

def compare_brands(
    db: Session,
    brand_ids: list[str] | None = None,
) -> ComparisonResponse:
    """
    Compare selected brands.

    Parameters
    ----------
    db:
        SQLAlchemy database session.

    brand_ids:
        List of brand IDs that should appear in the comparison.

        Example:

            [
                "brand-zomato",
                "brand-swiggy",
                "brand-blinkit"
            ]

        Only these brands will be compared.

        If brand_ids is None or empty, an empty comparison is
        returned instead of comparing every brand in the DB.

    Returns
    -------
    ComparisonResponse
    """

    # ========================================================
    # IMPORTANT:
    # Never load every brand when no IDs are supplied.
    # This prevents unrelated tracked brands from appearing
    # on the Comparison page.
    # ========================================================

    if not brand_ids:
        return ComparisonResponse(
            brands=[],
            sentimentLeader=None,
            volumeLeader=None,
        )

    # ========================================================
    # CLEAN IDS
    # ========================================================

    cleaned_ids = []

    for brand_id in brand_ids:
        if brand_id is None:
            continue

        clean_id = str(brand_id).strip()

        if not clean_id:
            continue

        if clean_id not in cleaned_ids:
            cleaned_ids.append(clean_id)

    if not cleaned_ids:
        return ComparisonResponse(
            brands=[],
            sentimentLeader=None,
            volumeLeader=None,
        )

    # ========================================================
    # GET ONLY REQUESTED BRANDS
    # ========================================================

    brands = (
        db.query(Brand)
        .filter(
            Brand.id.in_(cleaned_ids)
        )
        .all()
    )

    # ========================================================
    # KEEP THE SAME ORDER AS brand_ids
    # ========================================================
    #
    # SQLAlchemy does not guarantee that IN(...) returns rows
    # in the same order as the input IDs.
    #
    # We explicitly reorder them so the active brand remains
    # first in the comparison.
    # ========================================================

    brand_map = {
        brand.id: brand
        for brand in brands
    }

    ordered_brands = [
        brand_map[brand_id]
        for brand_id in cleaned_ids
        if brand_id in brand_map
    ]

    # ========================================================
    # BUILD COMPARISON ITEMS
    # ========================================================

    items: list[BrandComparisonItem] = []

    for brand in ordered_brands:

        # ----------------------------------------------------
        # GET MENTIONS
        # ----------------------------------------------------

        mentions = (
            db.query(Mention)
            .filter(
                Mention.brand_id == brand.id
            )
            .all()
        )

        total = len(mentions)

        # ----------------------------------------------------
        # SENTIMENT COUNTS
        # ----------------------------------------------------

        pos_count = sum(
            1
            for mention in mentions
            if mention.sentiment_label
            and mention.sentiment_label.lower()
            == "positive"
        )

        neg_count = sum(
            1
            for mention in mentions
            if mention.sentiment_label
            and mention.sentiment_label.lower()
            == "negative"
        )

        neu_count = sum(
            1
            for mention in mentions
            if (
                not mention.sentiment_label
                or mention.sentiment_label.lower()
                == "neutral"
            )
        )

        # ----------------------------------------------------
        # SENTIMENT PERCENTAGES
        # ----------------------------------------------------

        if total > 0:
            pos_pct = round(
                pos_count / total * 100,
                1,
            )

            neg_pct = round(
                neg_count / total * 100,
                1,
            )

            neu_pct = round(
                neu_count / total * 100,
                1,
            )

        else:
            pos_pct = 0.0
            neg_pct = 0.0
            neu_pct = 0.0

        # ----------------------------------------------------
        # TOP ASPECT
        # ----------------------------------------------------

        aspect_counts: dict[str, int] = {}

        for mention in mentions:
            if not mention.aspect:
                continue

            aspect = mention.aspect.strip()

            if not aspect:
                continue

            aspect_counts[aspect] = (
                aspect_counts.get(
                    aspect,
                    0,
                )
                + 1
            )

        if aspect_counts:
            top_aspect = max(
                aspect_counts,
                key=aspect_counts.get,
            )
        else:
            top_aspect = None

        # ----------------------------------------------------
        # SENTIMENT SCORE
        # ----------------------------------------------------

        sentiment_score = round(
            float(
                brand.sentiment_score
                if brand.sentiment_score is not None
                else 50.0
            ),
            1,
        )

        # ----------------------------------------------------
        # MENTION COUNT
        # ----------------------------------------------------

        mention_count = total

        # ----------------------------------------------------
        # TREND
        # ----------------------------------------------------

        trend = (
            brand.trend
            if brand.trend
            else "flat"
        )

        trend_delta = round(
            float(
                brand.trend_delta
                if brand.trend_delta is not None
                else 0.0
            ),
            1,
        )

        # ----------------------------------------------------
        # CREATE RESPONSE ITEM
        # ----------------------------------------------------

        items.append(
            BrandComparisonItem(
                id=brand.id,
                name=brand.name,
                category=brand.category,

                sentimentScore=sentiment_score,

                mentionCount=mention_count,

                positivePct=pos_pct,
                negativePct=neg_pct,
                neutralPct=neu_pct,

                trend=trend,
                trendDelta=trend_delta,

                topAspect=top_aspect,
            )
        )

    # ========================================================
    # DETERMINE LEADERS
    # ========================================================

    if items:
        sentiment_leader = max(
            items,
            key=lambda item: (
                item.sentimentScore
            ),
        ).name

        volume_leader = max(
            items,
            key=lambda item: (
                item.mentionCount
            ),
        ).name

    else:
        sentiment_leader = None
        volume_leader = None

    # ========================================================
    # RETURN COMPARISON
    # ========================================================

    return ComparisonResponse(
        brands=items,
        sentimentLeader=sentiment_leader,
        volumeLeader=volume_leader,
    )