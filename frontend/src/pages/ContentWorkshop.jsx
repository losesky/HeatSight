import React, { useState, useEffect } from 'react';
import { FiSearch, FiEdit, FiClock, FiBarChart2, FiDownload, FiCopy } from 'react-icons/fi';
import { topicsApi, searchTopics } from '../api/api';
import ApiStatus from '../components/ApiStatus';

const ContentWorkshop = () => {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiStatus, setShowApiStatus] = useState(false);
  
  // State for API data
  const [topics, setTopics] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingError, setLoadingError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Fetch hot topics from API
  const fetchHotTopics = async (forceUpdate = false) => {
    setIsLoadingTopics(true);
    setLoadingError(null);
    
    try {
      // 使用API函数获取热门话题
      const data = await topicsApi.getHotTopics({
        hot_limit: 15,
        category_limit: 5,
        force_update: forceUpdate
      });
      
      // Combine hot news and categories into a single array for display
      let allTopics = [];
      
      // Add hot news
      if (data.hot_news && data.hot_news.length > 0) {
        allTopics = [...data.hot_news];
      }
      
      // Add topics from each category
      if (data.categories) {
        const categoryNames = Object.keys(data.categories);
        setCategories(['all', ...categoryNames]);
        
        // Add each category's topics to the all topics list
        categoryNames.forEach(category => {
          if (data.categories[category] && data.categories[category].length > 0) {
            allTopics = [...allTopics, ...data.categories[category]];
          }
        });
      }
      
      // Remove duplicates based on id
      const uniqueTopics = Array.from(new Map(allTopics.map(item => [item.id, item])).values());
      
      setTopics(uniqueTopics);
      setFilteredTopics(uniqueTopics);
      setIsLoadingTopics(false);
    } catch (error) {
      console.error('Error fetching hot topics:', error);
      setLoadingError(error.message || 'Failed to fetch hot topics');
      setIsLoadingTopics(false);
    }
  };

  // Search topics
  const handleSearchTopics = async (query) => {
    if (!query.trim()) {
      setFilteredTopics(topics);
      return;
    }
    
    try {
      // 使用API函数搜索话题
      const result = await searchTopics(query, {
        page: 1,
        page_size: 10
      });
      
      if (result && result.results) {
        setFilteredTopics(result.results);
      }
    } catch (error) {
      console.error('Error searching topics:', error);
      // Fall back to client-side filtering if the API fails
      const filtered = topics.filter(topic => 
        topic.title.toLowerCase().includes(query.toLowerCase()) ||
        (topic.category && topic.category.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredTopics(filtered);
    }
  };

  // Handle search input
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search to avoid too many requests
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleSearchTopics(query);
    }, 300);
  };

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    handleSearchTopics(searchQuery);
  };

  // Select a topic
  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setGeneratedContent(null);
  };

  // Filter topics by category
  const filterByCategory = (category) => {
    setActiveCategory(category);
    
    if (category === 'all') {
      setFilteredTopics(topics);
    } else {
      const filtered = topics.filter(topic => topic.category === category);
      setFilteredTopics(filtered);
    }
  };

  // Generate subtopics for a topic
  const generateSubtopics = (topic) => {
    // Common subtopics based on the topic's category
    const subtopicsByCategory = {
      '科技': [
        `${topic.title}的核心技术解析`,
        `${topic.title}行业应用分析`,
        `${topic.title}的未来发展趋势`,
        `${topic.title}背后的商业模式`
      ],
      '财经': [
        `${topic.title}对经济的影响`,
        `${topic.title}相关投资机会`,
        `${topic.title}的政策环境分析`,
        `${topic.title}面临的风险与挑战`
      ],
      '文化': [
        `${topic.title}的社会影响`,
        `${topic.title}背后的文化意义`,
        `${topic.title}的受众分析`,
        `${topic.title}的传播与演变`
      ]
    };
    
    // Use category-specific subtopics if available, otherwise use general ones
    const subtopics = subtopicsByCategory[topic.category] || [
      `${topic.title}的背景分析`,
      `${topic.title}的主要内容`,
      `${topic.title}的影响评估`,
      `${topic.title}的未来展望`
    ];
    
    return subtopics;
  };

  // Generate content
  const handleGenerateContent = () => {
    if (!selectedTopic) return;
    
    setIsGenerating(true);
    
    // In a full implementation, this would be an API call to a content generation service
    setTimeout(() => {
      // Generate content based on the topic's category
      const contentByCategory = {
        '科技': {
          titleTemplates: [
            `${selectedTopic.title}：改变行业格局的技术革新`,
            `${selectedTopic.title}的商业应用与投资价值分析`,
            `${selectedTopic.title}：从概念到落地的全景分析`,
            `2023年${selectedTopic.title}发展趋势报告`
          ],
          outlineTemplates: [
            "1. 引言：技术创新的时代背景",
            "2. 核心技术剖析：原理与架构",
            "3. 产业链分析：关键参与者与技术壁垒",
            "4. 市场应用场景与典型案例",
            "5. 商业模式与投资逻辑",
            "6. 未来发展趋势与潜在挑战"
          ],
          keyPointTemplates: [
            `${selectedTopic.title}市场规模预计在未来5年内达到千亿规模`,
            `核心技术壁垒主要集中在算法、计算力和数据三方面`,
            `产业链上下游已形成初步生态，但整合度仍有待提高`,
            `头部企业已在该领域投入大量研发资源，竞争格局正在形成`,
            `政策支持力度逐渐加大，规范化管理同步推进`,
            `商业模式正从B端向C端逐步拓展，多样化场景落地`
          ],
          introTemplate: `近期，${selectedTopic.title}成为科技领域的焦点话题，其突破性进展吸引了产业界、投资界的广泛关注。本文将从技术原理、应用场景、商业模式和未来趋势等多个维度对${selectedTopic.title}进行深入解析，帮助读者全面把握这一前沿技术带来的变革与机遇。`
        },
        '财经': {
          titleTemplates: [
            `${selectedTopic.title}：宏观经济新变量分析`,
            `${selectedTopic.title}带来的投资机会与风险防范`,
            `解析${selectedTopic.title}对产业格局的深远影响`,
            `${selectedTopic.title}：政策导向与市场反应研究`
          ],
          outlineTemplates: [
            "1. 宏观经济背景与政策环境",
            "2. 行业影响分析：格局重塑与结构调整",
            "3. 市场反应：数据解读与趋势研判",
            "4. 投资策略：机会识别与风险控制",
            "5. 典型案例分析：成功应对的经验借鉴",
            "6. 未来展望：中长期影响评估"
          ],
          keyPointTemplates: [
            `${selectedTopic.title}表明经济结构正在发生深刻调整`,
            `政策走向已从短期刺激转向长期健康发展引导`,
            `市场情绪经历从过度悲观到理性分析的转变`,
            `相关板块估值已部分反映未来预期，但分化明显`,
            `机构投资者普遍认为需更加关注基本面和现金流`,
            `投资布局应兼顾防御性和成长性，优化配置结构`
          ],
          introTemplate: `${selectedTopic.title}作为当前财经领域的重要议题，其发展动向正深刻影响着宏观经济走势和市场投资行为。本文将通过数据分析和专业解读，为读者呈现${selectedTopic.title}背后的经济逻辑、市场机制和投资启示，帮助投资者在复杂多变的环境中做出更明智的决策。`
        },
        'default': {
          titleTemplates: [
            `${selectedTopic.title}完全指南：核心要点与深度解析`,
            `${selectedTopic.title}：现状、挑战与未来方向`,
            `${selectedTopic.title}的多维度分析与实践参考`,
            `解码${selectedTopic.title}：趋势把握与实操建议`
          ],
          outlineTemplates: [
            "1. 引言：话题背景与重要性",
            "2. 概念界定与理论基础",
            "3. 现状分析：发展历程与关键因素",
            "4. 案例研究：典型实践与经验总结",
            "5. 挑战与机遇：问题与潜力并存",
            "6. 未来展望：趋势预测与建议"
          ],
          keyPointTemplates: [
            `${selectedTopic.title}已成为行业关注的焦点，影响日益扩大`,
            `正确理解${selectedTopic.title}的核心概念对把握其本质至关重要`,
            `目前${selectedTopic.title}发展呈现出区域不平衡、结构性转变等特点`,
            `先行者的实践经验表明，创新思维和系统方法是成功关键`,
            `面临的主要挑战包括认知偏差、资源限制和环境变化`,
            `未来发展将更加注重可持续性、整合性和价值创造`
          ],
          introTemplate: `${selectedTopic.title}作为当下备受关注的话题，其重要性和影响力不断提升。本文将从多个角度对${selectedTopic.title}进行全面解析，包括其基本概念、发展现状、实践案例以及未来趋势，旨在为读者提供系统性的认识框架和实用的参考指南。`
        }
      };
      
      // Get content templates based on category or use default
      const contentTemplate = contentByCategory[selectedTopic.category] || contentByCategory['default'];
      
      // Randomly select a title from templates
      const titleIndex = Math.floor(Math.random() * contentTemplate.titleTemplates.length);
      const title = contentTemplate.titleTemplates[titleIndex];
      
      // Generate content structure
      setGeneratedContent({
        title: title,
        outline: contentTemplate.outlineTemplates,
        keyPoints: contentTemplate.keyPointTemplates,
        intro: contentTemplate.introTemplate
      });
      
      setIsGenerating(false);
    }, 2000);
  };

  // Copy to clipboard functionality
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // In a real app, would use a toast notification instead of alert
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg';
    toast.textContent = '已复制到剪贴板';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  };
  
  // Download content as Markdown
  const handleDownload = () => {
    if (!generatedContent) return;
    
    const filename = `${selectedTopic.title}_创作建议.md`;
    const content = `# ${generatedContent.title}\n\n` +
                   `## 内容大纲\n${generatedContent.outline.join('\n')}\n\n` +
                   `## 关键要点\n${generatedContent.keyPoints.map(point => `- ${point}`).join('\n')}\n\n` +
                   `## 开篇建议\n${generatedContent.intro}\n\n` +
                   `--- 由 HeatSight 内容灵感工坊生成 ---`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load topics on initial render
  useEffect(() => {
    fetchHotTopics();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">内容创作工坊</h1>
        <button 
          onClick={() => setShowApiStatus(!showApiStatus)}
          className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <FiBarChart2 />
          {showApiStatus ? "隐藏API状态" : "显示API状态"}
        </button>
      </div>
      
      {showApiStatus && <ApiStatus />}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Topics & Search */}
        <div className="lg:col-span-1 space-y-6">
          {/* Search */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">话题搜索</h2>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索热门话题..."
                  className="w-full px-4 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={handleSearchInput}
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
                >
                  <FiSearch size={18} />
                </button>
              </div>
            </form>
            
            {/* Category filters */}
            {categories.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">分类筛选</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => filterByCategory(category)}
                      className={`text-xs px-2 py-1 rounded-md ${
                        activeCategory === category
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {category === 'all' ? '全部' : category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Hot Topics */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">热门话题推荐</h2>
            
            {/* Loading state */}
            {isLoadingTopics && (
              <div className="py-4 text-center">
                <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                <p className="text-gray-500 text-sm">加载话题中...</p>
              </div>
            )}
            
            {/* Error state */}
            {loadingError && (
              <div className="py-4 text-center">
                <p className="text-red-500 mb-2">{loadingError}</p>
                <button 
                  onClick={() => fetchHotTopics(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  重试
                </button>
              </div>
            )}
            
            {/* Topics list */}
            {!isLoadingTopics && !loadingError && (
              <div className="space-y-4">
                {filteredTopics.length > 0 ? (
                  filteredTopics.map((topic) => (
                    <div 
                      key={topic.id}
                      onClick={() => handleSelectTopic(topic)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTopic?.id === topic.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-gray-900">{topic.title}</h3>
                        <span className="flex items-center text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          <FiBarChart2 className="mr-1" />
                          {topic.extra?.heat || "热门"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          {topic.category || "综合"}
                        </span>
                        <span className="mx-2">•</span>
                        <span className="flex items-center">
                          <FiClock className="mr-1" />
                          {topic.published_at ? new Date(topic.published_at).toLocaleDateString() : "最近更新"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-gray-500">未找到相关话题</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right column - Content generation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected topic */}
          {selectedTopic ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedTopic.title}</h2>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      {selectedTopic.category || "综合"}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="flex items-center">
                      <FiBarChart2 className="mr-1" />
                      热度 {selectedTopic.extra?.heat || "热门"}
                    </span>
                  </div>
                  {selectedTopic.summary && (
                    <p className="mt-3 text-gray-600">{selectedTopic.summary}</p>
                  )}
                </div>
                <button
                  onClick={handleGenerateContent}
                  disabled={isGenerating}
                  className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-md ${
                    isGenerating
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <FiEdit className="mr-2" />
                  {isGenerating ? '生成中...' : '生成内容'}
                </button>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-800 mb-2">推荐切入角度</h3>
                <div className="flex flex-wrap gap-2">
                  {generateSubtopics(selectedTopic).map((subtopic, index) => (
                    <span
                      key={index}
                      className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                    >
                      {subtopic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <FiEdit className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">选择一个话题开始创作</h3>
              <p className="mt-1 text-sm text-gray-500">
                从左侧推荐话题中选择，或使用搜索查找您感兴趣的内容
              </p>
            </div>
          )}
          
          {/* Generated content */}
          {generatedContent && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">创作建议</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => handleCopy(
                      `# ${generatedContent.title}\n\n` +
                      `## 内容大纲\n${generatedContent.outline.join('\n')}\n\n` +
                      `## 关键要点\n${generatedContent.keyPoints.map(point => `- ${point}`).join('\n')}\n\n` +
                      `## 开篇建议\n${generatedContent.intro}`
                    )}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md"
                    title="复制全部"
                  >
                    <FiCopy size={18} />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md"
                    title="下载"
                  >
                    <FiDownload size={18} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">标题建议</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-700">{generatedContent.title}</p>
                    <button
                      onClick={() => handleCopy(generatedContent.title)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <FiCopy className="mr-1" />
                      复制
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">内容大纲</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <ul className="space-y-1 text-gray-700">
                      {generatedContent.outline.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleCopy(generatedContent.outline.join('\n'))}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <FiCopy className="mr-1" />
                      复制
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">关键要点</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <ul className="space-y-1 text-gray-700 list-disc list-inside">
                      {generatedContent.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleCopy(generatedContent.keyPoints.join('\n'))}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <FiCopy className="mr-1" />
                      复制
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">开篇建议</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-700">{generatedContent.intro}</p>
                    <button
                      onClick={() => handleCopy(generatedContent.intro)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <FiCopy className="mr-1" />
                      复制
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentWorkshop; 