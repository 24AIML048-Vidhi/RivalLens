from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class MentionCreate(BaseModel):
    brand_id: str
    text: str
    source: str = "web"
    author: str | None = None
    url: str | None = None
    sentiment_label: str | None = None
    sentiment_score: float | None = None
    aspect: str | None = None

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Mention text cannot be empty")
        return cleaned


class MentionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    brandId: str | None = None
    brandName: str | None = None
    source: str
    sourceRef: str | None = None
    author: str | None = None
    text: str
    url: str | None = None
    sentiment: str | None = None
    sentimentScore: float | None = None
    aspect: str | None = None
    timestamp: str  # human-readable relative time
    postedAt: str | None = None

    @staticmethod
    def from_orm_mention(mention, timestamp: str, brand_name: str | None = None) -> "MentionOut":
        posted_str = mention.posted_at.isoformat() if mention.posted_at else None
        b_name = brand_name or (mention.brand.name if mention.brand else None)

        return MentionOut(
            id=mention.id,
            brandId=mention.brand_id,
            brandName=b_name,
            source=mention.source or "web",
            sourceRef=mention.source_ref,
            author=mention.author or "Anonymous",
            text=mention.text,
            url=mention.url,
            sentiment=mention.sentiment_label or "neutral",
            sentimentScore=mention.sentiment_score,
            aspect=mention.aspect,
            timestamp=timestamp,
            postedAt=posted_str,
        )


class MentionListResponse(BaseModel):
    items: list[MentionOut]
    total: int
    limit: int
    offset: int