#!/usr/bin/env python3
"""
手动触发数据生成脚本
用于测试和调试热度计算流程

使用方法:
    cd backend
    python test_generate_data.py
"""
import asyncio
import sys
from datetime import datetime
import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.services.news_heat_score_service import heat_score_service
from app.core.logging import setup_logging


async def run_heat_score_update():
    """运行一次完整的热度计算流程"""
    setup_logging()
    print(f"[{datetime.now().isoformat()}] 开始运行热度计算流程...")
    
    async with async_session_maker() as session:
        try:
            # 更新所有新闻热度分数
            result = await heat_score_service.update_all_heat_scores(session)
            print(f"热度更新完成! 处理了 {len(result)} 条新闻")
            
            # 更新关键词热度
            keywords = await heat_score_service.update_keyword_heat(session)
            print(f"关键词热度更新完成! 处理了 {len(keywords)} 个关键词")
            
            # 更新来源权重
            source_weights = await heat_score_service.update_source_weights(session)
            print(f"来源权重更新完成! 处理了 {len(source_weights)} 个来源")
            
            # 获取热门新闻作为示例
            from app.crud import news_heat_score
            top_news = await news_heat_score.get_top_heat_scores(
                session, 
                limit=5, 
                skip=0,
                min_score=0,
                max_age_hours=72
            )
            
            # 打印前5条热门新闻
            print("\n热门新闻示例:")
            for i, news in enumerate(top_news, 1):
                print(f"{i}. {news.title} (热度: {news.heat_score})")
                print(f"   来源: {news.source_id} | URL: {news.url}")
                print(f"   发布时间: {news.published_at}")
                print(f"   关键词: {', '.join([k.get('word', '') for k in news.keywords[:5]])}")
                print()
            
            # 打印前5个热门关键词
            if keywords:
                print("\n热门关键词示例:")
                for i, kw in enumerate(keywords[:5], 1):
                    print(f"{i}. {kw['keyword']} (热度: {kw['heat']:.2f}, 出现次数: {kw['count']})")
            
            print("\n数据生成流程测试完成!")
            
            # 提交事务以避免回滚
            await session.commit()
            
        except Exception as e:
            print(f"错误: {e}")
            import traceback
            print(traceback.format_exc())
            return False
    
    return True


if __name__ == "__main__":
    success = asyncio.run(run_heat_score_update())
    sys.exit(0 if success else 1) 