# NewsHeatScore (新闻热度评分系统)

## 概述

NewsHeatScore 是 HeatSight 平台中关键的数据处理引擎，专为评估和展示新闻热度而设计。该系统通过多维度分析新闻内容、传播特征和用户互动数据，生成客观准确的热度评分，为用户提供真实可靠的热门信息指标。系统直接整合到热门信息流模块，确保用户能够快速获取并关注全网最热门、最有价值的新闻内容。

## 系统原理

### 多维度评分机制

NewsHeatScore 基于以下关键维度进行热度综合评估：

- **关键词匹配度**：通过提取新闻关键词，检索系统中相似新闻的数量和相关度
- **时效性**：新闻发布时间的新鲜度及其随时间的衰减情况
- **原平台热度**：新闻在原发布平台上的热度指标（如浏览量、评论数等）
- **跨源出现频率**：同一新闻线索在不同新闻源中出现的频率
- **来源权重**：新闻来源的权威性和影响力评级

## 核心算法

### 1. 关键词提取与相似度检索

```
热度基础分 = 相似新闻数量 / 基准系数 * 100
```

- **关键词提取**：使用中文分词技术从新闻标题和摘要中提取3-5个代表性关键词
- **API检索**：利用`/api/news/`接口进行关键词搜索，确定相似新闻数量
- **归一化处理**：将检索结果归一化为0-100的分数范围

### 2. 时效性评分

```
时效性得分 = 100 * e^(-经过小时数/衰减因子)
```

- **衰减模型**：采用指数衰减模型计算新闻时效性得分
- **差异化配置**：不同类型新闻采用不同衰减因子（如突发新闻24小时，深度报道72小时）
- **时间窗口**：设定最大时间窗口（如7天），超过窗口的新闻时效分为最低值

### 3. 原平台热度换算

```
原平台得分 = 原始热度指标 / 该平台基准值 * 100
```

- **数据标准化**：不同平台热度指标（如"万热度"、点击量等）统一转换为百分制
- **平台差异**：考虑不同平台的用户体量差异，设定不同的基准转换值
- **数据修正**：通过历史数据分析，建立修正模型处理异常值

### 4. 综合热度计算公式

```
最终热度 = (W关键词 * 关键词得分) + (W时效 * 时效性得分) + (W原平台 * 原平台得分) + (W跨源 * 跨源频率得分) + (W来源 * 来源权重得分)
```

- **权重配置**：各因素权重（W）可根据新闻类型和应用场景动态调整
- **标准范围**：最终得分归一化至0-100分，并划分为"爆热"(90+)、"高热"(70-90)、"热门"(50-70)、"一般"(30-50)、"冷门"(0-30)五个等级
- **可解释性**：系统可提供热度分数的组成解释，如"主要由多平台关注度贡献"

## 技术实现

### 系统架构

NewsHeatScore 系统采用分层架构设计：

1. **数据获取层**：从 HeatLink API 获取基础新闻数据
2. **数据处理层**：进行关键词提取、相似度检索和热度计算
3. **数据存储层**：将计算结果持久化到数据库
4. **API服务层**：为前端提供热度数据接口
5. **定时任务层**：定期更新热度数据确保时效性

```
                   +------------------+
                   |   前端展示层     |
                   +--------+---------+
                            |
                            v
+----------+       +------------------+
| HeatLink |<----->|   API服务层     |
|   API    |       +--------+---------+
+----------+                |
                            v
                   +------------------+       +------------------+
                   |   数据处理层     |<----->|   数据存储层     |
                   +--------+---------+       +------------------+
                            |
                            v
                   +------------------+
                   |   定时任务层     |
                   +------------------+
```

### 数据获取流程

由于 HeatLink API 的 `/external/hot` 和 `/unified-news` 是伪接口，不会返回实际数据，因此需要通过以下流程获取和处理数据：

1. **新闻源列表获取**：
```python
# 获取所有新闻源列表
sources_data = await heatlink_client.get_sources(force_update=True)
sources = sources_data["sources"]
```

2. **并行获取每个新闻源的新闻**：
```python
# 限制并发请求数量
max_concurrent = 5
all_news_items = []

# 分批处理源，避免过多并发请求
for i in range(0, len(sources), max_concurrent):
    batch_sources = sources[i:i+max_concurrent]
    tasks = []
    
    for source in batch_sources:
        source_id = source["source_id"]
        task = asyncio.create_task(
            heatlink_client.get(f"external/test-source/{source_id}")
        )
        tasks.append((source_id, task))
    
    # 等待这一批任务完成
    for source_id, task in tasks:
        source_data = await task
        if source_data and "items" in source_data:
            all_news_items.extend(source_data["items"])
```

3. **关键词提取与相似度检索**：
```python
# 为每个新闻项提取关键词
for news_item in all_news_items:
    # 提取关键词
    keywords = _extract_keywords(news_item["title"], news_item.get("content", ""))
    
    # 使用关键词进行相似新闻搜索
    similar_count = 0
    for keyword in keywords:
        search_response = await heatlink_client.get(
            "news", params={"search": keyword["word"]}
        )
        if search_response and "items" in search_response:
            similar_count += len(search_response["items"])
    
    # 计算关键词匹配度得分
    keyword_score = min(similar_count / BASELINE_FACTOR * 100, 100)
    
    # 存储关键词和得分信息
    news_item["extracted_keywords"] = keywords
    news_item["keyword_score"] = keyword_score
```

4. **多维度热度计算**：
```python
# 计算每个新闻项的热度分数
for news_item in all_news_items:
    # 已有关键词匹配度得分
    keyword_score = news_item["keyword_score"]
    
    # 计算时效性得分
    published_time = datetime.fromisoformat(news_item["published_at"].replace('Z', '+00:00'))
    hours_passed = (datetime.now(timezone.utc) - published_time).total_seconds() / 3600
    recency_score = 100 * math.exp(-hours_passed / DECAY_FACTOR)
    
    # 计算原平台热度得分（如果有原始热度指标）
    platform_score = 0
    if "metrics" in news_item:
        platform_score = _normalize_platform_score(
            news_item["metrics"], news_item["source_id"]
        )
    
    # 计算跨源频率得分
    cross_source_score = _calculate_cross_source_score(
        news_item["title"], all_news_items
    )
    
    # 获取来源权重
    source_weight = await _get_source_weight(news_item["source_id"], session)
    
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
    
    # 存储计算结果到数据库
    heat_score = NewsHeatScore(
        id=str(uuid.uuid4()),
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
        keywords=news_item["extracted_keywords"],
        calculated_at=datetime.now(timezone.utc),
        published_at=published_time,
        updated_at=datetime.now(timezone.utc)
    )
    session.add(heat_score)

# 提交数据库事务
await session.commit()
```

### 关键词提取实现

```python
def _extract_keywords(title: str, content: str = "") -> List[Dict[str, Any]]:
    """使用中文分词技术提取新闻关键词"""
    # 合并标题和内容
    text = f"{title} {content}"
    
    # 使用jieba进行分词
    import jieba
    import jieba.analyse
    
    # 提取关键词（返回带权重的关键词）
    keywords = jieba.analyse.textrank(text, topK=5, withWeight=True)
    
    # 转换为所需的数据结构
    result = []
    for word, weight in keywords:
        result.append({"word": word, "weight": float(weight)})
    
    return result
```

### 相似度检索实现

```python
def _calculate_title_similarity(title1: str, title2: str) -> float:
    """计算两个标题的相似度"""
    # 分词
    import jieba
    words1 = set(jieba.cut(title1))
    words2 = set(jieba.cut(title2))
    
    # 计算Jaccard相似度
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    if union == 0:
        return 0
    
    return intersection / union

def _find_similar_news(title: str, news_items: List[Dict]) -> int:
    """查找与指定标题相似的新闻数量"""
    similar_count = 0
    threshold = 0.6  # 相似度阈值
    
    for item in news_items:
        if item["title"] != title:  # 排除自身
            similarity = _calculate_title_similarity(title, item["title"])
            if similarity > threshold:
                similar_count += 1
    
    return similar_count
```

### 定时任务实现

```python
async def update_hot_news(self):
    """更新热门新闻热度评分"""
    logger.info("Running scheduled task: update_hot_news")
    try:
        async with SessionLocal() as session:
            # 1. 获取所有新闻源
            sources_data = await heatlink_client.get_sources(force_update=True)
            sources = sources_data.get("sources", [])
            
            # 2. 并行获取每个新闻源的最新新闻
            all_news_items = await self._fetch_all_news_from_sources(sources)
            
            # 3. 批量计算热度评分
            await heat_score_service.calculate_batch_heat_scores(all_news_items, session)
            
        logger.info(f"Hot news heat scores updated successfully for {len(all_news_items)} items")
    except Exception as e:
        logger.error(f"Error updating hot news heat scores: {e}")
```

### 后端API实现

- **API封装**：封装对`/api/news/`接口的调用，实现批量关键词检索
- **缓存机制**：使用Redis实现热度计算结果缓存，减少重复计算
- **定时任务**：设置定时任务更新热度数据，确保时效性
- **数据持久化**：将计算结果存储到数据库，支持历史趋势分析
- **分布式计算**：通过分布式架构处理大规模热度计算任务，确保计算效率
- **API聚合层**：整合多个平台接口，实现统一的热度数据获取与处理

### 前端展示

- **可视化组件**：根据热度分数提供不同视觉效果（颜色、图标）
- **互动元素**：鼠标悬停可查看热度详情和贡献因素
- **趋势图表**：展示新闻热度随时间的变化趋势
- **排序功能**：支持按热度分数排序新闻列表
- **热度标记**：在信息流中突出显示高热度内容，如热度标签和特殊背景
- **类别筛选**：支持用户根据兴趣和热度组合筛选内容

## 前端数据获取流程

热门聚合页面的数据获取流程如下：

1. **初始化阶段**：
```javascript
// 在HotRankings组件中
useEffect(() => {
  // 获取所有源列表和数据的主函数
  const fetchAllData = async () => {
    // 尝试从缓存加载数据
    if (cacheUtils.isCacheValid()) {
      const cachedSources = cacheUtils.getFromCache(CACHE_KEYS.SOURCES);
      const cachedSourceData = cacheUtils.getFromCache(CACHE_KEYS.SOURCE_DATA);
      if (cachedSources && cachedSourceData) {
        setSources(cachedSources);
        setSourceDataMap(cachedSourceData);
        return;
      }
    }
    
    // 从API获取新数据
    const sourcesResponse = await axios.get(`${API_URL}/external/sources`);
    const sortedSources = sourcesResponse.data.sources;
    
    // 并行获取所有源的数据
    const newDataMap = {};
    await Promise.all(
      sortedSources.map(async (source) => {
        const response = await axios.get(`${API_URL}/external/source/${source.source_id}`);
        if (response.data) {
          newDataMap[source.source_id] = response.data;
        }
      })
    );
    
    // 更新状态和缓存
    setSources(sortedSources);
    setSourceDataMap(newDataMap);
    cacheUtils.saveToCache(CACHE_KEYS.SOURCES, sortedSources);
    cacheUtils.saveToCache(CACHE_KEYS.SOURCE_DATA, newDataMap);
  };
  
  fetchAllData();
}, []);
```

2. **热度数据获取**：
```javascript
// 获取新闻热度数据
const fetchHeatScores = async (newsIds) => {
  try {
    // 调用HeatSight API获取热度评分
    const response = await newsHeatApi.getHeatScores(newsIds);
    if (response && response.heat_scores) {
      setNewsHeatMap(response.heat_scores);
    }
  } catch (error) {
    console.error("Error fetching heat scores:", error);
  }
};
```

3. **数据渲染与过滤**：
```javascript
// 过滤和排序新闻
const getDisplayedNews = () => {
  // 根据选中的分类过滤新闻源
  const filteredSources = sources.filter(source => 
    selectedCategories.includes('all') || selectedCategories.includes(source.category)
  );
  
  // 获取所有过滤后的新闻
  let allNews = [];
  filteredSources.forEach(source => {
    const sourceData = sourceDataMap[source.source_id];
    if (sourceData && sourceData.news) {
      allNews = [...allNews, ...sourceData.news.map(item => ({
        ...item,
        source_name: source.name,
        category: source.category
      }))];
    }
  });
  
  // 根据热度排序
  return allNews.sort((a, b) => {
    const aHeat = getNewsHeatScore(a.id);
    const bHeat = getNewsHeatScore(b.id);
    return bHeat - aHeat;
  });
};
```

## 全网热点聚合

NewsHeatScore系统的一个核心能力是实现全网热点的高效聚合，通过以下机制确保用户能够关注到真正有价值的全网热点：

### 1. 全源数据采集

- **多平台覆盖**：同时监控39+个主流新闻和社交媒体平台
- **定时抓取**：根据平台特性设置不同的抓取频率，热门平台更新更频繁
- **增量更新**：实现增量数据抓取，减少系统负担同时保证数据新鲜度

### 2. 热点聚类与去重

- **相似内容聚合**：基于关键词和语义相似度，将报道同一事件的不同新闻聚合
- **多源交叉验证**：某一新闻线索在多个可信来源出现会获得更高可信度
- **细粒度分类**：将热点分为突发事件、持续关注、深度话题等不同类型

### 3. 热门信息流整合

- **统一展示界面**：在热门信息流页面(`/hot-news`)集中展示全网热点
- **信息流分类**：按来源类别和热度等级组织热门内容
- **个性化排序**：结合用户兴趣和全局热度进行个性化排序
- **实时更新**：支持实时或准实时更新热点排行
- **下拉刷新**：支持用户手动刷新获取最新热点

### 4. 热点深度链接

- **源头追溯**：用户可查看热点的来源分布和原始报道
- **关联拓展**：提供与当前热点相关的其他热门话题
- **热度演化**：展示热点话题的热度变化趋势

## 应用场景

1. **热门聚合页**：展示各新闻源中最热门的内容
2. **话题热度排名**：评估话题的整体热度水平
3. **热度趋势预测**：基于历史数据预测话题热度变化
4. **个性化推荐**：结合用户兴趣和新闻热度进行内容推荐
5. **全网热度榜单**：整合多平台数据，提供跨平台的统一热度排行
6. **热点监测预警**：对突发热点事件进行监测和预警
7. **媒体影响力分析**：评估不同媒体在热点传播中的影响力

## 优化方向

1. **机器学习增强**：
   - 训练模型自动调整各因素权重
   - 基于用户行为数据优化热度算法

2. **语义理解升级**：
   - 从关键词匹配升级到语义理解
   - 实现更准确的相似新闻识别

3. **实时计算优化**：
   - 改进热度计算性能，支持大规模数据处理
   - 优化缓存策略，减少API调用频率

4. **热度预测能力**：
   - 开发预测模型，预估新闻未来热度
   - 识别潜在爆款内容

5. **用户参与机制**：
   - 引入用户反馈数据调整热度算法
   - 开发社区互动功能，增强用户参与度

## 系统集成

NewsHeatScore 系统与 HeatSight 平台的其他组件紧密集成：

- 为**热门聚合**模块提供热度排序支持，成为热门信息流(`/hot-news`)页面的核心驱动引擎
- 为**内容灵感工坊**提供热点话题推荐
- 与**用户兴趣模型**协同，支持个性化内容推荐
- 向**分析仪表板**提供热度数据可视化
- 支持**移动端应用**，提供随时随地获取热点信息的能力
- 通过**OpenAPI**，允许第三方应用接入热度数据

### 与热门信息流的深度整合

热门信息流页面(`/hot-news`)是NewsHeatScore系统的主要应用场景之一，双方深度整合：

1. **数据驱动展示**：
   - 热门信息流页面的内容排序完全由NewsHeatScore系统的热度分数驱动
   - 不同热度等级的内容采用不同的视觉处理，高热度内容获得更多曝光

2. **实时响应**：
   - 热门信息流组件能够实时反映热度分数的变化
   - 支持按热度、时间或来源进行灵活排序

3. **交互体验**：
   - 用户可以查看每条新闻的热度来源构成
   - 提供热度趋势图表，展示热点的发展趋势
   - 支持热度阈值订阅，当某话题热度超过用户设定阈值时进行通知

4. **分类聚合**：
   - 按热度对各新闻源的内容进行优先级排序
   - 同一事件的不同来源报道会智能聚合，避免内容冗余

## 效果与价值

NewsHeatScore 系统通过客观、多维度的热度评估，解决了以下问题：

1. 替代随机生成的热度数值，提供真实可靠的热度指标
2. 帮助用户快速识别真正热门的内容，提高信息获取效率
3. 为内容创作者提供话题热度参考，指导创作方向
4. 支持热点分析和趋势洞察，助力决策制定
5. 打破信息孤岛，实现跨平台热点的统一展示和评估
6. 降低用户获取热点资讯的时间成本，提供"一站式"热点获取体验
7. 减少算法偏见，通过多源数据交叉验证确保热点评估的客观性

## 开发注意事项

1. **HeatLink API 接口使用说明**：
   - `/external/hot` 和 `/unified-news` 是伪接口，不会返回实际数据
   - 必须通过 `/external/sources` 获取所有新闻源列表
   - 然后通过 `/external/source/{source_id}` 获取每个源的具体新闻
   - 使用 `/api/news/` 接口进行关键词搜索确定相似新闻

2. **热度计算数据流**：
   - 基础数据获取 → 关键词提取 → 相似度检索 → 多维度评分 → 综合计算 → 数据持久化

3. **定时任务配置**：
   - 关键词热度更新：每60分钟
   - 来源权重更新：每天一次
   - 热门新闻热度更新：每30分钟

---

*本文档描述了 HeatSight 平台的 NewsHeatScore 系统设计方案和实现细节，开发人员应严格遵循上述数据处理流程和算法实现。* 