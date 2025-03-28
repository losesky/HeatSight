import asyncio
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy import select, desc, MetaData, Table, Column, String, Float, JSON, DateTime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# 从环境变量中获取数据库 URL，如果没有则使用默认值
from app.core.config import settings

# 使用与应用相同的数据库 URL
DATABASE_URL = settings.DATABASE_URL

Base = declarative_base()

# 定义与数据库模型相同的模型类
class NewsHeatScore(Base):
    __tablename__ = "news_heat_scores"
    
    id = Column(String, primary_key=True)
    news_id = Column(String, index=True)
    source_id = Column(String, index=True)
    title = Column(String)
    url = Column(String)
    heat_score = Column(Float, index=True)
    relevance_score = Column(Float)
    recency_score = Column(Float)
    popularity_score = Column(Float)
    meta_data = Column(JSON)
    keywords = Column(JSON)
    calculated_at = Column(DateTime)
    published_at = Column(DateTime, index=True)
    updated_at = Column(DateTime)
    
    # 将模型转换为字典的方法
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "news_id": self.news_id,
            "source_id": self.source_id,
            "title": self.title,
            "url": self.url,
            "heat_score": self.heat_score,
            "relevance_score": self.relevance_score,
            "recency_score": self.recency_score,
            "popularity_score": self.popularity_score,
            "meta_data": self.meta_data,
            "keywords": self.keywords,
            "calculated_at": self.calculated_at.isoformat() if self.calculated_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# 创建异步引擎和会话
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 测试查询方法 1 - 正在使用的方法（有问题的方法）
async def test_current_method():
    print("\n=== 测试当前方法 (可能有问题) ===")
    
    async with async_session() as session:
        try:
            # 构建查询
            stmt = select(NewsHeatScore)
            
            # 应用过滤条件
            min_time = datetime.utcnow() - timedelta(hours=72)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
            stmt = stmt.where(NewsHeatScore.heat_score >= 50.0)
            
            # 应用排序和分页
            stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
            stmt = stmt.limit(3)
            
            print("执行查询前...")
            # 执行查询 - 问题可能在这里
            result = await session.execute(stmt)
            print("查询已执行完成")
            
            # 使用同步方式处理结果集
            print("开始处理结果集...")
            news_list = []
            for row in result.scalars():
                news_dict = row.to_dict()
                news_list.append(news_dict)
            
            print(f"成功获取结果，共 {len(news_list)} 条记录")
            if news_list:
                print(f"第一条记录标题: {news_list[0]['title']}")
            
            return news_list
        except Exception as e:
            print(f"错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []

# 测试方法 2 - 不使用 await，而是直接执行
async def test_alternative_method():
    print("\n=== 测试替代方法 ===")
    
    async with async_session() as session:
        try:
            # 构建查询
            stmt = select(NewsHeatScore)
            
            # 应用过滤条件
            min_time = datetime.utcnow() - timedelta(hours=72)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
            stmt = stmt.where(NewsHeatScore.heat_score >= 50.0)
            
            # 应用排序和分页
            stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
            stmt = stmt.limit(3)
            
            print("执行查询前...")
            # 执行查询 - 不使用 await
            result = await session.execute(stmt)
            print("查询已执行完成")
            
            # 先获取所有结果
            print("获取所有结果...")
            all_results = result.all()
            print(f"共获取 {len(all_results)} 行结果")
            
            # 处理结果
            news_list = []
            for row in all_results:
                news_score = row[0]  # 获取 ORM 模型对象
                news_dict = news_score.to_dict()
                news_list.append(news_dict)
            
            print(f"成功获取结果，共 {len(news_list)} 条记录")
            if news_list:
                print(f"第一条记录标题: {news_list[0]['title']}")
            
            return news_list
        except Exception as e:
            print(f"错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []

# 测试方法 3 - 使用 fetchall 而不是 scalars
async def test_fetchall_method():
    print("\n=== 测试 fetchall 方法 ===")
    
    async with async_session() as session:
        try:
            # 构建查询
            stmt = select(NewsHeatScore)
            
            # 应用过滤条件
            min_time = datetime.utcnow() - timedelta(hours=72)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
            stmt = stmt.where(NewsHeatScore.heat_score >= 50.0)
            
            # 应用排序和分页
            stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
            stmt = stmt.limit(3)
            
            print("执行查询前...")
            # 执行查询
            result = await session.execute(stmt)
            print("查询已执行完成")
            
            # 使用 fetchall
            print("使用 fetchall 获取所有结果...")
            rows = result.fetchall()
            print(f"共获取 {len(rows)} 行结果")
            
            # 处理结果
            news_list = []
            for row in rows:
                news_score = row[0]  # 获取 ORM 模型对象
                news_dict = news_score.to_dict()
                news_list.append(news_dict)
            
            print(f"成功获取结果，共 {len(news_list)} 条记录")
            if news_list:
                print(f"第一条记录标题: {news_list[0]['title']}")
            
            return news_list
        except Exception as e:
            print(f"错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []

# 测试方法 4 - 使用 SQLAlchemy 2.0 更为推荐的方式
async def test_sqlalchemy2_method():
    print("\n=== 测试 SQLAlchemy 2.0 推荐方法 ===")
    
    async with async_session() as session:
        try:
            # 构建查询
            stmt = select(NewsHeatScore)
            
            # 应用过滤条件
            min_time = datetime.utcnow() - timedelta(hours=72)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
            stmt = stmt.where(NewsHeatScore.heat_score >= 50.0)
            
            # 应用排序和分页
            stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
            stmt = stmt.limit(3)
            
            print("执行查询前...")
            # 执行查询并直接获取结果
            result = await session.execute(stmt)
            print("查询已执行完成")
            
            # 使用 SQLAlchemy 2.0 的方式处理结果
            print("获取 scalars 结果...")
            rows = list(result.scalars().all())
            print(f"共获取 {len(rows)} 行结果")
            
            # 处理结果
            news_list = []
            for news_score in rows:
                news_dict = news_score.to_dict()
                news_list.append(news_dict)
            
            print(f"成功获取结果，共 {len(news_list)} 条记录")
            if news_list:
                print(f"第一条记录标题: {news_list[0]['title']}")
            
            return news_list
        except Exception as e:
            print(f"错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []


# 测试方法 5 - 使用原始 SQL 查询
async def test_raw_sql_method():
    print("\n=== 测试原始 SQL 查询方法 ===")
    
    async with async_session() as session:
        try:
            # 构建原始 SQL 查询
            from sqlalchemy import text
            
            sql = """
            SELECT * FROM news_heat_scores
            WHERE published_at >= :min_time
            AND heat_score >= :min_score
            ORDER BY heat_score DESC
            LIMIT :limit
            """
            
            min_time = datetime.utcnow() - timedelta(hours=72)
            params = {
                "min_time": min_time,
                "min_score": 50.0,
                "limit": 3
            }
            
            print("执行查询前...")
            # 执行原始 SQL 查询
            result = await session.execute(text(sql), params)
            print("查询已执行完成")
            
            # 处理结果
            news_list = []
            for row in result:
                # 将行转换为字典
                row_dict = {}
                for key in row._mapping:
                    value = row._mapping[key]
                    # 处理日期时间类型
                    if isinstance(value, datetime):
                        row_dict[key] = value.isoformat()
                    else:
                        row_dict[key] = value
                news_list.append(row_dict)
            
            print(f"成功获取结果，共 {len(news_list)} 条记录")
            if news_list:
                print(f"第一条记录标题: {news_list[0]['title']}")
            
            return news_list
        except Exception as e:
            print(f"错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []


# 主函数
async def main():
    print("开始测试 SQLAlchemy 异步查询...\n")
    
    try:
        # 测试当前方法（可能有问题）
        await test_current_method()
        
        # 测试替代方法
        await test_alternative_method()
        
        # 测试 fetchall 方法
        await test_fetchall_method()
        
        # 测试 SQLAlchemy 2.0 推荐方法
        await test_sqlalchemy2_method()
        
        # 测试原始 SQL 查询方法
        await test_raw_sql_method()
        
    except Exception as e:
        print(f"测试过程中发生错误: {str(e)}")
        import traceback
        print(traceback.format_exc())
    
    print("\n测试完成!")


# 运行主函数
if __name__ == "__main__":
    asyncio.run(main()) 