import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from sqlalchemy import Column, String, Float, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class NewsHeatScore(Base):
    """News heat score model.
    
    Stores calculation results of the news heat score system.
    """
    __tablename__ = "news_heat_scores"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_id = Column(String, index=True, nullable=False)
    source_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    
    # Heat score values
    heat_score = Column(Float, nullable=False, index=True)
    relevance_score = Column(Float)  # 关键词匹配度得分
    recency_score = Column(Float)    # 时效性得分
    popularity_score = Column(Float) # 原平台热度得分
    
    # Additional metadata
    meta_data = Column(JSON, nullable=True)  # 存储跨源频率得分、来源权重等额外信息
    keywords = Column(JSON, nullable=True)   # 提取的关键词列表
    
    # Timestamps
    calculated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    published_at = Column(DateTime, nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "news_id": self.news_id,
            "source_id": self.source_id,
            "title": self.title,
            "url": self.url,
            "heat_score": self.heat_score,
            "relevance_score": self.relevance_score,
            "recency_score": self.recency_score,
            "popularity_score": self.popularity_score,
            "meta_data": self.meta_data,
            "keywords": self.keywords,
            "calculated_at": self.calculated_at.isoformat() if self.calculated_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        } 