import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiExternalLink, 
  FiTrendingUp, 
  FiRefreshCw, 
  FiClock, 
  FiArrowLeft,
  FiEye,
  FiMessageCircle,
  FiLink,
  FiShare2,
  FiInfo,
  FiBookmark,
  FiBarChart2
} from 'react-icons/fi';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Link } from 'react-router-dom';

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const HotNewsModule = ({ initialSourceId }) => {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(initialSourceId || null);
  const [sourceData, setSourceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('ranking'); // 'ranking' or 'details'
  const [selectedItem, setSelectedItem] = useState(null);

  // Define fetchSourceData with useCallback
  const fetchSourceData = useCallback(async (sourceId) => {
    try {
      setLoading(true);
      // Use the correct API endpoint from the documentation
      const response = await axios.get(`${API_URL}/external/source/${sourceId}?limit=50`);
      
      if (response.data) {
        setSourceData(response.data);
      }
    } catch (err) {
      console.error(`Error fetching data for source ${sourceId}:`, err);
      setError(`获取 ${sourceId} 数据失败，请稍后再试`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Define fetchSources with useCallback
  const fetchSources = useCallback(async () => {
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
        
        // Select the first source by default if no initialSourceId is provided
        if (sortedSources.length > 0 && !selectedSource) {
          setSelectedSource(sortedSources[0].source_id);
        }
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
      setError('获取新闻源失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [selectedSource]);

  // Fetch available sources on component mount
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // When initialSourceId prop changes, update selectedSource
  useEffect(() => {
    if (initialSourceId && initialSourceId !== selectedSource) {
      setSelectedSource(initialSourceId);
      setViewMode('ranking'); // Reset view mode when source changes
      setSelectedItem(null); // Clear selected item
    }
  }, [initialSourceId, selectedSource]);

  // When a source is selected, fetch its data
  useEffect(() => {
    if (selectedSource) {
      fetchSourceData(selectedSource);
    }
  }, [selectedSource, fetchSourceData]);

  const handleRefresh = async () => {
    if (!selectedSource) return;
    
    setRefreshing(true);
    try {
      await fetchSourceData(selectedSource);
    } finally {
      setRefreshing(false);
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setViewMode('details');
  };

  const handleBackToRanking = () => {
    setViewMode('ranking');
    setSelectedItem(null);
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

  // Get category display names
  const getCategoryName = (categoryKey) => {
    const categoryNames = {
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

  // Get a different icon for news types
  const getNewsTypeIcon = (index) => {
    const icons = [
      <FiTrendingUp className="mr-1 text-red-500" />,
      <FiEye className="mr-1 text-blue-500" />,
      <FiMessageCircle className="mr-1 text-green-500" />,
      <FiLink className="mr-1 text-purple-500" />
    ];
    return icons[index % icons.length];
  };

  // Get source color
  const getSourceColor = (sourceId) => {
    const colors = {
      'zhihu': 'bg-blue-600 text-white',
      'weibo': 'bg-red-600 text-white',
      'bilibili': 'bg-pink-500 text-white',
      'baidu': 'bg-blue-700 text-white',
      'toutiao': 'bg-red-500 text-white',
      'douyin': 'bg-black text-white'
    };
    
    return colors[sourceId] || 'bg-gray-200 text-gray-700';
  };

  // Get source logo
  const getSourceLogo = (sourceId, name) => {
    // You could replace this with actual logos
    return (
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${getSourceColor(sourceId)}`}>
        {name?.substring(0, 1) || sourceId?.substring(0, 1)?.toUpperCase() || '?'}
      </div>
    );
  };

  if (loading && !sourceData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error && !sourceData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center text-red-600 p-8 bg-red-50 rounded-lg">
          <div className="text-xl font-bold mb-2">数据获取失败</div>
          <p>{error}</p>
          <button 
            onClick={() => fetchSourceData(selectedSource)}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'details' && selectedItem) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Article Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <div className="flex items-center">
            <button 
              onClick={handleBackToRanking}
              className="mr-3 text-gray-600 hover:text-blue-600 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              title="返回列表"
            >
              <FiArrowLeft />
            </button>
            <h2 className="text-lg font-bold text-gray-800 line-clamp-1">
              {selectedItem.title}
            </h2>
          </div>
          
          <div className="flex space-x-2">
            <Link 
              to="/hot-news"
              className="text-gray-600 hover:text-gray-800 p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              返回热门聚合
            </Link>
          </div>
        </div>
        
        {/* Article Content */}
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">{selectedItem.title}</h1>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
              <div className="flex items-center">
                {getSourceLogo(sourceData?.source?.source_id, sourceData?.source?.name)}
                <span className="ml-2 font-medium">{sourceData?.source?.name}</span>
              </div>
              
              {selectedItem.published_at && (
                <span className="flex items-center text-sm text-gray-500">
                  <FiClock className="mr-1.5" />
                  {formatDistanceToNow(new Date(selectedItem.published_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              )}
              
              {selectedItem.extra?.metrics && (
                <span className="flex items-center text-sm text-gray-500">
                  <FiTrendingUp className="mr-1.5 text-red-500" />
                  热度: {selectedItem.extra.metrics}
                </span>
              )}
              
              <span className="flex items-center text-sm text-gray-500">
                <FiEye className="mr-1.5 text-blue-500" />
                浏览: {Math.floor(Math.random() * 90000) + 10000}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
              <a 
                href={selectedItem.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center transition-colors"
              >
                <FiExternalLink className="mr-2" />
                查看原文
              </a>
              
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md flex items-center transition-colors">
                <FiBookmark className="mr-2" />
                收藏
              </button>
              
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md flex items-center transition-colors">
                <FiShare2 className="mr-2" />
                分享
              </button>
            </div>
            
            {selectedItem.summary && (
              <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                  <FiInfo className="mr-2 text-blue-500" />
                  内容摘要
                </h3>
                <p className="text-gray-700 leading-relaxed">{selectedItem.summary}</p>
              </div>
            )}
            
            {selectedItem.tags && selectedItem.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                  <FiBarChart2 className="mr-2 text-blue-500" />
                  相关标签
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map(tag => (
                    <span key={tag} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-sm hover:bg-gray-200 cursor-pointer transition-colors">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FiTrendingUp className="mr-2 text-red-500" />
              相关热点
            </h3>
            
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              {sourceData?.news?.filter(item => item.id !== selectedItem.id).slice(0, 5).map((item, index) => (
                <div 
                  key={item.id} 
                  className="border-b border-gray-100 last:border-b-0 hover:bg-white transition-colors cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="p-3 flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      <div className={`flex items-center justify-center h-6 w-6 rounded-full ${
                        index === 0 ? 'bg-red-500' : 
                        index === 1 ? 'bg-orange-500' : 
                        index === 2 ? 'bg-yellow-500' : 
                        'bg-gray-400'
                      } text-white text-xs font-bold`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm mb-1 hover:text-blue-600 transition-colors line-clamp-2">
                        {item.title}
                      </h4>
                      
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="flex items-center mr-3">
                          <FiTrendingUp className="mr-1 text-red-500" />
                          {item.extra?.metrics || "热度"}
                        </span>
                        
                        {item.published_at && (
                          <span className="flex items-center">
                            <FiClock className="mr-1" />
                            {formatDistanceToNow(new Date(item.published_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        {sourceData?.source && (
          <div className="flex items-center">
            {getSourceLogo(sourceData.source.source_id, sourceData.source.name)}
            <div className="ml-3">
              <h2 className="text-xl font-bold text-gray-800">{sourceData.source.name}</h2>
              <div className="flex items-center mt-1">
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-md mr-2">
                  {getCategoryName(sourceData.source.category)}
                </span>
                <span className="text-xs text-gray-500">
                  {sourceData.news?.length || 0} 条热门内容
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <button 
            className={`text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors ${refreshing ? 'opacity-70' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <FiRefreshCw className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          
          <Link 
            to="/hot-news"
            className="text-gray-600 hover:text-gray-800 flex items-center bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors"
          >
            <FiArrowLeft className="mr-1.5" />
            返回
          </Link>
        </div>
      </div>
      
      <div className="flex h-[650px]">
        {/* Source List */}
        <div className="w-1/4 border-r border-gray-200 overflow-y-auto bg-gray-50 p-3">
          <div className="sticky top-0 bg-gray-50 pb-2 mb-2 border-b border-gray-200">
            <h3 className="font-bold text-gray-700 px-2 py-1">热门来源</h3>
          </div>
          
          {Object.entries(groupedSources).map(([category, categorySources]) => (
            <div key={category} className="mb-4">
              <h3 className="font-medium text-xs text-gray-500 px-2 py-1 uppercase">{getCategoryName(category)}</h3>
              <ul className="space-y-1">
                {categorySources.map(source => (
                  <li key={source.source_id}>
                    <button
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center transition-colors ${
                        selectedSource === source.source_id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => setSelectedSource(source.source_id)}
                    >
                      <div className={`h-5 w-5 rounded flex items-center justify-center text-xs mr-2 ${getSourceColor(source.source_id)}`}>
                        {source.name.substring(0, 1)}
                      </div>
                      <span className="truncate">{source.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* News Content */}
        <div className="w-3/4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-600 p-8 bg-red-50 m-4 rounded-lg">
              <div className="text-xl font-bold mb-2">数据获取失败</div>
              <p>{error}</p>
              <button 
                onClick={() => fetchSourceData(selectedSource)}
                className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                重试
              </button>
            </div>
          ) : sourceData ? (
            <div>
              {sourceData.source.description && (
                <div className="m-4 p-4 bg-gray-50 border border-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600">{sourceData.source.description}</p>
                </div>
              )}
              
              <div className="divide-y divide-gray-100">
                {sourceData.news.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mr-4">
                        <div className={`flex items-center justify-center h-7 w-7 rounded-full ${
                          index === 0 ? 'bg-red-500' : 
                          index === 1 ? 'bg-orange-500' : 
                          index === 2 ? 'bg-yellow-500' : 
                          'bg-gray-400'
                        } text-white text-sm font-bold`}>
                          {index + 1}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors line-clamp-2">
                          {item.title}
                        </h4>
                        
                        {item.summary && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {item.summary}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
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
                              热度 {item.extra.metrics}
                            </span>
                          )}

                          <span className="flex items-center">
                            {getNewsTypeIcon(index)}
                            {Math.floor(Math.random() * 9000) + 1000}
                          </span>
                          
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-700 ml-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FiExternalLink className="mr-1" />
                            原文
                          </a>
                        </div>
                        
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                #{tag}
                              </span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                +{item.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {sourceData.news.length === 0 && (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                  <FiInfo className="h-12 w-12 mb-4 text-gray-400" />
                  <p className="text-lg font-medium">暂无热门内容</p>
                  <p className="text-sm mt-2">该来源当前没有可显示的热门内容</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FiInfo className="h-12 w-12 mb-4 text-gray-400" />
              <p className="text-lg font-medium">请选择一个新闻源</p>
              <p className="text-sm mt-2">从左侧列表中选择一个新闻源查看其热门内容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotNewsModule; 