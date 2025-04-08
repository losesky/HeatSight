import math
import uuid
import asyncio
import jieba
import jieba.analyse
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
import os
from pathlib import Path

from app.core.config import settings
from app.db.redis import redis_manager
from app.models.news_heat_score import NewsHeatScore
from app.schemas.news_heat_score import HeatScoreCreate, HeatScoreUpdate
from app.crud import news_heat_score
from app.services.heatlink_client import HeatLinkAPIClient

# 设置NLTK数据目录
NLTK_DATA_DIR = Path(__file__).parent.parent.parent / "nltk_data"
os.environ['NLTK_DATA'] = str(NLTK_DATA_DIR)

try:
    import nltk
    from nltk.tokenize import RegexpTokenizer
    from nltk.corpus import stopwords
    
    # 创建基本的分词器
    word_tokenizer = RegexpTokenizer(r'\w+')
    
    # 确保必要的NLTK数据已下载
    def ensure_nltk_resource(resource):
        try:
            if resource == 'stopwords':
                # 测试停用词功能
                stopwords.words('english')
        except LookupError:
            logger.info(f"正在下载NLTK资源: {resource}")
            nltk.download(resource, quiet=True, download_dir=str(NLTK_DATA_DIR))
    
    # 只下载停用词资源
    ensure_nltk_resource('stopwords')
    
    NLTK_AVAILABLE = True
    logger.info("✨ NLTK初始化成功")
except Exception as e:
    logger.warning(f"⚠️ NLTK初始化失败: {e}")
    NLTK_AVAILABLE = False

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
        
        # 加载停用词
        self._load_stopwords()
        
        # 初始化分词器
        self._init_tokenizers()

    def _load_stopwords(self):
        """加载中英文停用词"""
        try:
            # 加载中文停用词
            self.cn_stopwords = set()
            # 创建临时停用词文件
            self.cn_stopwords_file = os.path.join(
                os.path.dirname(__file__),
                "cn_stopwords.txt"
            )
            
            # 写入基本的中文停用词
            basic_stopwords = {
                "的", "了", "和", "是", "就", "都", "而", "及", "与", "着",
                "或", "一个", "没有", "我们", "你们", "他们", "它们", "这个",
                "那个", "这些", "那些", "这样", "那样", "之", "的话", "说",
                "时候", "显示", "一些", "现在", "已经", "什么", "只是", "还是",
                "可以", "这", "那", "又", "也", "有", "到", "很", "来", "去",
                "把", "被", "让", "但", "但是", "然后", "所以", "因为", "由于",
                "所以", "因此", "如果", "虽然", "于是", "一直", "并", "并且",
                "不过", "不", "没", "一", "在", "中", "为", "以", "能", "要"
            }
            
            # 将停用词写入文件
            with open(self.cn_stopwords_file, "w", encoding="utf-8") as f:
                f.write("\n".join(basic_stopwords))
            
            self.cn_stopwords.update(basic_stopwords)
            
            # 加载英文停用词
            if NLTK_AVAILABLE:
                self.en_stopwords = set(stopwords.words('english'))
            else:
                # 基本英文停用词
                self.en_stopwords = {'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
                                   'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
                                   'that', 'the', 'to', 'was', 'were', 'will', 'with'}
            
            logger.info("✨ 停用词加载完成")
        except Exception as e:
            logger.warning(f"⚠️ 停用词加载失败: {e}")
            self.cn_stopwords = set()
            self.en_stopwords = set()

    def _init_tokenizers(self):
        """初始化分词器"""
        # 初始化jieba分词
        import io
        import sys
        
        # 捕获jieba的stdout输出
        stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        try:
            # jieba初始化
            jieba.initialize()
            
            # 获取捕获的输出并记录到日志
            output = sys.stdout.getvalue()
            if output:
                logger.debug(f"Jieba初始化输出:\n{output}")
        finally:
            # 恢复标准输出
            sys.stdout = stdout
        
        logger.info("✨ 分词器初始化完成")

    def _is_chinese(self, text: str) -> bool:
        """判断文本是否主要为中文"""
        # 统计中文字符的数量
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        # 如果中文字符占比超过30%，认为是中文文本
        return chinese_chars / len(text) > 0.3 if text else False

    def _tokenize_text(self, text: str) -> List[str]:
        """根据文本语言选择合适的分词方法"""
        if self._is_chinese(text):
            # 中文分词
            words = list(jieba.cut(text))
            # 过滤中文停用词
            words = [w for w in words if w not in self.cn_stopwords and len(w.strip()) > 0]
        else:
            # 英文分词
            if NLTK_AVAILABLE:
                # 使用正则表达式分词器
                words = word_tokenizer.tokenize(text.lower())
            else:
                # 简单的英文分词（按空格分割）
                words = text.lower().split()
            # 过滤英文停用词和标点符号
            words = [w for w in words if w not in self.en_stopwords and len(w.strip()) > 0]
        
        return words

    async def _extract_keywords(self, title: str, content: str = "") -> List[Dict[str, Any]]:
        """使用中英文分词技术提取新闻关键词和短语"""
        # 合并标题和内容，标题权重更高所以重复三次
        text = f"{title} {title} {title} {content}"
        
        result = []
        if self._is_chinese(text):
            # 1. 提取关键短语（2-3个词的组合）
            import jieba.analyse
            # 设置停用词文件路径
            jieba.analyse.set_stop_words(self.cn_stopwords_file)
            
            # 使用TextRank提取关键短语
            keywords = jieba.analyse.textrank(
                text,
                topK=10,  # 提取更多关键词以便组合
                withWeight=True,
                allowPOS=('ns', 'n', 'vn', 'v', 'nr')  # 允许名词、动词、人名、地名
            )
            
            # 将单个关键词组合成短语
            words = list(jieba.cut(title))  # 主要从标题中提取
            phrases = []
            for i in range(len(words)-1):
                if len(words[i]) > 1 and len(words[i+1]) > 1:  # 只组合双字及以上的词
                    phrase = words[i] + words[i+1]
                    if 4 <= len(phrase) <= 8:  # 控制短语长度
                        phrases.append(phrase)
            
            # 添加关键词
            for word, weight in keywords:
                if (word not in self.cn_stopwords and 
                    len(word.strip()) > 1):  # 只保留双字及以上的词
                    result.append({
                        "word": word,
                        "weight": float(weight),
                        "type": "keyword"
                    })
            
            # 添加短语
            for phrase in phrases[:5]:  # 限制短语数量
                # 计算短语权重（基于其包含的关键词权重）
                phrase_weight = 0
                for word, weight in keywords:
                    if word in phrase:
                        phrase_weight += weight
                result.append({
                    "word": phrase,
                    "weight": float(phrase_weight or 0.5),
                    "type": "phrase"
                })
            
            # 2. 尝试提取主题（通过标题中的关键信息组合）
            if "：" in title or ":" in title:
                parts = title.replace(":", "：").split("：")
                if len(parts) >= 2:
                    topic = parts[0].strip()
                    if 4 <= len(topic) <= 20:  # 控制主题长度
                        result.append({
                            "word": topic,
                            "weight": 1.0,  # 主题权重最高
                            "type": "topic"
                        })
        else:
            # 英文文本处理
            words = self._tokenize_text(text)
            # 计算词频
            from collections import Counter
            word_freq = Counter(words)
            total = sum(word_freq.values())
            
            # 提取单词和短语
            phrases = []
            for i in range(len(words)-1):
                if len(words[i]) > 2 and len(words[i+1]) > 2:  # 忽略太短的单词
                    phrase = words[i] + " " + words[i+1]
                    phrases.append(phrase)
            
            # 添加关键词
            for word, count in word_freq.most_common(5):
                if word not in self.en_stopwords and len(word) > 2:
                    result.append({
                        "word": word,
                        "weight": float(count/total),
                        "type": "keyword"
                    })
            
            # 添加短语
            phrase_freq = Counter(phrases)
            for phrase, count in phrase_freq.most_common(3):
                result.append({
                    "word": phrase,
                    "weight": float(count/total),
                    "type": "phrase"
                })
        
        return result

    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        """计算两个标题的相似度"""
        # 分词
        words1 = set(self._tokenize_text(title1))
        words2 = set(self._tokenize_text(title2))
        
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
        try:
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
            try:
                published_str = news_item["published_at"]
                if 'Z' in published_str:
                    published_str = published_str.replace('Z', '+00:00')
                elif '+' not in published_str and '-' not in published_str[10:]:
                    published_str = published_str + '+00:00'
                
                published_time = datetime.fromisoformat(published_str)
                if published_time.tzinfo is None:
                    published_time = published_time.replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.error(f"解析发布时间失败: {e}，使用当前时间作为发布时间")
                published_time = datetime.now(timezone.utc)
            
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
            
            # 提取或推断分类信息
            category = news_item.get("category")
            
            # 如果新闻项中没有直接提供分类，尝试从其他字段获取
            if not category and "meta_data" in news_item and isinstance(news_item["meta_data"], dict):
                category = news_item["meta_data"].get("category")
            
            # 如果还没有分类，根据来源尝试推断
            if not category:
                # 根据source_id推断分类
                source_categories = {
                    "weibo": "social",
                    "zhihu": "knowledge",
                    "toutiao": "news",
                    "baidu": "search",
                    "bilibili": "video",
                    "douyin": "video",
                    "36kr": "technology",
                    "wallstreetcn": "finance",
                    "ithome": "technology",
                    "thepaper": "news",
                    "zaobao": "news",
                    "sina": "news",
                    "qq": "news",
                    "163": "news",
                    "sohu": "news",
                    "ifeng": "news",
                    "bbc_world": "world",
                    "bloomberg": "finance",
                    "hackernews": "technology",
                    "github": "technology",
                    "v2ex": "technology",
                    "kuaishou": "video"
                }
                category = source_categories.get(news_item["source_id"], "others")
                logger.debug(f"新闻[{news_item['id']}]没有分类信息，根据来源[{news_item['source_id']}]推断为: {category}")
            
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
                    "source_weight": source_weight,
                    "keywords": [k["word"] for k in keywords[:5]],  # 将关键词列表转换为字符串列表
                    "category": category  # 添加分类信息到meta_data
                },
                keywords=keywords,
                published_at=published_time,
            )
            
            # 保存到数据库
            db_obj = await news_heat_score.create(session, heat_score)
            
            return db_obj
            
        except Exception as e:
            import traceback
            error_location = traceback.extract_tb(e.__traceback__)[-1]
            file_name = error_location.filename.split('/')[-1]
            line_no = error_location.lineno
            func_name = error_location.name
            
            error_msg = (
                f"新闻热度计算失败:\n"
                f"错误类型: {type(e).__name__}\n"
                f"错误信息: {str(e)}\n"
                f"发生位置: {file_name}:{line_no} in {func_name}\n"
                f"新闻ID: {news_item.get('id', 'N/A')}\n"
                f"标题: {news_item.get('title', 'N/A')}\n"
                f"来源: {news_item.get('source_id', 'N/A')}\n"
                f"堆栈跟踪:\n{traceback.format_exc()}"
            )
            logger.error(error_msg)
            raise

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
                import traceback
                error_location = traceback.extract_tb(e.__traceback__)[-1]
                file_name = error_location.filename.split('/')[-1]
                line_no = error_location.lineno
                func_name = error_location.name
                
                error_msg = (
                    f"新闻[{news_item['id']}]热度计算失败:\n"
                    f"错误类型: {type(e).__name__}\n"
                    f"错误信息: {str(e)}\n"
                    f"发生位置: {file_name}:{line_no} in {func_name}\n"
                    f"标题: {news_item.get('title', 'N/A')}\n"
                    f"来源: {news_item.get('source_id', 'N/A')}\n"
                    f"堆栈跟踪:\n{traceback.format_exc()}"
                )
                logger.error(error_msg)
        
        logger.info(f"批量热度计算完成，成功: {len(results)}, 总数: {len(news_items)}")
        return results

    async def get_heat_scores(
        self, news_ids: List[str], session: AsyncSession
    ) -> Dict[str, float]:
        """获取多个新闻的热度分数"""
        # 尝试从缓存获取
        # 不再使用整个ID列表构建缓存键，而是使用长度
        ids_count = len(news_ids)
        cache_key = f"{CACHE_PREFIX}:bulk:{uuid.uuid4().hex[:8]}:{ids_count}"
        
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug(f"从缓存获取热度分数: {ids_count} 条")
            return cached_data
        
        # 从数据库获取
        logger.debug(f"从数据库获取热度分数，请求 {ids_count} 条记录")
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
        logger.debug(f"已完成热度分数查询，返回 {len(result)} 条结果")
        
        return result

    async def get_detailed_heat_scores(
        self, news_ids: List[str], session: AsyncSession
    ) -> Dict[str, Any]:
        """获取多个新闻的详细热度数据"""
        # 尝试从缓存获取
        ids_count = len(news_ids)
        cache_key = f"{CACHE_PREFIX}:detailed:{uuid.uuid4().hex[:8]}:{ids_count}"
        
        cached_data = await redis_manager.get(cache_key)
        if cached_data:
            logger.debug(f"从缓存获取详细热度数据: {ids_count} 条")
            return cached_data
        
        # 从数据库获取
        logger.debug(f"从数据库获取详细热度数据，请求 {ids_count} 条记录")
        scores_map = await news_heat_score.get_multi_by_news_ids(session, news_ids)
        
        # 转换为所需格式
        result = {}
        for news_id in news_ids:
            if news_id in scores_map:
                result[news_id] = scores_map[news_id].to_dict()
        
        # 缓存结果
        await redis_manager.set(cache_key, result, expire=CACHE_TTL)
        logger.debug(f"已完成详细热度数据查询，返回 {len(result)} 条结果")
        
        return result

    async def get_top_news(
        self, 
        limit: int = 50, 
        skip: int = 0, 
        min_score: Optional[float] = 50.0,
        max_age_hours: Optional[int] = 72,
        category: Optional[str] = None,
        session: AsyncSession = None,
    ) -> List[Dict[str, Any]]:
        """获取热门新闻列表"""
        try:
            logger.info(f"获取热门新闻列表: limit={limit}, skip={skip}, min_score={min_score}, max_age_hours={max_age_hours}, category={category}")
            
            # 使用新的字典返回方法，避免 ORM 模型和相关异步问题
            news_list = await news_heat_score.get_top_news_as_dict(
                session, limit, skip, min_score, max_age_hours, category
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
        
        # 降低并发请求数量以减轻系统负担
        max_concurrent = 3  # 从5降低到3
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
                
                # 设置任务超时以避免某些源长时间无响应导致整体阻塞
                task = asyncio.create_task(
                    asyncio.wait_for(
                        self.heatlink_client.get(f"external/source/{source_id}"),
                        timeout=10  # 添加10秒超时
                    )
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
                            logger.info(f"源 {source_id} 获取到 {len(news_items)} 条新闻")
                        
                        # 2. 如果没有news键，尝试从'items'键获取（旧格式）
                        elif isinstance(source_data, dict) and "items" in source_data:
                            news_items = source_data["items"]
                            logger.info(f"源 {source_id} 获取到 {len(news_items)} 条新闻")
                        
                        # 3. 如果API直接返回了列表
                        elif isinstance(source_data, list):
                            news_items = source_data
                            logger.info(f"源 {source_id} 获取到 {len(news_items)} 条新闻")
                        
                        # 为每个新闻项添加source_id
                        for item in news_items:
                            item["source_id"] = source_id
                        
                        # 添加到总列表
                        all_news_items.extend(news_items)
                    else:
                        logger.warning(f"从源[{source_id}]获取到空数据")
                except asyncio.TimeoutError:
                    logger.error(f"从源[{source_id}]获取新闻超时")
                except Exception as e:
                    logger.error(f"从源[{source_id}]获取新闻失败: {e}")
            
            # 添加短暂暂停，让其他任务有机会执行
            await asyncio.sleep(0.1)
        
        logger.info(f"共获取到 {len(all_news_items)} 条新闻")
        return all_news_items

    async def update_all_heat_scores(self, session: AsyncSession):
        """更新所有新闻热度分数"""
        logger.info("🔄 开始更新所有新闻热度分数")
        
        try:
            # 1. 获取所有新闻源，设置超时防止阻塞
            try:
                sources_data = await asyncio.wait_for(
                    self.heatlink_client.get_sources(force_update=True),
                    timeout=15  # 15秒超时
                )
            except asyncio.TimeoutError:
                logger.error("❌ 获取新闻源超时，任务终止")
                return []
                
            # 处理API返回值可能是列表或字典的情况
            if isinstance(sources_data, dict):
                sources = sources_data.get("sources", [])
            else:
                # 如果API直接返回列表，就直接使用
                sources = sources_data
            
            # 检查是否有有效的源
            if not sources:
                logger.warning("⚠️ 未获取到有效的新闻源，任务终止")
                return []
                
            logger.info(f"📊 成功获取 {len(sources)} 个新闻源")
            
            # 2. 获取所有新闻
            all_news_items = await self.fetch_all_news_from_sources(sources)
            
            # 如果没有获取到新闻，直接返回
            if not all_news_items:
                logger.warning("⚠️ 未获取到任何新闻，任务终止")
                return []
                
            # 3. 计算热度评分
            heat_scores = await self.calculate_batch_heat_scores(all_news_items, session)
            
            logger.info(f"✨ 热度分数更新完成，共更新 {len(heat_scores)} 条新闻")
            return heat_scores
        except Exception as e:
            logger.error(f"❌ 更新热度分数失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 返回空列表而不是引发异常，避免中断调度器
            return []

    async def update_keyword_heat(self, session: AsyncSession):
        """更新关键词热度"""
        logger.info("🔄 开始更新关键词热度")
        
        try:
            # 获取最近一段时间内的热门新闻
            heat_scores = await news_heat_score.get_top_heat_scores(
                session, 
                limit=1000,  # 增加获取的新闻数量到1000条
                skip=0,
                min_score=20,  # 降低热度分数阈值到20
                max_age_hours=12  # 只获取最近12小时的新闻
            )
            
            # 提取所有关键词并计算频率
            keyword_counts = {}
            for score in heat_scores:
                for keyword_item in score.keywords:
                    word = keyword_item.get("word")
                    weight = keyword_item.get("weight", 0.5)
                    word_type = keyword_item.get("type", "keyword")
                    
                    if word:
                        if word not in keyword_counts:
                            keyword_counts[word] = {
                                "count": 0,
                                "total_weight": 0,
                                "total_heat": 0,
                                "sources": set(),
                                "type": word_type
                            }
                        
                        keyword_counts[word]["count"] += 1
                        keyword_counts[word]["total_weight"] += weight
                        keyword_counts[word]["total_heat"] += score.heat_score
                        keyword_counts[word]["sources"].add(score.source_id)
            
            # 计算并存储关键词热度
            keyword_heat = []
            for word, data in keyword_counts.items():
                # 根据类型调整过滤条件
                should_include = False
                if data["type"] == "topic":
                    # 主题至少在2个来源出现
                    should_include = len(data["sources"]) >= 2
                elif data["type"] == "phrase":
                    # 短语至少在2个来源出现且出现2次以上
                    should_include = len(data["sources"]) >= 2 and data["count"] >= 2
                else:
                    # 关键词至少在3个来源出现且出现1次以上
                    should_include = len(data["sources"]) >= 3 and data["count"] >= 1
                
                if should_include:
                    # 根据类型调整热度计算
                    base_heat = (
                        data["count"] * 
                        (data["total_weight"] / data["count"]) * 
                        (data["total_heat"] / data["count"]) * 
                        len(data["sources"])
                    )
                    
                    # 不同类型的权重调整
                    if data["type"] == "topic":
                        heat = base_heat / 500  # 主题热度权重更高
                    elif data["type"] == "phrase":
                        heat = base_heat / 750  # 短语热度权重适中
                    else:
                        heat = base_heat / 1000  # 关键词热度权重标准
                    
                    keyword_heat.append({
                        "keyword": word,
                        "heat": min(heat, 100),  # 上限100
                        "count": data["count"],
                        "sources": list(data["sources"]),
                        "type": data["type"],  # 添加类型信息
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    })
            
            # 更新到Redis缓存
            if keyword_heat:
                # 按热度排序
                keyword_heat.sort(key=lambda x: x["heat"], reverse=True)
                # 保留前300个关键词/短语/主题
                top_keywords = keyword_heat[:300]
                
                # 存储到Redis
                cache_key = f"{CACHE_PREFIX}:keywords"
                await redis_manager.set(cache_key, top_keywords, expire=CACHE_TTL * 2)
                
                logger.info(f"✨ 关键词热度更新完成，共更新 {len(top_keywords)} 个关键词/短语/主题")
                return top_keywords
            else:
                logger.warning("⚠️ 未找到足够的关键词数据")
                return []
        
        except Exception as e:
            logger.error(f"❌ 更新关键词热度失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise

    async def update_source_weights(self, session: AsyncSession):
        """更新来源权重"""
        logger.info("🔄 开始更新来源权重")
        
        try:
            # 获取所有新闻源
            sources_data = await self.heatlink_client.get_sources(force_update=True)
            
            # 处理API返回值可能是列表或字典的情况
            if isinstance(sources_data, dict):
                sources = sources_data.get("sources", [])
            else:
                # 如果API直接返回列表，就直接使用
                sources = sources_data
            
            logger.info(f"📊 成功获取到 {len(sources)} 个新闻源")
            
            # 初始化来源权重数据
            source_stats = {}
            
            # 为每个来源获取最近的新闻
            for source in sources:
                source_id = source.get("source_id") or source.get("id")
                if not source_id:
                    logger.warning("⚠️ 跳过没有有效ID的源")
                    continue
                    
                try:
                    # 获取该来源的最新新闻
                    source_news = await self.heatlink_client.get_source(source_id, force_update=True)
                    
                    # 尝试从不同的键获取新闻项
                    news_items = []
                    
                    # 先尝试从'news'键获取，这是API当前的格式
                    if isinstance(source_news, dict) and "news" in source_news:
                        news_items = source_news.get("news", [])
                    
                    # 如果没找到，再尝试从'items'键获取（旧格式的兼容）
                    elif isinstance(source_news, dict) and "items" in source_news:
                        news_items = source_news.get("items", [])
                    
                    # 或者API直接返回了列表
                    elif isinstance(source_news, list):
                        news_items = source_news
                    
                    # 统计该来源的数据
                    if news_items:
                        avg_engagement = 0
                        total_items = len(news_items)
                        
                        # 分析新闻项的互动数据
                        for item in news_items:
                            metrics = item.get("metrics", {})
                            # 更新互动数据计算逻辑
                            view_count = float(metrics.get("view_count", 0))
                            like_count = float(metrics.get("like_count", 0))
                            comment_count = float(metrics.get("comment_count", 0))
                            share_count = float(metrics.get("share_count", 0))
                            
                            # 计算互动分数，不再添加基础分
                            engagement = (
                                view_count * 1 +      # 浏览量权重
                                like_count * 3 +      # 点赞权重
                                comment_count * 5 +   # 评论权重
                                share_count * 10      # 分享权重
                            )
                            
                            # 根据来源类型设置不同的基准值
                            baseline = {
                                "weibo": 10000,      # 微博基准值高
                                "zhihu": 5000,       # 知乎基准值中等
                                "bilibili": 3000,    # B站基准值适中
                                "toutiao": 8000,     # 头条基准值较高
                                "36kr": 2000,        # 36氪基准值较低
                                "default": 1000      # 默认基准值最低
                            }.get(source_id, 1000)
                            
                            # 标准化互动分数
                            normalized_engagement = min((engagement / baseline) * 100, 100)
                            avg_engagement += normalized_engagement
                        
                        if total_items > 0:
                            avg_engagement /= total_items
                        
                        # 计算更新频率分数
                        update_frequency = 50  # 默认值
                        if total_items >= 5:  # 至少需要5篇文章才能计算更新频率
                            try:
                                # 获取最新的5篇文章的时间
                                timestamps = []
                                for item in news_items[:5]:
                                    pub_str = item["published_at"]
                                    
                                    # 标准化时间字符串
                                    if 'Z' in pub_str:
                                        pub_str = pub_str.replace('Z', '+00:00')
                                    elif '+' not in pub_str and '-' not in pub_str[10:]:
                                        pub_str = pub_str + '+00:00'
                                    
                                    # 解析时间
                                    pub_time = datetime.fromisoformat(pub_str)
                                    if pub_time.tzinfo is None:
                                        pub_time = pub_time.replace(tzinfo=timezone.utc)
                                    
                                    timestamps.append(pub_time)
                                
                                # 计算平均时间间隔（小时）
                                intervals = []
                                for i in range(len(timestamps)-1):
                                    interval = (timestamps[i] - timestamps[i+1]).total_seconds() / 3600
                                    intervals.append(interval)
                                
                                avg_interval = sum(intervals) / len(intervals)
                                
                                # 根据平均更新间隔计算频率分数
                                if avg_interval <= 0.0833:     # 平均5分钟更新一次 (5/60=0.0833小时)
                                    update_frequency = 100
                                elif avg_interval <= 0.1667:   # 平均10分钟更新一次 (10/60=0.1667小时)
                                    update_frequency = 90
                                elif avg_interval <= 0.5:      # 平均30分钟更新一次 (30/60=0.5小时)
                                    update_frequency = 80
                                elif avg_interval <= 1:        # 平均60分钟更新一次
                                    update_frequency = 70
                                elif avg_interval <= 2:        # 平均120分钟更新一次
                                    update_frequency = 60
                                elif avg_interval <= 4:        # 平均4小时更新一次
                                    update_frequency = 50
                                else:                         # 更新较慢
                                    update_frequency = 40
                            except Exception as e:
                                logger.warning(f"⚠️ 计算更新频率失败: {e}")
                                import traceback
                                logger.debug(traceback.format_exc())
                        
                        # 更新来源权重计算公式
                        # 基础权重：根据来源类型分配
                        base_weight = {
                            "weibo": 90,  # 微博热搜
                            "zhihu": 85,  # 知乎热榜
                            "toutiao": 85,  # 头条热榜
                            "baidu": 85,  # 百度热搜
                            "bilibili": 80,  # B站热门
                            "douyin": 80,  # 抖音热点
                            "kuaishou": 75,  # 快手热点
                            "36kr": 75,  # 科技媒体
                            "wallstreetcn": 75,  # 华尔街见闻
                            "thepaper": 70,  # 澎湃新闻
                            "ithome": 70,  # IT之家
                            "zaobao": 70,  # 联合早报
                            "bbc_world": 85,  # BBC国际新闻
                            "bloomberg": 85,  # 彭博新闻
                            "v2ex": 65,  # 科技社区
                            "hackernews": 70,  # 科技新闻
                            "github": 60,  # 开发平台
                        }.get(source_id, 50)  # 其他来源默认50分
                        
                        # 动态权重：基于互动度和更新频率
                        engagement_score = min((avg_engagement / 1000), 100)  # 互动度得分
                        
                        # 综合计算最终权重
                        source_weight = (
                            base_weight * 0.5 +  # 基础权重占50%
                            engagement_score * 0.3 +  # 互动度占30%
                            update_frequency * 0.2  # 更新频率占20%
                        )
                        
                        # 确保权重在合理范围内
                        source_weight = max(min(source_weight, 100), 10)
                        
                        # 存储来源统计数据
                        source_stats[source_id] = {
                            "weight": source_weight,
                            "avg_engagement": avg_engagement,
                            "update_frequency": update_frequency,
                            "item_count": total_items,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        logger.debug(f"✅ 成功处理源 '{source_id}', 权重={source_weight:.2f}")
                    else:
                        logger.warning(f"⚠️ 源 '{source_id}' 没有返回新闻数据")
                
                except Exception as e:
                    logger.error(f"❌ 处理来源 {source_id} 失败: {e}")
            
            # 存储所有来源权重到Redis
            if source_stats:
                cache_key = f"{CACHE_PREFIX}:source_weights"
                await redis_manager.set(cache_key, source_stats, expire=CACHE_TTL * 24)  # 缓存24小时
                
                logger.info(f"✨ 来源权重更新完成，共更新 {len(source_stats)} 个来源")
                return source_stats
            else:
                logger.warning("⚠️ 未获取到有效的来源数据")
                return {}
                
        except Exception as e:
            logger.error(f"❌ 更新来源权重失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise


# 创建服务实例
heat_score_service = NewsHeatScoreService() 