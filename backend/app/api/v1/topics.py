from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
import traceback
from sqlalchemy import select

from app.db.redis import redis_manager
from app.db.session import get_db
from app.services.heatlink_client import heatlink_client
from app.crud.topic import topic as topic_crud
from app.models.topic import Topic

router = APIRouter()


@router.get("/hot")
async def get_hot_topics(
    hot_limit: int = Query(10, ge=1, le=50, description="Number of hot topics to fetch"),
    recommended_limit: int = Query(10, ge=1, le=50, description="Number of recommended topics to fetch"),
    category_limit: int = Query(5, ge=1, le=20, description="Number of topics per category to fetch"),
    force_update: bool = Query(False, description="Force fetching fresh data from sources"),
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get hot topics.
    
    This endpoint returns hot topics, recommended topics, and topics by category from the database.
    Data is cached in Redis for improved performance.
    """
    cache_key = f"topics:hot:{hot_limit}:{recommended_limit}:{category_limit}"
    
    # Try to get data from cache if enabled and not forcing update
    if use_cache and not force_update:
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug(f"Returning cached hot topics data: {cache_key}")
            return cached_data
    
    try:
        logger.info("开始从数据库获取热门话题数据")
        # 从数据库获取热门话题
        hot_topics = await topic_crud.get_hot_topics(db, limit=hot_limit)
        logger.info(f"成功获取到 {len(hot_topics)} 条热门话题")
        
        # 转换为字典格式
        hot_topics_data = [topic.to_dict() for topic in hot_topics]
        
        # 获取推荐内容
        # 这里简化处理，将热度靠前但不在热门话题中的主题作为推荐内容
        logger.info("获取推荐内容")
        stmt = select(Topic).order_by(Topic.heat.desc()).limit(hot_limit + recommended_limit)
        result = await db.execute(stmt)
        recommended_topics = list(result.scalars().all())
        recommended_ids = {topic.id for topic in hot_topics}
        recommended_topics_data = [
            topic.to_dict() for topic in recommended_topics 
            if topic.id not in recommended_ids
        ][:recommended_limit]
        logger.info(f"成功获取到 {len(recommended_topics_data)} 条推荐内容")
        
        # 获取分类数据
        # 获取所有存在的分类
        logger.info("获取分类数据")
        stmt = select(Topic.category).distinct()
        result = await db.execute(stmt)
        categories = result.all()
        category_names = [cat[0] for cat in categories if cat[0]]
        logger.info(f"成功获取到 {len(category_names)} 个分类: {category_names}")
        
        # 按分类获取主题
        categories_data = {}
        for category_name in category_names:
            category_topics = await topic_crud.get_by_category(
                db, category=category_name, limit=category_limit
            )
            categories_data[category_name] = [topic.to_dict() for topic in category_topics]
            logger.info(f"分类 '{category_name}' 获取到 {len(categories_data[category_name])} 条主题")
        
        # 兼容前端期望的数据结构
        response_data = {
            "hot_news": hot_topics_data,
            "recommended_news": recommended_topics_data,
            "categories": categories_data
        }
        
        # 同时包含新的字段结构，便于将来迁移
        response_data["hot_topics"] = hot_topics_data
        response_data["recommended_topics"] = recommended_topics_data
        
        # 缓存结果（过期时间为5分钟）
        if use_cache:
            await redis_manager.set(cache_key, response_data, expire=300)
            logger.info(f"成功缓存热门话题数据，key: {cache_key}")
        
        logger.info("热门话题数据获取成功")
        return response_data
    except Exception as e:
        stack_trace = traceback.format_exc()
        logger.error(f"获取热门话题数据失败: {e}")
        logger.error(f"错误堆栈: {stack_trace}")
        
        # 使用 HeatLink API 作为备用数据源
        try:
            logger.info("尝试从 HeatLink API 获取备用数据")
            hot_news_data = await heatlink_client.get_hot_news(
                hot_limit=hot_limit,
                recommended_limit=recommended_limit,
                category_limit=category_limit,
                force_update=force_update,
            )
            logger.info("从 HeatLink API 成功获取备用数据")
            return hot_news_data
        except Exception as backup_error:
            logger.error(f"备用数据源也失败: {backup_error}")
            # 返回带有服务器内部错误的错误响应，以便更好地前端展示
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "获取热门话题失败",
                    "error": str(e),
                    "backup_error": str(backup_error) if 'backup_error' in locals() else None
                }
            )


@router.get("/search")
async def search_topics(
    query: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    source_id: Optional[str] = Query(None, description="Filter by source ID"),
):
    """
    Search topics.
    
    Search for topics based on the provided query and filters.
    """
    try:
        # Search news from HeatLink API
        search_results = await heatlink_client.search_news(
            query=query,
            page=page,
            page_size=page_size,
            category=category,
            source_id=source_id,
        )
        
        return search_results
    except Exception as e:
        logger.error(f"Error searching topics: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error searching topics: {str(e)}"
        )


@router.get("/sources")
async def get_sources(
    use_cache: bool = Query(True, description="Use Redis cache if available"),
):
    """
    Get available sources.
    
    Returns all available news sources with metadata.
    """
    cache_key = "sources:all"
    
    # Try to get data from cache if enabled
    if use_cache:
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug("Returning cached sources data")
            return cached_data
    
    try:
        # Fetch sources from HeatLink API - 使用更新后的方法
        sources_data = await heatlink_client.get_sources()
        
        # Cache the results (expires in 1 hour)
        if use_cache:
            await redis_manager.set(cache_key, sources_data, expire=3600)
        
        return sources_data
    except Exception as e:
        logger.error(f"Error fetching sources: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error fetching sources: {str(e)}"
        )


@router.get("/categories")
async def get_categories(
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    force_refresh: bool = Query(False, description="Force refresh data from sources"),
):
    """
    Get topic categories.
    
    Returns available categories based on sources data.
    """
    cache_key = "categories:all"
    
    # Clear cache if force refresh
    if force_refresh and redis_manager.is_connected:
        try:
            await redis_manager.delete(cache_key)
            logger.debug(f"Cleared cache for {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to clear cache: {e}")
    
    # Try to get data from cache if enabled and not forcing refresh
    if use_cache and not force_refresh:
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug("Returning cached categories data")
            return cached_data
    
    try:
        # Fetch stats from HeatLink API which includes categories
        stats_data = await heatlink_client.get_sources_stats(use_cache=use_cache, force_update=force_refresh)
        categories = stats_data.get("categories", {})
        
        # Ensure we have some categories even if empty
        if not categories:
            logger.warning("No categories found in sources stats, using defaults")
            categories = {
                "科技": 0,
                "财经": 0,
                "教育": 0,
                "汽车": 0,
                "未分类": 0
            }
        
        result = {
            "categories": [
                {"name": cat, "count": count}
                for cat, count in categories.items()
            ]
        }
        
        # Cache the results (expires in 1 hour)
        if use_cache:
            await redis_manager.set(cache_key, result, expire=3600)
        
        return result
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        # Return default categories on error
        return {
            "categories": [
                {"name": "科技", "count": 0},
                {"name": "财经", "count": 0},
                {"name": "教育", "count": 0},
                {"name": "汽车", "count": 0},
                {"name": "未分类", "count": 0}
            ]
        }


@router.get("/{topic_id}")
async def get_topic_detail(
    topic_id: int = Path(..., description="The ID of the topic to get"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific topic by ID.
    
    Returns detailed information about a specific topic.
    """
    try:
        topic = await topic_crud.get(db, id=topic_id)
        if not topic:
            raise HTTPException(
                status_code=404,
                detail=f"Topic with ID {topic_id} not found"
            )
        
        # 获取话题详情
        topic_data = topic.to_dict()
        
        # 获取相关内容建议
        if topic.suggestions:
            content_suggestions = [suggestion.to_dict() for suggestion in topic.suggestions]
            topic_data["content_suggestions"] = content_suggestions
        
        return topic_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching topic {topic_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching topic: {str(e)}"
        )


@router.post("/cache/clear")
async def clear_topics_cache(
    cache_type: Optional[str] = Query(None, description="Type of cache to clear (hot, categories, sources, all)"),
    force: bool = Query(False, description="Force clear all caches including HeatLink API caches"),
):
    """
    Clear topics caches.
    
    Clears Redis caches for topics data. Can clear specific cache types or all caches.
    """
    success = True
    cleared_keys = []
    error_message = None
    
    try:
        if not redis_manager.is_connected or not redis_manager.redis_client:
            await redis_manager.connect()
            
        if not redis_manager.is_connected:
            return {
                "success": False,
                "message": "Could not connect to Redis"
            }
        
        # Clear specific cache type
        if cache_type:
            if cache_type == "hot":
                # Clear hot topics caches
                keys = await redis_manager.redis_client.keys("topics:hot:*")
                cleared_keys.extend(keys)
                if keys:
                    await redis_manager.redis_client.delete(*keys)
                # Clear HeatLink hot news caches if forced
                if force:
                    await heatlink_client.clear_cache_by_prefix("hot_news")
                
            elif cache_type == "categories":
                # Clear categories caches
                keys = await redis_manager.redis_client.keys("categories:*")
                cleared_keys.extend(keys)
                if keys:
                    await redis_manager.redis_client.delete(*keys)
                
            elif cache_type == "sources":
                # Clear sources caches
                keys = await redis_manager.redis_client.keys("sources:*")
                cleared_keys.extend(keys)
                if keys:
                    await redis_manager.redis_client.delete(*keys)
                # Clear HeatLink sources caches if forced
                if force:
                    await heatlink_client.clear_cache_by_prefix("sources")
                
            elif cache_type == "all":
                # Clear all topic related caches
                keys = await redis_manager.redis_client.keys("topics:*")
                keys.extend(await redis_manager.redis_client.keys("categories:*"))
                keys.extend(await redis_manager.redis_client.keys("sources:*"))
                cleared_keys.extend(keys)
                if keys:
                    await redis_manager.redis_client.delete(*keys)
                # Clear all HeatLink caches if forced
                if force:
                    await heatlink_client.clear_all_caches()
            else:
                return {
                    "success": False,
                    "message": f"Unknown cache type: {cache_type}"
                }
        else:
            # Default: clear all topic caches
            keys = await redis_manager.redis_client.keys("topics:*")
            cleared_keys.extend(keys)
            if keys:
                await redis_manager.redis_client.delete(*keys)
        
        logger.info(f"Cleared {len(cleared_keys)} cache keys")
        
    except Exception as e:
        success = False
        error_message = str(e)
        logger.error(f"Error clearing caches: {e}")
    
    return {
        "success": success,
        "message": "Cache cleared successfully" if success else f"Error: {error_message}",
        "cleared_keys_count": len(cleared_keys)
    } 