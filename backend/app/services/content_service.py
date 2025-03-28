"""
Service for handling content generation and related operations.
"""

from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from loguru import logger

from app.models.topic import Topic, ContentSuggestion
from app.schemas.content import GeneratedContent


class ContentService:
    """Service for content generation and related operations."""
    
    @staticmethod
    async def get_content_suggestions_by_category(db: AsyncSession, category: str) -> Dict[str, List[str]]:
        """
        Get content suggestions for a specific category grouped by type.
        
        Args:
            db: Database session
            category: Category to find suggestions for
            
        Returns:
            Dictionary of suggestion types and their corresponding content lists
        """
        stmt = (
            select(ContentSuggestion)
            .where(ContentSuggestion.category == category)
            .order_by(ContentSuggestion.suggestion_type, ContentSuggestion.position)
        )
        result = await db.execute(stmt)
        suggestions = list(result.scalars().all())
        
        result = {
            "title_templates": [],
            "outline_templates": [],
            "key_point_templates": [],
            "intro_templates": []
        }
        
        for suggestion in suggestions:
            if suggestion.suggestion_type == "title":
                result["title_templates"].append(suggestion.content)
            elif suggestion.suggestion_type == "outline":
                result["outline_templates"].append(suggestion.content)
            elif suggestion.suggestion_type == "keyPoint":
                result["key_point_templates"].append(suggestion.content)
            elif suggestion.suggestion_type == "introduction":
                result["intro_templates"].append(suggestion.content)
        
        return result
    
    @staticmethod
    async def generate_content_for_topic(db: AsyncSession, topic_id: int) -> GeneratedContent:
        """
        Generate content suggestions for a specific topic.
        
        Args:
            db: Database session
            topic_id: ID of the topic to generate content for
            
        Returns:
            Generated content including title suggestions, outline, key points, and introduction
        """
        # Get the topic
        stmt = select(Topic).where(Topic.id == topic_id)
        result = await db.execute(stmt)
        topic = result.scalar_one_or_none()
        
        if not topic:
            raise ValueError(f"Topic with ID {topic_id} not found")
            
        # Get suggestions for the topic's category
        category = topic.category or "default"
        suggestions = await ContentService.get_content_suggestions_by_category(db, category)
        
        # Use default suggestions if no category-specific ones exist
        if not suggestions["title_templates"]:
            default_suggestions = await ContentService.get_content_suggestions_by_category(db, "default")
            for key, value in default_suggestions.items():
                if not suggestions[key]:
                    suggestions[key] = value
        
        # Format the suggestions with the topic title
        title_suggestions = [
            template.replace("{topic}", topic.title) 
            for template in suggestions["title_templates"][:4]  # Limit to 4 suggestions
        ]
        
        outline = [
            template.replace("{topic}", topic.title)
            for template in suggestions["outline_templates"]
        ]
        
        key_points = [
            template.replace("{topic}", topic.title)
            for template in suggestions["key_point_templates"][:5]  # Limit to 5 key points
        ]
        
        # Get the first introduction template or use a default one
        introduction = (
            suggestions["intro_templates"][0].replace("{topic}", topic.title)
            if suggestions["intro_templates"]
            else f"在当今快速变化的数字化时代，{topic.title}已成为业界关注的焦点。本文将深入探讨这一领域的最新发展，分析其对行业的影响，并提供实用的策略和建议，帮助读者更好地理解和应用相关知识。"
        )
        
        return GeneratedContent(
            title_suggestions=title_suggestions,
            outline=outline,
            key_points=key_points,
            introduction=introduction
        )
        
    @staticmethod
    async def generate_subtopics(topic_title: str, category: Optional[str] = None) -> List[str]:
        """
        Generate subtopics based on a main topic title and category.
        
        Args:
            topic_title: The main topic title
            category: Optional category for context
            
        Returns:
            List of generated subtopics
        """
        # This is a simplified version - in production, this might use ML models or APIs
        default_subtopics = [
            f"{topic_title}的历史背景与发展",
            f"{topic_title}的核心技术原理",
            f"{topic_title}在行业中的应用场景",
            f"{topic_title}面临的主要挑战",
            f"{topic_title}未来的发展趋势"
        ]
        
        category_subtopics = {
            "科技": [
                f"{topic_title}的技术架构解析",
                f"{topic_title}对传统技术的颠覆",
                f"{topic_title}的商业化路径",
                f"{topic_title}与人工智能的结合",
                f"{topic_title}的隐私与安全问题"
            ],
            "财经": [
                f"{topic_title}的投资价值分析",
                f"{topic_title}对市场格局的影响",
                f"{topic_title}背后的商业模式",
                f"{topic_title}的风险控制策略",
                f"{topic_title}相关企业估值研究"
            ],
            "教育": [
                f"{topic_title}在教育领域的创新应用",
                f"{topic_title}对学习方式的改变",
                f"{topic_title}的教学效果评估",
                f"{topic_title}与传统教育的融合",
                f"{topic_title}的可持续发展模式"
            ],
            # Add more categories as needed
        }
        
        if category and category in category_subtopics:
            return category_subtopics[category]
        
        return default_subtopics

# Create a singleton instance of the ContentService
content_service = ContentService() 