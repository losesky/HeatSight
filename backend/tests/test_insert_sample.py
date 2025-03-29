"""
测试脚本，用于插入示例数据并测试热门新闻API
"""
import asyncio
import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.news_heat_score import NewsHeatScore


async def insert_sample_data():
    """插入示例新闻热度数据"""
    print("开始插入示例数据...")
    
    # 创建示例数据
    sample_data = [
        {
            "id": str(uuid.uuid4()),
            "news_id": "1001",
            "source_id": "weibo",
            "title": "示例热门新闻 1",
            "url": "https://example.com/news/1",
            "heat_score": 95.5,
            "relevance_score": 90.0,
            "recency_score": 85.0,
            "popularity_score": 88.0,
            "meta_data": {"cross_source_score": 75.0, "source_weight": 90.0},
            "keywords": [{"word": "热门", "weight": 0.8}, {"word": "新闻", "weight": 0.7}],
            "calculated_at": datetime.now(),
            "published_at": datetime.now() - timedelta(hours=2),
            "updated_at": datetime.now()
        },
        {
            "id": str(uuid.uuid4()),
            "news_id": "1002",
            "source_id": "zhihu",
            "title": "示例热门新闻 2",
            "url": "https://example.com/news/2",
            "heat_score": 92.0,
            "relevance_score": 88.0,
            "recency_score": 90.0,
            "popularity_score": 85.0,
            "meta_data": {"cross_source_score": 70.0, "source_weight": 85.0},
            "keywords": [{"word": "热点", "weight": 0.9}, {"word": "话题", "weight": 0.8}],
            "calculated_at": datetime.now(),
            "published_at": datetime.now() - timedelta(hours=3),
            "updated_at": datetime.now()
        },
        {
            "id": str(uuid.uuid4()),
            "news_id": "1003",
            "source_id": "toutiao",
            "title": "示例热门新闻 3",
            "url": "https://example.com/news/3",
            "heat_score": 88.5,
            "relevance_score": 85.0,
            "recency_score": 82.0,
            "popularity_score": 90.0,
            "meta_data": {"cross_source_score": 65.0, "source_weight": 80.0},
            "keywords": [{"word": "头条", "weight": 0.85}, {"word": "资讯", "weight": 0.75}],
            "calculated_at": datetime.now(),
            "published_at": datetime.now() - timedelta(hours=5),
            "updated_at": datetime.now()
        }
    ]
    
    # 创建异步会话
    async with SessionLocal() as session:
        try:
            # 插入示例数据
            for data in sample_data:
                db_obj = NewsHeatScore(**data)
                session.add(db_obj)
            
            # 提交事务
            await session.commit()
            print(f"成功插入 {len(sample_data)} 条示例数据")
            
        except Exception as e:
            print(f"插入数据失败: {e}")
            import traceback
            print(traceback.format_exc())
            await session.rollback()


async def test_api():
    """测试热门新闻API"""
    import httpx
    
    print("\n测试热门新闻API...")
    url = "http://localhost:8080/api/heat-score/top?limit=3&skip=0&min_score=50&max_age_hours=72"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                print(f"请求成功，获取到 {len(data)} 条记录")
                for item in data:
                    print(f"- {item['title']} (热度: {item['heat_score']})")
            else:
                print(f"请求失败，状态码: {response.status_code}")
                print(f"错误信息: {response.text}")
    
    except Exception as e:
        print(f"请求异常: {e}")
        import traceback
        print(traceback.format_exc())


async def main():
    """主函数"""
    print("运行测试脚本...")
    
    # 插入示例数据
    await insert_sample_data()
    
    # 测试API
    await test_api()


if __name__ == "__main__":
    asyncio.run(main()) 