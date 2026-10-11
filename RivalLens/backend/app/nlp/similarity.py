"""
Competitor similarity: given a brand's description/category text, suggests
which already-tracked brands are its closest competitors, using SBERT
sentence embeddings + cosine similarity. Used by the "Add brand" flow to
auto-suggest competitors instead of requiring the user to type them all.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer, util

MODEL_NAME = "all-MiniLM-L6-v2"  # small, fast, good enough for short brand/category text


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def find_similar_brands(target_text: str, candidates: list[tuple[str, str]], top_k: int = 5) -> list[str]:
    """
    target_text: description/category of the brand being added.
    candidates: list of (brand_id, description_text) for existing tracked brands.
    Returns brand_ids of the top_k most similar candidates.
    """
    if not candidates:
        return []

    model = _get_model()
    target_embedding = model.encode(target_text, convert_to_tensor=True)
    candidate_texts = [text for _, text in candidates]
    candidate_embeddings = model.encode(candidate_texts, convert_to_tensor=True)

    scores = util.cos_sim(target_embedding, candidate_embeddings)[0]
    ranked = sorted(zip(candidates, scores.tolist()), key=lambda pair: pair[1], reverse=True)

    return [brand_id for (brand_id, _), _ in ranked[:top_k]]