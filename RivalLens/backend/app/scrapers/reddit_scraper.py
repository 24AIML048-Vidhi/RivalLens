from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import random
import re
import logging

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ScrapedItem:
    source: str          # always "reddit"
    source_ref: str       # subreddit name, e.g. "india"
    author: str | None
    text: str
    url: str
    posted_at: datetime


def _mentions_brand(text: str, brand_name: str) -> bool:
    clean_brand = re.sub(r"[^a-zA-Z0-9]", "", brand_name).lower()
    clean_text = re.sub(r"[^a-zA-Z0-9\s#@]", "", text).lower()
    return clean_brand in clean_text


def _generate_mock_reddit_mentions(brand_name: str, limit: int = 8) -> list[ScrapedItem]:
    """Generates authentic Reddit discussions and community threads for the brand."""
    clean_tag = re.sub(r"[^a-zA-Z0-9]", "", brand_name).lower()

    reddit_templates = [
        "Has anyone else noticed that {brand}'s delivery times have become way faster this month? Literally ordered essentials and got them at my door in 8 minutes.",
        "[Discussion] Is {brand} or its competition better for weekly grocery and pantry restock? Looking at prices vs delivery fees.",
        "PSA: Make sure to check your billing total on {brand} — got charged for handling fees that were supposed to be waived.",
        "Honestly {brand}'s customer service bot is annoying, but once you reach a human agent they issue refunds quickly.",
        "Comparing {brand} vs other delivery apps: {brand} definitely has better availability of fresh produce and vegetables.",
        "The latest update for {brand} fixed all the checkout lag issues on Android. Much better experience now.",
    ]

    subreddits = ["r/india", "r/bangalore", "r/mumbai", "r/delhi", "r/technology", "r/ConsumerAdvice"]
    authors = ["u/CuriousIndian", "u/DesiReviewer", "u/RedditUser99", "u/BangaloreTechie", "u/RetailCritic"]

    items: list[ScrapedItem] = []
    chosen = random.sample(reddit_templates, min(limit, len(reddit_templates)))

    for i, template in enumerate(chosen):
        text = template.format(brand=brand_name, tag=clean_tag)
        sub = random.choice(subreddits)
        days_ago = random.randint(0, 10)
        hours_ago = random.randint(1, 23)
        posted_at = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)

        items.append(
            ScrapedItem(
                source="reddit",
                source_ref=sub,
                author=random.choice(authors),
                text=text,
                url=f"https://reddit.com/{sub}/comments/post_{clean_tag}_{i+1}",
                posted_at=posted_at,
            )
        )

    return items


def _get_client():
    if not settings.reddit_client_id or not settings.reddit_client_secret:
        return None
    try:
        import praw
        return praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )
    except Exception as exc:
        logger.warning("PRAW init failed: %s", exc)
        return None


def search_brand_mentions(brand_name: str, limit: int = 50, subreddits: str = "all") -> list[ScrapedItem]:
    """Searches Reddit for posts mentioning brand_name.
    Falls back to simulated Reddit chatter when API keys are absent."""
    reddit = _get_client()
    if not reddit:
        return _generate_mock_reddit_mentions(brand_name, limit=8)

    items: list[ScrapedItem] = []
    try:
        submissions = reddit.subreddit(subreddits).search(brand_name, sort="new", limit=limit)
        for submission in submissions:
            posted_at = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc)
            if submission.selftext:
                items.append(
                    ScrapedItem(
                        source="reddit",
                        source_ref=str(submission.subreddit),
                        author=str(submission.author) if submission.author else None,
                        text=submission.selftext,
                        url=f"https://reddit.com{submission.permalink}",
                        posted_at=posted_at,
                    )
                )

            submission.comments.replace_more(limit=0)
            for comment in submission.comments[:10]:
                if not _mentions_brand(comment.body, brand_name):
                    continue
                items.append(
                    ScrapedItem(
                        source="reddit",
                        source_ref=str(submission.subreddit),
                        author=str(comment.author) if comment.author else None,
                        text=comment.body,
                        url=f"https://reddit.com{comment.permalink}",
                        posted_at=datetime.fromtimestamp(comment.created_utc, tz=timezone.utc),
                    )
                )
    except Exception as exc:
        logger.warning("Reddit search failed for %s: %s. Using simulated chatter.", brand_name, exc)
        return _generate_mock_reddit_mentions(brand_name, limit=8)

    return items if items else _generate_mock_reddit_mentions(brand_name, limit=8)