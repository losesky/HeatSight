from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.services.news_heat_score_service import heat_score_service
from app.schemas.news_heat_score import (
    HeatScoreResponse,
    HeatScoreBulkResponse,
    HeatScoreDetailedBulkResponse,
)


router = APIRouter()


@router.get("/scores", response_model=HeatScoreBulkResponse)
async def get_heat_scores(
    news_ids: List[str] = Query(..., description="List of news IDs to get heat scores for"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取多个新闻的热度分数。
    
    用于热门信息流(/hot-news)页面的快速热度排序。
    
    - **news_ids**: 要获取热度分数的新闻ID列表
    """
    try:
        heat_scores = await heat_score_service.get_heat_scores(news_ids, db)
        return {"heat_scores": heat_scores}
    except Exception as e:
        logger.error(f"获取热度分数失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取热度分数失败: {str(e)}")


@router.get("/detailed-scores", response_model=HeatScoreDetailedBulkResponse)
async def get_detailed_heat_scores(
    news_ids: List[str] = Query(..., description="List of news IDs to get detailed heat scores for"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取多个新闻的详细热度数据，包括各维度分数和元数据。
    
    用于展示热度详细信息和可视化。
    
    - **news_ids**: 要获取热度详情的新闻ID列表
    """
    try:
        detailed_scores = await heat_score_service.get_detailed_heat_scores(news_ids, db)
        return {"heat_scores": detailed_scores}
    except Exception as e:
        logger.error(f"获取详细热度数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取详细热度数据失败: {str(e)}")


@router.get("/top", response_model=List[Dict[str, Any]])
async def get_top_news(
    limit: int = Query(50, description="Maximum number of items to return"),
    skip: int = Query(0, description="Number of items to skip"),
    min_score: Optional[float] = Query(50.0, description="Minimum heat score"),
    max_age_hours: Optional[int] = Query(72, description="Maximum age in hours"),
    db: AsyncSession = Depends(get_db)
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


@router.post("/update", response_model=Dict[str, Any])
async def update_heat_scores(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    更新所有新闻的热度分数（触发后台任务）。
    
    主要用于手动触发热度更新，通常由定时任务自动执行。
    """
    try:
        # 在后台执行更新任务
        background_tasks.add_task(heat_score_service.update_all_heat_scores, db)
        return {"status": "success", "message": "热度分数更新任务已启动"}
    except Exception as e:
        logger.error(f"启动热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动热度更新任务失败: {str(e)}")