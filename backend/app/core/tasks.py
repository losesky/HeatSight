"""
Schedule and manage periodic tasks.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.scheduler import scheduler
from app.services.news_heat_score_service import heat_score_service


async def update_heat_scores_task(session: AsyncSession):
    """Update all news heat scores."""
    logger.info("[任务执行] 开始更新热门新闻热度分数")
    try:
        news_count = await heat_score_service.update_all_heat_scores(session)
        # 明确提交事务
        await session.commit()
        logger.info(f"[任务完成] 热门新闻热度分数更新完成，已更新 {len(news_count) if news_count else 0} 条记录")
    except Exception as e:
        # 发生异常时回滚
        await session.rollback()
        logger.error(f"[任务错误] 热门新闻热度分数更新失败 - {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


async def update_keyword_heat_task(session: AsyncSession):
    """Update keyword heat scores."""
    logger.info("[任务执行] 开始更新关键词热度")
    try:
        keywords = await heat_score_service.update_keyword_heat(session)
        # 明确提交事务
        await session.commit()
        logger.info(f"[任务完成] 关键词热度更新完成，已更新 {len(keywords) if keywords else 0} 个关键词")
    except Exception as e:
        # 发生异常时回滚
        await session.rollback()
        logger.error(f"[任务错误] 关键词热度更新失败 - {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


async def update_source_weights_task(session: AsyncSession):
    """Update source weights."""
    logger.info("[任务执行] 开始更新来源权重")
    try:
        sources = await heat_score_service.update_source_weights(session)
        # 明确提交事务
        await session.commit()
        logger.info(f"[任务完成] 来源权重更新完成，已更新 {len(sources) if sources else 0} 个来源")
    except Exception as e:
        # 发生异常时回滚
        await session.rollback()
        logger.error(f"[任务错误] 来源权重更新失败 - {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


def register_tasks():
    """Register all scheduled tasks."""
    
    # 热门新闻热度更新：每10分钟
    scheduler.add_task(
        task_id="update_heat_scores",
        func=update_heat_scores_task,
        interval=10 * 60,  #10 minutes
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