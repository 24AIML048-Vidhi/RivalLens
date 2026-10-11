from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.brand import Brand
from app.schemas.brand import (
    BrandCreate,
    BrandUpdate,
    BrandOut,
    BrandSummary,
    TrendPoint,
    AspectBreakdown,
    AskRequest,
)
from app.schemas.mention import MentionOut
from app.services import (
    brand_service,
    ai_insight_service,
    competitor_service,
    crisis_service,
    root_cause_service,
    forecast_service,
    competitive_service,
    viral_service,
    health_service,
    analyst_service,
)


router = APIRouter(
    prefix="/api/brands",
    tags=["brands"]
)


def _require_brand(db: Session, brand_id: str) -> Brand:
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )
    return brand

@router.get("", response_model=list[BrandOut], summary="List all tracked brands")
def list_brands(db: Session = Depends(get_db)):
    brands = brand_service.get_all_brands(db)
    return [BrandOut.from_orm_brand(b) for b in brands]


@router.get(
    "/suggestions",
    summary="Auto-suggest competitors for a brand",
)
def get_brand_suggestions(
    name: str = Query(..., description="Brand name to find competitors for"),
    category: str = Query(default="", description="Brand category or industry"),
    count: int = Query(default=2, ge=1, le=10, description="Number of competitors to suggest"),
    db: Session = Depends(get_db),
):
    cleaned_name = name.strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand name cannot be empty"
        )

    existing_brand = brand_service.get_brand_by_name(db, cleaned_name)
    exclude_id = existing_brand.id if existing_brand else None
    cat = category.strip() or (existing_brand.category if existing_brand else "") or "General"

    suggestions = competitor_service.suggest_competitors(
        db=db,
        brand_name=cleaned_name,
        category=cat,
        count=count,
        exclude_brand_id=exclude_id,
    )

    # Ensure suggested competitors have a Brand record in DB so their ID is valid for frontend linking
    for item in suggestions:
        comp_name = item.get("name")
        comp_id = item.get("id")
        if not comp_id and comp_name:
            comp_brand = brand_service.get_brand_by_name(db, comp_name)
            if not comp_brand:
                comp_brand = Brand(
                    name=comp_name,
                    category=item.get("category") or cat or "General",
                    is_search_brand=False,
                    sentiment_score=50.0,
                    mention_count=0,
                    trend="flat",
                    trend_delta=0.0,
                )
                db.add(comp_brand)
                db.commit()
                db.refresh(comp_brand)
            item["id"] = comp_brand.id
            item["tracked"] = True

    return suggestions


@router.post(
    "",
    response_model=BrandOut,
    status_code=status.HTTP_201_CREATED,
    summary="Track a new brand"
)
def create_brand(
    payload: BrandCreate,
    db: Session = Depends(get_db)
):
    cleaned_name = payload.name.strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand name cannot be empty"
        )

    existing = brand_service.get_brand_by_name(db, cleaned_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand '{cleaned_name}' is already being tracked"
        )

    brand = brand_service.create_brand(
        db=db,
        name=cleaned_name,
        category=payload.category,
        competitor_names=payload.competitorNames
    )

    return BrandOut.from_orm_brand(brand)

@router.get(
    "/{brand_id}",
    response_model=BrandOut,
    summary="Get details of a specific brand"
)
def get_brand_details(
    brand_id: str,
    db: Session = Depends(get_db)
):
    brand = _require_brand(db, brand_id)
    return BrandOut.from_orm_brand(brand)

@router.put(
    "/{brand_id}",
    response_model=BrandOut,
    summary="Update a tracked brand"
)
def update_brand_details(
    brand_id: str,
    payload: BrandUpdate,
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)

    if payload.name is not None and payload.name.strip():
        existing = brand_service.get_brand_by_name(db, payload.name.strip())
        if existing and existing.id != brand_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another brand with name '{payload.name.strip()}' already exists"
            )

    updated = brand_service.update_brand(
        db=db,
        brand_id=brand_id,
        name=payload.name,
        category=payload.category,
        competitor_names=payload.competitorNames
    )
    return BrandOut.from_orm_brand(updated)


@router.delete(
    "/{brand_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a brand and its associated mentions"
)
def delete_brand(
    brand_id: str,
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)
    success = brand_service.delete_brand(db, brand_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete brand"
        )
    return {"status": "success", "message": f"Brand {brand_id} deleted successfully"}

@router.get(
    "/{brand_id}/summary",
    response_model=BrandSummary,
    summary="Get summary metrics and sentiment counts for a brand"
)
def get_brand_summary(
    brand_id: str,
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)
    summary = brand_service.get_brand_summary(db, brand_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand summary not found"
        )
    return summary

@router.get(
    "/{brand_id}/trend",
    response_model=list[TrendPoint],
    summary="Get chronological sentiment and mention trend over time"
)
def brand_trend(
    brand_id: str,
    days: int | None = Query(
        default=None,
        ge=1,
        description="Days of historical trend (7, 14, 30, 90). Omit for all history."
    ),
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)
    return brand_service.get_trend(db, brand_id, days)

@router.get(
    "/{brand_id}/aspects",
    response_model=list[AspectBreakdown],
    summary="Get sentiment breakdown by aspect (Delivery, Pricing, Quality, etc.)"
)
def brand_aspects(
    brand_id: str,
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)
    return brand_service.get_aspects(db, brand_id)


@router.get(
    "/{brand_id}/mentions",
    response_model=list[MentionOut],
    summary="Get recent mentions for a brand with optional quality/multilingual filtering"
)
def brand_mentions(
    brand_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    sentiment: str | None = Query(default=None, description="Filter by 'positive', 'negative', 'neutral', or 'mixed'"),
    source: str | None = Query(default=None, description="Filter by source (instagram, youtube, reddit, manual)"),
    status: str | None = Query(default=None, description="Filter by review status: 'genuine', 'suspicious', 'spam'"),
    language: str | None = Query(default=None, description="Filter by language: 'English', 'Hindi', 'Gujarati', 'Hinglish'"),
    duplicates: str | None = Query(default=None, description="Filter duplicates: 'unique_only', 'duplicates_only', or 'all'"),
    db: Session = Depends(get_db)
):
    _require_brand(db, brand_id)
    return brand_service.get_recent_mentions(
        db,
        brand_id,
        limit=limit,
        sentiment=sentiment,
        source=source,
        status=status,
        language=language,
        duplicates=duplicates,
    )


@router.get(
    "/{brand_id}/ai-recommendations",
    summary="Get AI-powered growth strategies and brand improvement playbook",
)
def get_brand_ai_recommendations(
    brand_id: str,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return ai_insight_service.generate_ai_recommendations(db, brand.id)


@router.get(
    "/{brand_id}/ai-insights",
    summary="Get AI recommendations alias",
)
def get_brand_ai_insights(
    brand_id: str,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return ai_insight_service.generate_ai_recommendations(db, brand.id)


@router.get(
    "/{brand_id}/crisis",
    summary="Get AI Crisis Detection score, severity, and contributing factors",
)
def get_brand_crisis_analysis(
    brand_id: str,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return crisis_service.calculate_crisis_score(db, brand.id)


@router.get(
    "/{brand_id}/root-cause",
    summary="Get Root-Cause Analysis for sentiment changes",
)
def get_brand_root_cause_analysis(
    brand_id: str,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return root_cause_service.calculate_root_cause(db, brand.id)


@router.get(
    "/{brand_id}/forecast",
    summary="Get 7-Day Sentiment Forecast",
)
def get_brand_sentiment_forecast(
    brand_id: str,
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return forecast_service.calculate_7day_forecast(db, brand.id, forecast_days=days)


@router.get(
    "/{brand_id}/competitive-insights",
    summary="Get Competitor Weakness Detection & Share of Voice Intelligence",
)
def get_brand_competitive_insights(
    brand_id: str,
    competitor_ids: str | None = Query(default=None, description="Comma-separated competitor IDs to benchmark"),
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    c_ids = [cid.strip() for cid in competitor_ids.split(",") if cid.strip()] if competitor_ids else None
    return competitive_service.calculate_competitive_insights(db, brand.id, competitor_ids=c_ids)


@router.get(
    "/{brand_id}/viral-complaints",
    summary="Get Potential Viral Complaints and Viral Risk Scores",
)
def get_brand_viral_complaints(
    brand_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return viral_service.detect_viral_complaints(db, brand.id, limit=limit)


@router.get(
    "/{brand_id}/health-score",
    summary="Get Unified Brand Health Score and Components Breakdown",
)
def get_brand_health_score(
    brand_id: str,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return health_service.calculate_brand_health_score(db, brand.id)


@router.post(
    "/{brand_id}/ask",
    summary="Ask RivalLens AI Analyst natural language question grounded strictly in data",
)
def ask_brand_analyst(
    brand_id: str,
    payload: AskRequest,
    db: Session = Depends(get_db),
):
    brand = _require_brand(db, brand_id)
    return analyst_service.ask_rivallens(db, brand.id, question=payload.question)


