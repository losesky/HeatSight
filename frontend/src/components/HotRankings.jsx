import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiExternalLink, 
  FiTrendingUp, 
  FiRefreshCw, 
  FiClock, 
  FiSearch,
  FiFilter,
  FiStar
} from 'react-icons/fi';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { SourceCardSkeleton } from './SkeletonLoader';

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

// 缓存keys
const CACHE_KEYS = {
  SOURCES: 'heatsight_sources',
  SOURCE_DATA: 'heatsight_source_data',
  CACHE_TIMESTAMP: 'heatsight_cache_timestamp',
  NEWS_HEAT_DATA: 'heatsight_news_heat_data'
};

// 缓存过期时间（毫秒）- 10分钟
const CACHE_EXPIRY = 10 * 60 * 1000;

// 缓存工具函数
const cacheUtils = {
  // 保存数据到本地缓存
  saveToCache: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    } catch (err) {
      console.error('Error saving to cache:', err);
    }
  },
  
  // 从本地缓存获取数据
  getFromCache: (key) => {
    try {
      const cachedData = localStorage.getItem(key);
      const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      
      // 检查缓存是否过期
      if (cachedData && timestamp) {
        const now = Date.now();
        const cacheTime = parseInt(timestamp, 10);
        
        // 如果缓存未过期，返回缓存数据
        if (now - cacheTime < CACHE_EXPIRY) {
          return JSON.parse(cachedData);
        }
      }
      return null;
    } catch (err) {
      console.error('Error reading from cache:', err);
      return null;
    }
  },
  
  // 清除缓存
  clearCache: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.SOURCES);
      localStorage.removeItem(CACHE_KEYS.SOURCE_DATA);
      localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP);
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  },
  
  // 检查缓存是否有效
  isCacheValid: () => {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      if (!timestamp) return false;
      
      const cacheTime = parseInt(timestamp, 10);
      return (Date.now() - cacheTime) < CACHE_EXPIRY;
    } catch (err) {
      return false;
    }
  }
};

const HotRankings = () => {
  const [sources, setSources] = useState([]);
  const [sourceDataMap, setSourceDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(new Set()); // 跟踪正在加载的源
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [newsHeatMap, setNewsHeatMap] = useState({});
  const displayCount = 5; // Number of news items to display per source
  
  // 使用ref跟踪组件是否已挂载，防止初始化后的重复请求
  const isMounted = useRef(false);
  // 使用ref标记手动刷新
  const isManualRefresh = useRef(false);
  // 存储数据，避免循环依赖
  const sourcesRef = useRef([]);

  // 只使用一个useEffect处理所有数据加载
  useEffect(() => {
    // 只在组件首次加载或手动刷新时请求数据
    if (isMounted.current && !isManualRefresh.current) {
      return;
    }

    // 标记组件已挂载
    isMounted.current = true;
    // 重置手动刷新标记
    isManualRefresh.current = false;

    // 获取所有源列表和数据的主函数
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      
      // 如果不是手动刷新，尝试从缓存加载数据
      if (!isManualRefresh.current && cacheUtils.isCacheValid()) {
        const cachedSources = cacheUtils.getFromCache(CACHE_KEYS.SOURCES);
        const cachedSourceData = cacheUtils.getFromCache(CACHE_KEYS.SOURCE_DATA);
        
        if (cachedSources && cachedSourceData) {
          console.log('Loading data from cache');
          setSources(cachedSources);
          setSourceDataMap(cachedSourceData);
          setLoading(false);
          return;
        }
      }
      
      try {
        console.log('Fetching fresh data from API');
        
        // 1. 首先获取所有可用的源
        const sourcesResponse = await axios.get(`${API_URL}/external/sources`);
        
        if (!sourcesResponse.data || !sourcesResponse.data.sources) {
          throw new Error('Failed to fetch sources data');
        }
        
        // 排序源
        const sortedSources = sourcesResponse.data.sources.sort((a, b) => {
          if (a.category === b.category) {
            return a.name.localeCompare(b.name);
          }
          return a.category.localeCompare(b.category);
        });
        
        // 更新sources状态和ref
        setSources(sortedSources);
        sourcesRef.current = sortedSources;
        
        // 保存源数据到缓存
        cacheUtils.saveToCache(CACHE_KEYS.SOURCES, sortedSources);
        
        // 筛选和准备要获取的源
        const popularSources = sortedSources.filter(s => 
          ['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
        );
        
        // 去掉slice限制，获取所有其他来源
        const otherSources = sortedSources.filter(s => 
          !['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
        );
        
        const allSourcesToFetch = [...popularSources, ...otherSources];
        
        // 准备加载所有源的数据
        setLoadingSources(new Set(allSourcesToFetch.map(s => s.source_id)));
        
        // 2. 并行获取所有源的数据
        const newDataMap = {};
        await Promise.all(
          allSourcesToFetch.map(async (source) => {
            try {
              const response = await axios.get(`${API_URL}/external/source/${source.source_id}?limit=${displayCount}`);
              
              if (response.data) {
                newDataMap[source.source_id] = response.data;
                
                // 实时更新UI，移除已加载的源
                setSourceDataMap(prev => ({
                  ...prev,
                  [source.source_id]: response.data
                }));
                
                setLoadingSources(prevState => {
                  const newSet = new Set(prevState);
                  newSet.delete(source.source_id);
                  return newSet;
                });
              }
            } catch (err) {
              console.error(`Error fetching data for source ${source.source_id}:`, err);
              // 移除失败的源
              setLoadingSources(prevState => {
                const newSet = new Set(prevState);
                newSet.delete(source.source_id);
                return newSet;
              });
            }
          })
        );
        
        // 最终更新所有数据
        setSourceDataMap(newDataMap);
        
        // 保存数据到缓存
        cacheUtils.saveToCache(CACHE_KEYS.SOURCE_DATA, newDataMap);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('获取数据失败，请稍后再试');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingSources(new Set());
      }
    };
    
    fetchAllData();
    
    // 组件卸载时清理
    return () => {
      isMounted.current = false;
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 手动刷新函数
  const handleRefresh = () => {
    if (loading || refreshing) return;
    
    // 先设置刷新状态
    setRefreshing(true);
    isManualRefresh.current = true;
    
    // 清除缓存
    cacheUtils.clearCache();
    
    // 重置挂载状态，触发useEffect
    isMounted.current = false;
    
    // 强制组件重新渲染以触发useEffect
    // 由于我们使用空依赖数组，React不会自动重新执行useEffect
    // 添加一个setTimeout以确保状态更新和DOM刷新后再触发useEffect
    setTimeout(() => {
      // 获取所有源列表和数据的主函数
      const fetchAllData = async () => {
        try {
          console.log('Manually refreshing data from API');
          
          // 1. 首先获取所有可用的源
          const sourcesResponse = await axios.get(`${API_URL}/external/sources`);
          
          if (!sourcesResponse.data || !sourcesResponse.data.sources) {
            throw new Error('Failed to fetch sources data');
          }
          
          // 排序源
          const sortedSources = sourcesResponse.data.sources.sort((a, b) => {
            if (a.category === b.category) {
              return a.name.localeCompare(b.name);
            }
            return a.category.localeCompare(b.category);
          });
          
          // 更新sources状态和ref
          setSources(sortedSources);
          sourcesRef.current = sortedSources;
          
          // 保存源数据到缓存
          cacheUtils.saveToCache(CACHE_KEYS.SOURCES, sortedSources);
          
          // 筛选和准备要获取的源
          const popularSources = sortedSources.filter(s => 
            ['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
          );
          
          // 去掉slice限制，获取所有其他来源
          const otherSources = sortedSources.filter(s => 
            !['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
          );
          
          const allSourcesToFetch = [...popularSources, ...otherSources];
          
          // 准备加载所有源的数据
          setLoadingSources(new Set(allSourcesToFetch.map(s => s.source_id)));
          
          // 2. 并行获取所有源的数据
          const newDataMap = {};
          await Promise.all(
            allSourcesToFetch.map(async (source) => {
              try {
                const response = await axios.get(`${API_URL}/external/source/${source.source_id}?limit=${displayCount}`);
                
                if (response.data) {
                  newDataMap[source.source_id] = response.data;
                  
                  // 实时更新UI，移除已加载的源
                  setSourceDataMap(prev => ({
                    ...prev,
                    [source.source_id]: response.data
                  }));
                  
                  setLoadingSources(prevState => {
                    const newSet = new Set(prevState);
                    newSet.delete(source.source_id);
                    return newSet;
                  });
                }
              } catch (err) {
                console.error(`Error fetching data for source ${source.source_id}:`, err);
                // 移除失败的源
                setLoadingSources(prevState => {
                  const newSet = new Set(prevState);
                  newSet.delete(source.source_id);
                  return newSet;
                });
              }
            })
          );
          
          // 最终更新所有数据
          setSourceDataMap(newDataMap);
          
          // 保存数据到缓存
          cacheUtils.saveToCache(CACHE_KEYS.SOURCE_DATA, newDataMap);
          
        } catch (err) {
          console.error('Error fetching data:', err);
          setError('获取数据失败，请稍后再试');
        } finally {
          setLoading(false);
          setRefreshing(false);
          setLoadingSources(new Set());
        }
      };
      
      fetchAllData();
    }, 0);
  };

  const toggleCategory = (category) => {
    if (category === 'all') {
      setSelectedCategories(['all']);
    } else {
      const newSelected = selectedCategories.includes('all') 
        ? [category]
        : selectedCategories.includes(category)
          ? selectedCategories.filter(c => c !== category)
          : [...selectedCategories, category];
      
      setSelectedCategories(newSelected.length === 0 ? ['all'] : newSelected);
    }
  };

  // Group sources by category
  const groupedSources = sources.reduce((acc, source) => {
    const { category } = source;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(source);
    return acc;
  }, {});

  // Get unique categories
  const categories = ['all', ...Object.keys(groupedSources)].sort();

  // Get filtered sources based on selected categories and search term
  const filteredSources = sources
    .filter(source => 
      selectedCategories.includes('all') || selectedCategories.includes(source.category)
    )
    .filter(source => 
      !searchTerm || source.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Get category display names
  const getCategoryName = (categoryKey) => {
    const categoryNames = {
      'all': '全部',
      'technology': '科技',
      'finance': '财经',
      'news': '新闻',
      'social': '社交',
      'search': '搜索',
      'video': '视频',
      'knowledge': '知识',
      'world': '国际',
      'entertainment': '娱乐',
      'sports': '体育'
    };
    
    return categoryNames[categoryKey] || categoryKey;
  };

  // Get source logo/background color
  const getSourceStyle = (sourceId) => {
    const sourceStyles = {
      'zhihu': {
        color: 'bg-blue-600',
        icon: '知',
        textColor: 'text-white'
      },
      'weibo': {
        color: 'bg-red-600',
        icon: '微',
        textColor: 'text-white'
      },
      'bilibili': {
        color: 'bg-pink-500',
        icon: 'B',
        textColor: 'text-white'
      },
      'baidu': {
        color: 'bg-blue-700',
        icon: '百',
        textColor: 'text-white'
      },
      'toutiao': {
        color: 'bg-red-500',
        icon: '头',
        textColor: 'text-white'
      },
      'douyin': {
        color: 'bg-black',
        icon: '抖',
        textColor: 'text-white'
      }
    };
    
    return sourceStyles[sourceId] || {
      color: 'bg-gray-200',
      icon: sourceId.substring(0, 1).toUpperCase(),
      textColor: 'text-gray-700'
    };
  };

  // 检查源是否正在加载中
  const isSourceLoading = (sourceId) => {
    return loadingSources.has(sourceId);
  };

  // 新增：计算所有新闻线索的热度分数（在所有新闻源中出现的频率）
  const calculateNewsHeat = useMemo(() => {
    if (Object.keys(sourceDataMap).length === 0) {
      return {};
    }

    console.log('计算热度分数...');
    
    // 1. 收集所有新闻
    const allNews = [];
    Object.values(sourceDataMap).forEach(sourceData => {
      if (sourceData.news && Array.isArray(sourceData.news)) {
        allNews.push(...sourceData.news);
      }
    });
    
    // 2. 对标题进行分词和处理（简单实现，仅示例）
    const processTitle = (title) => {
      return title
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留中文字符和英文字母数字
        .trim();
    };
    
    // 3. 创建标题关键词映射
    const titleKeywords = {};
    allNews.forEach(news => {
      if (news.title) {
        const processedTitle = processTitle(news.title);
        if (!titleKeywords[processedTitle]) {
          titleKeywords[processedTitle] = {
            newsId: news.id,
            count: 1, // 出现次数
            sources: new Set([news.source_id]), // 在哪些源中出现
          };
        } else {
          titleKeywords[processedTitle].count += 1;
          titleKeywords[processedTitle].sources.add(news.source_id);
        }
      }
    });
    
    // 4. 计算相似性和聚类（简化版，仅用于演示）
    // 在实际应用中，这里可以使用更复杂的算法，如余弦相似度、Jaccard相似系数等
    const similarity = (title1, title2) => {
      // 简单判断：如果两个标题有80%以上的相似，视为相同新闻
      const longer = title1.length >= title2.length ? title1 : title2;
      const shorter = title1.length >= title2.length ? title2 : title1;
      
      if (shorter.length === 0) return 0;
      
      // 检查一个字符串是否是另一个字符串的子串
      if (longer.includes(shorter)) return 1;
      
      // 简单计算部分匹配
      let matches = 0;
      const words1 = longer.split(/\s+/);
      const words2 = shorter.split(/\s+/);
      
      words2.forEach(word => {
        if (words1.includes(word)) matches++;
      });
      
      return matches / words2.length;
    };
    
    // 5. 合并相似新闻
    const processedTitles = Object.keys(titleKeywords);
    const clusters = [];
    
    processedTitles.forEach(title => {
      const item = titleKeywords[title];
      
      // 查找是否已有相似的标题簇
      let foundCluster = false;
      for (const cluster of clusters) {
        if (similarity(cluster.title, title) > 0.8) {
          // 合并到现有簇
          cluster.count += item.count;
          item.sources.forEach(source => cluster.sources.add(source));
          cluster.newsIds.push(item.newsId);
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        // 创建新簇
        clusters.push({
          title: title,
          count: item.count,
          sources: item.sources,
          newsIds: [item.newsId],
        });
      }
    });
    
    // 6. 计算最终热度分数
    const heatScores = {};
    const maxPossibleSources = sources.length; // 理论上最多可以出现在所有源中
    
    clusters.forEach(cluster => {
      const sourceCount = cluster.sources.size;
      const repeatCount = cluster.count;
      
      // 热度计算：(出现源数 / 总源数) * 70 + (重复次数 / 总源数) * 30
      // 结果是0-100的分数，但我们设置最小为10，给结果加上一些随机性
      let score = Math.floor((sourceCount / maxPossibleSources) * 70 + 
                   (repeatCount / maxPossibleSources) * 30);
      
      // 确保分数在10-100之间
      score = Math.max(10, Math.min(100, score));
      
      // 为所有相关的新闻ID设置相同的热度分数
      cluster.newsIds.forEach(newsId => {
        heatScores[newsId] = score;
      });
    });
    
    console.log(`计算了 ${Object.keys(heatScores).length} 个新闻热度分数`);
    
    // 保存到缓存
    try {
      localStorage.setItem(CACHE_KEYS.NEWS_HEAT_DATA, JSON.stringify(heatScores));
    } catch (err) {
      console.error('Error saving heat scores to cache:', err);
    }
    
    return heatScores;
  }, [sourceDataMap, sources.length]);
  
  // 更新热度分数
  useEffect(() => {
    if (Object.keys(sourceDataMap).length > 0) {
      // 尝试从缓存加载热度数据
      try {
        const cachedHeatMap = localStorage.getItem(CACHE_KEYS.NEWS_HEAT_DATA);
        if (cachedHeatMap && !isManualRefresh.current) {
          setNewsHeatMap(JSON.parse(cachedHeatMap));
        } else {
          // 如果没有缓存或手动刷新，计算新的热度分数
          setNewsHeatMap(calculateNewsHeat);
        }
      } catch (err) {
        console.error('Error loading heat scores from cache:', err);
        setNewsHeatMap(calculateNewsHeat);
      }
    }
  }, [calculateNewsHeat, sourceDataMap]);

  // 获取新闻热度分数
  const getNewsHeatScore = (newsId, defaultScore = 10) => {
    return newsHeatMap[newsId] || defaultScore;
  };

  // 获取热度等级文字描述
  const getHeatLevelText = (score) => {
    if (score >= 90) return '爆热';
    if (score >= 70) return '高热';
    if (score >= 50) return '热门';
    if (score >= 30) return '一般';
    return '冷门';
  };

  // 获取热度颜色类
  const getHeatColorClass = (score) => {
    if (score >= 90) return 'text-red-600';
    if (score >= 70) return 'text-orange-500';
    if (score >= 50) return 'text-yellow-500';
    if (score >= 30) return 'text-blue-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Filters & Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center text-gray-700 mr-1">
              <FiFilter className="mr-1.5" />
              <span className="font-medium">分类筛选:</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center whitespace-nowrap ${
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
          </div>
          
          <div className="flex space-x-2">
            <div className="relative flex-grow max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="搜索来源..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className={`px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center text-sm ${(refreshing || loading) ? 'opacity-50' : ''}`}
            >
              <FiRefreshCw className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>
      
      {/* Source Cards Grid */}
      {loading && sources.length === 0 ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      ) : error && sources.length === 0 ? (
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
      ) : filteredSources.length === 0 ? (
        <div className="bg-gray-50 text-gray-500 p-12 rounded-lg text-center shadow-sm">
          <div className="text-xl font-bold mb-2">未找到结果</div>
          <p>没有找到符合条件的热门内容，请调整筛选条件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSources.map(source => {
            // 判断源是否正在加载
            if (isSourceLoading(source.source_id)) {
              return (
                <SourceCardSkeleton key={`skeleton-${source.source_id}`} />
              );
            }
            
            const sourceData = sourceDataMap[source.source_id];
            if (!sourceData || !sourceData.news || sourceData.news.length === 0) {
              return null; // Skip sources with no data
            }
            
            const sourceStyle = getSourceStyle(source.source_id);
            
            return (
              <div key={source.source_id} className="bg-white shadow-sm rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-md ${sourceStyle.color} flex items-center justify-center font-bold ${sourceStyle.textColor} mr-3`}>
                      {sourceStyle.icon}
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-800">{source.name}</h2>
                      <p className="text-xs text-gray-500">{getCategoryName(source.category)}</p>
                    </div>
                  </div>
                  
                  <Link
                    to={`/hot-news/${source.source_id}`}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
                  >
                    详情 <FiExternalLink className="ml-1" />
                  </Link>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {sourceData.news.slice(0, displayCount).map((item, index) => (
                    <div key={item.id} className="p-3 hover:bg-gray-50">
                      <div className="flex">
                        <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-medium mr-2 mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 transition-colors"
                            >
                              {item.title}
                            </a>
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {item.published_at && (
                              <span className="flex items-center">
                                <FiClock className="mr-1" />
                                {formatDistanceToNow(new Date(item.published_at), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </span>
                            )}
                            
                            {item.extra?.metrics && (
                              <span className="flex items-center">
                                <FiTrendingUp className="mr-1 text-red-500" />
                                {item.extra.metrics}
                              </span>
                            )}
                            
                            <span className={`flex items-center ${getHeatColorClass(getNewsHeatScore(item.id))}`}>
                              <FiStar className="mr-1" />
                              热度 {getNewsHeatScore(item.id)} ({getHeatLevelText(getNewsHeatScore(item.id))})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {sourceData.news.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-lg font-medium mb-1">暂无数据</div>
                    <p className="text-sm">该来源暂无热门内容</p>
                  </div>
                )}
                
                {sourceData.news.length > 0 && (
                  <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                    <Link
                      to={`/hot-news/${source.source_id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center"
                    >
                      查看全部 <FiExternalLink className="ml-1" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HotRankings;