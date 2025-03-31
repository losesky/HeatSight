# HeatSight - 面向内容创作者的热点灵感挖掘平台

## 整体概念和定位

HeatSight是一个基于HeatLink API开发的专业工具站点，面向内容创作者，提供热点话题发现、深度分析和内容创作辅助的一站式解决方案。与传统热榜（如今日热榜、HotList Web）不同，HeatSight专注于内容创作者的实际需求，提供从热点发现、话题拆解到内容创作建议的全链路支持。

## 已实现功能概览

### 热点聚合浏览（Hot News Module）

- **多源热点聚合**：集成了多个内容平台（知乎、微博、B站等）的热门内容
- **按权重智能排序**：基于来源权重自动排序，使最重要的内容源显示在前面
- **热度评分系统**：为每条热点内容提供热度评分，直观展示内容受欢迎程度
- **沉浸式阅读体验**：支持内容详情页，提供便捷的原文跳转和相关推荐
- **优化的用户体验**：
  - 实现了平滑的源切换体验，避免全页面刷新
  - 通过请求取消和防抖机制解决了竞态条件问题
  - 加载状态透明化，旧内容在加载过程中保持可见
  - 视觉反馈和动画效果提升体验

### 内容灵感工坊（Content Workshop）

- **话题推荐与搜索**：根据热度和时效性推荐热门话题，支持自定义搜索
- **创作建议生成**：自动生成多种风格的标题建议、内容大纲和关键要点
- **一键复制功能**：便捷地复制所需内容片段用于创作
- **多样化的内容模板**：支持列表型、问答型、深度解析型等多种内容结构

### 话题解构分析（Topic Decomposition）

- **子话题自动拆解**：将热点主题自动拆解为多个子话题和角度
- **相关话题联系**：展示热点间的关联关系和延伸可能性
- **可视化展示**：直观地展示主题间关系图谱

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
  const response = await fetch('/external/hot');
  const data = await response.json();
  
  // 多维度处理和分类展示
  renderTrendingTopics(data.hot_news);
  renderCategoryTopics(data.categories);
  renderTrendCharts(data);
}
```

### 2. 热门信息流 - 数据处理与展示系统

**显示规则与算法分析：**

**前端显示规则：**
- **多分类筛选系统**：支持按多个分类同时筛选内容，单选或多选模式并存
- **数据限制机制**：每次展示最多20条高质量记录，避免信息过载
- **排序逻辑**：基于综合分数(combined_score)进行降序排列，确保最热内容优先展示
- **UI适配**：支持列表视图和网格视图，适配不同阅读偏好
- **视觉标识系统**：使用色彩区分不同分类，热度等级文字标记(爆热/高热/热门/一般/冷门)

**后台算法核心：**

1. **热度分数计算**：
   ```
   热度分数 = 相关性分数(relevance_score) + 时效性分数(recency_score) + 流行度分数(popularity_score)
   ```

   - 相关性分数：评估内容质量和相关性
   - 时效性分数：基于发布时间的新鲜度评分
   - 流行度分数：根据用户互动数据(评论、点赞、分享等)计算

2. **综合分数计算**：
   ```javascript
   const calculateCombinedScore = (item) => {
     // 基础热度分数
     const heatScore = item.heat_score || 0;
     
     // 时效性加成
     const recencyBoost = calculateRecencyScore(item.published_at);
     
     // 综合分数 = 热度分数 + 时效性加成
     return heatScore + recencyBoost;
   };
   ```

   时效性计算采用基于时间的两段式线性衰减：
   - 刚发布 (0小时)：获得满分加成 (30分)
   - 12小时后：获得22.5分加成
   - 24小时后：获得15分加成 (正好是满分的一半)
   - 36小时后：获得7.5分加成
   - 48小时后：0分加成
   - 48小时以上：无加成

3. **多层次去重策略**：
   - **第一层**：按来源内部去重，每个来源内部基于ID去重，保留最新版本
   - **第二层**：所有来源聚合后基于综合分数排序
   - **第三层**：标题相似度去重，使用编辑距离算法，相似度≥0.7的视为重复

4. **分类系统**：
   - 优先使用内容自带分类(category)
   - 其次尝试从元数据(meta_data)中提取
   - 最后根据来源ID(source_id)推断

**优势与特点：**
- 灵活的多分类筛选支持内容探索
- 三层去重确保内容多样性，避免单一来源主导
- 时效性加权提升新鲜内容曝光机会
- 热度等级可视化帮助用户直观了解内容热度

### 3. 话题解构 - 智能子话题拆解系统

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

### 4. 内容灵感工坊 - 创作思路生成系统

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

### 5. 时效深度分析 - 热点洞察系统

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

### 6. 数据验证实验室 - 创作效果评估系统

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

**已实现技术栈：**
- **React**：构建响应式用户界面，结合React Router实现SPA路由
- **Tailwind CSS**：实现美观现代的UI设计和响应式布局
- **Axios**：用于数据获取和API调用，支持请求取消功能
- **React Icons**：提供丰富的图标库
- **date-fns**：处理日期和时间格式化

### 后端架构

**已实现技术栈：**
- **FastAPI**：高性能API框架，提供异步支持和自动文档
- **SQLAlchemy**：ORM工具，简化数据库操作
- **Jieba**：强大的中文文本处理库，支持以下功能：
  - 中英文混合分词，准确处理包含外来词的热点内容
  - 关键词提取，基于TF-IDF和TextRank算法识别核心概念
  - 热门话题聚合，通过关键词聚类实现跨平台热点分析
  - 词性标注，用于理解话题的主体和行为
  - 自定义词典，支持添加领域特定术语提高准确性
  - 停用词管理，过滤无意义常见词优化结果
- **PostgreSQL**：关系型数据库，存储用户数据和分析结果
- **Docker**：容器化部署，确保一致的运行环境

### 项目结构

```
HeatSight/
├── frontend/               # 前端React应用
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── api/            # API调用服务
│   │   ├── utils/          # 工具函数
│   │   └── hooks/          # 自定义React Hooks
│   └── public/             # 静态资源
├── backend/                # 后端FastAPI应用
│   ├── app/
│   │   ├── api/            # API路由和控制器
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic模式
│   │   ├── services/       # 业务逻辑服务
│   │   ├── core/           # 核心配置
│   │   └── utils/          # 工具函数
│   └── alembic/            # 数据库迁移
└── scripts/                # 管理和部署脚本
```

## 当前实现状态

### 已完成功能

1. **基础平台搭建**
   - FastAPI后端框架集成
   - React前端应用搭建
   - PostgreSQL数据库集成
   - Docker容器化部署支持

2. **热点雷达核心功能**
   - 多源数据采集和展示
   - 热点内容聚合和排序
   - 热度评分系统
   - 优化的用户体验和交互设计

3. **内容灵感工坊**
   - 话题推荐和创意生成
   - 内容模板和建议系统
   - 用户界面和交互逻辑

4. **管理工具**
   - 数据库管理脚本
   - 系统启动和监控脚本
   - 依赖修复工具

### 进行中功能

1. **话题解构功能增强**
   - 改进关键词提取算法
   - 扩展子话题生成能力
   - 优化可视化效果

2. **用户系统完善**
   - 用户认证和授权
   - 用户偏好设置
   - 个性化推荐

## TODO 列表

### 短期计划（1-2周）

- [ ] **热点雷达优化**
  - [ ] 添加热点趋势图表，直观展示变化
  - [ ] 实现更精确的热度预测和评分算法
  - [ ] 支持更多内容源的集成

- [ ] **热门信息流改进**
  - [ ] 引入个性化推荐，根据用户浏览历史和兴趣调整内容权重
  - [ ] 优化时效性算法，从线性衰减改为更符合新闻生命周期的指数衰减
  - [ ] 实现多样性增强机制，确保不同类型内容都有曝光机会
  - [ ] 改进标题相似度算法，引入语义相似度，提高去重准确性
  - [ ] 添加热度变化指标，显示热度上升/下降趋势
  - [ ] 实现用户交互反馈系统，收集内容评价数据

- [ ] **话题解构功能**
  - [ ] 改进NLP算法提高子话题质量
  - [ ] 添加情感分析功能
  - [ ] 优化主题地图可视化效果

- [ ] **用户体验改进**
  - [ ] 实现深色模式支持
  - [ ] 优化移动端响应式设计
  - [ ] 添加国际化支持（英文界面）

### 中期计划（1-2月）

- [ ] **时效深度分析系统**
  - [ ] 开发热点生命周期预测模型
  - [ ] 实现热点成因分析功能
  - [ ] 构建历史关联事件推荐系统

- [ ] **热门信息流高级优化**
  - [ ] 实现季节性和周期性智能调整，根据时间段自动调整内容权重
  - [ ] 开发基于机器学习的热度预测模型，提前识别潜在热点
  - [ ] 构建媒体偏见分析系统，标记不同来源的观点倾向
  - [ ] 添加事件聚类功能，将相关新闻组织成事件线索
  - [ ] 开发内容质量评分系统，综合可读性、专业性和实用性

- [ ] **数据验证实验室**
  - [ ] 开发标题效果评估工具
  - [ ] 实现关键词优化建议系统
  - [ ] 构建平台匹配度分析功能

- [ ] **用户系统**
  - [ ] 实现用户注册和登录功能
  - [ ] 开发用户偏好配置界面
  - [ ] 添加收藏和历史记录功能

### 长期计划（3个月+）

- [ ] **商业化功能**
  - [ ] 开发订阅计费系统
  - [ ] 实现功能级别访问控制
  - [ ] 构建使用统计和分析系统

- [ ] **高级分析功能**
  - [ ] 集成机器学习模型预测热点
  - [ ] 开发自定义分析报告生成器
  - [ ] 构建API访问层，允许第三方集成

- [ ] **协作功能**
  - [ ] 实现团队工作区
  - [ ] 开发共享和协作编辑功能
  - [ ] 构建通知和任务分配系统

## 贡献指南

如果您想为HeatSight项目做出贡献，请遵循以下步骤：

1. Fork仓库
2. 创建您的特性分支：`git checkout -b feature/amazing-feature`
3. 提交您的更改：`git commit -m 'Add some amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交拉取请求

## 许可证

本项目采用MIT许可证 - 详见LICENSE文件

---

*HeatSight - 挖掘热点，激发灵感，成就创作*

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