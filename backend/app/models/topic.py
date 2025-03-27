"""
Topic related data models.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class Topic(Base):
    """Topic model for storing hot topics data."""
    
    __tablename__ = "topics"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    source_name = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)
    published_at = Column(DateTime, default=datetime.utcnow)
    url = Column(String(512), nullable=True)
    image_url = Column(String(512), nullable=True)
    heat = Column(Float, default=0)
    extra = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with ContentSuggestion
    suggestions = relationship("ContentSuggestion", back_populates="topic", cascade="all, delete-orphan")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "source_name": self.source_name,
            "category": self.category,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "url": self.url,
            "image_url": self.image_url,
            "extra": {
                "heat": self.heat,
                **(self.extra or {})
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ContentSuggestion(Base):
    """Content suggestions model for storing template suggestions based on topic categories."""
    
    __tablename__ = "content_suggestions"
    
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    category = Column(String(50), index=True, nullable=False)
    suggestion_type = Column(String(50), nullable=False)  # title, outline, keyPoint, introduction
    content = Column(Text, nullable=False)
    position = Column(Integer, default=0)  # For ordering within a category
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with Topic
    topic = relationship("Topic", back_populates="suggestions")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "topic_id": self.topic_id,
            "category": self.category,
            "suggestion_type": self.suggestion_type,
            "content": self.content,
            "position": self.position,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        } 