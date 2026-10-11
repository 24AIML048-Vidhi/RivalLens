from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import AnalyticsResponse
from app.services import analytics_service

router = APIRouter(
    prefix="/api/analytics",
    tags=["analytics"]
)


@router.get("", response_model=AnalyticsResponse, summary="Get comprehensive analytics overview")
def get_analytics_overview(
    brand_id: str | None = Query(default=None, description="Optional brand ID to narrow down analytics"),
    days: int | None = Query(default=None, ge=1, description="Days of history to include"),
    db: Session = Depends(get_db)
):
    return analytics_service.get_analytics(db, brand_id=brand_id, days=days)
