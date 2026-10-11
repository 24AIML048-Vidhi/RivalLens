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
    language: str | None = None
    review_status: str | None = None
    spam_score: float | None = None

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
    originalText: str | None = None
    normalizedText: str | None = None
    url: str | None = None
    sentiment: str | None = None
    sentimentScore: float | None = None
    sentimentConfidence: float | None = None
    aspect: str | None = None
    spamScore: float | None = 0.0
    reviewStatus: str = "genuine"
    isDuplicate: bool = False
    duplicateGroupId: str | None = None
    duplicateCount: int = 1
    language: str | None = "English"
    detectedLanguages: str | None = None
    timestamp: str  # human-readable relative time
    postedAt: str | None = None

    @staticmethod
    def from_orm_mention(mention, timestamp: str, brand_name: str | None = None) -> "MentionOut":
        posted_str = mention.posted_at.isoformat() if mention.posted_at else None
        b_name = brand_name or (mention.brand.name if mention.brand else None)
        s_score = mention.sentiment_score or 50.0
        confidence = round(abs(s_score - 50.0) * 2.0 / 100.0, 2) if mention.sentiment_score is not None else 0.50

        return MentionOut(
            id=mention.id,
            brandId=mention.brand_id,
            brandName=b_name,
            source=mention.source or "web",
            sourceRef=mention.source_ref,
            author=mention.author or "Anonymous",
            text=mention.text,
            originalText=getattr(mention, "original_text", None) or mention.text,
            normalizedText=getattr(mention, "normalized_text", None) or mention.text,
            url=mention.url,
            sentiment=mention.sentiment_label or "neutral",
            sentimentScore=mention.sentiment_score,
            sentimentConfidence=confidence,
            aspect=mention.aspect,
            spamScore=getattr(mention, "spam_score", 0.0) or 0.0,
            reviewStatus=getattr(mention, "review_status", "genuine") or "genuine",
            isDuplicate=bool(getattr(mention, "is_duplicate", False)),
            duplicateGroupId=getattr(mention, "duplicate_group_id", None),
            duplicateCount=getattr(mention, "duplicate_count", 1) or 1,
            language=getattr(mention, "language", "English") or "English",
            detectedLanguages=getattr(mention, "detected_languages", None),
            timestamp=timestamp,
            postedAt=posted_str,
        )


class MentionListResponse(BaseModel):
    items: list[MentionOut]
    total: int
    limit: int
    offset: int
    uniqueCount: int | None = None
    duplicateCount: int | None = None
    suspiciousCount: int | None = None
    spamCount: int | None = None