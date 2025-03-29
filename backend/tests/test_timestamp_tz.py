#!/usr/bin/env python3
"""
测试PostgreSQL时区处理
此脚本用于测试PostgreSQL如何处理带时区和不带时区的datetime对象
"""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Table, MetaData, create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import logging

# 设置日志
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 从环境变量中获取数据库URL
from app.core.config import settings
DATABASE_URL = settings.DATABASE_URL

# 创建临时表
metadata = MetaData()
Base = declarative_base()

class TimestampTest(Base):
    __tablename__ = "timestamp_tests"
    
    id = Column(String, primary_key=True)
    time_with_tz = Column(DateTime(timezone=True))
    time_without_tz = Column(DateTime(timezone=False))
    description = Column(String)

async def test_timestamp_handling():
    """测试PostgreSQL如何处理带时区和不带时区的datetime对象"""
    try:
        # 创建异步引擎和会话
        engine = create_async_engine(DATABASE_URL)
        
        # 创建临时表
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        # 创建会话
        async_session = sessionmaker(
            engine, expire_on_commit=False, class_=AsyncSession
        )
        
        # 获取当前时间（带UTC时区）
        now_with_tz = datetime.now(timezone.utc)
        logger.info(f"原始时间（带UTC时区）: {now_with_tz}")
        
        # 同样的时间，但移除时区信息
        now_without_tz = now_with_tz.replace(tzinfo=None)
        logger.info(f"原始时间（不带时区）: {now_without_tz}")
        
        # 测试1：插入带时区的datetime到时区列和无时区的datetime到非时区列
        test1 = TimestampTest(
            id="test1",
            time_with_tz=now_with_tz,
            time_without_tz=now_with_tz.replace(tzinfo=None), 
            description="带时区的datetime插入到时区列，移除时区后插入到非时区列"
        )
        
        # 测试2：插入不带时区的datetime到两种列
        test2 = TimestampTest(
            id="test2",
            time_with_tz=now_without_tz,
            time_without_tz=now_without_tz, 
            description="不带时区的datetime插入到两种列"
        )
        
        async with async_session() as session:
            # 插入测试数据
            session.add(test1)
            session.add(test2)
            await session.commit()
            
            # 查询并显示结果
            result = await session.execute(text("SELECT * FROM timestamp_tests"))
            rows = result.fetchall()
            
            logger.info("\n测试结果:")
            for row in rows:
                logger.info(f"ID: {row.id}, 描述: {row.description}")
                logger.info(f"  时区列: {row.time_with_tz}")
                logger.info(f"  非时区列: {row.time_without_tz}")
            
            # 执行直接的SQL查询，以查看PostgreSQL如何表示这些时间
            logger.info("\nSQL查询结果:")
            sql_result = await session.execute(text(
                "SELECT id, time_with_tz, time_without_tz, "
                "time_with_tz AT TIME ZONE 'UTC' as tz_utc, "
                "time_without_tz AT TIME ZONE 'UTC' as notz_utc "
                "FROM timestamp_tests"
            ))
            sql_rows = sql_result.fetchall()
            
            for row in sql_rows:
                logger.info(f"ID: {row.id}")
                logger.info(f"  时区列原始: {row.time_with_tz}")
                logger.info(f"  非时区列原始: {row.time_without_tz}")
                logger.info(f"  时区列UTC转换: {row.tz_utc}")
                logger.info(f"  非时区列UTC转换: {row.notz_utc}")
            
            # 测试HeatScoreCreate模拟场景
            logger.info("\n模拟HeatScoreCreate场景:")
            # 模拟从API获取的带时区时间
            api_time = datetime.now(timezone.utc)
            logger.info(f"模拟API时间（带时区）: {api_time}")
            
            # 创建测试数据，模拟我们的解决方案
            test3 = TimestampTest(
                id="solution_test",
                # 插入带时区的时间到时区列
                time_with_tz=api_time,
                # 插入移除时区的时间到非时区列
                time_without_tz=api_time.replace(tzinfo=None),
                description="我们的解决方案：明确移除时区信息"
            )
            
            session.add(test3)
            await session.commit()
            
            # 验证结果
            result = await session.execute(
                text("SELECT * FROM timestamp_tests WHERE id = 'solution_test'")
            )
            solution_row = result.fetchone()
            
            logger.info(f"解决方案结果:")
            logger.info(f"  时区列: {solution_row.time_with_tz}")
            logger.info(f"  非时区列: {solution_row.time_without_tz}")
            
            # 测试时区转换
            tz_test = await session.execute(text(
                "SELECT "
                "time_with_tz, "
                "time_with_tz AT TIME ZONE 'UTC' as tz_to_utc, "
                "time_with_tz AT TIME ZONE 'Asia/Shanghai' as tz_to_shanghai "
                "FROM timestamp_tests WHERE id = 'solution_test'"
            ))
            tz_row = tz_test.fetchone()
            
            logger.info(f"时区转换测试:")
            logger.info(f"  原始时区时间: {tz_row.time_with_tz}")
            logger.info(f"  转换为UTC: {tz_row.tz_to_utc}")
            logger.info(f"  转换为上海时区: {tz_row.tz_to_shanghai}")
        
        # 清理测试表
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        
        # 关闭连接池
        await engine.dispose()
        
        logger.info("测试完成")
    
    except Exception as e:
        logger.error(f"测试失败: {e}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test_timestamp_handling()) 