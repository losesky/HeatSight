import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  FiClock, 
  FiFilter, 
  FiRefreshCw, 
  FiExternalLink, 
  FiStar, 
  FiBarChart2, 
  FiGrid,
  FiList
} from 'react-icons/fi';
import HotRankings from '../components/HotRankings';
import HotNewsModule from '../components/HotNewsModule';
import { newsHeatApi } from '../api/api'; // Import newsHeatApi

// 清洗URL，去除跟踪参数
const cleanUrl = (url) => {
  try {
    const urlObj = new URL(url);
    
    // 需要移除的跟踪参数
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'source', 'ref', 'referrer', 'referral', 'channel', 'from',
      '_ga', '_gl', '_gid', 'fbclid', 'gclid', 'msclkid', 'dclid'
    ];
    
    const cleanParams = new URLSearchParams();
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (!trackingParams.includes(key.toLowerCase())) {
        cleanParams.append(key, value);
      }
    }
    
    // 重建URL
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch (e) {
    console.warn('URL清洗失败:', e);
    return url;
  }
};

// 清洗标题，去除广告标记
const cleanTitle = (title) => {
  if (!title) return '';
  
  // 移除常见的广告标记
  return title
    .replace(/\[广告\]|\[AD\]|\[推广\]|\[赞助\]/gi, '')
    .replace(/\(广告\)|\(AD\)|\(推广\)|\(赞助\)/gi, '')
    .replace(/【广告】|【AD】|【推广】|【赞助】/gi, '')
    .trim();
};

// 生成标题指纹，用于去重
const generateTitleFingerprint = (title) => {
  if (!title) return '';
  
  // 去除标点符号、空格，转为小写
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '') // 保留中文字符
    .replace(/\s+/g, '');
};

// 修改标题相似度的阈值，使其更严格，避免过度去重
const calculateSimilarity = (title1, title2) => {
  if (!title1 || !title2) return 0;
  
  const s1 = generateTitleFingerprint(title1);
  const s2 = generateTitleFingerprint(title2);
  
  // 如果标题完全相同，返回1
  if (s1 === s2) return 1;
  
  // 如果标题长度差异太大，可能是不同内容，降低相似度
  if (Math.abs(s1.length - s2.length) > Math.min(s1.length, s2.length) * 0.4) {
    return 0.4; // 降低相似度，使更多不同的新闻被展示
  }
  
  // 简单的编辑距离计算
  const m = s1.length;
  const n = s2.length;
  
  // 如果其中一个字符串为空，相似度为0
  if (m === 0 || n === 0) return 0;
  
  // 创建DP表
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // 初始化边界值
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 填充DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // 删除
          dp[i][j - 1] + 1,    // 插入
          dp[i - 1][j - 1] + 1 // 替换
        );
      }
    }
  }
  
  // 计算相似度，1减去编辑距离与最长字符串长度的比值
  return 1 - dp[m][n] / Math.max(m, n);
};

// 添加计算时效性分数的函数
const calculateRecencyScore = (publishedAt, maxBoost = 20) => {
  if (!publishedAt) return 0;
  
  try {
    const now = new Date();
    const publishTime = new Date(publishedAt);
    
    // 如果日期无效，返回0
    if (isNaN(publishTime.getTime())) return 0;
    
    // 计算发布时间到现在的小时数
    const hoursSincePublished = (now - publishTime) / (1000 * 60 * 60);
    
    // 24小时内的新闻获得最大加成，之后线性衰减
    // 48小时后不再有时效性加成
    if (hoursSincePublished <= 24) {
      return maxBoost * (1 - (hoursSincePublished / 24));
    } else if (hoursSincePublished <= 48) {
      return maxBoost * (1 - (hoursSincePublished / 24)) / 2;
    }
    
    return 0;
  } catch (e) {
    console.warn('计算时效性分数失败:', e);
    return 0;
  }
};

// 计算综合分数，考虑热度和时效性
const calculateCombinedScore = (item) => {
  // 基础热度分数
  const heatScore = item.heat_score || 0;
  
  // 时效性加成
  const recencyBoost = calculateRecencyScore(item.published_at);
  
  // 综合分数 = 热度分数 + 时效性加成
  return heatScore + recencyBoost;
};

const HotNewsPage = () => {
  const { sourceId } = useParams();
  const [activeTab, setActiveTab] = useState(sourceId ? 'detail' : 'feed');
  const [hotNews, setHotNews] = useState({
    hot_news: [],
    recommended_news: [],
    categories: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [refreshing, setRefreshing] = useState(false);
  const [newsHeatMap, setNewsHeatMap] = useState({}); // Add state for heat scores

  // If we have a sourceId but the active tab is not detail, set it to detail
  if (sourceId && activeTab !== 'detail') {
    setActiveTab('detail');
  }
  
  const fetchHotNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 请求更多数据
      const topNewsResponse = await newsHeatApi.getTopNews({
        limit: 300, // 大幅增加请求数量
        include_categories: true
      });
      
      let processedData;
      
      if (Array.isArray(topNewsResponse)) {
        console.log(`API返回了${topNewsResponse.length}条热门新闻数据`);
        
        // 清洗数据：清洗标题和URL
        const cleanedNewsData = topNewsResponse.map(item => ({
          ...item,
          title: cleanTitle(item.title),
          url: cleanUrl(item.url),
          combined_score: calculateCombinedScore(item), // 计算综合分数
          title_fingerprint: generateTitleFingerprint(item.title) // 预先生成指纹
        }));
        
        // ====== 根据用户建议实现更直接的去重策略 ======
        
        // 1. 先按新闻源分组，每个源内部按新闻ID去重，保留最新的
        const sourceGroups = new Map(); // source_id -> 新闻数组
        
        // 将新闻按来源分组
        cleanedNewsData.forEach(item => {
          const sourceId = item.source_id || 'unknown';
          if (!sourceGroups.has(sourceId)) {
            sourceGroups.set(sourceId, []);
          }
          sourceGroups.get(sourceId).push(item);
        });
        
        // 每个来源内部去重
        const sourceDeduplicated = new Map(); // source_id -> 去重后的新闻数组
        
        sourceGroups.forEach((newsItems, sourceId) => {
          // 对每个来源，按news_id精确去重，保留最新的版本
          const idMap = new Map(); // news_id -> 新闻条目
          
          newsItems.forEach(item => {
            const newsId = item.news_id || item.id;
            if (!newsId) return;
            
            // 如果新闻ID已存在，比较时间，保留最新的
            if (idMap.has(newsId)) {
              const existingItem = idMap.get(newsId);
              const existingDate = new Date(existingItem.published_at || 0);
              const currentDate = new Date(item.published_at || 0);
              
              // 如果当前版本更新，替换
              if (currentDate > existingDate) {
                idMap.set(newsId, item);
              }
            } else {
              // 首次见到此ID，直接添加
              idMap.set(newsId, item);
            }
          });
          
          // 保存这个来源去重后的新闻
          sourceDeduplicated.set(sourceId, Array.from(idMap.values()));
        });
        
        // 2. 将所有来源的去重结果合并，按综合分数排序
        let allDeduplicatedNews = [];
        sourceDeduplicated.forEach(newsItems => {
          allDeduplicatedNews.push(...newsItems);
        });
        
        // 按综合得分排序（热度+时效性）
        allDeduplicatedNews.sort((a, b) => b.combined_score - a.combined_score);
        
        // 3. 最后针对显示进行跨源去重
        const finalNewsList = [];
        const titleFingerprints = new Set(); // 用于标题去重
        const similarityThreshold = 0.8; // 相似度阈值
        
        // 对排序好的新闻按标题相似度去重
        allDeduplicatedNews.forEach(item => {
          // 检查是否与已选择的新闻标题相似
          let isDuplicate = false;
          
          for (const selectedItem of finalNewsList) {
            const similarity = calculateSimilarity(item.title, selectedItem.title);
            if (similarity >= similarityThreshold) {
              isDuplicate = true;
              break;
            }
          }
          
          // 如果不是重复的，添加到最终列表
          if (!isDuplicate) {
            finalNewsList.push(item);
            titleFingerprints.add(item.title_fingerprint);
          }
        });
        
        // 注意最终去重结果数量，但前端仍然会限制最多显示50条
        console.log(`去重后剩余${finalNewsList.length}条新闻数据，前端将显示最多50条`);
        
        // 将数组数据转换成我们需要的格式
        processedData = {
          hot_news: finalNewsList,
          recommended_news: [],
          categories: {}
        };
        
        // 从热度分数创建热度映射
        const heatScoresMap = {};
        finalNewsList.forEach(item => {
          if (item.id || item.news_id) {
            heatScoresMap[item.id || item.news_id] = item.heat_score;
          }
        });
        
        setNewsHeatMap(heatScoresMap);
        console.log(`从API数据中提取了${Object.keys(heatScoresMap).length}条热度数据`);
      } else {
        // 如果返回的是预期的对象格式，按原计划处理
        processedData = {
          hot_news: topNewsResponse.top_news || [],
          recommended_news: topNewsResponse.recommended_news || [],
          categories: topNewsResponse.categories || {}
        };
        
        // 如果API已经返回了热度分数，则不需要额外请求
        if (topNewsResponse.heat_scores) {
          setNewsHeatMap(topNewsResponse.heat_scores);
          console.log(`API已返回热度数据，包含${Object.keys(topNewsResponse.heat_scores).length}条记录`);
        } else {
          // 收集所有新闻ID以获取热度分数
          const allNewsIds = [];
          if (processedData.hot_news && processedData.hot_news.length > 0) {
            processedData.hot_news.forEach(item => {
              if (item.id) {
                allNewsIds.push(item.id);
              }
            });
          }
          
          // 从各个分类中添加新闻ID
          if (processedData.categories) {
            Object.values(processedData.categories).forEach(categoryNews => {
              if (Array.isArray(categoryNews)) {
                categoryNews.forEach(item => {
                  if (item.id && !allNewsIds.includes(item.id)) {
                    allNewsIds.push(item.id);
                  }
                });
              }
            });
          }
          
          // 如果有新闻ID，则获取热度分数
          if (allNewsIds.length > 0) {
            try {
              const heatResponse = await newsHeatApi.getHeatScores(allNewsIds);
              if (heatResponse && heatResponse.heat_scores) {
                setNewsHeatMap(heatResponse.heat_scores);
                console.log(`从API获取了${Object.keys(heatResponse.heat_scores).length}条热度数据`);
              }
            } catch (error) {
              console.error('获取热度分数失败:', error);
            }
          }
        }
      }
      
      setHotNews(processedData);
    } catch (err) {
      console.error('Error fetching hot news:', err);
      setError('获取热门数据失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchHotNews();
    }
  }, [activeTab, fetchHotNews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHotNews();
    setRefreshing(false);
  };

  // Get all available categories from the hot news data
  const getCategories = () => {
    const categories = Object.keys(hotNews.categories || {});
    return categories;
  };
  
  // Filter hot news based on active category
  const getFilteredNews = () => {
    const maxDisplayCount = 20; // 前端限制最多显示50条记录
    let newsData = [];
    
    if (activeCategory === 'all') {
      newsData = hotNews.hot_news || [];
    } else if (hotNews.categories && hotNews.categories[activeCategory]) {
      newsData = hotNews.categories[activeCategory];
    }
    
    // 确保只返回前50条数据
    return newsData.slice(0, maxDisplayCount);
  };

  // Get category display names
  const getCategoryName = (categoryKey) => {
    const categoryNames = {
      'technology': '科技',
      'finance': '财经',
      'news': '新闻',
      'social': '社交',
      'entertainment': '娱乐',
      'sports': '体育',
      'education': '教育',
      'gaming': '游戏',
      'travel': '旅游',
      'fashion': '时尚'
    };
    
    return categoryNames[categoryKey] || categoryKey;
  };

  // Get source color based on category or name
  const getSourceColor = (category, sourceName) => {
    const colorMap = {
      'technology': 'bg-blue-100 text-blue-800',
      'finance': 'bg-green-100 text-green-800',
      'news': 'bg-gray-100 text-gray-800',
      'social': 'bg-pink-100 text-pink-800',
      'entertainment': 'bg-purple-100 text-purple-800',
      'sports': 'bg-red-100 text-red-800',
      'education': 'bg-yellow-100 text-yellow-800',
      'gaming': 'bg-indigo-100 text-indigo-800',
      'travel': 'bg-teal-100 text-teal-800',
      'fashion': 'bg-rose-100 text-rose-800'
    };
    
    // Specific source names
    if (sourceName) {
      const sourceColorMap = {
        '知乎': 'bg-blue-100 text-blue-800',
        '微博': 'bg-red-100 text-red-800',
        '百度': 'bg-blue-100 text-blue-800',
        '哔哩哔哩': 'bg-pink-100 text-pink-800',
        '抖音': 'bg-black bg-opacity-10 text-gray-800',
        '今日头条': 'bg-red-100 text-red-800'
      };
      
      if (sourceColorMap[sourceName]) {
        return sourceColorMap[sourceName];
      }
    }
    
    return colorMap[category] || 'bg-gray-100 text-gray-800';
  };

  // Get heat score for a news item
  const getNewsHeatScore = (newsId, defaultScore = 10) => {
    if (!newsId) return defaultScore;
    
    // 直接在热门新闻数组中查找该条新闻
    const newsItem = hotNews.hot_news?.find(item => (item.id || item.news_id) === newsId);
    
    // 如果找到新闻且它直接包含热度分数，则使用
    if (newsItem && newsItem.heat_score !== undefined) {
      return newsItem.heat_score;
    }
    
    // 否则从热度映射中获取
    const score = newsHeatMap[newsId];
    return score !== undefined ? score : defaultScore;
  };

  // Get heat level text based on score
  const getHeatLevelText = (score) => {
    if (score >= 90) return '爆热';
    if (score >= 70) return '高热';
    if (score >= 50) return '热门';
    if (score >= 30) return '一般';
    if (score > 0) return '冷门';
    return ''; // 对于热度为0的不返回文字
  };

  // Get heat color class based on score
  const getHeatColorClass = (score) => {
    if (score >= 90) return 'text-red-600';
    if (score >= 70) return 'text-orange-500';
    if (score >= 50) return 'text-yellow-500';
    if (score >= 30) return 'text-blue-500';
    return 'text-gray-500';
  };

  const renderFeedView = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="bg-red-50 text-red-600 p-8 rounded-lg text-center shadow-sm">
          <div className="text-xl font-bold mb-2">数据获取失败</div>
          <p>{error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            重试
          </button>
        </div>
      );
    }
    
    const filteredNews = getFilteredNews();
    
    if (filteredNews.length === 0) {
      return (
        <div className="bg-gray-50 text-gray-500 p-12 rounded-lg text-center shadow-sm">
          <div className="text-xl font-bold mb-2">暂无内容</div>
          <p>当前分类下没有找到符合条件的热门内容</p>
        </div>
      );
    }
    
    return viewMode === 'list' ? renderListView(filteredNews) : renderGridView(filteredNews);
  };
  
  const renderListView = (news) => {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {news.map((item, index) => {
            // 确保我们有唯一键
            const itemKey = item.id || item.news_id || index;
            // 确保我们有标识符来获取热度信息
            const heatId = item.id || item.news_id;
            // 确定源显示名称
            const sourceName = item.source_name || item.source_id;
            
            return (
              <div key={itemKey} className="hover:bg-gray-50 transition-colors">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                        {index + 1}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <h3 className="font-medium text-gray-900 text-lg">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors"
                          >
                            {item.title}
                          </a>
                        </h3>
                        
                        <div className="flex items-center space-x-3 text-sm whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSourceColor(item.category, sourceName)}`}>
                            {sourceName}
                          </span>
                        </div>
                      </div>
                      
                      {item.summary && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {item.published_at && (
                          <span className="flex items-center">
                            <FiClock className="mr-1" />
                            {formatDistanceToNow(new Date(item.published_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                        )}
                        
                        <span className={`flex items-center ${getHeatColorClass(getNewsHeatScore(heatId))}`}>
                          <FiStar className="mr-1" />
                          热度 {Math.round(getNewsHeatScore(heatId))}
                          {getHeatLevelText(getNewsHeatScore(heatId)) && ` (${getHeatLevelText(getNewsHeatScore(heatId))})`}
                        </span>
                        
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-700"
                        >
                          <FiExternalLink className="mr-1" />
                          查看原文
                        </a>
                      </div>
                      
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map(tag => (
                            <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const renderGridView = (news) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {news.map((item, index) => {
          // 确保我们有唯一键
          const itemKey = item.id || item.news_id || index;
          // 确保我们有标识符来获取热度信息
          const heatId = item.id || item.news_id;
          // 确定源显示名称
          const sourceName = item.source_name || item.source_id;
          
          return (
            <div key={itemKey} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">
                      {index + 1}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-col gap-2 mb-2">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getSourceColor(item.category, sourceName)}`}>
                          {sourceName}
                        </span>
                        
                        <span className={`flex items-center text-xs ${getHeatColorClass(getNewsHeatScore(heatId))}`}>
                          <FiStar className="mr-1" />
                          热度 {Math.round(getNewsHeatScore(heatId))}
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-gray-900">
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 transition-colors"
                        >
                          {item.title}
                        </a>
                      </h3>
                    </div>
                    
                    {item.summary && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                      {item.published_at && (
                        <span className="flex items-center">
                          <FiClock className="mr-1" />
                          {formatDistanceToNow(new Date(item.published_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      )}
                      
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-700"
                      >
                        <FiExternalLink className="mr-1" />
                        查看
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
            <FiBarChart2 className="mr-2 text-blue-600" />
            热门资讯
          </h1>
          
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className={`px-4 py-2 rounded-md flex items-center text-sm ${
                activeTab === 'feed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('feed')}
            >
              <FiStar className="mr-1.5" />
              热门信息流
            </button>
          
            <button
              className={`px-4 py-2 rounded-md flex items-center text-sm ${
                activeTab === 'rankings'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('rankings')}
            >
              <FiBarChart2 className="mr-1.5" />
              热门聚合
            </button>
            
            <button
              className={`px-4 py-2 rounded-md flex items-center text-sm ${
                activeTab === 'detail'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('detail')}
              disabled={!sourceId}
            >
              <FiExternalLink className="mr-1.5" />
              详细浏览
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center flex-wrap gap-2">
                <div className="flex items-center text-gray-700 mr-2">
                  <FiFilter className="mr-1.5" />
                  <span className="font-medium">分类筛选:</span>
                </div>
                
                <button
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center ${
                    activeCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveCategory('all')}
                >
                  全部
                </button>
                
                {getCategories().map(category => (
                  <button
                    key={category}
                    className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap flex items-center ${
                      activeCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveCategory(category)}
                  >
                    {getCategoryName(category)}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center text-sm ${refreshing ? 'opacity-50' : ''}`}
                >
                  <FiRefreshCw className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                
                <div className="flex border border-gray-200 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <FiList />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <FiGrid />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content */}
          {renderFeedView()}
        </div>
      )}
      
      {/* 热门聚合部分 - 按照需求不修改此部分 */}
      {activeTab === 'rankings' && <HotRankings />}
      
      {activeTab === 'detail' && sourceId ? (
        <HotNewsModule initialSourceId={sourceId} />
      ) : (
        activeTab === 'detail' && <Navigate to="/hot-news" replace />
      )}
    </div>
  );
};

export default HotNewsPage; 