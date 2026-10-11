from pydantic import BaseModel


class BrandComparisonItem(BaseModel):
    id: str
    name: str
    category: str | None = None
    sentimentScore: float
    mentionCount: int
    positivePct: float
    negativePct: float
    neutralPct: float
    trend: str
    trendDelta: float
    topAspect: str | None = None


class ComparisonResponse(BaseModel):
    brands: list[BrandComparisonItem]
    sentimentLeader: str | None = None
    volumeLeader: str | None = None
