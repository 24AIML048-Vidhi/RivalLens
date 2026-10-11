from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.mention import MentionCreate, MentionOut, MentionListResponse
from app.services import mention_service, brand_service, analytics_service

router = APIRouter(
    tags=["mentions"]
)


@router.get("/api/mentions", response_model=MentionListResponse, summary="Query and filter all mentions / reviews")
@router.get("/api/reviews", response_model=MentionListResponse, summary="Alias for querying all reviews")
def list_mentions(
    brand_id: str | None = Query(default=None, description="Filter by brand ID"),
    sentiment: str | None = Query(default=None, description="Filter by 'positive', 'negative', 'neutral', or 'mixed'"),
    source: str | None = Query(default=None, description="Filter by source platform"),
    status: str | None = Query(default=None, description="Filter by review status: 'genuine', 'suspicious', 'spam'"),
    language: str | None = Query(default=None, description="Filter by language: 'English', 'Hindi', 'Gujarati', 'Hinglish'"),
    duplicates: str | None = Query(default=None, description="Filter duplicates: 'unique_only', 'duplicates_only', or 'all'"),
    q: str | None = Query(default=None, description="Search text in mention content"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    return mention_service.get_mentions(
        db=db,
        brand_id=brand_id,
        sentiment=sentiment,
        source=source,
        query_text=q,
        status=status,
        language=language,
        duplicates=duplicates,
        limit=limit,
        offset=offset
    )


@router.get("/api/mentions/quality-stats", summary="Get review intelligence quality metrics")
@router.get("/api/reviews/quality", summary="Get review quality statistics")
def get_review_quality_statistics(
    brand_id: str | None = Query(default=None, description="Filter quality statistics by brand"),
    db: Session = Depends(get_db)
):
    return analytics_service.get_review_quality_stats(db, brand_id=brand_id)


@router.get("/api/reviews/duplicates", summary="Get duplicate reviews breakdown")
def get_duplicate_reviews(
    brand_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    return mention_service.get_mentions(
        db=db,
        brand_id=brand_id,
        duplicates="duplicates_only",
        limit=limit,
        offset=offset
    )


@router.get("/api/reviews/spam", summary="Get suspicious and spam reviews")
def get_spam_reviews(
    brand_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    return mention_service.get_mentions(
        db=db,
        brand_id=brand_id,
        status="spam",
        limit=limit,
        offset=offset
    )


@router.get("/api/reviews/languages", summary="Get language distribution summary")
def get_language_summary(
    brand_id: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    stats = analytics_service.get_review_quality_stats(db, brand_id=brand_id)
    return {
        "brand_id": brand_id,
        "languages": stats["languages"],
        "total_reviews": stats["total_reviews"],
    }


@router.post(
    "/api/mentions",
    response_model=MentionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new mention with automatic sentiment & quality scoring"
)
@router.post(
    "/api/reviews",
    response_model=MentionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Alias for adding a new review"
)
def create_mention(
    payload: MentionCreate,
    db: Session = Depends(get_db)
):
    # Verify brand exists
    brand = brand_service.get_brand(db, payload.brand_id)
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified brand does not exist"
        )

    return mention_service.create_mention(db, payload)


@router.delete(
    "/api/mentions/{mention_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a mention by ID"
)
@router.delete(
    "/api/reviews/{mention_id}",
    status_code=status.HTTP_200_OK,
    summary="Alias for deleting a review"
)
def delete_mention(
    mention_id: str,
    db: Session = Depends(get_db)
):
    success = mention_service.delete_mention(db, mention_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mention not found"
        )
    return {"status": "success", "message": f"Mention {mention_id} deleted"}

