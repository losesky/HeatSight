from datetime import datetime
from typing import Dict, List, Any, Optional

from pydantic import BaseModel, Field, HttpUrl


class KeywordBase(BaseModel):
    """Keyword model with its weight."""
    word: str
    weight: float


class HeatScoreBase(BaseModel):
    """Base model for heat score."""
    news_id: str
    source_id: str
    title: str
    url: str
    heat_score: float
    relevance_score: Optional[float] = None
    recency_score: Optional[float] = None
    popularity_score: Optional[float] = None
    meta_data: Optional[Dict[str, Any]] = None
    keywords: Optional[List[KeywordBase]] = None
    calculated_at: datetime
    published_at: datetime
    updated_at: datetime


class HeatScoreCreate(BaseModel):
    """Model for heat score creation."""
    news_id: str
    source_id: str
    title: str
    url: str
    heat_score: float
    relevance_score: Optional[float] = None
    recency_score: Optional[float] = None
    popularity_score: Optional[float] = None
    meta_data: Optional[Dict[str, Any]] = None
    keywords: Optional[List[KeywordBase]] = None
    published_at: datetime


class HeatScoreResponse(HeatScoreBase):
    """Model for heat score response."""
    id: str

    class Config:
        from_attributes = True


class HeatScoreUpdate(BaseModel):
    """Model for heat score update."""
    heat_score: Optional[float] = None
    relevance_score: Optional[float] = None
    recency_score: Optional[float] = None
    popularity_score: Optional[float] = None
    meta_data: Optional[Dict[str, Any]] = None
    keywords: Optional[List[KeywordBase]] = None


class HeatScoreBulkResponse(BaseModel):
    """Model for bulk heat score response."""
    heat_scores: Dict[str, float] = Field(default_factory=dict)


class HeatScoreDetailedBulkResponse(BaseModel):
    """Model for detailed bulk heat score response."""
    heat_scores: Dict[str, HeatScoreResponse] = Field(default_factory=dict) 