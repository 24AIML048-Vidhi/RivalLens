"""
The full pipeline for brands: scrape → language & normalize → duplicate detect → spam filter → sentiment/aspect → store → recompute rollup.
Supports scraping the active brand and all linked competitors.
"""

import logging
import sys

from app.database import SessionLocal
from app.models.brand import Brand
from app.models.mention import Mention
from app.scrapers import instagram_scraper, youtube_scraper, reddit_scraper
from app.nlp import sentiment, aspects
from app.services.language_detection import detect_language, normalize_text
from app.services.duplicate_detection import group_mentions_batch
from app.services.review_quality import calculate_spam_score
from app.services.brand_service import recompute_brand_rollup

logger = logging.getLogger(__name__)


def _ingest_single_brand(db, brand) -> int:
    """Scrapes and stores mentions across Instagram, YouTube, and Reddit for a brand."""
    scraped_items = []

    # 1. Instagram Scraper
    try:
        scraped_items += instagram_scraper.search_brand_mentions(brand.name)
    except Exception as exc:
        logger.warning("Instagram scrape failed for %s: %s", brand.name, exc)

    # 2. YouTube Scraper
    try:
        scraped_items += youtube_scraper.search_brand_mentions(brand.name)
    except Exception as exc:
        logger.warning("YouTube scrape failed for %s: %s", brand.name, exc)

    # 3. Reddit Scraper
    try:
        scraped_items += reddit_scraper.search_brand_mentions(brand.name)
    except Exception as exc:
        logger.warning("Reddit scrape failed for %s: %s", brand.name, exc)

    if not scraped_items:
        logger.info("No new mentions found for %s", brand.name)
        return 0

    # Build intermediate items dict
    items_data = []
    for item in scraped_items:
        raw_text = item.text.strip()
        lang, detected_codes = detect_language(raw_text)
        norm_text = normalize_text(raw_text)
        items_data.append({
            "source": item.source,
            "source_ref": item.source_ref,
            "author": item.author,
            "text": raw_text,
            "original_text": raw_text,
            "normalized_text": norm_text,
            "url": item.url,
            "posted_at": item.posted_at,
            "language": lang,
            "detected_languages": ",".join(detected_codes),
        })

    # Run Duplicate Detection on the batch
    grouped_items = group_mentions_batch(items_data)

    # Batch sentiment analysis on normalized texts
    norm_texts = [d["normalized_text"] for d in grouped_items]
    sentiment_results = sentiment.analyze_batch(norm_texts)

    for data, (label, score) in zip(grouped_items, sentiment_results):
        # Calculate Spam / Authenticity Score
        spam_score, review_status, _ = calculate_spam_score(
            text=data["text"],
            author=data.get("author"),
            is_duplicate=data.get("is_duplicate", False),
            dup_count=data.get("duplicate_count", 1)
        )

        aspect_val = aspects.extract_aspect(data["normalized_text"])

        mention = Mention(
            brand_id=brand.id,
            source=data["source"],
            source_ref=data["source_ref"],
            author=data["author"],
            text=data["text"],
            original_text=data["original_text"],
            normalized_text=data["normalized_text"],
            url=data["url"],
            sentiment_label=label,
            sentiment_score=score,
            aspect=aspect_val,
            spam_score=spam_score,
            review_status=review_status,
            is_duplicate=data.get("is_duplicate", False),
            duplicate_group_id=data.get("duplicate_group_id"),
            duplicate_count=data.get("duplicate_count", 1),
            language=data.get("language", "English"),
            detected_languages=data.get("detected_languages"),
            posted_at=data["posted_at"],
        )
        db.add(mention)

    db.commit()
    recompute_brand_rollup(db, brand.id)
    logger.info("Ingested %d mentions for %s (Intelligence pipeline applied)", len(scraped_items), brand.name)
    return len(scraped_items)


def run_ingestion_for_brand(brand_id: str, ingest_competitors: bool = True) -> dict:
    """Runs ingestion pipeline for the target brand and all its linked competitor brands."""
    db = SessionLocal()
    result_summary = {
        "brand_id": brand_id,
        "brand_name": "",
        "brand_mentions": 0,
        "competitor_mentions": {},
    }

    try:
        brand = db.query(Brand).filter(Brand.id == brand_id).first()
        if not brand:
            logger.warning("Ingestion skipped — brand %s not found", brand_id)
            return result_summary

        result_summary["brand_name"] = brand.name

        # 1. Ingest for target active brand
        logger.info("Starting ingestion for target brand: %s (%s)", brand.name, brand.id)
        target_count = _ingest_single_brand(db, brand)
        result_summary["brand_mentions"] = target_count

        # 2. Also ingest for all linked competitor brands
        if ingest_competitors and brand.competitors:
            for competitor in list(brand.competitors):
                if competitor.id != brand.id:
                    try:
                        logger.info("Ingesting competitor mentions for %s (competitor of %s)", competitor.name, brand.name)
                        comp_count = _ingest_single_brand(db, competitor)
                        result_summary["competitor_mentions"][competitor.name] = comp_count
                    except Exception as comp_exc:
                        logger.warning("Competitor ingestion error for %s: %s", competitor.name, comp_exc)

        logger.info("Completed ingestion run for %s: %s", brand.name, result_summary)
        return result_summary

    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.ingestion_service <brand_id>")
        sys.exit(1)
    run_ingestion_for_brand(sys.argv[1])

