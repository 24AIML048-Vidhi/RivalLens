import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine, SessionLocal
from app import models  # noqa: F401
from app.routes import brands, mentions, comparison, analytics, ingestion
from app.models.brand import Brand
from app.models.mention import Mention

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rivallens")

app = FastAPI(

    title="RivalLens API",
    description="Competitor Intelligence & Brand Sentiment Analysis Platform API",
    version="1.0.0",
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


@app.on_event("startup")
def on_startup():
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("RivalLens backend started successfully.")


@app.get("/api/health", summary="Health and status check", tags=["system"])
def health_check():
    db = SessionLocal()
    db_status = "connected"
    brand_count = 0
    mention_count = 0
    try:
        brand_count = db.query(Brand).count()
        mention_count = db.query(Mention).count()
    except Exception as exc:
        db_status = f"error: {str(exc)}"
    finally:
        db.close()

    return {
        "status": "ok",
        "app": "RivalLens",
        "version": "1.0.0",
        "environment": settings.environment,
        "database": {
            "status": db_status,
            "brandsTracked": brand_count,
            "totalMentions": mention_count,
        }
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled Exception at %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check the backend logs."}
    )