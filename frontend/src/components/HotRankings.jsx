import React, { useState, useEffect, useCallback } from 'react';
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

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

const HotRankings = () => {
  const [sources, setSources] = useState([]);
  const [sourceDataMap, setSourceDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const displayCount = 5; // Number of news items to display per source

  // Define fetchAllSourceData with useCallback to avoid infinite loops
  const fetchAllSourceData = useCallback(async () => {
    setLoading(true);
    const dataMap = {};
    
    // Get popular sources first (limit to prevent too many concurrent requests)
    const popularSources = sources.filter(s => 
      ['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
    );
    
    // Then other sources
    const otherSources = sources.filter(s => 
      !['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'].includes(s.source_id)
    ).slice(0, 15); // Limit to 15 other sources to prevent too many requests
    
    const allSourcesToFetch = [...popularSources, ...otherSources];
    
    try {
      // Use Promise.all to fetch data for all sources in parallel
      await Promise.all(
        allSourcesToFetch.map(async (source) => {
          try {
            // Use the correct API endpoint from the documentation
            const response = await axios.get(`${API_URL}/external/source/${source.source_id}?limit=${displayCount}`);
            if (response.data) {
              dataMap[source.source_id] = response.data;
            }
          } catch (err) {
            console.error(`Error fetching data for source ${source.source_id}:`, err);
            // Continue with other sources if one fails
          }
        })
      );
      
      setSourceDataMap(dataMap);
    } catch (err) {
      console.error('Error fetching source data:', err);
      setError('获取新闻数据失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [sources, displayCount]);

  // Fetch available sources on component mount
  useEffect(() => {
    fetchSources();
  }, []);

  // Fetch source data for each source
  useEffect(() => {
    if (sources.length > 0) {
      fetchAllSourceData();
    }
  }, [sources, fetchAllSourceData]);

  const fetchSources = async () => {
    try {
      setLoading(true);
      // Use the correct API endpoint from the documentation
      const response = await axios.get(`${API_URL}/external/sources`);
      
      if (response.data && response.data.sources) {
        // Sort sources by category
        const sortedSources = response.data.sources.sort((a, b) => {
          if (a.category === b.category) {
            return a.name.localeCompare(b.name);
          }
          return a.category.localeCompare(b.category);
        });
        
        setSources(sortedSources);
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
      setError('获取新闻源失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllSourceData();
    } finally {
      setRefreshing(false);
    }
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
              disabled={refreshing}
              className={`px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center text-sm ${refreshing ? 'opacity-50' : ''}`}
            >
              <FiRefreshCw className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>
      
      {/* Source Cards Grid */}
      {loading && !refreshing ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      ) : error ? (
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
                    <div key={item.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-3">
                          <div className={`flex items-center justify-center h-5 w-5 rounded-full ${
                            index === 0 ? 'bg-red-500' : 
                            index === 1 ? 'bg-orange-500' : 
                            index === 2 ? 'bg-yellow-500' : 
                            'bg-gray-400'
                          } text-white text-xs font-bold`}>
                            {index + 1}
                          </div>
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
                            
                            <span className="flex items-center">
                              <FiStar className="mr-1 text-yellow-500" />
                              热度 {Math.floor(Math.random() * 90) + 10}
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