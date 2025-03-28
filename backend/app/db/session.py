from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# 创建异步 SQLAlchemy 引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG,
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
async def get_db():
    """提供 SQLAlchemy 异步数据库会话的依赖函数。"""
    async with SessionLocal() as db:
        try:
            yield db
        finally:
            await db.close() 