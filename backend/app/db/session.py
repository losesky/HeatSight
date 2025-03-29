from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from fastapi import Depends
from typing import AsyncGenerator

from app.core.config import settings

# 创建异步 SQLAlchemy 引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    # 只在调试模式下回显SQL语句
    echo=False,  # 完全禁用直接回显，我们通过日志过滤器来控制
    # 禁用参数回显，避免生成大量无用信息
    echo_pool=False,
)

# 创建异步会话类
SessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False, 
    autoflush=False
)

# 为了兼容性添加别名
async_session_maker = SessionLocal

# 创建声明性基类模型
Base = declarative_base()


# 获取数据库会话的依赖函数
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """提供 SQLAlchemy 异步数据库会话的依赖函数。"""
    async with SessionLocal() as db:
        try:
            yield db
        except Exception:
            # 出现异常时回滚事务
            await db.rollback()
            raise
        finally:
            # 确保会话被关闭
            await db.close()


# 提供一个自动提交事务的数据库会话依赖
async def get_db_auto_commit() -> AsyncGenerator[AsyncSession, None]:
    """提供自动提交事务的 SQLAlchemy 异步数据库会话依赖函数。"""
    async with SessionLocal() as db:
        try:
            yield db
            # 视图函数成功结束后自动提交事务
            await db.commit()
        except Exception:
            # 出现异常时回滚事务
            await db.rollback()
            raise
        finally:
            # 确保会话被关闭
            await db.close()


# 创建一个上下文管理器函数，用于后台任务使用
async def get_session_for_task():
    """为后台任务创建独立的数据库会话上下文。"""
    async with SessionLocal() as session:
        try:
            yield session
            # 确保事务被提交
            await session.commit()
        except Exception:
            # 出现异常时回滚事务
            await session.rollback()
            raise 