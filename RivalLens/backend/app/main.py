import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine, SessionLocal
from app import models  # noqa: F401
from app.routes import brands, mentions, comparison, analytics, ingestion
from app.models.brand import Brand
from app.models.mention import Mention
from app.services.language_detection import detect_language, normalize_text
from app.services.duplicate_detection import group_mentions_batch
from app.services.review_quality import calculate_spam_score
from app.services.brand_service import recompute_brand_rollup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rivallens")

app = FastAPI(
    title="RivalLens API",
    description="Competitor Intelligence & Brand Sentiment Analysis Platform API",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(brands.router)
app.include_router(mentions.router)
app.include_router(comparison.router)
app.include_router(analytics.router)
app.include_router(ingestion.router)


def _safe_migrate_database():
    """Safely adds any missing review intelligence columns to existing SQLite table."""
    logger.info("Checking database schema migrations...")
    Base.metadata.create_all(bind=engine)

    try:
        with engine.connect() as conn:
            # Check SQLite table info
            result = conn.execute(text("PRAGMA table_info(mentions);"))
            columns = {row[1] for row in result.fetchall()}

            new_columns = {
                "spam_score": "FLOAT DEFAULT 0.0",
                "review_status": "VARCHAR DEFAULT 'genuine'",
                "is_duplicate": "BOOLEAN DEFAULT 0",
                "duplicate_group_id": "VARCHAR",
                "duplicate_count": "INTEGER DEFAULT 1",
                "language": "VARCHAR DEFAULT 'English'",
                "detected_languages": "VARCHAR",
                "original_text": "TEXT",
                "normalized_text": "TEXT",
            }

            for col_name, col_type in new_columns.items():
                if col_name not in columns:
                    logger.info("Migrating schema: adding column %s to mentions table", col_name)
                    conn.execute(text(f"ALTER TABLE mentions ADD COLUMN {col_name} {col_type};"))
            conn.commit()
    except Exception as exc:
        logger.warning("Schema auto-migration check note: %s", exc)


def _backfill_legacy_mentions():
    """One-time processing of legacy records for language detection, spam scores, and duplicates."""
    db = SessionLocal()
    try:
        unprocessed = db.query(Mention).filter(
            (Mention.language.is_(None)) | (Mention.review_status.is_(None)) | (Mention.is_duplicate.is_(None))
        ).all()

        if unprocessed:
            logger.info("Backfilling review intelligence on %d legacy mentions...", len(unprocessed))
            # Group by brand to cluster duplicates properly
            brand_map = {}
            for m in unprocessed:
                brand_map.setdefault(m.brand_id, []).append(m)

            for brand_id, m_list in brand_map.items():
                items_data = []
                for m in m_list:
                    raw_text = (m.text or "").strip()
                    lang, detected_codes = detect_language(raw_text)
                    norm_text = normalize_text(raw_text)
                    items_data.append({
                        "id": m.id,
                        "text": raw_text,
                        "original_text": raw_text,
                        "normalized_text": norm_text,
                        "author": m.author,
                        "language": lang,
                        "detected_languages": ",".join(detected_codes),
                    })

                grouped = group_mentions_batch(items_data)
                for data, m in zip(grouped, m_list):
                    spam_score, status, _ = calculate_spam_score(
                        text=data["text"],
                        author=data["author"],
                        is_duplicate=data.get("is_duplicate", False),
                        dup_count=data.get("duplicate_count", 1)
                    )
                    m.original_text = data["original_text"]
                    m.normalized_text = data["normalized_text"]
                    m.language = data["language"]
                    m.detected_languages = data["detected_languages"]
                    m.is_duplicate = data.get("is_duplicate", False)
                    m.duplicate_group_id = data.get("duplicate_group_id")
                    m.duplicate_count = data.get("duplicate_count", 1)
                    m.spam_score = spam_score
                    m.review_status = status

                db.commit()
                recompute_brand_rollup(db, brand_id)

            logger.info("Legacy mentions backfill complete.")
    except Exception as exc:
        logger.warning("Backfill error: %s", exc)
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    _safe_migrate_database()
    _backfill_legacy_mentions()
    logger.info("RivalLens backend started successfully with Review Intelligence module active.")


@app.get("/api/health", summary="Health and status check", tags=["system"])
def health_check():
    db = SessionLocal()
    db_status = "connected"
    brand_count = 0
    mention_count = 0
    unique_mention_count = 0
    spam_count = 0
    try:
        brand_count = db.query(Brand).count()
        mention_count = db.query(Mention).count()
        unique_mention_count = db.query(Mention).filter(Mention.is_duplicate.is_(False)).count()
        spam_count = db.query(Mention).filter(Mention.review_status == "spam").count()
    except Exception as exc:
        db_status = f"error: {str(exc)}"
    finally:
        db.close()

    return {
        "status": "ok",
        "app": "RivalLens",
        "version": "1.1.0",
        "environment": settings.environment,
        "database": {
            "status": db_status,
            "brandsTracked": brand_count,
            "totalMentions": mention_count,
            "uniqueMentions": unique_mention_count,
            "spamMentions": spam_count,
        }
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled Exception at %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check the backend logs."}
    )

