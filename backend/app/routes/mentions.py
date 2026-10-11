from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.mention import MentionCreate, MentionOut, MentionListResponse
from app.services import mention_service, brand_service

router = APIRouter(
    prefix="/api/mentions",
    tags=["mentions"]
)


@router.get("", response_model=MentionListResponse, summary="Query and filter all mentions")
def list_mentions(
    brand_id: str | None = Query(default=None, description="Filter by brand ID"),
    sentiment: str | None = Query(default=None, description="Filter by 'positive', 'negative', or 'neutral'"),
    source: str | None = Query(default=None, description="Filter by source platform"),
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
        limit=limit,
        offset=offset
    )


@router.post(
    "",
    response_model=MentionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new mention with automatic sentiment scoring"
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
    "/{mention_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a mention by ID"
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
