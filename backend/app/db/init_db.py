"""
Database initialization script.

This script is responsible for creating initial data in the database.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Any

from sqlalchemy.orm import Session # type: ignore

from app import crud, models, schemas
from app.core.config import settings
from app.services.content_service import ContentService


logger = logging.getLogger(__name__)


def init_db(db: Session) -> None:
    """
    Initialize database with default data.
    """
    logger.info("Starting database initialization")
    
    # Create default topics
    create_default_topics(db)
    
    # Create default content suggestions
    create_default_content_suggestions(db)
    
    logger.info("Database initialization completed")


def create_default_topics(db: Session) -> None:
    """
    Create default topics for demo purposes.
    """
    logger.info("Creating default topics")
    
    default_topics = [
        {
            "title": "元宇宙发展现状与未来趋势",
            "summary": "Facebook更名为Meta后，元宇宙概念持续升温，各大科技巨头争相布局。",
            "source_id": "科技日报",
            "category": "科技",
            "published_at": datetime.now(),
            "url": "https://example.com/news/1",
            "image_url": "https://via.placeholder.com/300x200?text=元宇宙",
            "heat": 98,
            "extra": {"likes": 1205, "comments": 368}
        },
        {
            "title": "数字人民币试点扩大到更多城市",
            "summary": "数字人民币试点范围进一步扩大，新增多个省份的主要城市。",
            "source_id": "金融时报",
            "category": "财经",
            "published_at": datetime.now(),
            "url": "https://example.com/news/2",
            "image_url": "https://via.placeholder.com/300x200?text=数字人民币",
            "heat": 92,
            "extra": {"likes": 845, "comments": 226}
        },
        {
            "title": "新能源汽车销量创历史新高",
            "summary": "今年以来，我国新能源汽车销量持续攀升，市场渗透率进一步提高。",
            "source_id": "汽车周刊",
            "category": "汽车",
            "published_at": datetime.now(),
            "url": "https://example.com/news/3",
            "image_url": "https://via.placeholder.com/300x200?text=新能源汽车",
            "heat": 85,
            "extra": {"likes": 632, "comments": 154}
        },
        {
            "title": "AI绘画引发版权争议",
            "summary": "人工智能绘画工具的兴起引发了关于艺术创作版权归属的广泛争议。",
            "source_id": "数字文化报",
            "category": "文化",
            "published_at": datetime.now(),
            "url": "https://example.com/news/4",
            "image_url": "https://via.placeholder.com/300x200?text=AI绘画",
            "heat": 82,
            "extra": {"likes": 758, "comments": 293}
        },
        {
            "title": "芯片短缺问题持续影响全球供应链",
            "summary": "全球芯片短缺情况虽有所缓解，但仍影响多个行业生产和供应。",
            "source_id": "半导体周刊",
            "category": "科技",
            "published_at": datetime.now(),
            "url": "https://example.com/news/8",
            "image_url": "https://via.placeholder.com/300x200?text=芯片短缺",
            "heat": 73,
            "extra": {"likes": 289, "comments": 105}
        },
        {
            "title": "在线教育行业进入深度调整期",
            "summary": "双减政策一年后，在线教育企业纷纷转型，行业生态重构。",
            "source_id": "教育时报",
            "category": "教育",
            "published_at": datetime.now(),
            "url": "https://example.com/news/7",
            "image_url": "https://via.placeholder.com/300x200?text=在线教育",
            "heat": 74,
            "extra": {"likes": 356, "comments": 127}
        },
        {
            "title": "碳达峰碳中和政策推进情况分析",
            "summary": "各地积极推进碳达峰碳中和相关政策，能源结构持续优化。",
            "source_id": "能源评论",
            "category": "环保",
            "published_at": datetime.now(),
            "url": "https://example.com/news/6",
            "image_url": "https://via.placeholder.com/300x200?text=碳中和",
            "heat": 76,
            "extra": {"likes": 412, "comments": 98}
        },
        {
            "title": "直播电商新规出台",
            "summary": "新规要求直播带货需更加规范透明，明确标示商品信息和促销规则。",
            "source_id": "电商日报",
            "category": "电商",
            "published_at": datetime.now(),
            "url": "https://example.com/news/5",
            "image_url": "https://via.placeholder.com/300x200?text=直播电商",
            "heat": 79,
            "extra": {"likes": 542, "comments": 187}
        }
    ]
    
    for topic_data in default_topics:
        # Check if topic already exists
        existing_topic = db.query(models.Topic).filter(models.Topic.title == topic_data["title"]).first()
        if existing_topic:
            logger.info(f"Topic '{topic_data['title']}' already exists, skipping")
            continue
        
        # Create new topic
        topic_in = schemas.TopicCreate(
            title=topic_data["title"],
            summary=topic_data["summary"],
            source_id=topic_data["source_id"],
            category=topic_data["category"],
            published_at=topic_data["published_at"],
            url=topic_data["url"],
            image_url=topic_data["image_url"],
            heat=topic_data["heat"],
            extra=topic_data["extra"]
        )
        crud.topic.create(db, obj_in=topic_in)
        logger.info(f"Created topic: {topic_data['title']}")


def create_default_content_suggestions(db: Session) -> None:
    """
    Create default content suggestions for demo purposes.
    """
    logger.info("Creating default content suggestions")
    
    # Define suggestions by category and type
    suggestions_data = {
        "科技": {
            "title": [
                "{topic}：改变行业格局的技术革新",
                "{topic}的商业应用与投资价值分析",
                "{topic}：从概念到落地的全景分析",
                "2023年{topic}发展趋势报告"
            ],
            "outline": [
                "1. 引言：技术创新的时代背景",
                "2. 核心技术剖析：原理与架构",
                "3. 产业链分析：关键参与者与技术壁垒",
                "4. 市场应用场景与典型案例",
                "5. 商业模式与投资逻辑",
                "6. 未来发展趋势与潜在挑战"
            ],
            "keyPoint": [
                "{topic}市场规模预计在未来5年内达到千亿规模",
                "核心技术壁垒主要集中在算法、计算力和数据三方面",
                "产业链上下游已形成初步生态，但整合度仍有待提高",
                "头部企业已在该领域投入大量研发资源，竞争格局正在形成",
                "政策支持力度逐渐加大，规范化管理同步推进",
                "商业模式正从B端向C端逐步拓展，多样化场景落地"
            ],
            "introduction": "近期，{topic}成为科技领域的焦点话题，其突破性进展吸引了产业界、投资界的广泛关注。本文将从技术原理、应用场景、商业模式和未来趋势等多个维度对{topic}进行深入解析，帮助读者全面把握这一前沿技术带来的变革与机遇。"
        },
        "财经": {
            "title": [
                "{topic}投资策略与风险分析",
                "{topic}对宏观经济的影响与展望",
                "把握{topic}背后的投资机会",
                "{topic}相关产业链深度剖析"
            ],
            "outline": [
                "1. 市场概况：发展历程与现状",
                "2. 政策环境：相关法规与监管动态",
                "3. 市场参与者分析：头部机构与新兴力量",
                "4. 风险因素与应对策略",
                "5. 投资机会分析与布局建议",
                "6. 未来展望与趋势预测"
            ],
            "keyPoint": [
                "{topic}已成为资本市场重点关注的新兴领域",
                "相关政策趋势逐渐明朗，监管框架日趋完善",
                "头部机构战略布局加速，市场集中度有望提升",
                "中长期投资价值显著，但短期波动风险需关注",
                "产业链上下游整合将创造新的价值增长点",
                "国际市场比较视角下，国内市场仍具较大发展空间"
            ],
            "introduction": "{topic}作为金融市场的重要议题，正引发投资者广泛关注。本文将从宏观经济背景出发，结合政策环境变化，深入分析{topic}的投资价值、风险特征以及未来发展路径，为投资者提供系统性的分析框架和具体的投资策略参考。"
        },
        "教育": {
            "title": [
                "{topic}教育变革与创新实践",
                "解析{topic}教育的挑战与机遇",
                "{topic}如何重塑教育生态",
                "未来教育视角下的{topic}发展路径"
            ],
            "outline": [
                "1. 教育背景：传统模式的局限性",
                "2. {topic}的核心理念与方法论",
                "3. 实践案例：成功经验与典型模式",
                "4. 挑战分析：实施障碍与解决方案",
                "5. 效果评估：学习成效与能力提升",
                "6. 未来展望：教育生态的重构与创新"
            ],
            "keyPoint": [
                "{topic}正在改变传统的教学模式和学习方式",
                "个性化、适应性学习是{topic}的核心价值主张",
                "教师角色转变是实施{topic}的关键因素之一",
                "技术支持为{topic}提供了可能，但不是全部",
                "评估体系需要同步革新，关注综合能力培养",
                "家校协同在{topic}实施过程中扮演重要角色"
            ],
            "introduction": "教育领域的变革正在加速，{topic}作为其中的重要议题，正在引领新的教育理念和实践方向。本文将探讨{topic}的核心理念、实施路径和实践案例，分析其对学习者、教育者和教育生态的深远影响，并提出未来发展的思考与建议。"
        },
        "default": {
            "title": [
                "{topic}完全指南：核心要点与深度解析",
                "{topic}：现状、挑战与未来方向",
                "{topic}的多维度分析与实践参考",
                "解码{topic}：趋势把握与实操建议"
            ],
            "outline": [
                "1. 引言：话题背景与重要性",
                "2. 概念界定与理论基础",
                "3. 现状分析：发展历程与关键因素",
                "4. 案例研究：典型实践与经验总结",
                "5. 挑战与机遇：问题与潜力并存",
                "6. 未来展望：趋势预测与建议"
            ],
            "keyPoint": [
                "{topic}已成为行业关注的焦点，影响日益扩大",
                "正确理解{topic}的核心概念对把握其本质至关重要",
                "目前{topic}发展呈现出区域不平衡、结构性转变等特点",
                "先行者的实践经验表明，创新思维和系统方法是成功关键",
                "面临的主要挑战包括认知偏差、资源限制和环境变化",
                "未来发展将更加注重可持续性、整合性和价值创造"
            ],
            "introduction": "{topic}作为当下备受关注的话题，其重要性和影响力不断提升。本文将从多个角度对{topic}进行全面解析，包括其基本概念、发展现状、实践案例以及未来趋势，旨在为读者提供系统性的认识框架和实用的参考指南。"
        }
    }
    
    # Create content suggestions batch by batch
    for category, type_data in suggestions_data.items():
        for suggestion_type, contents in type_data.items():
            # Create batch of suggestions
            suggestions_batch = []
            for position, content in enumerate(contents):
                suggestion_in = schemas.ContentSuggestionCreate(
                    category=category,
                    suggestion_type=suggestion_type,
                    content=content,
                    position=position
                )
                suggestions_batch.append(suggestion_in)
            
            # Check if suggestions already exist for this category and type
            existing_suggestions = db.query(models.ContentSuggestion).filter(
                models.ContentSuggestion.category == category,
                models.ContentSuggestion.suggestion_type == suggestion_type
            ).count()
            
            if existing_suggestions == 0:
                crud.content_suggestion.create_batch(db, obj_in_list=suggestions_batch)
                logger.info(f"Created {len(suggestions_batch)} {suggestion_type} suggestions for category '{category}'")
            else:
                logger.info(f"Suggestions for category '{category}' and type '{suggestion_type}' already exist, skipping") 