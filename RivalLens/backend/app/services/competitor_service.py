"""
Competitor Analysis & Suggestion Service

Provides:
- Auto-discovery of 2 or 3 similar-category competitors based on domain intelligence + tracked DB brands.
- Retrieval of saved competitors for active brands.
- Zero contamination with unrelated search brands.
"""

import re
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.brand import Brand

# Domain intelligence catalog for smart category suggestions
INDUSTRY_COMPETITORS = {
    "quick commerce": [
        {"name": "Blinkit", "category": "Quick Commerce", "reason": "Leading 10-minute grocery delivery competitor"},
        {"name": "Zepto", "category": "Quick Commerce", "reason": "High-growth quick commerce rival"},
        {"name": "Swiggy Instamart", "category": "Quick Commerce", "reason": "Major grocery and instant retail platform"},
        {"name": "BigBasket BB Now", "category": "Quick Commerce", "reason": "Established instant grocery player"},
    ],
    "grocery": [
        {"name": "Blinkit", "category": "Quick Commerce", "reason": "Leading 10-minute grocery delivery competitor"},
        {"name": "Zepto", "category": "Quick Commerce", "reason": "High-growth quick commerce rival"},
        {"name": "Swiggy Instamart", "category": "Quick Commerce", "reason": "Major grocery and instant retail platform"},
        {"name": "JioMart", "category": "Grocery", "reason": "Nationwide grocery delivery retail platform"},
    ],
    "food delivery": [
        {"name": "Swiggy", "category": "Food Delivery", "reason": "Direct hyper-local food & restaurant delivery rival"},
        {"name": "Zomato", "category": "Food Delivery", "reason": "Market-leading food ordering and dining ecosystem"},
        {"name": "Uber Eats", "category": "Food Delivery", "reason": "Global on-demand food delivery network"},
        {"name": "EatSure", "category": "Food Delivery", "reason": "Multi-brand cloud kitchen food ordering platform"},
    ],
    "food": [
        {"name": "Swiggy", "category": "Food Delivery", "reason": "Direct hyper-local food & restaurant delivery rival"},
        {"name": "Zomato", "category": "Food Delivery", "reason": "Market-leading food ordering and dining ecosystem"},
        {"name": "DoorDash", "category": "Food Delivery", "reason": "On-demand food and restaurant delivery"},
    ],
    "ecommerce": [
        {"name": "Amazon", "category": "E-Commerce", "reason": "Leading global marketplace and retail platform"},
        {"name": "Flipkart", "category": "E-Commerce", "reason": "Major multi-category consumer e-commerce competitor"},
        {"name": "Meesho", "category": "E-Commerce", "reason": "High-volume social and value commerce platform"},
        {"name": "Myntra", "category": "Fashion E-Commerce", "reason": "Specialized fashion and lifestyle marketplace"},
    ],
    "e-commerce": [
        {"name": "Amazon", "category": "E-Commerce", "reason": "Leading global marketplace and retail platform"},
        {"name": "Flipkart", "category": "E-Commerce", "reason": "Major multi-category consumer e-commerce competitor"},
        {"name": "Meesho", "category": "E-Commerce", "reason": "High-volume social and value commerce platform"},
    ],
    "shopping": [
        {"name": "Amazon", "category": "E-Commerce", "reason": "Global marketplace leader"},
        {"name": "Flipkart", "category": "E-Commerce", "reason": "Major online retail marketplace"},
        {"name": "Myntra", "category": "Fashion", "reason": "Premier fashion destination"},
    ],
    "ride hailing": [
        {"name": "Uber", "category": "Ride Hailing", "reason": "Global ride-hailing and mobility network"},
        {"name": "Ola", "category": "Ride Hailing", "reason": "Leading regional cab and mobility service"},
        {"name": "BluSmart", "category": "EV Mobility", "reason": "All-electric premium cab service"},
        {"name": "Rapido", "category": "Bike & Auto Hailing", "reason": "High-frequency two-wheeler and auto ride service"},
    ],
    "cab": [
        {"name": "Uber", "category": "Ride Hailing", "reason": "Global ride-hailing and mobility network"},
        {"name": "Ola", "category": "Ride Hailing", "reason": "Leading regional cab and mobility service"},
        {"name": "BluSmart", "category": "EV Mobility", "reason": "All-electric premium cab service"},
    ],
    "fintech": [
        {"name": "PhonePe", "category": "FinTech", "reason": "Top digital payments and UPI ecosystem"},
        {"name": "Paytm", "category": "FinTech", "reason": "Pioneer in mobile payments and financial services"},
        {"name": "Google Pay", "category": "FinTech", "reason": "Widespread mobile UPI and bill payment platform"},
        {"name": "CRED", "category": "FinTech", "reason": "Premium rewards and credit card payment platform"},
    ],
    "payments": [
        {"name": "PhonePe", "category": "FinTech", "reason": "Top digital payments and UPI ecosystem"},
        {"name": "Paytm", "category": "FinTech", "reason": "Pioneer in mobile payments and financial services"},
        {"name": "Razorpay", "category": "FinTech", "reason": "Leading payments gateway and banking platform"},
    ],
    "streaming": [
        {"name": "Netflix", "category": "Streaming / OTT", "reason": "Global premium video streaming entertainment"},
        {"name": "Prime Video", "category": "Streaming / OTT", "reason": "Amazon's comprehensive content streaming service"},
        {"name": "Disney+ Hotstar", "category": "Streaming / OTT", "reason": "Leading live sports and entertainment streaming platform"},
        {"name": "JioCinema", "category": "Streaming / OTT", "reason": "Major free and premium content streaming hub"},
    ],
    "ott": [
        {"name": "Netflix", "category": "Streaming / OTT", "reason": "Global premium video streaming entertainment"},
        {"name": "Prime Video", "category": "Streaming / OTT", "reason": "Amazon's content streaming service"},
        {"name": "Disney+ Hotstar", "category": "Streaming / OTT", "reason": "Sports and entertainment streaming hub"},
    ],
    "edtech": [
        {"name": "PhysicsWallah", "category": "EdTech", "reason": "Affordable online and hybrid learning platform"},
        {"name": "Unacademy", "category": "EdTech", "reason": "Comprehensive test prep and live learning platform"},
        {"name": "Coursera", "category": "EdTech", "reason": "Global higher education and certification platform"},
        {"name": "Udemy", "category": "EdTech", "reason": "Skill-based on-demand video course marketplace"},
    ],
    "fashion": [
        {"name": "Zara", "category": "Fashion", "reason": "Global fast-fashion trendsetter"},
        {"name": "H&M", "category": "Fashion", "reason": "Global accessible fashion apparel retailer"},
        {"name": "Uniqlo", "category": "Fashion", "reason": "Everyday functional and high-quality apparel"},
        {"name": "Myntra", "category": "Fashion", "reason": "Top online fashion and apparel marketplace"},
    ],
    "sportswear": [
        {"name": "Nike", "category": "Sportswear", "reason": "Leading global athletic footwear and apparel brand"},
        {"name": "Adidas", "category": "Sportswear", "reason": "Major international sports lifestyle and performance brand"},
        {"name": "Puma", "category": "Sportswear", "reason": "High-growth athletic and streetwear footwear brand"},
    ],
    "coffee": [
        {"name": "Starbucks", "category": "Beverages", "reason": "Global specialty coffeehouse chain"},
        {"name": "Blue Tokai", "category": "Beverages", "reason": "Artisanal specialty coffee roaster"},
        {"name": "Third Wave Coffee", "category": "Beverages", "reason": "Modern craft coffee cafe chain"},
        {"name": "Dunkin'", "category": "Beverages", "reason": "Quick-service coffee and bakery chain"},
    ],
    "saas": [
        {"name": "Notion", "category": "SaaS / Productivity", "reason": "All-in-one connected workspace and docs tool"},
        {"name": "Slack", "category": "SaaS / Productivity", "reason": "Industry-standard real-time team communication hub"},
        {"name": "Asana", "category": "SaaS / Productivity", "reason": "Enterprise work management and project tracker"},
        {"name": "Monday.com", "category": "SaaS / Productivity", "reason": "Customizable workflow and project management platform"},
    ],
    "cloud": [
        {"name": "AWS", "category": "Cloud Computing", "reason": "Leading global cloud infrastructure provider"},
        {"name": "Microsoft Azure", "category": "Cloud Computing", "reason": "Enterprise cloud services and AI ecosystem"},
        {"name": "Google Cloud", "category": "Cloud Computing", "reason": "Data analytics and AI-first cloud platform"},
    ],
}


def _match_category_key(category_text: str) -> str | None:
    """Finds the best matching category key in the knowledge base."""
    if not category_text:
        return None
    cleaned = category_text.lower().strip()
    
    for key in INDUSTRY_COMPETITORS:
        if key in cleaned or cleaned in key:
            return key
    return None


def suggest_competitors(
    db: Session,
    brand_name: str,
    category: str = "",
    count: int = 2,
    exclude_brand_id: str | None = None,
) -> list[dict]:
    """
    Auto-suggests 2 or 3 similar category competitors for a brand.
    Combines already tracked DB brands and domain knowledge suggestions.
    """
    clean_target_name = brand_name.strip().lower()
    target_category = (category or "").strip()
    
    count = max(2, min(3, count))
    suggestions: list[dict] = []
    seen_names: set[str] = {clean_target_name}

    # 1. Query existing tracked brands in the same or similar category
    db_query = db.query(Brand)
    if exclude_brand_id:
        db_query = db_query.filter(Brand.id != exclude_brand_id)
    
    all_db_brands = db_query.all()
    
    # Filter DB brands that match category
    matched_db_brands = []
    if target_category:
        for b in all_db_brands:
            if b.name.strip().lower() in seen_names:
                continue
            if b.category and (
                target_category.lower() in b.category.lower()
                or b.category.lower() in target_category.lower()
            ):
                matched_db_brands.append(b)

    for b in matched_db_brands:
        if len(suggestions) >= count:
            break
        suggestions.append({
            "id": b.id,
            "name": b.name,
            "category": b.category or target_category or "General",
            "reason": f"Tracked competitor in {b.category or target_category}",
            "tracked": True,
        })
        seen_names.add(b.name.strip().lower())

    # 2. Query domain knowledge catalog
    cat_key = _match_category_key(target_category) or _match_category_key(brand_name)
    
    catalog_items = []
    if cat_key and cat_key in INDUSTRY_COMPETITORS:
        catalog_items = INDUSTRY_COMPETITORS[cat_key]
    else:
        # Generic fallback based on any keyword match
        for key, items in INDUSTRY_COMPETITORS.items():
            if any(word in clean_target_name for word in key.split()):
                catalog_items = items
                break

    for item in catalog_items:
        if len(suggestions) >= count:
            break
        item_name_lower = item["name"].lower()
        if item_name_lower in seen_names:
            continue

        # Check if this catalog brand already exists in DB
        existing_brand = next(
            (b for b in all_db_brands if b.name.lower() == item_name_lower),
            None
        )

        suggestions.append({
            "id": existing_brand.id if existing_brand else None,
            "name": item["name"],
            "category": item.get("category", target_category or "General"),
            "reason": item.get("reason", f"Similar market player in {target_category or 'industry'}"),
            "tracked": existing_brand is not None,
        })
        seen_names.add(item_name_lower)

    # 3. If still under count, draw from other tracked DB brands
    if len(suggestions) < count:
        for b in all_db_brands:
            if len(suggestions) >= count:
                break
            if b.name.strip().lower() in seen_names:
                continue
            suggestions.append({
                "id": b.id,
                "name": b.name,
                "category": b.category or "General",
                "reason": "Existing tracked brand in library",
                "tracked": True,
            })
            seen_names.add(b.name.strip().lower())

    return suggestions[:count]


def get_saved_competitors(brand: Brand) -> list[dict]:
    """Returns the list of competitors directly associated with this brand."""
    if not brand or not brand.competitors:
        return []
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category or "General",
        }
        for c in brand.competitors
        if c.id != brand.id
    ]
