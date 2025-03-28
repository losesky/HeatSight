"""
Schedule and manage periodic tasks.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.scheduler import scheduler
from app.services.news_heat_score_service import heat_score_service


async def update_heat_scores_task(session: AsyncSession):
    """Update all news heat scores."""
    logger.info("定时任务：开始更新热门新闻热度分数")
    await heat_score_service.update_all_heat_scores(session)
    logger.info("定时任务：热门新闻热度分数更新完成")


async def update_keyword_heat_task(session: AsyncSession):
    """Update keyword heat scores."""
    logger.info("定时任务：开始更新关键词热度")
    # 实现关键词热度更新逻辑
    # 可以调用 heat_score_service 中新增的方法
    # 例如：await heat_score_service.update_keyword_heat(session)
    logger.info("定时任务：关键词热度更新完成")


async def update_source_weights_task(session: AsyncSession):
    """Update source weights."""
    logger.info("定时任务：开始更新来源权重")
    # 实现来源权重更新逻辑
    # 可以调用 heat_score_service 中新增的方法
    # 例如：await heat_score_service.update_source_weights(session)
    logger.info("定时任务：来源权重更新完成")


def register_tasks():
    """Register all scheduled tasks."""
    
    # 热门新闻热度更新：每30分钟
    scheduler.add_task(
        task_id="update_heat_scores",
        func=update_heat_scores_task,
        interval=30 * 60,  # 30 minutes
        with_session=True
    )
    
    # 关键词热度更新：每60分钟
    scheduler.add_task(
        task_id="update_keyword_heat",
        func=update_keyword_heat_task,
        interval=60 * 60,  # 60 minutes
        with_session=True
    )
    
    # 来源权重更新：每天一次
    scheduler.add_task(
        task_id="update_source_weights",
        func=update_source_weights_task,
        interval=24 * 60 * 60,  # 24 hours
        with_session=True
    ) 