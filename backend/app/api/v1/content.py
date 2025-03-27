"""
API endpoints for content generation and related operations.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from loguru import logger

from app.db.session import get_db
from app.services.content_service import ContentService
from app.crud import topic, content_suggestion
from app.schemas.content import GeneratedContent

router = APIRouter()


@router.get("/generate/{topic_id}", response_model=GeneratedContent)
async def generate_content(
    topic_id: int,
    db: Session = Depends(get_db),
):
    """
    Generate content for a specific topic.
    
    This endpoint generates content suggestions based on the selected topic.
    """
    try:
        # Check if topic exists
        topic_obj = topic.get(db, id=topic_id)
        if not topic_obj:
            raise HTTPException(status_code=404, detail=f"Topic with ID {topic_id} not found")
        
        # Generate content
        generated_content = ContentService.generate_content_for_topic(db, topic_id)
        
        return generated_content
    except ValueError as e:
        logger.error(f"Value error in generate_content: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating content for topic {topic_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating content: {str(e)}"
        )


@router.get("/subtopics")
async def get_subtopics(
    topic_title: str = Query(..., description="The main topic title"),
    category: Optional[str] = Query(None, description="Optional category for context"),
):
    """
    Generate subtopics for a given main topic.
    
    This endpoint suggests related subtopics based on the main topic title.
    """
    try:
        subtopics = ContentService.generate_subtopics(topic_title, category)
        return {"subtopics": subtopics}
    except Exception as e:
        logger.error(f"Error generating subtopics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating subtopics: {str(e)}"
        ) 