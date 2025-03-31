import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Navigate, Link, useLocation } from 'react-router-dom';
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
const calculateRecencyScore = (publishedAt, maxBoost = 30) => {
  if (!publishedAt) return 0;
  
  try {
    const now = new Date();
    const publishTime = new Date(publishedAt);
    
    // 如果日期无效，返回0
    if (isNaN(publishTime.getTime())) return 0;
    
    // 计算发布时间到现在的小时数
    const hoursSincePublished = (now - publishTime) / (1000 * 60 * 60);
    
    // 时效性计算逻辑 - 平滑的两段式线性衰减
    if (hoursSincePublished <= 24) {
      // 0-24小时：从满分(30分)线性递减到半分(15分)
      // 例如：0小时=30分，12小时=22.5分，24小时=15分
      return maxBoost - (maxBoost / 2) * (hoursSincePublished / 24);
    } else if (hoursSincePublished <= 48) {
      // 24-48小时：从半分(15分)线性递减到0分
      // 例如：24小时=15分，36小时=7.5分，48小时=0分
      return (maxBoost / 2) * (1 - ((hoursSincePublished - 24) / 24));
    }
    
    // 48小时后不再有时效性加成
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
  // 获取URL查询参数
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const tabParam = queryParams.get('tab');
  
  // 根据URL参数初始化activeTab
  const [activeTab, setActiveTab] = useState(() => {
    if (sourceId) return 'detail';
    if (tabParam === 'rankings') return 'rankings';
    return 'feed'; // 默认标签页
  });
  
  const [hotNews, setHotNews] = useState({
    hot_news: [],
    recommended_news: [],
    categories: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState(['all']); // 改为多选
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [refreshing, setRefreshing] = useState(false);
  const [newsHeatMap, setNewsHeatMap] = useState({}); // Add state for heat scores
  const [sourceCategoryMap, setSourceCategoryMap] = useState({}); // 添加来源-分类映射状态
  const [availableCategories, setAvailableCategories] = useState([]); // 添加可用分类状态
  const [sourceNameMap, setSourceNameMap] = useState({}); // 添加来源ID到中文名称的映射

  // If we have a sourceId but the active tab is not detail, set it to detail
  if (sourceId && activeTab !== 'detail') {
    setActiveTab('detail');
  }
  
  const fetchHotNews = useCallback(async (categoryFilters = null) => {
    setLoading(true);
    setError(null);
    
    try {
      // 请求更多数据，添加category参数
      const params = {
        limit: 300,
        include_categories: true
      };
      
      // 处理分类过滤参数
      // 只有当分类不为null且不包含'all'时才添加category参数
      if (categoryFilters) {
        // 如果输入是字符串(单个分类)，转换为数组
        const categories = Array.isArray(categoryFilters) ? categoryFilters : [categoryFilters];
        
        if (!categories.includes('all') && categories.length > 0) {
          // 如果有多个分类，以逗号分隔拼接
          params.category = categories.join(',');
        }
      }
      
      const topNewsResponse = await newsHeatApi.getTopNews(params);
      
      let processedData;
      
      if (Array.isArray(topNewsResponse)) {
        console.log(`API返回了${topNewsResponse.length}条热门新闻数据`);
        
        // 使用来源推断分类的映射
        const defaultSourceCategories = {
          'weibo': 'social',
          'zhihu': 'knowledge',
          'toutiao': 'news',
          'baidu': 'search',
          'bilibili': 'video',
          'douyin': 'video',
          '36kr': 'technology',
          'wallstreetcn': 'finance',
          'ithome': 'technology',
          'thepaper': 'news',
          'zaobao': 'news',
          'sina': 'news',
          'qq': 'news',
          '163': 'news',
          'sohu': 'news',
          'ifeng': 'news',
          'bbc_world': 'world',
          'bloomberg': 'finance'
        };
        
        // 清洗数据：清洗标题和URL
        const cleanedNewsData = topNewsResponse.map(item => {
          // 获取原始分类或从meta_data中提取
          let category = item.category;
          
          // 如果没有直接分类但有meta_data，从meta_data中提取
          if (!category && item.meta_data && typeof item.meta_data === 'object') {
            category = item.meta_data.category;
          }
          
          // 如果仍然没有分类，根据来源推断
          if (!category && item.source_id) {
            category = Object.keys(sourceCategoryMap).length > 0 
              ? sourceCategoryMap[item.source_id] || 'others'
              : defaultSourceCategories[item.source_id] || 'others';
          }
          
          return {
            ...item,
            title: cleanTitle(item.title),
            url: cleanUrl(item.url),
            category: category, // 确保保留或推断分类信息
            combined_score: calculateCombinedScore(item), // 计算综合分数
            title_fingerprint: generateTitleFingerprint(item.title) // 预先生成指纹
          };
        });
        
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
        const similarityThreshold = 0.7; // 相似度阈值
        
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
        
        // 根据新闻条目的 category 属性将它们组织成分类
        const categoriesMap = {};
        
        // 遍历去重后的新闻，按分类进行分组
        finalNewsList.forEach(newsItem => {
          // 使用已有分类，如果没有则使用'others'
          const category = newsItem.category || 'others';
          
          if (!categoriesMap[category]) {
            categoriesMap[category] = [];
          }
          categoriesMap[category].push(newsItem);
        });
        
        // 排除空分类和只有少量新闻的分类(小于2条)
        const filteredCategories = {};
        Object.keys(categoriesMap).forEach(category => {
          if (categoriesMap[category].length >= 2) {
            filteredCategories[category] = categoriesMap[category];
          }
        });
        
        console.log(`从新闻数据中提取了${Object.keys(filteredCategories).length}个分类`);
        
        // 将数组数据转换成我们需要的格式，包含分类信息
        processedData = {
          hot_news: finalNewsList,
          recommended_news: [],
          categories: filteredCategories
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当URL参数改变时更新activeTab
  useEffect(() => {
    if (sourceId) {
      setActiveTab('detail');
    } else if (tabParam === 'rankings') {
      setActiveTab('rankings');
    } else if (!tabParam && activeTab !== 'feed') {
      setActiveTab('feed');
    }
  }, [sourceId, tabParam, activeTab]);

  // 使用ref存储当前选中的分类，避免无限循环
  const selectedCategoriesRef = useRef(selectedCategories);
  
  // 当selectedCategories变化时更新ref
  useEffect(() => {
    selectedCategoriesRef.current = selectedCategories;
  }, [selectedCategories]);
  
  // 组件加载时获取所有可用分类
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 先获取所有来源分类
        const response = await newsHeatApi.getSourceWeights();
        if (response && response.sources && Array.isArray(response.sources)) {
          // 提取所有来源的分类信息并去重
          const categoriesSet = new Set();
          
          response.sources.forEach(source => {
            if (source.category && source.category !== 'unknown') {
              categoriesSet.add(source.category);
            }
          });
          
          // 将Set转换为数组，并按字母顺序排序
          const categoriesArray = Array.from(categoriesSet).sort();
          setAvailableCategories(categoriesArray);
          console.log('从API获取的可用分类:', categoriesArray);
          
          // 获取完分类后，加载热门信息
          if (activeTab === 'feed') {
            fetchHotNews(selectedCategories);
          }
        }
      } catch (error) {
        console.error('获取可用分类失败:', error);
        // 设置默认分类作为回退
        setAvailableCategories([
          'technology', 'finance', 'news', 'social', 
          'entertainment', 'sports', 'knowledge', 'video'
        ]);
        
        // 即使获取分类失败，也尝试加载热门信息
        if (activeTab === 'feed') {
          fetchHotNews(selectedCategories);
        }
      }
    };
    
    fetchInitialData();
  }, [activeTab, fetchHotNews, selectedCategories]); // 添加activeTab、fetchHotNews和selectedCategories作为依赖项
  
  // 只有当activeTab变化时才触发加载
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'feed' && availableCategories.length > 0) {
      fetchHotNews(selectedCategoriesRef.current);
    }
  }, [activeTab, fetchHotNews, availableCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHotNews(selectedCategories); // 使用当前选中的所有分类刷新
    setRefreshing(false);
  };
  
  // 处理分类选择 - 支持多选
  const toggleCategory = (category) => {
    let newCategories;
    if (category === 'all') {
      // 如果选择"全部"，则清除其他所有选择
      newCategories = ['all'];
    } else {
      // 如果当前选择包含"全部"，则清除"全部"并选择当前分类
      if (selectedCategories.includes('all')) {
        newCategories = [category];
      } else if (selectedCategories.includes(category)) {
        // 如果当前分类已被选中，则取消选择
        const filtered = selectedCategories.filter(c => c !== category);
        // 如果取消后没有选中任何分类，则默认选择"全部"
        newCategories = filtered.length === 0 ? ['all'] : filtered;
      } else {
        // 否则添加当前分类到选中列表
        newCategories = [...selectedCategories, category];
      }
    }
    
    setSelectedCategories(newCategories);
    fetchHotNews(newCategories); // 获取多个分类的新闻
  };

  // Get all available categories from the hot news data
  const getCategories = () => {
    // 优先使用API获取的可用分类
    if (availableCategories.length > 0) {
      return availableCategories;
    }
    
    // 回退到从热门新闻数据中提取的分类
    const categories = Object.keys(hotNews.categories || {});
    return categories;
  };
  
  // Filter hot news based on selected categories
  const getFilteredNews = () => {
    const maxDisplayCount = 20; // 限制最多显示20条记录
    
    // 如果选择了"全部"
    if (selectedCategories.includes('all')) {
      return (hotNews.hot_news || []).slice(0, maxDisplayCount);
    }
    
    // 如果选择了特定分类
    let combinedNews = [];
    
    // 合并选中分类的所有新闻
    selectedCategories.forEach(category => {
      if (hotNews.categories && hotNews.categories[category]) {
        combinedNews = [...combinedNews, ...hotNews.categories[category]];
      }
    });
    
    // 去重 - 根据新闻ID
    const uniqueIds = new Set();
    const uniqueNews = [];
    
    combinedNews.forEach(item => {
      const newsId = item.id || item.news_id;
      if (newsId && !uniqueIds.has(newsId)) {
        uniqueIds.add(newsId);
        uniqueNews.push(item);
      }
    });
    
    // 按综合分数排序
    uniqueNews.sort((a, b) => b.combined_score - a.combined_score);
    
    // 返回前20条
    return uniqueNews.slice(0, maxDisplayCount);
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
      'fashion': '时尚',
      'politics': '政治',
      'economy': '经济',
      'health': '健康',
      'science': '科学',
      'world': '国际',
      'culture': '文化',
      'military': '军事',
      'automotive': '汽车',
      'realestate': '房产',
      'food': '美食',
      'video': '视频',
      'knowledge': '知识',
      'search': '搜索',
      'lifestyle': '生活方式',
      'others': '其他'
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
      'fashion': 'bg-rose-100 text-rose-800',
      'politics': 'bg-orange-100 text-orange-800',
      'economy': 'bg-emerald-100 text-emerald-800',
      'health': 'bg-lime-100 text-lime-800',
      'science': 'bg-cyan-100 text-cyan-800',
      'world': 'bg-violet-100 text-violet-800',
      'culture': 'bg-fuchsia-100 text-fuchsia-800',
      'military': 'bg-slate-100 text-slate-800',
      'automotive': 'bg-sky-100 text-sky-800',
      'realestate': 'bg-amber-100 text-amber-800',
      'food': 'bg-orange-100 text-orange-800',
      'video': 'bg-pink-100 text-pink-800',
      'knowledge': 'bg-blue-100 text-blue-800',
      'search': 'bg-gray-100 text-gray-800',
      'lifestyle': 'bg-purple-100 text-purple-800'
    };
    
    // Specific source names
    if (sourceName) {
      const sourceColorMap = {
        // 英文名称
        'zhihu': 'bg-blue-100 text-blue-800',
        'weibo': 'bg-red-100 text-red-800',
        'baidu': 'bg-blue-100 text-blue-800',
        'bilibili': 'bg-pink-100 text-pink-800',
        'douyin': 'bg-black bg-opacity-10 text-gray-800',
        'toutiao': 'bg-red-100 text-red-800',
        '36kr': 'bg-green-100 text-green-800',
        'cls': 'bg-green-100 text-green-800',
        'wallstreetcn': 'bg-green-100 text-green-800',
        'yicai': 'bg-green-100 text-green-800',
        'eastmoney': 'bg-green-100 text-green-800',
        'sina': 'bg-red-100 text-red-800',
        'nbd': 'bg-green-100 text-green-800',
        'thepaper': 'bg-blue-100 text-blue-800',
        'zaobao': 'bg-green-100 text-green-800',
        'ithome': 'bg-blue-100 text-blue-800',
        'qq': 'bg-teal-100 text-teal-800',
        '163': 'bg-red-100 text-red-800',
        'sohu': 'bg-orange-100 text-orange-800',
        'ifeng': 'bg-red-100 text-red-800',
        'guancha': 'bg-blue-100 text-blue-800',
        'cnstock': 'bg-green-100 text-green-800',
        'jiemian': 'bg-green-100 text-green-800',
        'bjnews': 'bg-gray-100 text-gray-800',
        'hexun': 'bg-green-100 text-green-800',
        
        // 中文名称
        '知乎': 'bg-blue-100 text-blue-800',
        '微博': 'bg-red-100 text-red-800',
        '百度': 'bg-blue-100 text-blue-800',
        '哔哩哔哩': 'bg-pink-100 text-pink-800',
        '抖音': 'bg-black bg-opacity-10 text-gray-800',
        '今日头条': 'bg-red-100 text-red-800',
        '36氪': 'bg-green-100 text-green-800',
        '澎湃新闻': 'bg-blue-100 text-blue-800',
        '新浪': 'bg-red-100 text-red-800',
        '腾讯': 'bg-teal-100 text-teal-800',
        '网易': 'bg-red-100 text-red-800',
        '搜狐': 'bg-orange-100 text-orange-800',
        '凤凰网': 'bg-red-100 text-red-800',
        '人民日报': 'bg-red-100 text-red-800',
        'IT之家': 'bg-blue-100 text-blue-800',
        '环球时报': 'bg-red-100 text-red-800',
        '中国青年报': 'bg-red-100 text-red-800',
        '观察者网': 'bg-blue-100 text-blue-800',
        '第一财经': 'bg-green-100 text-green-800',
        '财联社': 'bg-green-100 text-green-800',
        '央视': 'bg-red-100 text-red-800',
        '央视新闻': 'bg-red-100 text-red-800',
        '新华社': 'bg-red-100 text-red-800',
        '华尔街见闻': 'bg-green-100 text-green-800',
        '东方财富': 'bg-green-100 text-green-800',
        '新浪财经': 'bg-red-100 text-red-800',
        '每日经济新闻': 'bg-green-100 text-green-800',
        '联合早报': 'bg-green-100 text-green-800',
        '中国证券网': 'bg-green-100 text-green-800',
        '界面新闻': 'bg-green-100 text-green-800',
        '新京报': 'bg-green-100 text-green-800',
        '和讯网': 'bg-green-100 text-green-800'
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

  // 组件加载时获取来源-分类映射
  useEffect(() => {
    const fetchSourceCategories = async () => {
      try {
        const response = await newsHeatApi.getSourceWeights();
        // 从API响应中提取来源ID和分类信息
        if (response && response.sources && Array.isArray(response.sources)) {
          const categoryMap = {};
          const nameMap = {}; // 创建来源ID到中文名称的映射
          
          response.sources.forEach(source => {
            if (source.source_id && source.category) {
              categoryMap[source.source_id] = source.category;
            }
            
            // 添加来源ID到名称的映射
            if (source.source_id && source.name) {
              nameMap[source.source_id] = source.name;
            }
          });
          
          setSourceCategoryMap(categoryMap);
          setSourceNameMap(nameMap); // 保存名称映射
          console.log('从API获取的来源-分类映射:', categoryMap);
          console.log('从API获取的来源-名称映射:', nameMap);
        }
      } catch (error) {
        console.error('获取来源分类映射失败:', error);
        // 设置默认映射作为回退
        setSourceCategoryMap({
          'weibo': 'social',
          'zhihu': 'knowledge',
          'toutiao': 'news',
          'baidu': 'search',
          'bilibili': 'video',
          'douyin': 'video',
          '36kr': 'technology'
        });
        
        // 设置默认的名称映射
        setSourceNameMap({
          'weibo': '微博',
          'zhihu': '知乎',
          'toutiao': '今日头条',
          'baidu': '百度',
          'bilibili': '哔哩哔哩',
          'douyin': '抖音',
          '36kr': '36氪',
          'cls': '财联社',
          'wallstreetcn': '华尔街见闻',
          'yicai': '第一财经',
          'eastmoney': '东方财富',
          'sina': '新浪财经',
          'nbd': '每日经济新闻',
          'thepaper': '澎湃新闻',
          'zaobao': '联合早报',
          'ithome': 'IT之家',
          'qq': '腾讯新闻',
          '163': '网易新闻',
          'sohu': '搜狐新闻',
          'ifeng': '凤凰网',
          'guancha': '观察者网',
          'cnstock': '中国证券网',
          'jiemian': '界面新闻',
          'bjnews': '新京报',
          'hexun': '和讯网'
        });
      }
    };
    
    fetchSourceCategories();
  }, []);

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
            // 确定源显示名称 - 优先使用映射中的中文名称
            const sourceId = item.source_id || '';
            const sourceName = sourceNameMap[sourceId] || item.source_name || sourceId;
            
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
          // 确定源显示名称 - 优先使用映射中的中文名称
          const sourceId = item.source_id || '';
          const sourceName = sourceNameMap[sourceId] || item.source_name || sourceId;
          
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

  // 在Toolbar部分使用新的渲染函数
  const renderCategoryFilters = () => {
    const categories = getCategories();
    
    return (
      <div className="flex flex-wrap gap-2">
        <button
          className={`px-3 py-1.5 rounded-md text-sm flex items-center ${
            selectedCategories.includes('all')
              ? 'bg-blue-600 text-white font-medium'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => toggleCategory('all')}
        >
          全部
        </button>
        
        {categories.map(category => (
          <button
            key={category}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap flex items-center ${
              selectedCategories.includes(category)
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => toggleCategory(category)}
          >
            {getCategoryName(category)}
          </button>
        ))}
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
            <Link
              to="/hot-news"
              className={`px-4 py-2 rounded-md flex items-center text-sm ${
                activeTab === 'feed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('feed')}
            >
              <FiStar className="mr-1.5" />
              热门信息流
            </Link>
          
            <Link
              to="/hot-news?tab=rankings"
              className={`px-4 py-2 rounded-md flex items-center text-sm ${
                activeTab === 'rankings'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('rankings')}
            >
              <FiBarChart2 className="mr-1.5" />
              热门聚合
            </Link>
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
                
                {renderCategoryFilters()}
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