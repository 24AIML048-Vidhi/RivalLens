import uuid

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Mention(Base):
    """One scraped piece of text (Instagram post/reel/comment or YouTube comment)
    plus the sentiment/aspect analysis run on it."""

    __tablename__ = "mentions"

    id = Column(String, primary_key=True, default=lambda: f"mention-{uuid.uuid4().hex[:12]}")
    brand_id = Column(String, ForeignKey("brands.id"), nullable=False)

    source = Column(String, nullable=False)        # "instagram" | "youtube" | "web" | "manual"
    source_ref = Column(String, nullable=True)      # hashtag/handle or video id, for traceability
    author = Column(String, nullable=True)
    text = Column(Text, nullable=False)
    url = Column(String, nullable=True)

    # Filled in by app/nlp/sentiment.py during ingestion
    sentiment_label = Column(String, nullable=True)   # "positive" | "negative" | "neutral"
    sentiment_score = Column(Float, nullable=True)     # 0-100

    # Filled in by app/nlp/aspects.py — which product aspect this mention is about
    aspect = Column(String, nullable=True)

    posted_at = Column(DateTime(timezone=True), nullable=True)   # original post/comment time
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())

    brand = relationship("Brand", back_populates="mentions")