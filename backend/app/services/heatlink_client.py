from typing import Any, Dict, List, Optional, Union

import httpx
from fastapi import HTTPException
from loguru import logger
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.db.redis import redis_manager


class HeatLinkAPIClient:
    """Client for interacting with HeatLink API."""

    def __init__(
        self,
        base_url: str = settings.HEATLINK_API_URL,
        timeout: int = settings.HEATLINK_API_TIMEOUT,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.client_params = {
            "timeout": timeout,
            "headers": {"Accept": "application/json"},
        }
        
        # 缓存配置
        self.cache_config = {
            # 为不同类型的请求设置不同的缓存时间（秒）
            "hot_news": 300,         # 热门新闻缓存5分钟
            "sources": 3600,         # 来源信息缓存1小时
            "source_detail": 600,    # 单个来源详情缓存10分钟
            "unified_news": 300,     # 统一新闻缓存5分钟
            "search": 180,           # 搜索结果缓存3分钟
            "source_types": 3600,    # 来源类型缓存1小时
            "sources_stats": 1800,   # 来源统计缓存30分钟
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Make a request to the HeatLink API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            params: Query parameters
            data: Request body data for POST, PUT, etc.
            
        Returns:
            API response data
        """
        # 构建URL，处理可能的'/api/api/'重复问题
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # 检测并修复潜在的URL路径重复问题
        if '/api/api/' in url:
            # 去除重复的'/api/'
            url = url.replace('/api/api/', '/api/')
            logger.warning(f"Detected and fixed duplicated API path in URL: {url}")
        
        logger.debug(f"Making {method} request to {url}")
        
        try:
            # 创建client时启用follow_redirects以自动处理重定向
            client_params = {**self.client_params, "follow_redirects": True}
            async with httpx.AsyncClient(**client_params) as client:
                # 针对不同的HTTP方法使用不同的参数
                if method.upper() == "GET":
                    response = await client.get(url, params=params)
                else:
                    # POST, PUT等方法可以使用json参数
                    response = await getattr(client, method.lower())(
                        url,
                        params=params,
                        json=data,
                    )
                
                # 检查是否发生重定向，记录日志
                if response.history:
                    redirects = [f"{r.status_code}: {r.url} -> {r.headers.get('location', 'unknown')}" for r in response.history]
                    logger.info(f"Request was redirected: {' -> '.join(redirects)} (final: {response.url})")
                
                # Raise exception for 4xx/5xx responses
                response.raise_for_status()
                
                # Return JSON response
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error occurred: {e}")
            # Try to get error message from response
            try:
                error_data = e.response.json()
                error_message = error_data.get("detail", str(e))
            except Exception:
                error_message = str(e)
                
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"HeatLink API error: {error_message}"
            )
        except httpx.RequestError as e:
            logger.error(f"Request error occurred: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"HeatLink API request failed: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error: {str(e)}"
            )

    @retry(
        retry=retry_if_exception_type(HTTPException),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def get(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        use_cache: bool = True,
        cache_key_prefix: Optional[str] = None,
        cache_ttl: Optional[int] = None,
        force_refresh: bool = False,
    ) -> Any:
        """Make a GET request to the HeatLink API with caching support.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            use_cache: Whether to use Redis cache
            cache_key_prefix: Prefix for the cache key (defaults to endpoint)
            cache_ttl: Cache time-to-live in seconds (overrides default)
            force_refresh: Force refresh from API ignoring cache
            
        Returns:
            API response data (from cache or fresh)
        """
        # 构建缓存键
        if cache_key_prefix is None:
            cache_key_prefix = endpoint.replace("/", ":")
        
        # 根据参数生成唯一缓存键
        param_str = ":".join([f"{k}={v}" for k, v in (params or {}).items()]) if params else ""
        cache_key = f"heatlink:{cache_key_prefix}:{param_str}".rstrip(":")
        
        # 如果启用缓存且不是强制刷新，先尝试从缓存获取
        if use_cache and not force_refresh:
            cached_data = await redis_manager.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_data
            logger.debug(f"Cache miss for {cache_key}")
        
        # 从API获取数据
        response_data = await self._make_request("GET", endpoint, params=params)
        
        # 如果启用缓存，则缓存结果
        if use_cache and response_data:
            # 确定缓存的TTL
            ttl = cache_ttl
            if ttl is None:
                # 根据请求类型确定默认TTL
                endpoint_type = endpoint.split("/")[0] if "/" in endpoint else endpoint
                ttl = self.cache_config.get(endpoint_type, 300)  # 默认5分钟
            
            logger.debug(f"Caching data with key {cache_key}, TTL: {ttl}s")
            await redis_manager.set(cache_key, response_data, expire=ttl)
        
        return response_data

    async def post(
        self, endpoint: str, data: Dict[str, Any], params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Make a POST request to the HeatLink API."""
        return await self._make_request("POST", endpoint, params=params, data=data)

    # Hot news endpoints
    async def get_hot_news(
        self,
        hot_limit: int = 10,
        recommended_limit: int = 10,
        category_limit: int = 5,
        timeout: Optional[int] = None,
        force_update: bool = False,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """Get hot news from HeatLink API."""
        params = {
            "hot_limit": hot_limit,
            "recommended_limit": recommended_limit,
            "category_limit": category_limit,
        }
        if timeout:
            params["timeout"] = timeout
            
        return await self.get(
            "external/hot", 
            params=params,
            use_cache=use_cache,
            cache_key_prefix="hot_news",
            force_refresh=force_update,
            cache_ttl=self.cache_config["hot_news"]
        )
    
    # Source endpoints
    async def get_sources(self, use_cache: bool = True, force_update: bool = False) -> Dict[str, Any]:
        """Get all available sources from HeatLink API."""
        # 确保URL末尾带有斜杠以避免重定向
        return await self.get(
            "external/sources",
            use_cache=use_cache,
            cache_key_prefix="sources",
            force_refresh=force_update,
            cache_ttl=self.cache_config["sources"]
        )
    
    async def get_source(
        self, 
        source_id: str, 
        timeout: Optional[int] = None,
        use_cache: bool = True,
        force_update: bool = False,
    ) -> Dict[str, Any]:
        """Get details and news for a specific source from HeatLink API."""
        params = {}
        if timeout:
            params["timeout"] = timeout
            
        return await self.get(
            f"external/source/{source_id}", 
            params=params,
            use_cache=use_cache,
            cache_key_prefix=f"source:{source_id}",
            force_refresh=force_update,
            cache_ttl=self.cache_config["source_detail"]
        )
    
    async def get_source_types(self, use_cache: bool = True, force_update: bool = False) -> List[str]:
        """Get all available source types from HeatLink API."""
        return await self.get(
            "external/source-types",
            use_cache=use_cache,
            cache_key_prefix="source_types",
            force_refresh=force_update,
            cache_ttl=self.cache_config["source_types"]
        )
    
    # News endpoints
    async def get_unified_news(
        self,
        page: int = 1,
        page_size: int = 20,
        category: Optional[str] = None,
        country: Optional[str] = None,
        language: Optional[str] = None,
        source_id: Optional[str] = None,
        keyword: Optional[str] = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        timeout: Optional[int] = None,
        max_concurrent: Optional[int] = None,
        use_cache: bool = True,
        force_update: bool = False,
    ) -> Dict[str, Any]:
        """Get unified news from HeatLink API."""
        params = {
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }
        
        # Add optional params if provided
        if category:
            params["category"] = category
        if country:
            params["country"] = country
        if language:
            params["language"] = language
        if source_id:
            params["source_id"] = source_id
        if keyword:
            params["keyword"] = keyword
        if timeout:
            params["timeout"] = timeout
        if max_concurrent:
            params["max_concurrent"] = max_concurrent
            
        return await self.get(
            "external/unified", 
            params=params,
            use_cache=use_cache,
            cache_key_prefix="unified_news",
            force_refresh=force_update,
            cache_ttl=self.cache_config["unified_news"]
        )
    
    # Search endpoints
    async def search_news(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
        category: Optional[str] = None,
        country: Optional[str] = None,
        language: Optional[str] = None,
        source_id: Optional[str] = None,
        max_results: Optional[int] = None,
        use_cache: bool = True,
        force_update: bool = False,
    ) -> Dict[str, Any]:
        """Search news from HeatLink API."""
        params = {
            "query": query,
            "page": page,
            "page_size": page_size,
        }
        
        # Add optional params if provided
        if category:
            params["category"] = category
        if country:
            params["country"] = country
        if language:
            params["language"] = language
        if source_id:
            params["source_id"] = source_id
        if max_results:
            params["max_results"] = max_results
            
        # 搜索结果使用较短的缓存时间
        return await self.get(
            "external/search", 
            params=params,
            use_cache=use_cache,
            cache_key_prefix="search",
            force_refresh=force_update,
            cache_ttl=self.cache_config["search"]
        )

    async def get_sources_stats(self, use_cache: bool = True, force_update: bool = False) -> Dict[str, Any]:
        """Get sources statistics from HeatLink API by aggregating data from all sources."""
        cache_key = "sources_stats:all"
        
        # Try to get data from cache if enabled
        if use_cache and not force_update:
            cached_data = await redis_manager.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_data
                
        try:
            # First, get all sources
            sources_response = await self.get_sources(use_cache=use_cache, force_update=force_update)
            
            # Initialize categories counter
            categories_count = {}
            source_count = 0
            news_count = 0
            
            # Adapt to different API response formats
            sources_list = []
            if isinstance(sources_response, list):
                # If API returns a list directly
                sources_list = sources_response
            elif isinstance(sources_response, dict):
                # If API returns a dict with sources key
                sources_list = sources_response.get("sources", [])
                # Or try other common keys if sources not found
                if not sources_list and "items" in sources_response:
                    sources_list = sources_response.get("items", [])
                elif not sources_list and "data" in sources_response:
                    sources_list = sources_response.get("data", [])
            
            # Log source count
            logger.debug(f"Processing {len(sources_list)} sources for stats")
            
            # For each source, get its stats
            for source in sources_list:
                # Try different possible id field names
                source_id = None
                for id_field in ["id", "source_id", "name", "key"]:
                    if id_field in source:
                        source_id = source.get(id_field)
                        break
                        
                if not source_id:
                    logger.warning(f"Skipping source without id: {source}")
                    continue
                
                source_count += 1
                
                try:
                    # Get stats for this source - using the correct API path
                    source_stats = await self.get(
                        f"external/source/{source_id}",
                        use_cache=use_cache,
                        cache_key_prefix=f"source:{source_id}:stats",
                        force_refresh=force_update,
                        cache_ttl=self.cache_config["source_detail"]
                    )
                    
                    # Aggregate categories - handle different return structures
                    source_categories = {}
                    
                    # Option 1: Direct dictionary of categories
                    if "categories" in source_stats and isinstance(source_stats["categories"], dict):
                        source_categories = source_stats["categories"]
                    
                    # Option 2: List of category objects
                    elif "categories" in source_stats and isinstance(source_stats["categories"], list):
                        for cat_obj in source_stats["categories"]:
                            if isinstance(cat_obj, dict) and "name" in cat_obj and "count" in cat_obj:
                                source_categories[cat_obj["name"]] = cat_obj["count"]
                    
                    # Option 3: Look for categories in items or news objects
                    elif "items" in source_stats:
                        for item in source_stats["items"]:
                            if "category" in item and item["category"]:
                                cat = item["category"]
                                source_categories[cat] = source_categories.get(cat, 0) + 1
                    
                    # If still no categories found but we have items, use default category
                    if not source_categories and "items" in source_stats:
                        source_categories["未分类"] = len(source_stats["items"])
                    
                    # Add categories to count
                    for category, count in source_categories.items():
                        if category:
                            categories_count[category] = categories_count.get(category, 0) + count
                            news_count += count
                            
                except Exception as e:
                    logger.warning(f"Failed to get stats for source {source_id}: {e}")
                    continue
            
            # Ensure we have at least some default categories if none found
            if not categories_count:
                categories_count = {
                    "科技": 0,
                    "财经": 0,
                    "教育": 0,
                    "汽车": 0,
                    "未分类": 0
                }
            
            # Create aggregated stats result
            result = {
                "categories": categories_count,
                "sources_count": source_count,
                "news_count": news_count
            }
            
            # Cache the results
            if use_cache:
                await redis_manager.set(cache_key, result, expire=self.cache_config["sources_stats"])
            
            return result
            
        except Exception as e:
            logger.error(f"Error aggregating sources stats: {e}")
            # Return default categories on error
            return {
                "categories": {
                    "科技": 0,
                    "财经": 0,
                    "教育": 0,
                    "汽车": 0,
                    "未分类": 0
                }, 
                "sources_count": 0, 
                "news_count": 0
            }
        
    # 缓存管理方法
    async def clear_all_caches(self) -> bool:
        """Clear all HeatLink API caches."""
        try:
            pattern = "heatlink:*"
            if redis_manager.redis_client:
                keys = await redis_manager.redis_client.keys(pattern)
                if keys:
                    # 使用await处理异步调用
                    if len(keys) > 1:
                        await redis_manager.redis_client.delete(*keys)
                    elif keys:
                        await redis_manager.redis_client.delete(keys[0])
                logger.info(f"Cleared all HeatLink API caches: {len(keys)} keys")
                return True
            return False
        except Exception as e:
            logger.error(f"Error clearing caches: {e}")
            return False
    
    async def clear_cache_by_prefix(self, prefix: str) -> bool:
        """Clear caches by prefix (e.g., 'hot_news', 'sources')."""
        try:
            pattern = f"heatlink:{prefix}:*"
            if redis_manager.redis_client:
                keys = await redis_manager.redis_client.keys(pattern)
                if keys:
                    # 使用await处理异步调用
                    if len(keys) > 1:
                        await redis_manager.redis_client.delete(*keys)
                    elif keys:
                        await redis_manager.redis_client.delete(keys[0])
                logger.info(f"Cleared {prefix} caches: {len(keys)} keys")
                return True
            return False
        except Exception as e:
            logger.error(f"Error clearing {prefix} caches: {e}")
            return False


# Create client instance
heatlink_client = HeatLinkAPIClient() 