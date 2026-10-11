from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import brand_service
from app.services.ingestion_service import run_ingestion_for_brand

router = APIRouter(prefix="/api/brands", tags=["ingestion"])


@router.post("/{brand_id}/ingest", status_code=202)
def trigger_ingestion(brand_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Kicks off a scrape (Instagram + YouTube) + sentiment analysis run for a
    brand in the background, so the request returns immediately instead of
    blocking on network calls + model inference."""
    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    competitor_names = [c.name for c in brand.competitors] if brand.competitors else []
    background_tasks.add_task(run_ingestion_for_brand, brand_id)
    return {
        "status": "ingestion_started",
        "brand_id": brand_id,
        "brand_name": brand.name,
        "competitors_included": competitor_names,
    }