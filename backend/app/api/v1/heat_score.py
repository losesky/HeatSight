from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from pydantic import BaseModel
import asyncio

from app.db.session import get_db_auto_commit, async_session_maker
from app.services.news_heat_score_service import heat_score_service, CACHE_PREFIX
from app.schemas.news_heat_score import (
    HeatScoreResponse,
    HeatScoreBulkResponse,
    HeatScoreDetailedBulkResponse,
)
from app.db.redis import redis_manager


router = APIRouter()


class NewsIdsRequest(BaseModel):
    news_ids: List[str]


@router.post("/scores", response_model=HeatScoreBulkResponse)
async def post_heat_scores(
    request: NewsIdsRequest,
    db: AsyncSession = Depends(get_db_auto_commit)
):
    """
    获取多个新闻的热度分数。
    
    用于热门信息流(/hot-news)页面的快速热度排序。
    
    请求体:
    - **news_ids**: 要获取热度分数的新闻ID列表
    """
    try:
        heat_scores = await heat_score_service.get_heat_scores(request.news_ids, db)
        return {"heat_scores": heat_scores}
    except Exception as e:
        logger.error(f"获取热度分数失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取热度分数失败: {str(e)}")


@router.post("/detailed-scores", response_model=HeatScoreDetailedBulkResponse)
async def post_detailed_heat_scores(
    request: NewsIdsRequest,
    db: AsyncSession = Depends(get_db_auto_commit)
):
    """
    获取多个新闻的详细热度数据，包括各维度分数和元数据。
    
    用于展示热度详细信息和可视化。
    
    请求体:
    - **news_ids**: 要获取热度详情的新闻ID列表
    """
    try:
        detailed_scores = await heat_score_service.get_detailed_heat_scores(request.news_ids, db)
        return {"heat_scores": detailed_scores}
    except Exception as e:
        logger.error(f"获取详细热度数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取详细热度数据失败: {str(e)}")


@router.get("/top", response_model=List[Dict[str, Any]])
async def get_top_news(
    limit: int = Query(50, description="Maximum number of items to return"),
    skip: int = Query(0, description="Number of items to skip"),
    min_score: Optional[float] = Query(30.0, description="Minimum heat score"),
    max_age_hours: Optional[int] = Query(72, description="Maximum age in hours"),
    db: AsyncSession = Depends(get_db_auto_commit)
):
    """
    获取热门新闻列表，按热度分数降序排列。
    
    用于热门榜单和热门推荐。
    
    - **limit**: 返回结果数量限制
    - **skip**: 分页偏移量
    - **min_score**: 最低热度分数阈值
    - **max_age_hours**: 最大时效性（小时）
    """
    try:
        logger.info(f"API 请求: 获取热门新闻 limit={limit}, skip={skip}, min_score={min_score}, max_age_hours={max_age_hours}")
        
        # 调用服务层获取数据
        news_list = await heat_score_service.get_top_news(
            limit=limit, 
            skip=skip, 
            min_score=min_score,
            max_age_hours=max_age_hours,
            session=db
        )
        
        # 验证结果类型
        if not isinstance(news_list, list):
            logger.warning(f"服务层返回的不是列表: {type(news_list)}")
            if news_list is None:
                return []
            # 尝试转换为列表
            try:
                news_list = list(news_list)
            except Exception as e:
                logger.error(f"无法将结果转换为列表: {e}")
                news_list = []
        
        logger.info(f"成功获取热门新闻列表，返回 {len(news_list)} 条记录")
        return news_list
    except Exception as e:
        # 详细记录错误
        logger.error(f"获取热门新闻失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取热门新闻失败: {str(e)}")


# 修改后台任务处理方式，确保正确的事务管理
async def run_update_task(db_dependency=None):
    """在独立会话中运行更新任务"""
    # 创建自己的会话，不依赖API提供的会话
    async with async_session_maker() as session:
        try:
            await heat_score_service.update_all_heat_scores(session)
            # 明确提交事务
            await session.commit()
            logger.info("热度分数更新任务完成并提交")
        except Exception as e:
            await session.rollback()
            logger.error(f"热度更新任务失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise


@router.post("/update", response_model=Dict[str, Any])
async def update_heat_scores(background_tasks: BackgroundTasks):
    """
    更新所有新闻的热度分数（触发后台任务）。
    
    主要用于手动触发热度更新，通常由定时任务自动执行。
    """
    try:
        # 在后台执行更新任务，使用专门的任务处理函数
        background_tasks.add_task(run_update_task)
        return {"status": "success", "message": "热度分数更新任务已启动"}
    except Exception as e:
        logger.error(f"启动热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动热度更新任务失败: {str(e)}")


@router.get("/keywords")
async def get_hot_keywords(
    limit: int = Query(50, ge=1, le=100, description="返回关键词数量"),
    min_heat: float = Query(0, ge=0, le=100, description="最低热度阈值"),
) -> List[Dict[str, Any]]:
    """
    获取热门关键词列表。
    
    返回按热度排序的关键词列表，每个关键词包含热度分数、出现次数和来源等信息。
    """
    try:
        # 从Redis缓存获取关键词数据
        cache_key = f"{CACHE_PREFIX}:keywords"
        cached_data = await redis_manager.get(cache_key)
        
        if not cached_data:
            logger.warning("关键词缓存未找到")
            return []
            
        # 过滤并排序关键词
        keywords = [
            kw for kw in cached_data 
            if kw.get("heat", 0) >= min_heat
        ]
        
        # 返回指定数量的关键词
        return keywords[:limit]
        
    except Exception as e:
        logger.error(f"获取热门关键词失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取热门关键词失败: {str(e)}")


@router.get("/source-weights")
async def get_source_weights(
    min_weight: float = Query(0, ge=0, le=100, description="最低权重阈值"),
) -> Dict[str, Any]:
    """
    获取新闻来源权重列表。
    
    返回所有新闻来源的权重信息，包括权重分数、平均互动量和更新频率等数据。
    结果按权重降序排列。
    """
    try:
        # 从Redis缓存获取来源权重数据
        cache_key = f"{CACHE_PREFIX}:source_weights"
        cached_data = await redis_manager.get(cache_key)
        
        if not cached_data:
            logger.warning("来源权重缓存未找到")
            return {}
            
        # 过滤低于阈值的来源
        filtered_sources = {
            source_id: data 
            for source_id, data in cached_data.items()
            if data.get("weight", 0) >= min_weight
        }
        
        # 按weight降序排序
        sorted_sources = dict(sorted(
            filtered_sources.items(),
            key=lambda x: x[1].get("weight", 0),
            reverse=True
        ))
        
        return sorted_sources
        
    except Exception as e:
        logger.error(f"获取来源权重失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取来源权重失败: {str(e)}")