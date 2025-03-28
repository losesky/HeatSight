"""
API endpoints for content generation and related operations.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.services.content_service import ContentService
from app.crud import topic, content_suggestion
from app.schemas.content import GeneratedContent

router = APIRouter()


@router.get("/generate/{topic_id}", response_model=GeneratedContent)
async def generate_content(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate content for a specific topic.
    
    This endpoint generates content suggestions based on the selected topic.
    """
    try:
        # Check if topic exists
        topic_obj = await topic.get(db, id=topic_id)
        if not topic_obj:
            raise HTTPException(status_code=404, detail=f"Topic with ID {topic_id} not found")
        
        # Generate content
        generated_content = await ContentService.generate_content_for_topic(db, topic_id)
        
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
        subtopics = await ContentService.generate_subtopics(topic_title, category)
        return {"subtopics": subtopics}
    except Exception as e:
        logger.error(f"Error generating subtopics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating subtopics: {str(e)}"
        )


@router.get("/suggestions")
async def get_content_suggestions(
    topic_id: Optional[int] = Query(None, description="Topic ID to get suggestions for"),
    limit: int = Query(10, ge=1, le=50, description="Number of suggestions to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get content suggestions.
    
    This endpoint returns content suggestions for a specific topic or random suggestions if no topic is specified.
    """
    try:
        if topic_id:
            # 检查话题是否存在
            topic_obj = await topic.get(db, id=topic_id)
            if not topic_obj:
                raise HTTPException(status_code=404, detail=f"Topic with ID {topic_id} not found")
            
            # 获取话题的内容建议
            suggestions = await content_suggestion.get_by_topic(db, topic_id=topic_id, limit=limit)
        else:
            # 获取随机内容建议
            suggestions = await content_suggestion.get_random(db, limit=limit)
        
        # 转换为响应格式
        result = {
            "suggestions": [s.to_dict() for s in suggestions]
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting content suggestions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting content suggestions: {str(e)}"
        ) 