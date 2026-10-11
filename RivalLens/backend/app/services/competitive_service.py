"""
Competitor Intelligence, Weakness Detection & Share of Voice Service

Calculates:
- Share of Voice percentage per brand (Brand Mentions / Total Benchmark Mentions * 100)
- Aspect-by-aspect sentiment benchmark comparison (Delivery, Pricing, Quality, Support, App experience, etc.)
- Automated Strengths, Weaknesses, and Differentiation Opportunities identification
"""

from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.mention import Mention
from app.services import brand_service, comparison_service


def calculate_competitive_insights(db: Session, brand_id: str, competitor_ids: list[str] | None = None) -> dict:
    """
    Computes dynamic aspect comparison, competitor weakness detection, and share of voice.
    """
    target_brand = brand_service.get_brand(db, brand_id)
    if not target_brand:
        target_brand = brand_service.get_brand_by_name(db, brand_id)

    if not target_brand:
        return {
            "brand_id": brand_id,
            "brand_name": "Unknown",
            "share_of_voice": [],
            "strengths": [],
            "weaknesses": [],
            "opportunities": [],
            "aspect_benchmarks": [],
        }

    # Collect competitor IDs
    if competitor_ids is None:
        competitor_ids = [c.id for c in target_brand.competitors if c.id != target_brand.id] if target_brand.competitors else []
    else:
        competitor_ids = [cid for cid in competitor_ids if cid != target_brand.id]

    all_compared_ids = [target_brand.id] + competitor_ids

    # Fetch comparison data for target brand + competitors
    comp_res = comparison_service.compare_brands(db, all_compared_ids)
    compared_brands = comp_res.brands if comp_res else []

    # 1. Calculate Share of Voice
    total_benchmark_mentions = sum(b.mentionCount for b in compared_brands) or 1

    share_of_voice = []
    for b in compared_brands:
        sov_pct = round((b.mentionCount / total_benchmark_mentions) * 100, 1)
        share_of_voice.append({
            "brand_id": b.id,
            "brand_name": b.name,
            "mention_count": b.mentionCount,
            "share_of_voice_pct": sov_pct,
            "sentiment_score": b.sentimentScore,
            "trend": b.trend,
            "trend_delta": b.trendDelta,
        })

    share_of_voice.sort(key=lambda s: s["share_of_voice_pct"], reverse=True)

    # 2. Fetch Aspect Sentiment for target brand and each competitor
    brand_aspect_maps = {}
    for b in compared_brands:
        aspects_list = brand_service.get_aspects(db, b.id)
        aspect_dict = {}
        for a in aspects_list:
            # Positive score approximation: 50 + (positive% - negative%) * 0.4
            asp_score = round(50.0 + (a.positive - a.negative) * 0.4, 1)
            aspect_dict[a.aspect] = {
                "positive": a.positive,
                "negative": a.negative,
                "score": asp_score,
                "count": a.mentionCount,
            }
        brand_aspect_maps[b.id] = aspect_dict

    target_aspects = brand_aspect_maps.get(target_brand.id, {})
    comp_aspect_maps = {bid: amap for bid, amap in brand_aspect_maps.items() if bid != target_brand.id}

    all_aspect_names = set(target_aspects.keys())
    for amap in comp_aspect_maps.values():
        all_aspect_names.update(amap.keys())

    aspect_benchmarks = []
    strengths = []
    weaknesses = []
    opportunities = []

    for aspect in all_aspect_names:
        target_info = target_aspects.get(aspect, {"score": 50.0, "positive": 50.0, "negative": 0.0, "count": 0})
        target_score = target_info["score"]

        comp_scores = []
        comp_details = {}
        for comp_id, amap in comp_aspect_maps.items():
            comp_brand_obj = next((b for b in compared_brands if b.id == comp_id), None)
            comp_name = comp_brand_obj.name if comp_brand_obj else comp_id
            if aspect in amap:
                comp_scores.append(amap[aspect]["score"])
                comp_details[comp_name] = amap[aspect]["score"]

        avg_comp_score = round(sum(comp_scores) / len(comp_scores), 1) if comp_scores else target_score
        diff = round(target_score - avg_comp_score, 1)

        aspect_benchmarks.append({
            "aspect": aspect,
            "target_score": target_score,
            "competitor_avg_score": avg_comp_score,
            "diff": diff,
            "competitor_breakdown": comp_details,
        })

        # Identify Strengths
        if diff >= 4.0:
            strengths.append({
                "aspect": aspect,
                "advantage_pct": f"+{diff}%",
                "target_score": target_score,
                "benchmark_avg": avg_comp_score,
                "detail": f"{target_brand.name} outperforms competitor average by {diff}% in {aspect}.",
            })
        # Identify Weaknesses
        elif diff <= -4.0:
            weaknesses.append({
                "aspect": aspect,
                "gap_pct": f"{diff}%",
                "target_score": target_score,
                "benchmark_avg": avg_comp_score,
                "detail": f"{target_brand.name} trails competitor benchmark by {abs(diff)}% in {aspect}.",
            })

        # Identify Opportunities (Where competitors underperform)
        for comp_name, c_score in comp_details.items():
            if c_score < 45.0 and target_score > c_score + 3.0:
                opportunities.append({
                    "aspect": aspect,
                    "competitor": comp_name,
                    "competitor_score": c_score,
                    "target_score": target_score,
                    "opportunity": f"{comp_name} has weak sentiment ({c_score} pts) in '{aspect}'. {target_brand.name} can capture market share by highlighting superior service.",
                })

    return {
        "brand_id": target_brand.id,
        "brand_name": target_brand.name,
        "share_of_voice": share_of_voice,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "opportunities": opportunities,
        "aspect_benchmarks": aspect_benchmarks,
    }
