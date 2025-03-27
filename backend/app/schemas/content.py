"""
Pydantic schemas for Content Suggestion models.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ContentSuggestionBase(BaseModel):
    """Base schema for Content Suggestion."""
    category: str
    suggestion_type: str
    content: str
    position: Optional[int] = 0


class ContentSuggestionCreate(ContentSuggestionBase):
    """Schema for creating a Content Suggestion."""
    topic_id: Optional[int] = None


class ContentSuggestionResponse(ContentSuggestionBase):
    """Schema for Content Suggestion response."""
    id: int
    topic_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GeneratedContent(BaseModel):
    """Schema for generated content response."""
    title_suggestions: List[str]
    outline: List[str]
    key_points: List[str]
    introduction: str 