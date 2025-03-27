# HeatSight - 面向内容创作者的热点灵感挖掘平台

## 整体概念和定位

HeatSight是一个基于HeatLink API开发的专业工具站点，面向内容创作者，提供热点话题发现、深度分析和内容创作辅助的一站式解决方案。与传统热榜（如今日热榜、HotList Web）不同，HeatSight专注于内容创作者的实际需求，提供从热点发现、话题拆解到内容创作建议的全链路支持。

## 核心功能设计

### 1. 热点雷达 - 综合热点捕捉系统

**功能特点：**
- **多维热点聚合**：整合HeatLink的多源热点数据（新闻、社交媒体、专业平台等）
- **行业细分筛选**：按照不同内容创作领域（科技、文化、财经、生活等）分类热点
- **热度趋势追踪**：显示话题热度变化曲线，预测热点持续性
- **时效性标记**：明确标记热点新鲜度、持续时间和预计热度衰减时间
- **地域热点定制**：支持按地区查看热点差异，针对不同区域受众定制内容

**实现思路：**
```javascript
// 前端调用HeatLink API获取热点数据并进行可视化
async function fetchHotTopics() {
  const response = await fetch('/api/external/hot');
  const data = await response.json();
  
  // 多维度处理和分类展示
  renderTrendingTopics(data.hot_news);
  renderCategoryTopics(data.categories);
  renderTrendCharts(data);
}
```

### 2. 话题解构 - 智能子话题拆解系统

**功能特点：**
- **子话题自动拆解**：将热点主题自动拆解为多个子话题和角度
- **相关话题映射**：展示与主题相关的延伸话题和内容机会
- **目标受众画像**：分析该话题的潜在受众群体特征
- **竞争态势分析**：展示该话题下已有内容的数量和质量分布
- **话题探索地图**：可视化展示主题间的关联关系

**实现思路：**
```python
# 基于热点新闻聚类数据，进行进一步的子话题拆解
class TopicDecomposer:
    def __init__(self, nlp_processor):
        self.nlp_processor = nlp_processor
    
    def decompose(self, main_topic):
        # 提取关键实体和概念
        entities = self.nlp_processor.extract_entities(main_topic)
        
        # 生成子话题角度
        perspectives = [
            "背景分析", "影响评估", "未来趋势", 
            "行业关联", "争议观点", "相似案例"
        ]
        
        # 创建子话题地图
        subtopics = {}
        for entity in entities:
            subtopics[entity] = {
                "relevance": self.calculate_relevance(entity, main_topic),
                "perspectives": self.generate_entity_perspectives(entity, perspectives)
            }
        
        return {
            "main_topic": main_topic,
            "subtopics": subtopics,
            "related_topics": self.find_related_topics(main_topic)
        }
```

### 3. 内容灵感工坊 - 创作思路生成系统

**功能特点：**
- **创作角度推荐**：基于子话题提供多样化的创作角度和切入点
- **内容框架生成**：自动生成内容大纲和框架
- **热点素材库**：整合与话题相关的图片、数据、案例素材
- **差异化定位指南**：分析当前话题下的内容空白点和差异化机会
- **观点摘要**：汇总话题下的主流观点和独特视角

**实现思路：**
```python
class ContentInspirationGenerator:
    def generate(self, topic_analysis):
        # 生成内容结构建议
        content_structures = [
            {"title": "列表型", "template": "10个解读{topic}的关键点"},
            {"title": "问答型", "template": "{topic}引发的5个关键问题及解答"},
            {"title": "深度解析型", "template": "{topic}背后的深层原因与影响分析"},
            {"title": "对比型", "template": "{topic}的不同视角：正反方观点对比"}
        ]
        
        # 生成独特卖点建议
        unique_angles = self.identify_unique_angles(topic_analysis)
        
        # 推荐相关素材和数据
        supporting_materials = self.gather_relevant_materials(topic_analysis)
        
        return {
            "content_structures": content_structures,
            "unique_angles": unique_angles,
            "supporting_materials": supporting_materials,
            "outline_suggestions": self.generate_outlines(topic_analysis)
        }
```

### 4. 时效深度分析 - 热点洞察系统

**功能特点：**
- **热点生命周期预测**：预测热点持续时间和最佳发布窗口
- **热点成因分析**：分析热点产生的原因和背景
- **深度洞察**：提供对热点的深层次解读和分析
- **潜在关注焦点**：预测话题可能引发的关注焦点转移
- **历史关联**：展示与当前热点相关的历史事件和话题

**实现思路：**
```python
class HotTopicInsightAnalyzer:
    def analyze(self, topic_data, historical_data):
        # 计算话题生命周期预测
        lifecycle = self.predict_lifecycle(topic_data, historical_data)
        
        # 分析热点产生原因
        causal_factors = self.identify_causal_factors(topic_data)
        
        # 潜在发展方向分析
        potential_directions = self.predict_topic_evolution(topic_data)
        
        # 相关历史事件关联
        historical_correlations = self.find_historical_correlations(topic_data)
        
        return {
            "lifecycle": lifecycle,
            "causal_factors": causal_factors,
            "potential_directions": potential_directions,
            "historical_correlations": historical_correlations,
            "optimal_publishing_window": self.calculate_optimal_window(lifecycle)
        }
```

### 5. 数据验证实验室 - 创作效果评估系统

**功能特点：**
- **标题效果测试**：分析不同标题的吸引力和点击潜力
- **关键词优化**：推荐热点相关的高热度关键词
- **平台匹配度**：评估内容对不同平台（B站、抖音、微博等）的适配性
- **受众兴趣匹配**：分析内容与目标受众兴趣的匹配程度
- **内容差异化评分**：评估内容在同类话题中的独特性

**实现思路：**
```python
class ContentEffectivenessAnalyzer:
    def analyze_title(self, title, topic_data):
        # 计算标题吸引力得分
        engagement_score = self.calculate_title_engagement(title, topic_data)
        
        # 关键词覆盖评估
        keyword_coverage = self.evaluate_keyword_coverage(title, topic_data)
        
        # 情感分析
        sentiment = self.analyze_sentiment(title)
        
        # 平台适配性分析
        platform_compatibility = {
            "weibo": self.evaluate_platform_fit(title, "weibo"),
            "douyin": self.evaluate_platform_fit(title, "douyin"),
            "bilibili": self.evaluate_platform_fit(title, "bilibili"),
            "wechat": self.evaluate_platform_fit(title, "wechat")
        }
        
        return {
            "engagement_score": engagement_score,
            "keyword_coverage": keyword_coverage,
            "sentiment": sentiment,
            "platform_compatibility": platform_compatibility,
            "improvement_suggestions": self.generate_improvements(title, topic_data)
        }
```

## 技术架构

### 前端架构

**主要技术栈：**
- **React/Vue.js**：构建响应式用户界面
- **Tailwind CSS**：实现美观现代的UI设计
- **ECharts/D3.js**：数据可视化和热点趋势图表
- **SWR/React Query**：数据获取和缓存
- **Next.js/Nuxt.js**：服务端渲染提升性能和SEO

### 后端架构

**主要技术栈：**
- **FastAPI**：高性能API框架，与HeatLink后端一致
- **HeatLink API集成**：直接调用HeatLink提供的开放API
- **Redis**：缓存热点数据，提高性能
- **PostgreSQL**：存储用户数据、分析结果和历史记录
- **Celery**：处理后台任务，如定期数据分析

### 数据流架构

1. **数据采集层**：通过HeatLink API获取多源热点数据
2. **数据处理层**：对热点数据进行聚合、分类、拆解和深度分析
3. **数据存储层**：将处理结果存储在数据库和缓存系统中
4. **业务逻辑层**：实现各功能模块的核心逻辑
5. **API服务层**：为前端提供统一的API接口
6. **展示交互层**：用户界面和交互体验设计

## 用户体验设计

### 个性化功能

1. **用户兴趣配置**：允许用户设置感兴趣的内容领域和偏好
2. **创作风格画像**：系统学习用户的创作风格，提供更匹配的建议
3. **平台偏好设置**：用户可设置优先创作平台，获取平台特化建议
4. **历史热点收藏**：保存和管理感兴趣的热点，便于后续创作
5. **灵感笔记**：提供简单的笔记功能，记录创作灵感和想法

### 用户界面设计

1. **仪表盘视图**：整合核心数据和热点概览
2. **探索视图**：深入探索热点话题和子话题
3. **创作辅助视图**：提供创作建议和工具
4. **分析视图**：展示详细的数据分析结果
5. **移动端优化**：确保在移动设备上有良好的使用体验

## 业务模式

### 基础版（免费）
- 热点雷达基础功能
- 有限的话题解构功能
- 基础的创作建议
- 每日有限的数据验证次数

### 专业版（订阅）
- 完整的热点雷达和话题解构功能
- 高级创作建议和内容框架生成
- 详细的时效深度分析
- 无限的数据验证和测试
- 优先访问最新热点

### 团队版（企业）
- 多用户协作功能
- 定制化热点追踪
- API集成能力
- 专业数据分析报告
- 内容策略咨询

## 实现路径

### 第一阶段：基础平台搭建
1. 构建基础架构，与HeatLink API集成
2. 实现热点雷达核心功能
3. 开发简单的话题解构功能
4. 搭建基础用户系统

### 第二阶段：智能功能开发
1. 增强话题解构算法
2. 开发创作灵感生成系统
3. 实现时效深度分析功能
4. 构建数据验证实验室基础功能

### 第三阶段：高级功能与优化
1. 增强数据分析能力和预测模型
2. 优化用户体验和界面设计
3. 添加高级个性化功能
4. 完善数据验证实验室的全部功能

### 第四阶段：商业化与扩展
1. 实现付费订阅系统
2. 开发团队协作功能
3. 增加企业定制服务
4. 扩展平台集成能力

## 与竞品的差异化优势

与今日热榜和HotList Web相比，HeatSight具有以下明显优势：

1. **创作者导向**：专为内容创作者设计，而非普通信息浏览用户
2. **深度分析**：提供热点背后的深度分析和洞察，而非仅展示热点列表
3. **内容辅助**：从热点发现直接延伸到内容创作辅助
4. **综合数据**：整合多维度数据，评估内容潜力
5. **个性化推荐**：根据用户兴趣和创作风格提供定制化建议

## 结语

HeatSight将充分利用HeatLink的强大数据采集和处理能力，打造一个面向内容创作者的专业工具平台。通过提供热点发现、话题拆解、创作辅助、深度分析和效果验证的全链路服务，HeatSight将成为内容创作者挖掘热点灵感的得力助手，帮助他们在竞争激烈的内容领域中脱颖而出。

## ContentWorkshop 页面

ContentWorkshop（内容灵感工坊）是一个帮助内容创作者快速获取创作素材和灵感的工具。该页面包含以下功能：

### 主要特点

1. **话题推荐**：系统根据热度和时效性推荐热门话题，帮助创作者选择当下最受关注的内容方向
2. **话题搜索**：创作者可以搜索特定领域或关键词的话题
3. **创作辅助**：选择话题后，系统自动生成：
   - 标题建议
   - 内容大纲
   - 关键要点
   - 开篇示例

### 界面截图

**初始界面**：
![ContentWorkshop初始界面](docs/images/content_workshop_initial.png)

**话题选择后**：
![话题选择界面](docs/images/content_workshop_topic_selected.png)

**内容生成后**：
![内容生成界面](docs/images/content_workshop_generated.png)

### 使用流程

1. 从左侧推荐列表中选择一个感兴趣的话题，或通过搜索找到特定话题
2. 点击"生成内容"按钮
3. 系统会根据选择的话题自动生成创作建议
4. 创作者可以直接复制所需部分用于创作

### 技术实现

- 界面使用React和Tailwind CSS构建
- 内容生成基于话题热度分析和关键词提取
- 一键复制功能通过Web API实现
- 响应式设计，适配不同屏幕尺寸

## 数据库管理

为了简化项目的数据库操作，提供了一个集中式的数据库管理工具 `db-manager.sh`，替代了以前的多个脚本：

### 功能

1. **数据库结构初始化**：创建数据库和表结构
2. **主题数据管理**：添加和更新热点主题
3. **内容建议管理**：管理内容建议模板和与主题的关联
4. **数据清理**：清除所有数据或重置数据库

### 使用方法

```bash
# 使用交互式菜单
./db-manager.sh

# 快速初始化数据库（适合首次设置）
./db-manager.sh --quick

# 查看帮助信息
./db-manager.sh --help
```

### 在HeatSight管理工具中使用

您也可以通过统一的管理界面 `heatsight-manager.sh` 访问数据库管理功能：

1. 运行 `./heatsight-manager.sh`
2. 选择"数据库服务管理"
3. 选择所需的操作：
   - "启动数据库管理工具"：打开完整的数据库管理界面
   - "快速初始化数据库"：一键设置数据库
   - "查看数据库状态"：检查当前数据库状态

这种简化的管理方式使得数据库操作更加直观，减少了维护多个脚本的复杂性。