"""
CRUD operations for Topic model.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.sql import Select

from app.crud.base import CRUDBase
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicUpdate


class CRUDTopic(CRUDBase[Topic, TopicCreate, TopicUpdate]):
    """CRUD operations for Topic model."""
    
    async def get_by_category(self, db: AsyncSession, *, category: str, skip: int = 0, limit: int = 100) -> List[Topic]:
        """
        Get topics by category.
        """
        stmt = select(self.model).where(self.model.category == category).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_by_title_search(self, db: AsyncSession, *, query: str, skip: int = 0, limit: int = 100) -> List[Topic]:
        """
        Search topics by title.
        """
        search_query = f"%{query}%"
        stmt = select(self.model).where(self.model.title.ilike(search_query)).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_hot_topics(self, db: AsyncSession, *, limit: int = 10) -> List[Topic]:
        """
        Get hot topics sorted by heat.
        """
        stmt = select(self.model).order_by(self.model.heat.desc()).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_by_category_with_pagination(
        self, 
        db: AsyncSession, 
        *, 
        category: Optional[str] = None, 
        page: int = 1, 
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get topics by category with pagination.
        """
        skip = (page - 1) * page_size
        
        # Base query
        stmt = select(self.model)
        
        # Apply category filter if provided
        if category:
            stmt = stmt.where(self.model.category == category)
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Get paginated items
        paginated_stmt = stmt.order_by(self.model.heat.desc()).offset(skip).limit(page_size)
        result = await db.execute(paginated_stmt)
        items = list(result.scalars().all())
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }


topic = CRUDTopic(Topic) 