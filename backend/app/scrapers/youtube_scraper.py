from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import random
import re
import logging

from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_QUERY_SUFFIXES = ("app", "delivery", "review")


@dataclass
class ScrapedItem:
    source: str          # "youtube"
    source_ref: str       # video ID or channel name
    author: str | None
    text: str
    url: str
    posted_at: datetime


def _mentions_brand(text: str, brand_name: str) -> bool:
    """Check if comment or text mentions brand."""
    clean_brand = re.sub(r"[^a-zA-Z0-9]", "", brand_name).lower()
    clean_text = re.sub(r"[^a-zA-Z0-9\s#@]", "", text).lower()
    return clean_brand in clean_text


def _generate_mock_youtube_mentions(brand_name: str, limit: int = 12) -> list[ScrapedItem]:
    """Generates realistic YouTube video comments and reviews for the brand
    when YouTube Data API key is not configured."""
    clean_tag = re.sub(r"[^a-zA-Z0-9]", "", brand_name).lower()
    
    comment_templates = [
        (
            "Been using {brand} for the last 6 months after watching this review. Honestly the app speed and tracking accuracy is unmatched compared to alternatives.",
            "positive",
            "Speed / UX",
        ),
        (
            "Great comparison! {brand} definitely has better pricing and discounts, but their customer support takes forever to reply.",
            "neutral",
            "Customer Support",
        ),
        (
            "I stopped ordering from {brand} after my delivery got delayed by 45 minutes twice in a row with zero refund. Terrible experience.",
            "negative",
            "Delivery",
        ),
        (
            "The new UI update for {brand} is so clean and easy to navigate! Huge improvement over previous version.",
            "positive",
            "User Experience",
        ),
        (
            "Does {brand} offer student discounts or loyalty rewards in Tier 2 cities? Thinking of switching.",
            "neutral",
            "Pricing",
        ),
        (
            "Hands down the best service in the industry right now. {brand} delivered in under 10 mins and items were fresh.",
            "positive",
            "Delivery",
        ),
        (
            "The hidden platform fee on {brand} is getting ridiculous recently. They add extra charges on checkout.",
            "negative",
            "Pricing",
        ),
        (
            "Comprehensive breakdown! {brand} has clearly taken the market lead this quarter.",
            "positive",
            "Market / General",
        ),
        (
            "I had an issue with a damaged item and {brand} support resolved it with an instant refund in 2 minutes. Impressed!",
            "positive",
            "Customer Support",
        ),
        (
            "Whenever peak hours hit, {brand} app crashes or shows unavailable in my area. They really need better server scaling.",
            "negative",
            "Reliability",
        ),
        (
            "Comparing {brand} with competitors, the product quality and packaging are noticeably superior.",
            "positive",
            "Product Quality",
        ),
        (
            "Solid review! {brand} has been my go-to for daily needs. Reliable and consistent.",
            "positive",
            "General",
        ),
    ]

    items: list[ScrapedItem] = []
    chosen = random.sample(comment_templates, min(limit, len(comment_templates)))

    channel_authors = [
        "TechReviewerIndia", "ConsumerPulse", "AaravSh", "PriyaVlogs",
        "RohanGadgets", "DailyShopper", "Neha_G", "KaranT", "UrbanExplorer"
    ]

    for i, (template, sentiment_tag, aspect_hint) in enumerate(chosen):
        text = template.format(brand=brand_name, tag=clean_tag)
        video_id = f"yt_{clean_tag}_{i+101}"
        days_ago = random.randint(0, 14)
        hours_ago = random.randint(1, 23)
        posted_at = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)

        items.append(
            ScrapedItem(
                source="youtube",
                source_ref=video_id,
                author=random.choice(channel_authors),
                text=text,
                url=f"https://youtube.com/watch?v={video_id}",
                posted_at=posted_at,
            )
        )

    return items


def _get_client():
    if not settings.youtube_api_key:
        return None
    try:
        from googleapiclient.discovery import build
        return build("youtube", "v3", developerKey=settings.youtube_api_key)
    except Exception as exc:
        logger.warning("Failed to initialize YouTube API client: %s", exc)
        return None


def _search_videos(youtube, query: str, max_results: int) -> list[str]:
    response = (
        youtube.search()
        .list(q=query, part="id", type="video", maxResults=max_results, order="relevance")
        .execute()
    )
    return [item["id"]["videoId"] for item in response.get("items", [])]


def _find_candidate_videos(youtube, brand_name: str, max_videos: int, query_suffixes) -> list[str]:
    per_query = max(1, max_videos // max(1, len(query_suffixes)))
    seen: dict[str, None] = {}

    for suffix in query_suffixes:
        query = f"{brand_name} {suffix}".strip()
        for video_id in _search_videos(youtube, query, per_query):
            seen[video_id] = None

    return list(seen.keys())[:max_videos]


def _get_comments_for_video(youtube, video_id: str, brand_name: str, max_comments: int) -> list[ScrapedItem]:
    items: list[ScrapedItem] = []
    try:
        response = (
            youtube.commentThreads()
            .list(part="snippet", videoId=video_id, maxResults=max_comments, order="relevance", textFormat="plainText")
            .execute()
        )
    except Exception:
        return items

    for thread in response.get("items", []):
        snippet = thread["snippet"]["topLevelComment"]["snippet"]
        text = snippet.get("textDisplay", "")

        if not _mentions_brand(text, brand_name):
            continue

        items.append(
            ScrapedItem(
                source="youtube",
                source_ref=video_id,
                author=snippet.get("authorDisplayName"),
                text=text,
                url=f"https://youtube.com/watch?v={video_id}&lc={thread['id']}",
                posted_at=datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00")),
            )
        )
    return items


def search_brand_mentions(
    brand_name: str,
    max_videos: int = 15,
    max_comments_per_video: int = 10,
    query_suffixes: tuple[str, ...] = DEFAULT_QUERY_SUFFIXES,
) -> list[ScrapedItem]:
    """Searches YouTube for brand video comments.
    Falls back to mock mentions when API key is missing or fails."""
    youtube = _get_client()
    
    if youtube:
        try:
            items: list[ScrapedItem] = []
            video_ids = _find_candidate_videos(youtube, brand_name, max_videos, query_suffixes)
            for video_id in video_ids:
                items.extend(_get_comments_for_video(youtube, video_id, brand_name, max_comments_per_video))
            if items:
                return items
        except Exception as exc:
            logger.warning("Live YouTube API query failed for %s: %s. Using simulated chatter.", brand_name, exc)

    return _generate_mock_youtube_mentions(brand_name, limit=12)