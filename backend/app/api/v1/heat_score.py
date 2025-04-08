from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from pydantic import BaseModel
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select, or_
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import get_db_auto_commit, async_session_maker
from app.services.news_heat_score_service import heat_score_service, CACHE_PREFIX
from app.schemas.news_heat_score import (
    HeatScoreResponse,
    HeatScoreBulkResponse,
    HeatScoreDetailedBulkResponse,
)
from app.models.news_heat_score import NewsHeatScore
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
    category: Optional[str] = Query(None, description="Filter news by category. Multiple categories can be specified as comma-separated values, e.g. 'news,social,video'"),
    db: AsyncSession = Depends(get_db_auto_commit)
):
    """
    获取热门新闻列表，按热度分数降序排列。
    
    用于热门榜单和热门推荐。
    
    - **limit**: 返回结果数量限制
    - **skip**: 分页偏移量
    - **min_score**: 最低热度分数阈值
    - **max_age_hours**: 最大时效性（小时）
    - **category**: 按新闻分类筛选，支持多分类（逗号分隔，如'news,social,video'）
    """
    try:
        logger.info(f"API 请求: 获取热门新闻 limit={limit}, skip={skip}, min_score={min_score}, max_age_hours={max_age_hours}, category={category}")
        
        # 调用服务层获取数据
        news_list = await heat_score_service.get_top_news(
            limit=limit, 
            skip=skip, 
            min_score=min_score,
            max_age_hours=max_age_hours,
            category=category,
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
    按权重降序排列。
    """
    try:
        # 从Redis缓存获取来源权重数据
        cache_key = f"{CACHE_PREFIX}:source_weights"
        cached_data = await redis_manager.get(cache_key)
        
        if not cached_data:
            logger.warning("来源权重缓存未找到")
            return {"total_sources": 0, "sources": []}
        
        # 从HeatLink API获取源信息
        try:
            # 修改这里，使用external/sources端点而不是sources
            sources_data = await heat_score_service.heatlink_client.get(
                "external/sources", 
                use_cache=True,
                cache_key_prefix="sources",
                force_refresh=False
            )
            
            # 处理API返回值可能是列表或字典的情况
            if isinstance(sources_data, dict):
                sources_info = {s["source_id"]: s for s in sources_data.get("sources", [])}
            else:
                sources_info = {s["source_id"]: s for s in sources_data}
        except Exception as e:
            logger.error(f"获取源信息失败: {e}")
            sources_info = {}
            
        # 过滤低于阈值的来源并转换为列表格式
        sources_list = []
        for source_id, weight_data in cached_data.items():
            if weight_data.get("weight", 0) >= min_weight:
                # 获取源的详细信息
                source_info = sources_info.get(source_id, {})
                source_data = {
                    "source_id": source_id,
                    "name": source_info.get("name", source_id),
                    "category": source_info.get("category", "unknown"),
                    "country": source_info.get("country", "unknown"),
                    "language": source_info.get("language", "unknown"),
                    "update_interval": source_info.get("update_interval", 0),
                    "cache_ttl": source_info.get("cache_ttl", 0),
                    "description": source_info.get("description", ""),
                    "weight": weight_data.get("weight", 0),
                    "avg_engagement": weight_data.get("avg_engagement", 0),
                    "update_frequency": weight_data.get("update_frequency", 0),
                    "item_count": weight_data.get("item_count", 0),
                    "updated_at": weight_data.get("updated_at", "")
                }
                sources_list.append(source_data)
        
        # 按权重降序排序
        sources_list.sort(key=lambda x: x["weight"], reverse=True)
        
        return {
            "total_sources": len(sources_list),
            "sources": sources_list
        }
        
    except Exception as e:
        logger.error(f"获取来源权重失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取来源权重失败: {str(e)}")


@router.post("/update-heat-scores", response_model=Dict[str, Any])
async def update_heat_scores(background_tasks: BackgroundTasks):
    """
    手动触发更新所有新闻的热度分数。
    
    此接口会在后台启动热度分数更新任务。任务完成后，新的热度分数将被保存到数据库。
    """
    try:
        background_tasks.add_task(run_update_task)
        return {
            "status": "success",
            "message": "热度分数更新任务已启动",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"启动热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动热度更新任务失败: {str(e)}")


async def run_keyword_heat_update():
    """在独立会话中运行关键词热度更新任务"""
    async with async_session_maker() as session:
        try:
            await heat_score_service.update_keyword_heat(session)
            await session.commit()
            logger.info("关键词热度更新任务完成并提交")
        except Exception as e:
            await session.rollback()
            logger.error(f"关键词热度更新任务失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise

@router.post("/update-keyword-heat", response_model=Dict[str, Any])
async def update_keyword_heat(background_tasks: BackgroundTasks):
    """
    手动触发更新关键词热度。
    
    此接口会在后台启动关键词热度更新任务。任务完成后，新的关键词热度数据将被缓存到Redis。
    """
    try:
        background_tasks.add_task(run_keyword_heat_update)
        return {
            "status": "success",
            "message": "关键词热度更新任务已启动",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"启动关键词热度更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动关键词热度更新任务失败: {str(e)}")

async def run_source_weights_update():
    """在独立会话中运行来源权重更新任务"""
    async with async_session_maker() as session:
        try:
            await heat_score_service.update_source_weights(session)
            await session.commit()
            logger.info("来源权重更新任务完成并提交")
        except Exception as e:
            await session.rollback()
            logger.error(f"来源权重更新任务失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise

@router.post("/update-source-weights", response_model=Dict[str, Any])
async def update_source_weights(background_tasks: BackgroundTasks):
    """
    手动触发更新来源权重。
    
    此接口会在后台启动来源权重更新任务。任务完成后，新的来源权重数据将被缓存到Redis。
    """
    try:
        background_tasks.add_task(run_source_weights_update)
        return {
            "status": "success",
            "message": "来源权重更新任务已启动",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"启动来源权重更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动来源权重更新任务失败: {str(e)}")

@router.post("/update-categories", response_model=Dict[str, Any])
async def update_news_categories(background_tasks: BackgroundTasks):
    """
    更新所有新闻热度分数记录的分类信息。
    
    此接口会在后台启动分类更新任务，检查所有没有分类信息的热度记录，
    并根据来源ID推断分类。任务完成后，更新后的分类信息将被保存到数据库。
    """
    try:
        background_tasks.add_task(run_category_update)
        return {
            "status": "success",
            "message": "分类信息更新任务已启动",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"启动分类更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动分类更新任务失败: {str(e)}")


async def run_category_update():
    """在独立会话中运行分类更新任务"""
    async with async_session_maker() as session:
        try:
            # 动态获取来源-分类映射关系
            source_categories = {}
            
            # 通过 HeatLink API 获取源分类信息
            try:
                # 直接从服务获取源信息
                sources_data = await heat_score_service.heatlink_client.get_sources()
                
                # 处理API返回的不同格式
                if isinstance(sources_data, dict):
                    sources_list = sources_data.get("sources", [])
                else:
                    sources_list = sources_data
                
                # 构建 source_id 到 category 的映射
                for source in sources_list:
                    if "source_id" in source and "category" in source:
                        source_categories[source["source_id"]] = source["category"]
                
                logger.info(f"从 HeatLink API 获取到 {len(source_categories)} 个来源的分类信息")
                
                # 如果没有获取到任何分类信息，使用默认的回退映射
                if not source_categories:
                    logger.warning("从 API 获取的分类信息为空，使用默认映射")
                    source_categories = {
                        "weibo": "social",
                        "zhihu": "knowledge",
                        "toutiao": "news",
                        "baidu": "search",
                        "bilibili": "video",
                        "douyin": "video",
                        "36kr": "technology"
                    }
            except Exception as e:
                logger.error(f"获取来源分类信息失败，使用默认映射: {e}")
                # 使用基本的默认映射作为回退
                source_categories = {
                    "weibo": "social",
                    "zhihu": "knowledge",
                    "toutiao": "news",
                    "baidu": "search",
                    "bilibili": "video",
                    "douyin": "video"
                }
            
            # 查询所有需要更新的记录
            stmt = select(NewsHeatScore).where(
                or_(
                    NewsHeatScore.meta_data.is_(None),
                    ~NewsHeatScore.meta_data.cast(JSONB).op('?')('category')
                )
            ).limit(5000)  # 限制一次处理的记录数量
            
            result = await session.execute(stmt)
            records = result.scalars().all()
            
            updated_count = 0
            for record in records:
                # 获取来源ID
                source_id = record.source_id
                
                # 推断分类
                category = source_categories.get(source_id, "others")
                
                # 更新meta_data
                if record.meta_data is None:
                    record.meta_data = {"category": category}
                else:
                    record.meta_data["category"] = category
                
                session.add(record)
                updated_count += 1
                
                # 每100条记录提交一次，减少数据库压力
                if updated_count % 100 == 0:
                    await session.commit()
                    logger.info(f"已更新 {updated_count} 条记录的分类信息")
            
            # 提交最后的更改
            if updated_count % 100 != 0:
                await session.commit()
            
            logger.info(f"分类更新任务完成，共更新 {updated_count} 条记录")
        except Exception as e:
            await session.rollback()
            logger.error(f"分类更新任务失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise