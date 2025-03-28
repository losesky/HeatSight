from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Query, HTTPException
from loguru import logger

from app.services.heatlink_client import heatlink_client

router = APIRouter()


@router.get("/hot-news")
async def get_hot_news(
    hot_limit: int = Query(10, ge=1, le=50, description="Number of hot news to fetch"),
    recommended_limit: int = Query(10, ge=1, le=50, description="Number of recommended news to fetch"),
    category_limit: int = Query(5, ge=1, le=20, description="Number of news per category to fetch"),
    force_update: bool = Query(False, description="Force fetching fresh data"),
    use_cache: bool = Query(True, description="Use Redis cache if available"),
):
    """
    Get hot news from HeatLink API.
    
    Returns hot news, recommended news, and news by category from external HeatLink API.
    """
    try:
        data = await heatlink_client.get_hot_news(
            hot_limit=hot_limit,
            recommended_limit=recommended_limit,
            category_limit=category_limit,
            force_update=force_update,
            use_cache=use_cache
        )
        return data
    except Exception as e:
        logger.error(f"Error fetching hot news: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error fetching hot news: {str(e)}"
        )


@router.get("/unified-news")
async def get_unified_news(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    country: Optional[str] = Query(None, description="Filter by country"),
    language: Optional[str] = Query(None, description="Filter by language"),
    source_id: Optional[str] = Query(None, description="Filter by source ID"),
    keyword: Optional[str] = Query(None, description="Filter by keyword"),
    sort_by: str = Query("published_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order (asc or desc)"),
    timeout: Optional[int] = Query(None, description="Request timeout in seconds"),
    max_concurrent: Optional[int] = Query(None, description="Maximum concurrent requests"),
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    force_update: bool = Query(False, description="Force fetching fresh data"),
):
    """
    Get unified news from HeatLink API.
    
    Returns a unified list of news from various sources with filtering options.
    """
    try:
        data = await heatlink_client.get_unified_news(
            page=page,
            page_size=page_size,
            category=category,
            country=country,
            language=language,
            source_id=source_id,
            keyword=keyword,
            sort_by=sort_by,
            sort_order=sort_order,
            timeout=timeout,
            max_concurrent=max_concurrent,
            use_cache=use_cache,
            force_update=force_update
        )
        return data
    except Exception as e:
        logger.error(f"Error fetching unified news: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error fetching unified news: {str(e)}"
        )


@router.get("/search")
async def search_news(
    query: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    country: Optional[str] = Query(None, description="Filter by country"),
    language: Optional[str] = Query(None, description="Filter by language"),
    source_id: Optional[str] = Query(None, description="Filter by source ID"),
    max_results: Optional[int] = Query(None, description="Maximum results to return"),
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    force_update: bool = Query(False, description="Force fetching fresh data"),
):
    """
    Search news from HeatLink API.
    
    Search for news based on the provided query and filters.
    """
    try:
        data = await heatlink_client.search_news(
            query=query,
            page=page,
            page_size=page_size,
            category=category,
            country=country,
            language=language,
            source_id=source_id,
            max_results=max_results,
            use_cache=use_cache,
            force_update=force_update
        )
        return data
    except Exception as e:
        logger.error(f"Error searching news: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error searching news: {str(e)}"
        )


@router.get("/sources")
async def get_sources(
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    force_update: bool = Query(False, description="Force fetching fresh data"),
):
    """
    Get available sources from HeatLink API.
    
    Returns all available news sources with metadata.
    """
    try:
        data = await heatlink_client.get_sources(
            use_cache=use_cache,
            force_update=force_update
        )
        return data
    except Exception as e:
        logger.error(f"Error fetching sources: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error fetching sources: {str(e)}"
        )


@router.get("/source/{source_id}")
async def get_source(
    source_id: str,
    timeout: Optional[int] = Query(None, description="Request timeout in seconds"),
    use_cache: bool = Query(True, description="Use Redis cache if available"),
    force_update: bool = Query(False, description="Force fetching fresh data"),
):
    """
    Get details for a specific source from HeatLink API.
    
    Returns detailed information about a specific news source.
    """
    try:
        data = await heatlink_client.get_source(
            source_id=source_id,
            timeout=timeout,
            use_cache=use_cache,
            force_update=force_update
        )
        return data
    except Exception as e:
        logger.error(f"Error fetching source {source_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Error fetching source: {str(e)}"
        ) 