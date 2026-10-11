"""
NLP Sentiment Module - delegates to app.services.sentiment_service
Maintains backwards compatibility for any existing scraper or test imports.
"""

from app.services.sentiment_service import analyze_text, analyze_batch

# Aliases
analyze = analyze_text

__all__ = ["analyze", "analyze_text", "analyze_batch"]