from pydantic import BaseModel
from app.schemas.brand import AspectBreakdown, TrendPoint


class SentimentDistribution(BaseModel):
    positive: int = 0
    negative: int = 0
    neutral: int = 0
    positivePct: float = 0.0
    negativePct: float = 0.0
    neutralPct: float = 0.0


class SourceBreakdown(BaseModel):
    source: str
    count: int
    percentage: float


class TopicItem(BaseModel):
    topic: str
    count: int
    sentimentScore: float
    sentimentLabel: str


class AnalyticsResponse(BaseModel):
    brandId: str | None = None
    brandName: str | None = None
    totalMentions: int
    averageSentiment: float
    sentimentDistribution: SentimentDistribution
    sourceBreakdown: list[SourceBreakdown]
    aspects: list[AspectBreakdown]
    trend: list[TrendPoint]
    topTopics: list[TopicItem] = []
