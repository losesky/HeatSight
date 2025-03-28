import math
import uuid
import asyncio
import jieba
import jieba.analyse
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.config import settings
from app.db.redis import redis_manager
from app.models.news_heat_score import NewsHeatScore
from app.schemas.news_heat_score import HeatScoreCreate, HeatScoreUpdate
from app.crud import news_heat_score
from app.services.heatlink_client import HeatLinkAPIClient


# 算法常量配置
BASELINE_FACTOR = 10  # 基准系数，用于归一化关键词匹配度
DECAY_FACTOR = 24.0  # 时效性衰减因子（小时）
W_KEYWORD = 0.3  # 关键词匹配度权重
W_RECENCY = 0.25  # 时效性权重
W_PLATFORM = 0.15  # 原平台热度权重
W_CROSS_SOURCE = 0.2  # 跨源频率权重
W_SOURCE = 0.1  # 来源权重

# 缓存配置
CACHE_PREFIX = "heatsight:heatscore"
CACHE_TTL = 3600  # 1小时缓存时间


class NewsHeatScoreService:
    """Service for calculating and managing news heat scores."""

    def __init__(self):
        self.heatlink_client = HeatLinkAPIClient()
        
        # 加载停用词（可选）
        self._load_stopwords()
        
        # 初始化jieba分词
        self._init_jieba()

    def _load_stopwords(self):
        """加载中文停用词（可选）"""
        try:
            # 如果有停用词文件，可以在这里加载
            # with open("path/to/stopwords.txt", "r", encoding="utf-8") as f:
            #     self.stopwords = set([line.strip() for line in f])
            self.stopwords = set()
            logger.info("停用词初始化完成")
        except Exception as e:
            logger.warning(f"停用词加载失败: {e}")
            self.stopwords = set()

    def _init_jieba(self):
        """初始化jieba分词"""
        # 如果有自定义词典，可以在这里加载
        # jieba.load_userdict("path/to/userdict.txt")
        logger.info("jieba分词初始化完成")

    async def _extract_keywords(self, title: str, content: str = "") -> List[Dict[str, Any]]:
        """使用中文分词技术提取新闻关键词"""
        # 合并标题和内容，标题权重更高所以重复一次
        text = f"{title} {title} {content}"
        
        # 使用jieba提取关键词（返回带权重的关键词）
        keywords = jieba.analyse.textrank(text, topK=5, withWeight=True)
        
        # 转换为所需的数据结构
        result = []
        for word, weight in keywords:
            if word not in self.stopwords:  # 过滤停用词
                result.append({"word": word, "weight": float(weight)})
        
        return result

    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        """计算两个标题的相似度"""
        # 分词
        words1 = set(jieba.cut(title1))
        words2 = set(jieba.cut(title2))
        
        # 去除停用词
        words1 = words1.difference(self.stopwords)
        words2 = words2.difference(self.stopwords)
        
        # 计算Jaccard相似度
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        if union == 0:
            return 0
        
        return intersection / union

    async def _find_similar_news(self, title: str, news_items: List[Dict]) -> int:
        """查找与指定标题相似的新闻数量"""
        similar_count = 0
        threshold = 0.6  # 相似度阈值
        
        for item in news_items:
            if item["title"] != title:  # 排除自身
                similarity = self._calculate_title_similarity(title, item["title"])
                if similarity > threshold:
                    similar_count += 1
        
        return similar_count

    async def _normalize_platform_score(
        self, metrics: Dict[str, Any], source_id: str
    ) -> float:
        """标准化不同平台的热度指标"""
        # 不同平台的基准值
        platform_baselines = {
            "weibo": 10000,  # 微博热搜基准值
            "zhihu": 5000,   # 知乎热榜基准值
            "toutiao": 8000, # 头条热榜基准值
            "default": 1000  # 默认基准值
        }
        
        # 获取原始热度指标（不同平台可能有不同字段）
        original_score = 0
        if "view_count" in metrics:
            original_score = metrics["view_count"]
        elif "like_count" in metrics:
            original_score = metrics["like_count"]
        elif "comment_count" in metrics:
            original_score = metrics["comment_count"]
        elif "heat" in metrics:
            original_score = metrics["heat"]
        
        # 获取该平台的基准值
        baseline = platform_baselines.get(source_id, platform_baselines["default"])
        
        # 计算标准化得分（0-100范围）
        normalized_score = min(original_score / baseline * 100, 100)
        
        return normalized_score

    async def _calculate_cross_source_score(
        self, title: str, all_news_items: List[Dict]
    ) -> float:
        """计算跨源频率得分"""
        # 获取包含该新闻的不同源数量
        sources = set()
        for item in all_news_items:
            similarity = self._calculate_title_similarity(title, item["title"])
            if similarity > 0.6:  # 相似度阈值
                sources.add(item.get("source_id", ""))
        
        # 计算得分（假设最多出现在10个源中为满分）
        score = min(len(sources) / 10 * 100, 100)
        
        return score

    async def _get_source_weight(self, source_id: str, session: AsyncSession) -> float:
        """获取来源权重"""
        # 可以从数据库或配置获取来源权重
        # 这里简化为一个固定的权重映射
        source_weights = {
            "weibo": 90,
            "zhihu": 85,
            "toutiao": 80,
            "sina": 75,
            "163": 70,
            "qq": 70,
            "sohu": 65,
            "ifeng": 65,
            "baidu": 90,
            "default": 50,
        }
        
        return source_weights.get(source_id, source_weights["default"])

    async def calculate_heat_score(
        self, 
        news_item: Dict[str, Any], 
        all_news_items: List[Dict[str, Any]],
        session: AsyncSession
    ) -> NewsHeatScore:
        """为单个新闻项计算热度分数"""
        # 提取关键词
        keywords = await self._extract_keywords(
            news_item["title"], news_item.get("content", "")
        )
        
        # 计算关键词匹配度得分（通过搜索相似新闻）
        similar_count = 0
        for keyword in keywords[:3]:  # 使用前3个关键词进行搜索
            try:
                search_response = await self.heatlink_client.get(
                    "news", params={"search": keyword["word"]}
                )
                if search_response and "items" in search_response:
                    similar_count += len(search_response["items"])
            except Exception as e:
                logger.error(f"关键词搜索失败: {e}")
        
        # 归一化相似新闻数量为0-100分
        keyword_score = min(similar_count / BASELINE_FACTOR * 100, 100)
        
        # 计算时效性得分
        # 标准化时间格式处理，确保时区信息正确
        try:
            published_str = news_item["published_at"]
            # 处理不同格式的ISO日期字符串
            if 'Z' in published_str:
                # 替换Z为+00:00标准格式
                published_str = published_str.replace('Z', '+00:00')
            elif '+' not in published_str and '-' not in published_str[10:]:
                # 如果字符串中没有时区信息，添加UTC时区
                published_str = published_str + '+00:00'
            
            # 解析日期并确保是UTC时区
            published_time = datetime.fromisoformat(published_str)
            # 如果没有时区信息，添加UTC时区
            if published_time.tzinfo is None:
                published_time = published_time.replace(tzinfo=timezone.utc)
        except Exception as e:
            logger.error(f"解析发布时间失败: {e}，使用当前时间作为发布时间")
            published_time = datetime.now(timezone.utc)
        
        # 使用带时区的当前时间来计算时间差
        hours_passed = (datetime.now(timezone.utc) - published_time).total_seconds() / 3600
        recency_score = 100 * math.exp(-hours_passed / DECAY_FACTOR)
        
        # 计算原平台热度得分
        platform_score = 0
        if "metrics" in news_item:
            platform_score = await self._normalize_platform_score(
                news_item["metrics"], news_item["source_id"]
            )
        
        # 计算跨源频率得分
        cross_source_score = await self._calculate_cross_source_score(
            news_item["title"], all_news_items
        )
        
        # 获取来源权重
        source_weight = await self._get_source_weight(news_item["source_id"], session)
        
        # 综合计算最终热度
        final_score = (
            (W_KEYWORD * keyword_score) +
            (W_RECENCY * recency_score) +
            (W_PLATFORM * platform_score) +
            (W_CROSS_SOURCE * cross_source_score) +
            (W_SOURCE * source_weight)
        )
        
        # 归一化到0-100
        final_score = min(max(final_score, 0), 100)
        
        # 创建热度评分对象
        heat_score = HeatScoreCreate(
            news_id=news_item["id"],
            source_id=news_item["source_id"],
            title=news_item["title"],
            url=news_item["url"],
            heat_score=final_score,
            relevance_score=keyword_score,
            recency_score=recency_score,
            popularity_score=platform_score,
            meta_data={
                "cross_source_score": cross_source_score,
                "source_weight": source_weight
            },
            keywords=keywords,
            published_at=published_time,
        )
        
        # 保存到数据库
        db_obj = await news_heat_score.create(session, heat_score)
        
        return db_obj

    async def calculate_batch_heat_scores(
        self, news_items: List[Dict[str, Any]], session: AsyncSession
    ) -> Dict[str, NewsHeatScore]:
        """批量计算热度分数"""
        logger.info(f"开始计算{len(news_items)}条新闻的热度分数")
        
        results = {}
        for news_item in news_items:
            try:
                score_obj = await self.calculate_heat_score(
                    news_item, news_items, session
                )
                results[news_item["id"]] = score_obj
                logger.debug(f"新闻[{news_item['id']}]热度计算完成: {score_obj.heat_score}")
            except Exception as e:
                logger.error(f"新闻[{news_item['id']}]热度计算失败: {e}")
        
        logger.info(f"批量热度计算完成，成功: {len(results)}, 总数: {len(news_items)}")
        return results

    async def get_heat_scores(
        self, news_ids: List[str], session: AsyncSession
    ) -> Dict[str, float]:
        """获取多个新闻的热度分数"""
        # 尝试从缓存获取
        cache_key = f"{CACHE_PREFIX}:bulk:{','.join(sorted(news_ids))}"
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug(f"从缓存获取热度分数: {len(cached_data)} 条")
            return cached_data
        
        # 从数据库获取
        scores_map = await news_heat_score.get_multi_by_news_ids(session, news_ids)
        
        # 转换为所需格式
        result = {}
        for news_id in news_ids:
            if news_id in scores_map:
                result[news_id] = scores_map[news_id].heat_score
            else:
                result[news_id] = 0  # 默认分数
        
        # 缓存结果
        await redis_manager.set(cache_key, result, expire=CACHE_TTL)
        
        return result

    async def get_detailed_heat_scores(
        self, news_ids: List[str], session: AsyncSession
    ) -> Dict[str, Any]:
        """获取多个新闻的详细热度数据"""
        # 尝试从缓存获取
        cache_key = f"{CACHE_PREFIX}:detailed:{','.join(sorted(news_ids))}"
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug(f"从缓存获取详细热度数据: {len(cached_data)} 条")
            return cached_data
        
        # 从数据库获取
        scores_map = await news_heat_score.get_multi_by_news_ids(session, news_ids)
        
        # 转换为所需格式
        result = {}
        for news_id in news_ids:
            if news_id in scores_map:
                result[news_id] = scores_map[news_id].to_dict()
        
        # 缓存结果
        await redis_manager.set(cache_key, result, expire=CACHE_TTL)
        
        return result

    async def get_top_news(
        self, 
        limit: int = 50, 
        skip: int = 0, 
        min_score: Optional[float] = 50.0,
        max_age_hours: Optional[int] = 72,
        session: AsyncSession = None,
    ) -> List[Dict[str, Any]]:
        """获取热门新闻列表"""
        try:
            logger.info(f"获取热门新闻列表: limit={limit}, skip={skip}, min_score={min_score}, max_age_hours={max_age_hours}")
            
            # 使用新的字典返回方法，避免 ORM 模型和相关异步问题
            news_list = await news_heat_score.get_top_news_as_dict(
                session, limit, skip, min_score, max_age_hours
            )
            
            logger.info(f"成功获取热门新闻列表，共 {len(news_list)} 条记录")
            return news_list
        except Exception as e:
            logger.error(f"获取热门新闻列表失败: {str(e)}")
            # 记录更多的错误信息，有助于调试
            import traceback
            logger.error(traceback.format_exc())
            raise

    async def fetch_all_news_from_sources(self, sources: List[Dict]) -> List[Dict]:
        """从所有源获取新闻"""
        logger.info(f"开始从{len(sources)}个源获取新闻")
        
        # 限制并发请求数量
        max_concurrent = 5
        all_news_items = []
        
        # 分批处理源，避免过多并发请求
        for i in range(0, len(sources), max_concurrent):
            batch_sources = sources[i:i+max_concurrent]
            tasks = []
            
            for source in batch_sources:
                # 适配不同的API返回格式，尝试多种可能的ID字段名
                source_id = None
                for id_field in ["source_id", "id", "key", "name"]:
                    if id_field in source:
                        source_id = source[id_field]
                        break
                
                if not source_id:
                    logger.warning(f"跳过没有ID的源: {source}")
                    continue
                
                task = asyncio.create_task(
                    self.heatlink_client.get(f"external/source/{source_id}")
                )
                tasks.append((source_id, task))
            
            # 等待这一批任务完成
            for source_id, task in tasks:
                try:
                    source_data = await task
                    news_items = []
                    
                    # 尝试从不同的键获取新闻项
                    if source_data:
                        # 1. 首先尝试从'news'键获取（当前API格式）
                        if isinstance(source_data, dict) and "news" in source_data:
                            news_items = source_data["news"]
                            logger.debug(f"从源[{source_id}]的'news'键获取到 {len(news_items)} 条新闻")
                        
                        # 2. 如果没有news键，尝试从'items'键获取（旧格式）
                        elif isinstance(source_data, dict) and "items" in source_data:
                            news_items = source_data["items"]
                            logger.debug(f"从源[{source_id}]的'items'键获取到 {len(news_items)} 条新闻")
                        
                        # 3. 如果API直接返回了列表
                        elif isinstance(source_data, list):
                            news_items = source_data
                            logger.debug(f"源[{source_id}]直接返回列表，包含 {len(news_items)} 条新闻")
                        
                        # 为每个新闻项添加source_id
                        for item in news_items:
                            item["source_id"] = source_id
                        
                        # 添加到总列表
                        all_news_items.extend(news_items)
                    else:
                        logger.warning(f"从源[{source_id}]获取到空数据")
                except Exception as e:
                    logger.error(f"从源[{source_id}]获取新闻失败: {e}")
        
        logger.info(f"共获取到 {len(all_news_items)} 条新闻")
        return all_news_items

    async def update_all_heat_scores(self, session: AsyncSession):
        """更新所有新闻热度分数"""
        logger.info("开始更新所有新闻热度分数")
        
        try:
            # 1. 获取所有新闻源
            sources_data = await self.heatlink_client.get_sources(force_update=True)
            
            # 处理API返回值可能是列表或字典的情况
            if isinstance(sources_data, dict):
                sources = sources_data.get("sources", [])
            else:
                # 如果API直接返回列表，就直接使用
                sources = sources_data
            
            # 2. 获取所有新闻
            all_news_items = await self.fetch_all_news_from_sources(sources)
            
            # 3. 计算热度评分
            heat_scores = await self.calculate_batch_heat_scores(all_news_items, session)
            
            logger.info(f"热度分数更新完成，共更新{len(heat_scores)}条新闻")
            return heat_scores
        except Exception as e:
            logger.error(f"更新热度分数失败: {e}")
            raise

    async def update_keyword_heat(self, session: AsyncSession):
        """更新关键词热度"""
        logger.info("开始更新关键词热度")
        
        try:
            # 获取最近一段时间内的热门新闻
            heat_scores = await news_heat_score.get_top_heat_scores(
                session, 
                limit=100, 
                skip=0,
                min_score=30,
                max_age_hours=24 * 7  # 最近一周的数据
            )
            
            # 提取所有关键词并计算频率
            keyword_counts = {}
            for score in heat_scores:
                for keyword_item in score.keywords:
                    word = keyword_item.get("word")
                    weight = keyword_item.get("weight", 0.5)
                    
                    if word:
                        if word not in keyword_counts:
                            keyword_counts[word] = {
                                "count": 0,
                                "total_weight": 0,
                                "total_heat": 0,
                                "sources": set()
                            }
                        
                        keyword_counts[word]["count"] += 1
                        keyword_counts[word]["total_weight"] += weight
                        keyword_counts[word]["total_heat"] += score.heat_score
                        keyword_counts[word]["sources"].add(score.source_id)
            
            # 计算并存储关键词热度
            keyword_heat = []
            for word, data in keyword_counts.items():
                # 只关注出现在多个来源中的关键词
                if len(data["sources"]) >= 2 and data["count"] >= 3:
                    # 热度计算公式 = 出现次数 * 平均权重 * 平均热度 * 来源数量
                    heat = (
                        data["count"] * 
                        (data["total_weight"] / data["count"]) * 
                        (data["total_heat"] / data["count"]) * 
                        len(data["sources"])
                    ) / 1000  # 归一化
                    
                    keyword_heat.append({
                        "keyword": word,
                        "heat": min(heat, 100),  # 上限100
                        "count": data["count"],
                        "sources": list(data["sources"]),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    })
            
            # 更新到Redis缓存
            if keyword_heat:
                # 按热度排序
                keyword_heat.sort(key=lambda x: x["heat"], reverse=True)
                # 只保留前100个
                top_keywords = keyword_heat[:100]
                
                # 存储到Redis
                cache_key = f"{CACHE_PREFIX}:keywords"
                await redis_manager.set(cache_key, top_keywords, expire=CACHE_TTL * 2)
                
                logger.info(f"关键词热度更新完成，共更新 {len(top_keywords)} 个关键词")
                return top_keywords
            else:
                logger.warning("未找到足够的关键词数据")
                return []
        
        except Exception as e:
            logger.error(f"更新关键词热度失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise

    async def update_source_weights(self, session: AsyncSession):
        """更新来源权重"""
        logger.info("开始更新来源权重")
        
        try:
            # 获取所有新闻源
            sources_data = await self.heatlink_client.get_sources(force_update=True)
            
            # 处理API返回值可能是列表或字典的情况
            if isinstance(sources_data, dict):
                sources = sources_data.get("sources", [])
            else:
                # 如果API直接返回列表，就直接使用
                sources = sources_data
            
            logger.info(f"成功获取到 {len(sources)} 个新闻源")
            
            # 初始化来源权重数据
            source_stats = {}
            
            # 为每个来源获取最近的新闻
            for source in sources:
                source_id = source.get("source_id") or source.get("id")
                if not source_id:
                    logger.warning(f"跳过没有有效ID的源")
                    continue
                    
                try:
                    # 获取该来源的最新新闻
                    source_news = await self.heatlink_client.get_source(source_id, force_update=True)
                    
                    # 尝试从不同的键获取新闻项
                    news_items = []
                    
                    # 先尝试从'news'键获取，这是API当前的格式
                    if isinstance(source_news, dict) and "news" in source_news:
                        news_items = source_news.get("news", [])
                        logger.debug(f"从'news'键找到 {len(news_items)} 条新闻项")
                    
                    # 如果没找到，再尝试从'items'键获取（旧格式的兼容）
                    elif isinstance(source_news, dict) and "items" in source_news:
                        news_items = source_news.get("items", [])
                        logger.debug(f"从'items'键找到 {len(news_items)} 条新闻项")
                    
                    # 或者API直接返回了列表
                    elif isinstance(source_news, list):
                        news_items = source_news
                        logger.debug(f"API直接返回列表格式，包含 {len(news_items)} 条新闻项")
                    
                    # 统计该来源的数据
                    if news_items:
                        avg_engagement = 0
                        total_items = len(news_items)
                        
                        # 分析新闻项的互动数据
                        for item in news_items:
                            metrics = item.get("metrics", {})
                            engagement = (
                                metrics.get("view_count", 0) + 
                                metrics.get("like_count", 0) * 3 + 
                                metrics.get("comment_count", 0) * 5 + 
                                metrics.get("share_count", 0) * 10
                            )
                            avg_engagement += engagement
                        
                        if total_items > 0:
                            avg_engagement /= total_items
                        
                        # 计算更新频率分数（基于最新文章的时间间隔）
                        update_frequency = 50  # 默认值
                        if total_items >= 2:
                            try:
                                # 获取最新两篇文章的时间差
                                latest_str = news_items[0]["published_at"]
                                second_latest_str = news_items[1]["published_at"]
                                
                                # 处理不同格式的ISO日期字符串 - 最新文章
                                if 'Z' in latest_str:
                                    latest_str = latest_str.replace('Z', '+00:00')
                                elif '+' not in latest_str and '-' not in latest_str[10:]:
                                    latest_str = latest_str + '+00:00'
                                
                                # 处理不同格式的ISO日期字符串 - 第二新文章
                                if 'Z' in second_latest_str:
                                    second_latest_str = second_latest_str.replace('Z', '+00:00')
                                elif '+' not in second_latest_str and '-' not in second_latest_str[10:]:
                                    second_latest_str = second_latest_str + '+00:00'
                                    
                                # 解析日期并确保是UTC时区
                                latest_time = datetime.fromisoformat(latest_str)
                                second_latest_time = datetime.fromisoformat(second_latest_str)
                                
                                # 如果没有时区信息，添加UTC时区
                                if latest_time.tzinfo is None:
                                    latest_time = latest_time.replace(tzinfo=timezone.utc)
                                if second_latest_time.tzinfo is None:
                                    second_latest_time = second_latest_time.replace(tzinfo=timezone.utc)
                                
                                # 计算小时差
                                hours_diff = (latest_time - second_latest_time).total_seconds() / 3600
                                
                                # 更新越频繁，分数越高（最高100）
                                if hours_diff <= 1:  # 每小时更新
                                    update_frequency = 100
                                elif hours_diff <= 3:  # 每3小时更新
                                    update_frequency = 90
                                elif hours_diff <= 6:  # 每6小时更新
                                    update_frequency = 80
                                elif hours_diff <= 12:  # 每12小时更新
                                    update_frequency = 70
                                elif hours_diff <= 24:  # 每天更新
                                    update_frequency = 60
                                else:
                                    update_frequency = 50
                            except Exception as e:
                                logger.warning(f"计算更新频率失败: {e}")
                                # 记录更详细的错误信息以便调试
                                import traceback
                                logger.debug(traceback.format_exc())
                        
                        # 综合计算来源权重
                        source_weight = min(
                            (avg_engagement / 1000) * 0.7 + update_frequency * 0.3, 
                            100
                        )
                        
                        # 存储来源统计数据
                        source_stats[source_id] = {
                            "weight": source_weight,
                            "avg_engagement": avg_engagement,
                            "update_frequency": update_frequency,
                            "item_count": total_items,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        logger.debug(f"成功处理源 '{source_id}', 权重={source_weight:.2f}")
                    else:
                        logger.warning(f"源 '{source_id}' 没有返回新闻数据")
                
                except Exception as e:
                    logger.error(f"处理来源 {source_id} 失败: {e}")
            
            # 存储所有来源权重到Redis
            if source_stats:
                cache_key = f"{CACHE_PREFIX}:source_weights"
                await redis_manager.set(cache_key, source_stats, expire=CACHE_TTL * 24)  # 缓存24小时
                
                logger.info(f"来源权重更新完成，共更新 {len(source_stats)} 个来源")
                return source_stats
            else:
                logger.warning("未获取到有效的来源数据")
                return {}
                
        except Exception as e:
            logger.error(f"更新来源权重失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise


# 创建服务实例
heat_score_service = NewsHeatScoreService() 