#!/usr/bin/env python3
"""
手动触发数据生成脚本
用于测试和调试热度计算流程

使用方法:
    cd backend
    python run_generate_data.py
"""
import asyncio
import sys
from datetime import datetime
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import async_session_maker
from app.services.news_heat_score_service import heat_score_service
from app.core.logging import setup_logging


async def run_heat_score_update():
    """运行一次完整的热度计算流程"""
    # 设置日志系统
    setup_logging()
    
    # 设置 SQLAlchemy 日志级别为 WARNING，减少 SQL 日志输出
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    
    # 使用明显的标记，确保在非调试模式下也能看到
    print("\n" + "="*60)
    print(f"[{datetime.now().isoformat()}] 开始运行热度计算流程...")
    print("="*60 + "\n")
    
    async with async_session_maker() as session:
        try:
            # 1. 更新所有新闻热度分数
            print("\n>>> 第1步: 正在更新所有新闻热度分数...")
            result = await heat_score_service.update_all_heat_scores(session)
            print(f"    [完成] 热度更新成功! 处理了 {len(result)} 条新闻")
            
            # 2. 更新关键词热度
            print("\n>>> 第2步: 正在更新关键词热度...")
            keywords = await heat_score_service.update_keyword_heat(session)
            print(f"    [完成] 关键词热度更新成功! 处理了 {len(keywords)} 个关键词")
            
            # 3. 更新来源权重
            print("\n>>> 第3步: 正在更新来源权重...")
            source_weights = await heat_score_service.update_source_weights(session)
            print(f"    [完成] 来源权重更新成功! 处理了 {len(source_weights)} 个来源")
            
            # 4. 获取热门新闻作为示例
            print("\n>>> 第4步: 获取热门新闻示例...")
            from app.crud import news_heat_score
            top_news = await news_heat_score.get_top_heat_scores(
                session, 
                limit=5, 
                skip=0,
                min_score=0,
                max_age_hours=72
            )
            
            # 打印前5条热门新闻
            print("\n热门新闻Top5:")
            for i, news in enumerate(top_news, 1):
                print(f"{i}. {news.title}")
                print(f"   热度: {news.heat_score:.1f} | 来源: {news.source_id}")
                print(f"   时效性: {news.recency_score:.1f} | 相关性: {news.relevance_score:.1f} | 平台热度: {news.popularity_score:.1f}")
                print(f"   发布时间: {news.published_at}")
                print(f"   关键词: {', '.join([k.get('word', '') for k in news.keywords[:5]])}")
                print()
            
            # 打印前5个热门关键词
            if keywords:
                print("\n热门关键词Top5:")
                for i, kw in enumerate(keywords[:5], 1):
                    sources = kw.get('sources', [])
                    sources_str = ", ".join(sources[:3])
                    if len(sources) > 3:
                        sources_str += f" 等{len(sources)}个来源"
                    print(f"{i}. {kw['keyword']} (热度: {kw['heat']:.1f}, 出现: {kw['count']}次, 来源: {sources_str})")
            
            # 提交事务以保存所有更改
            await session.commit()
            
            print("\n" + "="*60)
            print(f"数据生成流程测试完成! - {datetime.now().isoformat()}")
            print("所有数据已成功写入数据库")
            print("="*60 + "\n")
            
        except Exception as e:
            print("\n" + "="*60)
            print(f"错误: {e}")
            print("="*60)
            
            # 发生异常时回滚事务
            await session.rollback()
            print("数据库事务已回滚!")
            
            import traceback
            traceback_str = traceback.format_exc()
            print(f"\n错误详情:\n{traceback_str}")
            
            return False
    
    return True


if __name__ == "__main__":
    success = asyncio.run(run_heat_score_update())
    sys.exit(0 if success else 1) 