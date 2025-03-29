import json
from typing import Any, Dict, Optional, Union

from loguru import logger

try:
    import aioredis
    REDIS_AVAILABLE = True
except ImportError:
    try:
        from redis.asyncio import Redis
        REDIS_AVAILABLE = True
        # 兼容旧版代码，redis v4.2.0+也支持异步API
        aioredis = Redis
    except ImportError:
        logger.warning("Redis异步库不可用，使用内存缓存作为备选")
        REDIS_AVAILABLE = False

# 简单的内存缓存实现，作为Redis不可用时的备选
class MemoryCache:
    def __init__(self):
        self._cache = {}
        self._expires = {}
        import time
        self.time = time
    
    async def ping(self):
        return True
        
    async def get(self, key):
        if key in self._expires and self._expires[key] < self.time.time():
            del self._cache[key]
            del self._expires[key]
            return None
        return self._cache.get(key)
    
    async def set(self, key, value, ex=None):
        self._cache[key] = value
        if ex:
            self._expires[key] = self.time.time() + ex
        return True
    
    async def setex(self, key, ex, value):
        return await self.set(key, value, ex)
        
    async def delete(self, *keys):
        count = 0
        for key in keys:
            if key in self._cache:
                del self._cache[key]
                if key in self._expires:
                    del self._expires[key]
                count += 1
        return count
    
    async def exists(self, key):
        return key in self._cache
        
    async def keys(self, pattern="*"):
        # 简单实现，不支持模式匹配
        return list(self._cache.keys())
        
    async def dbsize(self):
        return len(self._cache)
        
    async def close(self):
        self._cache.clear()
        self._expires.clear()

# 简化的Redis连接管理器
class RedisManager:
    """Redis connection manager."""

    def __init__(self, url: str = "redis://localhost:6379/0"):
        self.redis_url = url
        self.redis_client = None
        self.is_connected = False
        self.using_memory_cache = False

    async def connect(self) -> None:
        """Connect to Redis."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis不可用，使用内存缓存")
            self.redis_client = MemoryCache()
            self.is_connected = True
            self.using_memory_cache = True
            return

        try:
            self.redis_client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            
            # 测试连接
            if hasattr(self.redis_client, "ping"):
                await self.redis_client.ping()
            
            self.is_connected = True
            logger.info("已连接到Redis")
        except Exception as e:
            logger.error(f"Redis连接失败: {e}")
            logger.warning("使用内存缓存作为备选")
            self.redis_client = MemoryCache()
            self.is_connected = True
            self.using_memory_cache = True

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self.redis_client:
            if hasattr(self.redis_client, "close"):
                await self.redis_client.close()
            self.is_connected = False
            logger.info("已断开Redis连接")

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis by key."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return None

        try:
            data = await self.redis_client.get(key)
            if data:
                try:
                    return json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    return data
            return None
        except Exception as e:
            logger.error(f"Redis获取错误: {e}")
            return None

    async def set(
        self, key: str, value: Any, expire: Optional[int] = None
    ) -> bool:
        """Set a value in Redis."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return False

        try:
            # 序列化复杂类型
            if isinstance(value, (dict, list, tuple, set)):
                serialized_value = json.dumps(value)
            else:
                serialized_value = value
                
            if expire:
                await self.redis_client.setex(key, expire, serialized_value)
            else:
                await self.redis_client.set(key, serialized_value)
            return True
        except Exception as e:
            logger.error(f"Redis设置错误: {e}")
            return False

    async def delete(self, *keys) -> bool:
        """Delete keys from Redis."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return False

        try:
            if keys:
                await self.redis_client.delete(*keys)
            return True
        except Exception as e:
            logger.error(f"Redis删除错误: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if a key exists in Redis."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return False

        try:
            result = await self.redis_client.exists(key)
            return bool(result)
        except Exception as e:
            logger.error(f"Redis检查错误: {e}")
            return False
            
    async def keys(self, pattern: str) -> list:
        """Get keys matching pattern."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return []

        try:
            return await self.redis_client.keys(pattern)
        except Exception as e:
            logger.error(f"Redis keys错误: {e}")
            return []
    
    async def dbsize(self) -> int:
        """Get database size."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return 0

        try:
            return await self.redis_client.dbsize()
        except Exception as e:
            logger.error(f"Redis dbsize错误: {e}")
            return 0


# 创建Redis管理器实例
try:
    from app.core.config import settings
    redis_url = settings.REDIS_URL
except (ImportError, AttributeError):
    # 如果无法从settings导入，使用默认URL
    redis_url = "redis://localhost:6379/0"

redis_manager = RedisManager(url=redis_url) 