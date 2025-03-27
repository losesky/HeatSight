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
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        logger.debug(f"Making {method} request to {url}")
        
        try:
            async with httpx.AsyncClient(**self.client_params) as client:
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
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Make a GET request to the HeatLink API."""
        return await self._make_request("GET", endpoint, params=params)

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
    ) -> Dict[str, Any]:
        """Get hot news from HeatLink API."""
        params = {
            "hot_limit": hot_limit,
            "recommended_limit": recommended_limit,
            "category_limit": category_limit,
            "force_update": force_update,
        }
        if timeout:
            params["timeout"] = timeout
            
        return await self.get("external/hot", params)
    
    # Source endpoints
    async def get_sources(self) -> Dict[str, Any]:
        """Get all available sources from HeatLink API."""
        return await self.get("external/sources")
    
    async def get_source(
        self, source_id: str, timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get details and news for a specific source from HeatLink API."""
        params = {}
        if timeout:
            params["timeout"] = timeout
            
        return await self.get(f"external/source/{source_id}", params)
    
    async def get_source_types(self) -> List[str]:
        """Get all available source types from HeatLink API."""
        return await self.get("external/source-types")
    
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
            
        return await self.get("external/unified", params)
    
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
            
        return await self.get("external/search", params)
    
    # Stats endpoints
    async def get_sources_stats(self) -> Dict[str, Any]:
        """Get sources statistics from HeatLink API."""
        return await self.get("external/stats")


# Create client instance
heatlink_client = HeatLinkAPIClient() 