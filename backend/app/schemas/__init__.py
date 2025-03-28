"""
Pydantic schemas for the API.
"""

# Import schemas to expose them at package level
from .topic import TopicBase, TopicCreate, TopicUpdate, TopicResponse, TopicList
from .content import ContentSuggestionBase, ContentSuggestionCreate, ContentSuggestionResponse, GeneratedContent
from .news_heat_score import (
    KeywordBase,
    HeatScoreBase,
    HeatScoreCreate,
    HeatScoreResponse,
    HeatScoreUpdate,
    HeatScoreBulkResponse,
    HeatScoreDetailedBulkResponse,
) 