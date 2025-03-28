# SQLAlchemy 异步数据库连接修复方案

## 问题描述

当前应用使用 SQLAlchemy 异步 API 与同步的 PostgreSQL 驱动程序 (`psycopg2`) 一起使用，导致以下错误：

```
sqlalchemy.exc.InvalidRequestError: The asyncio extension requires an async driver to be used. The loaded 'psycopg2' is not async.
```

或者在尝试访问数据时出现：

```
TypeError: object ChunkedIteratorResult can't be used in 'await' expression
```

## 解决方案

### 1. 安装异步 PostgreSQL 驱动程序

```bash
pip install asyncpg
```

添加到 `requirements.txt`：

```
asyncpg==0.29.0  # PostgreSQL 异步驱动
```

### 2. 修改数据库 URL 配置

编辑 `.env` 文件，将数据库 URL 从 `postgresql://` 修改为 `postgresql+asyncpg://`：

```
# 原始配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heatsight_dev
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heatsight_test

# 修改为
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/heatsight_dev
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/heatsight_test
```

### 3. 更新 CRUD 函数

确保所有 CRUD 函数正确使用 SQLAlchemy 异步 API：

```python
# 示例：获取热门新闻列表
async def get_top_news_as_dict(
    db: AsyncSession, 
    limit: int = 50, 
    skip: int = 0,
    min_score: Optional[float] = None,
    max_age_hours: Optional[int] = 72,
) -> List[Dict[str, Any]]:
    """获取热门新闻列表作为字典列表"""
    try:
        # 构建查询
        stmt = select(NewsHeatScore)
        
        # 应用过滤条件
        if max_age_hours is not None:
            min_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            stmt = stmt.where(NewsHeatScore.published_at >= min_time)
        
        if min_score is not None:
            stmt = stmt.where(NewsHeatScore.heat_score >= min_score)
        
        # 应用排序和分页
        stmt = stmt.order_by(desc(NewsHeatScore.heat_score))
        
        if skip:
            stmt = stmt.offset(skip)
        
        if limit:
            stmt = stmt.limit(limit)
        
        # 执行查询
        result = await db.execute(stmt)
        
        # 获取结果并转换为字典列表
        news_list = []
        for row in result.scalars():
            item_dict = {
                "id": row.id,
                "news_id": row.news_id,
                "source_id": row.source_id,
                "title": row.title,
                "url": row.url,
                "heat_score": row.heat_score,
                "relevance_score": row.relevance_score,
                "recency_score": row.recency_score,
                "popularity_score": row.popularity_score,
                "meta_data": row.meta_data,
                "keywords": row.keywords,
                "calculated_at": row.calculated_at.isoformat() if row.calculated_at else None,
                "published_at": row.published_at.isoformat() if row.published_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            news_list.append(item_dict)
        
        return news_list
    except Exception as e:
        logger.error(f"获取热门新闻列表失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise
```

### 4. 重启应用

安装依赖并修改配置后，重启应用：

```bash
cd /home/losesky/HeatSight/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

## 技术说明

SQLAlchemy 支持多种数据库驱动程序，但在使用异步 API 时必须使用异步驱动程序：

1. **同步驱动程序**：如 `psycopg2`、`pymysql` 等
2. **异步驱动程序**：如 `asyncpg`、`aiomysql` 等

当使用 `sqlalchemy.ext.asyncio` 模块中的功能时，必须配合异步驱动程序使用，否则会出现上述错误。

## 数据库 URL 格式参考

```
# PostgreSQL
同步: postgresql://user:password@host:port/dbname
异步: postgresql+asyncpg://user:password@host:port/dbname

# MySQL
同步: mysql://user:password@host:port/dbname
异步: mysql+aiomysql://user:password@host:port/dbname

# SQLite
同步: sqlite:///path/to/file.db
异步: sqlite+aiosqlite:///path/to/file.db
``` 