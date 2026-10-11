import uuid

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Table,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

brand_competitors = Table(
    "brand_competitors",
    Base.metadata,

    Column(
        "brand_id",
        String,
        ForeignKey(
            "brands.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),

    Column(
        "competitor_id",
        String,
        ForeignKey(
            "brands.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)


class Brand(Base):
    __tablename__ = "brands"

    id = Column(
        String,
        primary_key=True,
        default=lambda: (
            f"brand-{uuid.uuid4().hex[:12]}"
        ),
    )

    name = Column(
        String,
        nullable=False,
        unique=True,
    )

    category = Column(
        String,
        nullable=True,
    )

    description = Column(
        String,
        nullable=True,
    )

    is_search_brand = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    sentiment_score = Column(
        Float,
        default=50.0,
    )

    mention_count = Column(
        Integer,
        default=0,
    )

    trend = Column(
        String,
        default="flat",
    )

    trend_delta = Column(
        Float,
        default=0.0,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    mentions = relationship(
        "Mention",
        back_populates="brand",
        cascade="all, delete-orphan",
    )

    competitors = relationship(
        "Brand",
        secondary=brand_competitors,

        primaryjoin=(
            id
            == brand_competitors.c.brand_id
        ),

        secondaryjoin=(
            id
            == brand_competitors.c.competitor_id
        ),

        foreign_keys=[
            brand_competitors.c.brand_id,
            brand_competitors.c.competitor_id,
        ],

        cascade="all",
    )