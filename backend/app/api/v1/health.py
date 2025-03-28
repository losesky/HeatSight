from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from loguru import logger
from typing import Dict, Any

from app.db.redis import redis_manager
from app.db.session import get_db
from app.services.heatlink_client import heatlink_client

router = APIRouter()


@router.get("")
async def health_check():
    """
    Health check endpoint.
    
    Returns a simple success message to verify the API is responding.
    """
    return {"status": "ok", "message": "API is healthy"}


@router.get("/details")
async def health_details():
    """
    Detailed health check of API and components.
    
    Checks database, Redis, and external API connections.
    """
    status_details = {
        "api": {"status": "ok"},
        "components": {}
    }
    
    # Check Redis connection
    redis_status = "ok" if await check_redis() else "error"
    status_details["components"]["redis"] = {"status": redis_status}
    
    # Check HeatLink API connection
    heatlink_status = "ok"
    try:
        # Simple check by getting source types (should be quick)
        await heatlink_client.get_source_types(use_cache=False)
    except Exception as e:
        heatlink_status = "error"
        logger.error(f"HeatLink API health check failed: {e}")
    
    status_details["components"]["heatlink_api"] = {"status": heatlink_status}
    
    return status_details


@router.get("/cache")
async def cache_status():
    """
    Check Redis cache status.
    
    Returns information about the Redis cache including connection status
    and cache statistics if available.
    """
    if not redis_manager.is_connected:
        await redis_manager.connect()
    
    cache_info = {
        "connected": redis_manager.is_connected,
    }
    
    # If connected, get some basic stats
    if redis_manager.is_connected and redis_manager.redis_client:
        try:
            # Count HeatLink API caches
            heatlink_keys = await redis_manager.redis_client.keys("heatlink:*")
            # Count topic caches
            topic_keys = await redis_manager.redis_client.keys("topics:*")
            
            # Get DB size (total number of keys)
            db_size = await redis_manager.redis_client.dbsize()
            
            # Convert byte keys to strings for proper comparison
            heatlink_keys_str = [k.decode('utf-8') if isinstance(k, bytes) else k for k in heatlink_keys]
            
            cache_info.update({
                "total_keys": db_size,
                "heatlink_cache_count": len(heatlink_keys),
                "topic_cache_count": len(topic_keys),
                # Group HeatLink caches by type
                "heatlink_cache_types": {
                    "hot_news": len([k for k in heatlink_keys_str if "hot_news" in k]),
                    "sources": len([k for k in heatlink_keys_str if "sources" in k]),
                    "search": len([k for k in heatlink_keys_str if "search" in k]),
                    "unified_news": len([k for k in heatlink_keys_str if "unified_news" in k]),
                }
            })
        except Exception as e:
            logger.error(f"Error getting Redis stats: {e}")
            cache_info["error"] = str(e)
    
    return cache_info


async def check_redis() -> bool:
    """Check if Redis is accessible."""
    if not redis_manager.is_connected:
        await redis_manager.connect()
    
    if redis_manager.is_connected:
        try:
            # Try a simple PING operation
            await redis_manager.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
    
    return False 