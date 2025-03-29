"""
Pydantic schemas for Topic models.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, HttpUrl


class TopicBase(BaseModel):
    """Base schema for Topic."""
    title: str
    summary: Optional[str] = None
    source_id: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    heat: Optional[float] = 0.0


class TopicCreate(TopicBase):
    """Schema for creating a Topic."""
    published_at: Optional[datetime] = None
    extra: Optional[Dict[str, Any]] = None


class TopicUpdate(BaseModel):
    """Schema for updating a Topic."""
    title: Optional[str] = None
    summary: Optional[str] = None
    source_id: Optional[str] = None
    category: Optional[str] = None
    published_at: Optional[datetime] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    heat: Optional[float] = None
    extra: Optional[Dict[str, Any]] = None


class TopicResponse(TopicBase):
    """Schema for Topic response."""
    id: int
    published_at: Optional[datetime] = None
    extra: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TopicList(BaseModel):
    """Schema for list of topics."""
    items: List[TopicResponse]
    total: int
    page: int = 1
    page_size: int = 20 