"""
One-off cleanup for mentions ingested before the brand-name filter was added
to the scrapers. Deletes any stored mention whose text doesn't actually
contain the brand name, then recomputes that brand's rollup stats.

Usage:
    python -m app.scripts.cleanup_unrelated_mentions <brand_id>
    python -m app.scripts.cleanup_unrelated_mentions --all
"""

import sys

from app.database import SessionLocal
from app.models.brand import Brand
from app.models.mention import Mention
from app.services.brand_service import recompute_brand_rollup


def _mentions_brand(text: str, brand_name: str) -> bool:
    return brand_name.lower() in text.lower()


def cleanup_brand(db, brand: Brand) -> int:
    mentions = db.query(Mention).filter(Mention.brand_id == brand.id).all()
    removed = 0

    for mention in mentions:
        if not _mentions_brand(mention.text, brand.name):
            db.delete(mention)
            removed += 1

    if removed:
        db.commit()
        recompute_brand_rollup(db, brand.id)

    return removed


def main():
    db = SessionLocal()
    try:
        if len(sys.argv) < 2:
            print("Usage: python -m app.scripts.cleanup_unrelated_mentions <brand_id> | --all")
            sys.exit(1)

        target = sys.argv[1]

        if target == "--all":
            brands = db.query(Brand).all()
        else:
            brand = db.query(Brand).filter(Brand.id == target).first()
            if not brand:
                print(f"No brand found with id {target}")
                sys.exit(1)
            brands = [brand]

        for brand in brands:
            removed = cleanup_brand(db, brand)
            print(f"{brand.name}: removed {removed} unrelated mention(s), {brand.mention_count} remain")

    finally:
        db.close()


if __name__ == "__main__":
    main()