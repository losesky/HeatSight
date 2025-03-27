import json
from typing import Any, Dict, Optional, Union

import redis.asyncio as redis
from fastapi.encoders import jsonable_encoder
from loguru import logger

from app.core.config import settings


class RedisManager:
    """Redis connection manager."""

    def __init__(self, url: str = settings.REDIS_URL):
        self.redis_url = url
        self.redis_client: Optional[redis.Redis] = None
        self.is_connected = False

    async def connect(self) -> None:
        """Connect to Redis."""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            # Check connection by pinging Redis
            await self.redis_client.ping()
            self.is_connected = True
            logger.info("Connected to Redis")
        except Exception as e:
            self.is_connected = False
            logger.error(f"Failed to connect to Redis: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self.redis_client:
            await self.redis_client.close()
            self.is_connected = False
            logger.info("Disconnected from Redis")

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
                except json.JSONDecodeError:
                    return data
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
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
            serialized_value = (
                json.dumps(jsonable_encoder(value))
                if not isinstance(value, (str, int, float, bool))
                else value
            )
            if expire:
                await self.redis_client.setex(key, expire, serialized_value)
            else:
                await self.redis_client.set(key, serialized_value)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key from Redis."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return False

        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if a key exists in Redis."""
        if not self.is_connected or not self.redis_client:
            await self.connect()
            if not self.is_connected:
                return False

        try:
            return bool(await self.redis_client.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False


# Create Redis manager instance
redis_manager = RedisManager() 