from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union, Any

from loguru import logger
from sqlalchemy import desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.news_heat_score import NewsHeatScore
from app.schemas.news_heat_score import HeatScoreCreate, HeatScoreUpdate


async def create(db: AsyncSession, obj_in: HeatScoreCreate) -> NewsHeatScore:
    """Create a new heat score."""
    # 创建数据字典
    data = obj_in.model_dump(exclude_unset=True)
    
    # 设置计算时间和更新时间（带时区）
    now_with_tz = datetime.now(timezone.utc)
    
    # PostgreSQL需要不带时区的datetime对象，或者明确使用timestamptz类型
    # 移除时区信息，但保留UTC时间
    if "published_at" in data and data["published_at"] and data["published_at"].tzinfo is not None:
        # 保存UTC时间但去掉时区信息
        data["published_at"] = data["published_at"].replace(tzinfo=None)
    
    # 确保计算时间和更新时间没有时区信息
    data["calculated_at"] = now_with_tz.replace(tzinfo=None)
    data["updated_at"] = now_with_tz.replace(tzinfo=None)
    
    # 创建数据库对象并保存
    db_obj = NewsHeatScore(**data)
    db.add(db_obj)
    
    try:
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except Exception as e:
        await db.rollback()
        logger.error(f"创建热度评分失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def get(db: AsyncSession, id: str) -> Optional[NewsHeatScore]:
    """Get a heat score by ID."""
    try:
        result = await db.execute(select(NewsHeatScore).where(NewsHeatScore.id == id))
        # 使用同步方式获取第一个结果
        item = result.scalars().first()
        return item
    except Exception as e:
        logger.error(f"获取热度评分失败 (ID: {id}): {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def get_by_news_id(db: AsyncSession, news_id: str) -> Optional[NewsHeatScore]:
    """Get the latest heat score for a news item."""
    try:
        query = (
            select(NewsHeatScore)
            .where(NewsHeatScore.news_id == news_id)
            .order_by(desc(NewsHeatScore.calculated_at))
        )
        result = await db.execute(query)
        # 使用同步方式获取第一个结果
        item = result.scalars().first()
        return item
    except Exception as e:
        logger.error(f"根据新闻ID获取热度评分失败 (news_id: {news_id}): {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def get_multi_by_news_ids(
    db: AsyncSession, news_ids: List[str]
) -> Dict[str, NewsHeatScore]:
    """Get heat scores for multiple news items."""
    try:
        query = (
            select(NewsHeatScore)
            .where(NewsHeatScore.news_id.in_(news_ids))
            .order_by(desc(NewsHeatScore.calculated_at))
        )
        result = await db.execute(query)
        
        # Create a dictionary of news_id -> heat_score
        scores = {}
        
        # 使用同步方式处理结果集
        scalar_result = result.scalars()
        for row in scalar_result:
            if row.news_id not in scores:
                scores[row.news_id] = row
        
        return scores
    except Exception as e:
        logger.error(f"批量获取热度评分失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def get_top_heat_scores(
    db: AsyncSession, 
    limit: int = 50, 
    skip: int = 0,
    min_score: Optional[float] = None,
    max_age_hours: Optional[int] = 72,
) -> List[NewsHeatScore]:
    """Get top heat scores within the specified time window."""
    try:
        # 构建查询
        stmt = select(NewsHeatScore)
        
        # 应用过滤条件
        if max_age_hours is not None:
            # 先获取带时区的时间
            min_time_with_tz = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            # 移除时区信息，保留UTC时间值，因为数据库字段是TIMESTAMP WITHOUT TIME ZONE
            min_time = min_time_with_tz.replace(tzinfo=None)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
        
        if min_score is not None:
            stmt = stmt.where(NewsHeatScore.heat_score >= min_score)
        
        # 应用排序和分页
        stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
        
        if skip:
            stmt = stmt.offset(skip)
        
        if limit:
            stmt = stmt.limit(limit)
        
        # 执行查询
        result = await db.execute(stmt)
        
        # 使用同步方式处理结果集
        scores = []
        for row in result.scalars():
            scores.append(row)
        
        return scores
    except Exception as e:
        logger.error(f"获取热门评分新闻列表失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def get_top_news_as_dict(
    db: AsyncSession, 
    limit: int = 50, 
    skip: int = 0,
    min_score: Optional[float] = None,
    max_age_hours: Optional[int] = 72,
) -> List[Dict[str, Any]]:
    """获取热门新闻列表作为字典列表"""
    try:
        # 构建查询
        stmt = select(NewsHeatScore)
        
        # 应用过滤条件
        if max_age_hours is not None:
            # 先获取带时区的时间
            min_time_with_tz = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            # 移除时区信息，保留UTC时间值，因为数据库字段是TIMESTAMP WITHOUT TIME ZONE
            min_time = min_time_with_tz.replace(tzinfo=None)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
        
        if min_score is not None:
            stmt = stmt.where(NewsHeatScore.heat_score >= min_score)
        
        # 应用排序和分页
        stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
        
        if skip:
            stmt = stmt.offset(skip)
        
        if limit:
            stmt = stmt.limit(limit)
        
        # 执行查询
        result = await db.execute(stmt)
        
        # 获取结果并转换为字典列表
        news_list = []
        for row in result.scalars().all():
            item_dict = {
                "id": row.id,
                "news_id": row.news_id,
                "source_id": row.source_id,
                "title": row.title,
                "url": row.url,
                "heat_score": row.heat_score,
                "relevance_score": row.relevance_score,
                "recency_score": row.recency_score,
                "popularity_score": row.popularity_score,
                "meta_data": row.meta_data,
                "keywords": row.keywords,
                "calculated_at": row.calculated_at.isoformat() if row.calculated_at else None,
                "published_at": row.published_at.isoformat() if row.published_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            news_list.append(item_dict)
        
        return news_list
    except Exception as e:
        logger.error(f"获取热门新闻列表失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def update(
    db: AsyncSession, db_obj: NewsHeatScore, obj_in: Union[HeatScoreUpdate, Dict[str, Any]]
) -> NewsHeatScore:
    """Update a heat score."""
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.model_dump(exclude_unset=True)
    
    # 处理时区问题 - 更新时间设置为无时区的UTC时间
    now_with_tz = datetime.now(timezone.utc)
    update_data["updated_at"] = now_with_tz.replace(tzinfo=None)
    
    # 如果更新中包含published_at且有时区，移除时区信息
    if "published_at" in update_data and update_data["published_at"] and hasattr(update_data["published_at"], "tzinfo") and update_data["published_at"].tzinfo is not None:
        update_data["published_at"] = update_data["published_at"].replace(tzinfo=None)
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    try:
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except Exception as e:
        await db.rollback()
        logger.error(f"更新热度评分失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def delete(db: AsyncSession, id: str) -> bool:
    """Delete a heat score."""
    try:
        result = await db.execute(select(NewsHeatScore).where(NewsHeatScore.id == id))
        # 使用同步方式获取第一个结果
        obj = result.scalars().first()
        if not obj:
            return False
        
        await db.delete(obj)
        await db.commit()
        return True
    except Exception as e:
        logger.error(f"删除热度评分失败 (ID: {id}): {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise 