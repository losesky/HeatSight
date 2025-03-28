from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Optional, Any
from loguru import logger

from app.api import deps
from app.crud import news_heat_score
from app.schemas.news_heat_score import NewsHeatScoreResponse
from app.services.news_heat_score_service import heat_score_service

router = APIRouter()


@router.get("/top", response_model=List[NewsHeatScoreResponse])
async def get_top_news(
    db: AsyncSession = Depends(deps.get_db),
    limit: int = Query(10, ge=1, le=100),
    skip: int = Query(0, ge=0),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_age_hours: Optional[int] = Query(None, ge=1),
) -> List[NewsHeatScoreResponse]:
    """
    获取热门新闻列表
    """
    try:
        heat_scores = await news_heat_score.get_top_heat_scores(
            db, limit=limit, skip=skip, min_score=min_score, max_age_hours=max_age_hours
        )
        return heat_scores
    except Exception as e:
        logger.error(f"获取热门新闻失败: {e}")
        raise HTTPException(status_code=500, detail="获取热门新闻失败")


@router.post("/update")
async def update_heat_scores(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
) -> Dict[str, Any]:
    """
    手动触发更新所有新闻的热度分数
    """
    try:
        # 在后台任务中运行，避免阻塞API响应
        background_tasks.add_task(heat_score_service.update_all_heat_scores, db)
        return {
            "success": True,
            "message": "新闻热度更新任务已启动，将在后台运行"
        }
    except Exception as e:
        logger.error(f"启动热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail="启动热度更新任务失败")


@router.post("/update-keywords")
async def update_keywords(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
) -> Dict[str, Any]:
    """
    手动触发更新关键词热度
    """
    try:
        # 在后台任务中运行
        background_tasks.add_task(heat_score_service.update_keyword_heat, db)
        return {
            "success": True,
            "message": "关键词热度更新任务已启动，将在后台运行"
        }
    except Exception as e:
        logger.error(f"启动关键词热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail="启动关键词热度更新任务失败")


@router.post("/update-source-weights")
async def update_source_weights(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
) -> Dict[str, Any]:
    """
    手动触发更新来源权重
    """
    try:
        # 在后台任务中运行
        background_tasks.add_task(heat_score_service.update_source_weights, db)
        return {
            "success": True,
            "message": "来源权重更新任务已启动，将在后台运行"
        }
    except Exception as e:
        logger.error(f"启动来源权重更新任务失败: {e}")
        raise HTTPException(status_code=500, detail="启动来源权重更新任务失败") 