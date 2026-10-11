from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class BrandCreate(BaseModel):
    name: str
    category: str = ""
    description: str | None = None
    competitorNames: list[str] = []
    is_search_brand: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Brand name cannot be empty")
        return cleaned


class BrandUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    competitorNames: list[str] | None = None
    is_search_brand: bool | None = None


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str | None = None
    sentimentScore: float
    mentionCount: int
    trend: str
    trendDelta: float
    isSearchBrand: bool = True
    competitors: list[str] = []
    competitorNames: list[str] = []
    competitorBrands: list[dict] = []
    createdAt: str | None = None

    @staticmethod
    def from_orm_brand(brand) -> "BrandOut":
        """Maps snake_case DB fields to the camelCase shape the frontend expects."""
        competitor_ids = [c.id for c in brand.competitors] if brand.competitors else []
        competitor_names = [c.name for c in brand.competitors] if brand.competitors else []
        competitor_brands = [
            {
                "id": c.id,
                "name": c.name,
                "category": c.category,
                "sentimentScore": round(c.sentiment_score or 50.0, 1),
                "mentionCount": c.mention_count or 0,
            }
            for c in brand.competitors
        ] if brand.competitors else []
        
        created_str = brand.created_at.strftime("%Y-%m-%d") if brand.created_at else None
        is_search = getattr(brand, "is_search_brand", True)
        if is_search is None:
            is_search = True

        return BrandOut(
            id=brand.id,
            name=brand.name,
            category=brand.category,
            sentimentScore=round(brand.sentiment_score or 50.0, 1),
            mentionCount=brand.mention_count or 0,
            trend=brand.trend or "flat",
            trendDelta=round(brand.trend_delta or 0.0, 1),
            isSearchBrand=bool(is_search),
            competitors=competitor_ids,
            competitorNames=competitor_names,
            competitorBrands=competitor_brands,
            createdAt=created_str,
        )


class BrandSummary(BaseModel):
    id: str
    name: str
    category: str | None = None
    sentimentScore: float
    sentimentLabel: str   # "Positive", "Negative", "Neutral"
    mentionCount: int
    positiveMentions: int
    negativeMentions: int
    neutralMentions: int
    positivePct: float
    negativePct: float
    neutralPct: float
    trend: str
    trendDelta: float
    competitorCount: int


class TrendPoint(BaseModel):
    date: str
    score: float
    mentionCount: int = 0
    positiveCount: int = 0
    negativeCount: int = 0
    neutralCount: int = 0


class AspectBreakdown(BaseModel):
    aspect: str
    positive: float
    negative: float
    neutral: float
    mentionCount: int = 0