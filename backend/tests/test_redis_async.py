#!/usr/bin/env python3
"""
Redis异步包装器测试脚本
用于验证Redis包装方法是否正确处理协程
"""
import asyncio
import json
from typing import Any, Dict, Optional
import logging
import sys

# 配置日志
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("redis_test")

# 尝试导入redis
try:
    import redis
    REDIS_AVAILABLE = True
    logger.info("Redis库已加载")
except ImportError:
    logger.warning("Redis库不可用")
    REDIS_AVAILABLE = False

# 首先测试直接使用redis-py库
async def test_direct_redis():
    """测试直接使用redis-py库"""
    logger.info("\n===== 测试直接使用redis-py库 =====")
    
    if not REDIS_AVAILABLE:
        logger.error("redis-py库不可用，跳过测试")
        return

    # 连接Redis
    client = redis.Redis.from_url(
        "redis://localhost:6379/0", 
        encoding="utf-8",
        decode_responses=True
    )
    
    # 测试同步操作
    logger.info("测试同步操作")
    test_key = "test:direct:sync"
    test_value = {"time": "now", "value": 123}
    
    try:
        # 设置值
        client.set(test_key, json.dumps(test_value))
        logger.info("设置值成功")
        
        # 获取值
        result = client.get(test_key)
        if result:
            data = json.loads(result)
            logger.info(f"获取值成功: {data}")
        else:
            logger.warning("获取值失败")
    except Exception as e:
        logger.error(f"同步操作错误: {e}")
    
    # 关闭连接
    client.close()

# 简单异步包装器 - 方法 1
class AsyncRedisWrapper1:
    """使用run_in_executor的异步Redis包装器"""
    
    def __init__(self, url="redis://localhost:6379/0"):
        self.redis_client = redis.Redis.from_url(
            url, 
            encoding="utf-8",
            decode_responses=True
        )
        
        # 包装方法
        self._wrap_methods()
    
    def _wrap_methods(self):
        """将同步方法包装为异步方法"""
        async def _async_wrap(method, *args, **kwargs):
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, 
                lambda: method(*args, **kwargs)
            )
        
        # 包装常用方法
        self._original_set = self.redis_client.set
        self._original_get = self.redis_client.get
        self._original_delete = self.redis_client.delete
        
        # 替换为异步版本
        self.set = lambda key, value, ex=None: _async_wrap(
            self._original_set, key, value, ex=ex
        )
        self.get = lambda key: _async_wrap(self._original_get, key)
        self.delete = lambda key: _async_wrap(self._original_delete, key)

# 简单异步包装器 - 方法 2 (使用函数包装)
class AsyncRedisWrapper2:
    """使用函数定义包装的异步Redis包装器"""
    
    def __init__(self, url="redis://localhost:6379/0"):
        self.redis_client = redis.Redis.from_url(
            url, 
            encoding="utf-8",
            decode_responses=True
        )
    
    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """异步设置值"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.redis_client.set(key, value, ex=ex)
        )
    
    async def get(self, key: str) -> Any:
        """异步获取值"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.redis_client.get(key)
        )
        
    async def delete(self, key: str) -> bool:
        """异步删除值"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.redis_client.delete(key)
        )

# 简单异步包装器 - 方法 3 (使用类方法)
class AsyncRedisWrapper3:
    """使用类方法和装饰器的异步Redis包装器"""
    
    def __init__(self, url="redis://localhost:6379/0"):
        self.redis_client = redis.Redis.from_url(
            url, 
            encoding="utf-8",
            decode_responses=True
        )
    
    @staticmethod
    async def _run_sync(func, *args, **kwargs):
        """在执行器中运行同步函数"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: func(*args, **kwargs)
        )
    
    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """异步设置值"""
        return await self._run_sync(self.redis_client.set, key, value, ex=ex)
    
    async def get(self, key: str) -> Any:
        """异步获取值"""
        return await self._run_sync(self.redis_client.get, key)
        
    async def delete(self, key: str) -> bool:
        """异步删除值"""
        return await self._run_sync(self.redis_client.delete, key)

# 测试不同的包装器
async def test_wrapper(name: str, wrapper):
    """测试指定的包装器"""
    logger.info(f"\n===== 测试 {name} =====")
    
    test_key = f"test:{name}"
    test_value = {"name": name, "time": "now", "value": 456}
    serialized = json.dumps(test_value)
    
    try:
        # 设置值
        result = await wrapper.set(test_key, serialized)
        logger.info(f"设置值结果: {result}")
        
        # 获取值
        data = await wrapper.get(test_key)
        if data:
            logger.info(f"获取值成功: {json.loads(data)}")
        else:
            logger.warning("获取值为空")
            
        # 删除值
        delete_result = await wrapper.delete(test_key)
        logger.info(f"删除值结果: {delete_result}")
        
        # 验证删除
        after_delete = await wrapper.get(test_key)
        logger.info(f"删除后获取值: {after_delete}")
        
    except Exception as e:
        logger.error(f"测试 {name} 时出错: {e}")
        import traceback
        logger.error(traceback.format_exc())

# 主测试函数
async def main():
    """测试主函数"""
    logger.info("开始测试Redis异步包装器")
    
    if not REDIS_AVAILABLE:
        logger.error("Redis库不可用，无法进行测试")
        return
    
    # 测试直接使用redis-py
    await test_direct_redis()
    
    # 测试不同的包装器
    wrapper1 = AsyncRedisWrapper1()
    await test_wrapper("AsyncRedisWrapper1", wrapper1)
    
    wrapper2 = AsyncRedisWrapper2()
    await test_wrapper("AsyncRedisWrapper2", wrapper2)
    
    wrapper3 = AsyncRedisWrapper3()
    await test_wrapper("AsyncRedisWrapper3", wrapper3)
    
    logger.info("\n测试完成!")

if __name__ == "__main__":
    asyncio.run(main()) 