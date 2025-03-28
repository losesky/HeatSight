"""
CRUD operations for ContentSuggestion model.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.crud.base import CRUDBase
from app.models.topic import ContentSuggestion
from app.schemas.content import ContentSuggestionCreate, ContentSuggestionBase


class CRUDContentSuggestion(CRUDBase[ContentSuggestion, ContentSuggestionCreate, ContentSuggestionBase]):
    """CRUD operations for ContentSuggestion model."""
    
    async def get_by_category(
        self, db: AsyncSession, *, category: str, suggestion_type: Optional[str] = None
    ) -> List[ContentSuggestion]:
        """
        Get content suggestions by category and optionally by type.
        """
        query = select(self.model).where(self.model.category == category)
        
        if suggestion_type:
            query = query.where(self.model.suggestion_type == suggestion_type)
            
        query = query.order_by(self.model.position)
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def get_by_topic(
        self, db: AsyncSession, *, topic_id: int, limit: int = 10
    ) -> List[ContentSuggestion]:
        """
        Get content suggestions by topic ID.
        """
        query = select(self.model).where(self.model.topic_id == topic_id)
        query = query.order_by(self.model.position).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def get_random(
        self, db: AsyncSession, *, limit: int = 10
    ) -> List[ContentSuggestion]:
        """
        Get random content suggestions.
        """
        # SQLAlchemy 异步不能直接使用 func.random()，使用基础的查询
        query = select(self.model).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def create_batch(
        self, db: AsyncSession, *, obj_in_list: List[ContentSuggestionCreate]
    ) -> List[ContentSuggestion]:
        """
        Create multiple content suggestions in one batch.
        """
        db_objs = []
        
        for obj_in in obj_in_list:
            obj_in_data = obj_in.model_dump()
            db_obj = self.model(**obj_in_data)
            db.add(db_obj)
            db_objs.append(db_obj)
            
        await db.commit()
        
        for db_obj in db_objs:
            await db.refresh(db_obj)
            
        return db_objs


content_suggestion = CRUDContentSuggestion(ContentSuggestion) 