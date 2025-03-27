"""
CRUD operations for ContentSuggestion model.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.topic import ContentSuggestion
from app.schemas.content import ContentSuggestionCreate, ContentSuggestionBase


class CRUDContentSuggestion(CRUDBase[ContentSuggestion, ContentSuggestionCreate, ContentSuggestionBase]):
    """CRUD operations for ContentSuggestion model."""
    
    def get_by_category(
        self, db: Session, *, category: str, suggestion_type: Optional[str] = None
    ) -> List[ContentSuggestion]:
        """
        Get content suggestions by category and optionally by type.
        """
        query = db.query(self.model).filter(self.model.category == category)
        
        if suggestion_type:
            query = query.filter(self.model.suggestion_type == suggestion_type)
            
        return query.order_by(self.model.position).all()
    
    def get_by_topic_id(
        self, db: Session, *, topic_id: int, suggestion_type: Optional[str] = None
    ) -> List[ContentSuggestion]:
        """
        Get content suggestions by topic ID and optionally by type.
        """
        query = db.query(self.model).filter(self.model.topic_id == topic_id)
        
        if suggestion_type:
            query = query.filter(self.model.suggestion_type == suggestion_type)
            
        return query.order_by(self.model.position).all()
    
    def create_batch(
        self, db: Session, *, obj_in_list: List[ContentSuggestionCreate]
    ) -> List[ContentSuggestion]:
        """
        Create multiple content suggestions in one batch.
        """
        db_objs = []
        
        for obj_in in obj_in_list:
            obj_in_data = obj_in.dict()
            db_obj = self.model(**obj_in_data)
            db.add(db_obj)
            db_objs.append(db_obj)
            
        db.commit()
        
        for db_obj in db_objs:
            db.refresh(db_obj)
            
        return db_objs


content_suggestion = CRUDContentSuggestion(ContentSuggestion) 