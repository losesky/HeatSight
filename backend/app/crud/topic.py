"""
CRUD operations for Topic model.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.crud.base import CRUDBase
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicUpdate


class CRUDTopic(CRUDBase[Topic, TopicCreate, TopicUpdate]):
    """CRUD operations for Topic model."""
    
    def get_by_category(self, db: Session, *, category: str, skip: int = 0, limit: int = 100) -> List[Topic]:
        """
        Get topics by category.
        """
        return db.query(self.model).filter(self.model.category == category).offset(skip).limit(limit).all()
    
    def get_by_title_search(self, db: Session, *, query: str, skip: int = 0, limit: int = 100) -> List[Topic]:
        """
        Search topics by title.
        """
        search_query = f"%{query}%"
        return db.query(self.model).filter(self.model.title.ilike(search_query)).offset(skip).limit(limit).all()
    
    def get_hot_topics(self, db: Session, *, limit: int = 10) -> List[Topic]:
        """
        Get hot topics sorted by heat.
        """
        return db.query(self.model).order_by(self.model.heat.desc()).limit(limit).all()
    
    def get_by_category_with_pagination(
        self, 
        db: Session, 
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
        query = db.query(self.model)
        
        # Apply category filter if provided
        if category:
            query = query.filter(self.model.category == category)
        
        # Get total count
        total = query.count()
        
        # Get paginated items
        items = query.order_by(self.model.heat.desc()).offset(skip).limit(page_size).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }


topic = CRUDTopic(Topic) 