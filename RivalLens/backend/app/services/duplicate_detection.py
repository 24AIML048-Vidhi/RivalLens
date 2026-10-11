"""
Duplicate and Repeated Review Detection Service
Identifies exact, normalized, and fuzzy near-duplicate reviews across social mentions.
Groups duplicate reviews without deleting them, preserving representative reviews for unique analytics.
"""

import re
import uuid
import difflib
from sqlalchemy.orm import Session
from app.services.language_detection import normalize_text


def _clean_tokens(text: str) -> set[str]:
    """Extracts cleaned alphanumeric word tokens."""
    if not text:
        return set()
    return set(re.findall(r"\b[a-zA-Z0-9\u0900-\u097F\u0A80-\u0AFF]+\b", text.lower()))


def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculates multi-tier text similarity between 0.0 and 1.0:
    - Exact match: 1.0
    - Normalized match: 0.98
    - Token Jaccard + SequenceMatcher blend: 0.0 - 1.0
    """
    if not text1 or not text2:
        return 0.0

    t1_raw = text1.strip().lower()
    t2_raw = text2.strip().lower()

    if t1_raw == t2_raw:
        return 1.0

    # Normalized text check
    t1_norm = normalize_text(text1).lower()
    t2_norm = normalize_text(text2).lower()

    if t1_norm == t2_norm:
        return 0.98

    # Token overlap (Jaccard similarity)
    tokens1 = _clean_tokens(t1_norm)
    tokens2 = _clean_tokens(t2_norm)

    if not tokens1 or not tokens2:
        return 0.0

    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    jaccard = len(intersection) / len(union) if union else 0.0

    # Sequence matcher ratio for word order & character level similarity
    seq_ratio = difflib.SequenceMatcher(None, t1_norm, t2_norm).ratio()

    # Weighted blend
    similarity = (0.5 * jaccard) + (0.5 * seq_ratio)
    return round(similarity, 4)


def group_mentions_batch(items: list[dict]) -> list[dict]:
    """
    Groups a batch of new mention dicts into duplicate clusters.
    Sets duplicate_group_id, is_duplicate, and duplicate_count for each item.
    """
    if not items:
        return []

    # Map indices to cluster IDs
    clusters: list[list[int]] = []
    visited = [False] * len(items)

    for i in range(len(items)):
        if visited[i]:
            continue
        cluster = [i]
        visited[i] = True

        for j in range(i + 1, len(items)):
            if visited[j]:
                continue
            sim = calculate_similarity(items[i].get("text", ""), items[j].get("text", ""))
            if sim >= 0.82:
                cluster.append(j)
                visited[j] = True

        clusters.append(cluster)

    # Apply grouping attributes
    for cluster in clusters:
        group_id = f"dup-{uuid.uuid4().hex[:10]}"
        group_size = len(cluster)

        # Primary / representative is the first item
        rep_idx = cluster[0]
        items[rep_idx]["is_duplicate"] = False
        items[rep_idx]["duplicate_group_id"] = group_id
        items[rep_idx]["duplicate_count"] = group_size

        # Secondary items marked as duplicates
        for other_idx in cluster[1:]:
            items[other_idx]["is_duplicate"] = True
            items[other_idx]["duplicate_group_id"] = group_id
            items[other_idx]["duplicate_count"] = 0

    return items


def check_and_group_new_mention(
    db: Session,
    brand_id: str,
    text: str,
    similarity_threshold: float = 0.82
) -> tuple[bool, str, int]:
    """
    Checks whether a new mention text is a duplicate of an existing review for the brand.
    Returns:
      (is_duplicate, duplicate_group_id, duplicate_count)
    """
    from app.models.mention import Mention

    norm_new = normalize_text(text).lower()

    # Look up recent mentions for the brand
    existing_mentions = (
        db.query(Mention)
        .filter(Mention.brand_id == brand_id)
        .order_by(Mention.scraped_at.desc())
        .limit(200)
        .all()
    )

    for m in existing_mentions:
        sim = calculate_similarity(text, m.text)
        if sim >= similarity_threshold:
            # Duplicate found!
            group_id = m.duplicate_group_id or f"dup-{uuid.uuid4().hex[:10]}"
            if not m.duplicate_group_id:
                m.duplicate_group_id = group_id
                m.duplicate_count = (m.duplicate_count or 1) + 1

            # If existing mention is representative, increment its count
            if not m.is_duplicate:
                m.duplicate_count = (m.duplicate_count or 1) + 1
                db.add(m)

            return True, group_id, 0

    # Unique review
    new_group_id = f"dup-{uuid.uuid4().hex[:10]}"
    return False, new_group_id, 1

