#!/usr/bin/env python3
"""
HeatLink API 客户端测试脚本
用于验证客户端连接和解决重定向问题
"""
import asyncio
import httpx
from loguru import logger

from app.services.heatlink_client import HeatLinkAPIClient
from app.core.config import settings


# 测试直接使用httpx的情况
async def test_httpx_direct():
    print("\n===== 测试直接使用HTTPX =====")
    # 测试不自动重定向的情况
    print("测试不跟随重定向:")
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
            url = f"{settings.HEATLINK_API_URL}/sources"
            print(f"请求URL: {url}")
            response = await client.get(url)
            print(f"状态码: {response.status_code}")
            print(f"响应头: {dict(response.headers)}")
            if 'location' in response.headers:
                print(f"重定向位置: {response.headers['location']}")
    except Exception as e:
        print(f"错误: {e}")
    
    # 测试自动重定向的情况
    print("\n测试跟随重定向:")
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            url = f"{settings.HEATLINK_API_URL}/sources"
            print(f"请求URL: {url}")
            response = await client.get(url)
            print(f"状态码: {response.status_code}")
            print(f"响应内容长度: {len(response.text)} 字节")
            print(f"响应内容前100个字符: {response.text[:100]}")
    except Exception as e:
        print(f"错误: {e}")


# 测试HeatLink客户端
async def test_heatlink_client():
    print("\n===== 测试HeatLink客户端 =====")
    try:
        client = HeatLinkAPIClient()
        print(f"基础URL: {client.base_url}")
        
        print("\n测试获取sources:")
        sources = await client.get_sources(force_update=True)
        if isinstance(sources, list):
            print(f"成功获取 {len(sources)} 个源")
            if sources:
                print(f"第一个源: {sources[0]}")
        elif isinstance(sources, dict):
            sources_list = sources.get("sources", [])
            print(f"成功获取 {len(sources_list)} 个源")
            if sources_list:
                print(f"第一个源: {sources_list[0]}")
        else:
            print(f"返回类型: {type(sources)}")
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        print(traceback.format_exc())


async def main():
    # 配置日志
    logger.remove()
    logger.add(lambda msg: print(msg), level="DEBUG")
    
    print(f"HeatLink API URL: {settings.HEATLINK_API_URL}")
    print(f"HeatLink API超时设置: {settings.HEATLINK_API_TIMEOUT}秒")
    
    # 测试直接使用httpx
    await test_httpx_direct()
    
    # 测试HeatLink客户端
    await test_heatlink_client()


if __name__ == "__main__":
    asyncio.run(main()) 