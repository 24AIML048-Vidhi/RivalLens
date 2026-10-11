from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.brand import Brand
from app.schemas.comparison import ComparisonResponse
from app.services import comparison_service
from app.services import brand_service
from app.services import competitor_service


router = APIRouter(
    prefix="/api/comparison",
    tags=["comparison"],
)

@router.get(
    "",
    response_model=ComparisonResponse,
    summary="Compare selected brands side-by-side",
)
def compare_brands(
    brand_ids: str | None = Query(
        default=None,
        description=(
            "Comma-separated brand IDs to compare. "
            "Only these brands will be included."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Compare only the brands explicitly supplied by the frontend.

    Example:

        /api/comparison?brand_ids=brand-1,brand-2,brand-3

    Result:

        brand-1
        brand-2
        brand-3

    IMPORTANT:
    If brand_ids is empty, this endpoint returns an empty
    comparison instead of comparing every tracked brand.

    This prevents previously searched/tracked brands from
    appearing automatically.
    """

    if not brand_ids:
        return comparison_service.compare_brands(
            db,
            [],
        )

    ids = [
        brand_id.strip()
        for brand_id in brand_ids.split(",")
        if brand_id.strip()
    ]

    ids = list(
        dict.fromkeys(ids)
    )

    if not ids:
        return comparison_service.compare_brands(
            db,
            [],
        )

    brands = brand_service.get_brands_by_ids(
        db,
        ids,
    )

    existing_ids = {
        brand.id
        for brand in brands
    }

    missing_ids = [
        brand_id
        for brand_id in ids
        if brand_id not in existing_ids
    ]

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "One or more brands were not found.",
                "missingBrandIds": missing_ids,
            },
        )

    return comparison_service.compare_brands(
        db,
        ids,
    )


@router.get(
    "/active/{brand_id}",
    response_model=ComparisonResponse,
    summary="Compare active brand with its saved competitors",
)
def compare_active_brand(
    brand_id: str,
    db: Session = Depends(get_db),
):
    """
    Compare an active brand only with its saved competitors.

    Example:

        Active brand:
            Zomato

        Saved competitors:
            Swiggy
            Blinkit

    Comparison result:

        Zomato
        Swiggy
        Blinkit

    Other tracked brands such as Zepto, Amazon, or Flipkart
    are NOT included.
    """

    active_brand = brand_service.get_brand(
        db,
        brand_id,
    )

    if not active_brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active brand not found",
        )

    competitors = (
        active_brand.competitors
        if active_brand.competitors
        else []
    )

    
    brand_ids = [
        active_brand.id
    ]

    for competitor in competitors:

        # Prevent accidental self-competition.
        if competitor.id == active_brand.id:
            continue

        # Prevent duplicate IDs.
        if competitor.id in brand_ids:
            continue

        brand_ids.append(
            competitor.id
        )

    return comparison_service.compare_brands(
        db,
        brand_ids,
    )


@router.get(
    "/active/{brand_id}/suggest",
    response_model=ComparisonResponse,
    summary="Auto-suggest competitors and compare",
)
def suggest_and_compare_active_brand(
    brand_id: str,
    count: int = Query(
        default=2,
        ge=2,
        le=3,
        description="Number of competitors to suggest: 2 or 3",
    ),
    db: Session = Depends(get_db),
):
    """
    Automatically suggest 2 or 3 competitors for the active
    brand and immediately compare them.

    IMPORTANT:
    The suggested competitors are used only for this comparison.
    They are NOT automatically saved to the active brand.

    If the user wants to permanently save them, the Add Brand /
    Update Brand flow should save the selected competitors.
    """

    active_brand = brand_service.get_brand(
        db,
        brand_id,
    )

    if not active_brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active brand not found",
        )

    if count not in (2, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Competitor count must be 2 or 3.",
        )

    suggestions = (
        competitor_service.suggest_competitors(
            db=db,
            brand_name=active_brand.name,
            category=active_brand.category or "General",
            count=count,
            exclude_brand_id=active_brand.id,
        )
    )

    suggested_ids = []
    for suggestion in suggestions:
        comp_id = suggestion.get("id")
        comp_name = suggestion.get("name")
        if not comp_id and comp_name:
            # Check or create in DB
            comp_brand = brand_service.get_brand_by_name(db, comp_name)
            if not comp_brand:
                comp_brand = Brand(name=comp_name, category=active_brand.category or suggestion.get("category"))
                db.add(comp_brand)
                db.commit()
                db.refresh(comp_brand)
            comp_id = comp_brand.id
        
        if comp_id and comp_id != active_brand.id and comp_id not in suggested_ids:
            suggested_ids.append(comp_id)

    brand_ids = [
        active_brand.id
    ]

    for competitor_id in suggested_ids:
        if competitor_id not in brand_ids:
            brand_ids.append(competitor_id)

    comparison = comparison_service.compare_brands(
        db,
        brand_ids,
    )

    return comparison


@router.get(
    "/active/{brand_id}/competitors",
    summary="Get competitors saved for an active brand",
)
def get_active_brand_competitors(
    brand_id: str,
    db: Session = Depends(get_db),
):
    """
    Return only the competitors saved for the selected brand.

    This endpoint is useful for the Comparison page when it
    needs to load the active brand's current competitor list.
    """


    active_brand = brand_service.get_brand(
        db,
        brand_id,
    )

    if not active_brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active brand not found",
        )

    competitors = (
        competitor_service.get_saved_competitors(
            active_brand
        )
    )

    return {
        "brandId": active_brand.id,
        "brandName": active_brand.name,
        "competitors": competitors,
        "count": len(competitors),
    }