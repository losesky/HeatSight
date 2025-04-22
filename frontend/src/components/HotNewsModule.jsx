import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FiExternalLink, 
  FiTrendingUp, 
  FiRefreshCw, 
  FiClock, 
  FiArrowLeft,
  FiEye,
  FiShare2,
  FiInfo,
  FiBookmark,
  FiBarChart2,
  FiStar
} from 'react-icons/fi';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { newsHeatApi } from '../api/api'; // Import the newsHeatApi service

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

const HotNewsModule = ({ initialSourceId }) => {
  const navigate = useNavigate(); // 添加导航钩子
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(initialSourceId || null);
  const [sourceData, setSourceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [renderingComplete, setRenderingComplete] = useState(true); // 控制渲染完成状态
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('ranking'); // 'ranking' or 'details'
  const [selectedItem, setSelectedItem] = useState(null);
  const [newsHeatMap, setNewsHeatMap] = useState({}); // Add newsHeatMap state
  
  // 用于追踪最新请求的引用
  const latestRequestRef = useRef(null);
  const lastRequestedSourceIdRef = useRef(null);

  // 调试日志，帮助确认initialSourceId是否正确传入
  useEffect(() => {
    console.log("HotNewsModule初始化，initialSourceId:", initialSourceId);
  }, [initialSourceId]);

  // Define fetchSourceData with useCallback
  const fetchSourceData = useCallback(async (sourceId) => {
    if (!sourceId) return;
    
    console.log("开始获取源数据，sourceId:", sourceId);
    
    // 保存当前请求的sourceId，用于后续比对
    lastRequestedSourceIdRef.current = sourceId;
    
    // 如果有正在进行的请求，取消它
    if (latestRequestRef.current) {
      console.log(`取消之前的请求 (${latestRequestRef.current.sourceId})`);
      latestRequestRef.current.cancel();
    }
    
    // 创建新的取消令牌
    const cancelTokenSource = axios.CancelToken.source();
    
    // 保存当前请求的信息，包括sourceId和取消函数
    latestRequestRef.current = {
      sourceId,
      cancel: cancelTokenSource.cancel
    };
    
    // 设置加载状态，但不清除现有数据
    setLoading(true);
    setRenderingComplete(false); // 标记渲染未完成
    setError(null);
    
    try {
      // 添加最小延迟以确保加载状态能够被用户看到
      const fetchPromise = axios.get(`${API_URL}/external/source/${sourceId}?limit=50`, {
        cancelToken: cancelTokenSource.token
      });
      const delayPromise = new Promise(resolve => setTimeout(resolve, 600)); // 600ms延迟
      
      // 同时等待数据获取和最小延迟
      const [response] = await Promise.all([fetchPromise, delayPromise]);
      
      // 检查这个响应是否是最近请求的sourceId的响应
      if (sourceId !== lastRequestedSourceIdRef.current) {
        console.log(`忽略过时的响应 (请求的: ${sourceId}, 最新的: ${lastRequestedSourceIdRef.current})`);
        return;
      }
      
      if (response.data) {
        // 设置新的数据
        console.log("获取源数据成功:", sourceId);
        setSourceData(response.data);
        
        // 延迟标记渲染完成，确保DOM已经更新
        setTimeout(() => {
          // 再次检查是否仍然是最近请求的sourceId
          if (sourceId !== lastRequestedSourceIdRef.current) {
            console.log(`忽略过时的渲染完成事件 (请求的: ${sourceId}, 最新的: ${lastRequestedSourceIdRef.current})`);
            return;
          }
          
          setLoading(false);
          // 额外延迟500ms再隐藏加载遮罩，确保内容已完全渲染
          setTimeout(() => {
            // 最后一次检查是否仍然是最近请求的sourceId
            if (sourceId !== lastRequestedSourceIdRef.current) {
              console.log(`忽略过时的渲染完成事件 (请求的: ${sourceId}, 最新的: ${lastRequestedSourceIdRef.current})`);
              return;
            }
            
            setRenderingComplete(true);
            console.log("渲染完成，隐藏加载遮罩:", sourceId);
          }, 500);
        }, 100);
        return; // 提前返回，不执行finally块
      }
    } catch (err) {
      // 忽略取消的请求错误
      if (axios.isCancel(err)) {
        console.log(`请求已取消 (${sourceId})`);
        return;
      }
      
      // 检查这个错误是否是最近请求的sourceId的错误
      if (sourceId !== lastRequestedSourceIdRef.current) {
        console.log(`忽略过时的错误 (请求的: ${sourceId}, 最新的: ${lastRequestedSourceIdRef.current})`);
        return;
      }
      
      console.error(`Error fetching data for source ${sourceId}:`, err);
      setError(`获取 ${sourceId} 数据失败，请稍后再试`);
      setLoading(false);
      setRenderingComplete(true);
    }
  }, []);

  // Define fetchSources with useCallback
  const fetchSources = useCallback(async () => {
    try {
      // 标记为初始化加载
      const requestId = 'initial-load';
      
      // 保存当前请求的ID
      lastRequestedSourceIdRef.current = requestId;
      
      // 如果有正在进行的请求，取消它
      if (latestRequestRef.current) {
        console.log(`取消之前的请求 (${latestRequestRef.current.sourceId})`);
        latestRequestRef.current.cancel();
      }
      
      // 创建新的取消令牌
      const cancelTokenSource = axios.CancelToken.source();
      
      // 保存当前请求的信息
      latestRequestRef.current = {
        sourceId: requestId,
        cancel: cancelTokenSource.cancel
      };
      
      setLoading(true);
      setRenderingComplete(false); // 设置渲染未完成
      
      // Use the correct API endpoint from the documentation
      const response = await axios.get(`${API_BASE_URL}/heat-score/source-weights`, {
        cancelToken: cancelTokenSource.token
      });
      
      // 检查是否仍然是初始加载请求
      if (requestId !== lastRequestedSourceIdRef.current) {
        console.log(`忽略过时的初始加载响应 (当前最新: ${lastRequestedSourceIdRef.current})`);
        return;
      }
      
      if (response.data && response.data.sources) {
        // 首先按权重降序排序，相同权重时再按分类和名称排序
        const sortedSources = response.data.sources.sort((a, b) => {
          // 首先按权重降序排序
          if (b.weight !== a.weight) {
            return b.weight - a.weight;
          }
          // 权重相同时，按分类排序
          if (a.category === b.category) {
            return a.name.localeCompare(b.name);
          }
          return a.category.localeCompare(b.category);
        });
        
        setSources(sortedSources);
        
        // 加载源列表后，检查是否有initialSourceId，如果有直接加载该源的数据
        if (initialSourceId) {
          console.log("已有initialSourceId，立即加载该源数据:", initialSourceId);
          // 这里不依赖selectedSource状态，直接使用initialSourceId确保加载
          fetchSourceData(initialSourceId);
          return; // 不再设置loading和renderingComplete，由fetchSourceData处理
        }
        // Select the first source by default if no initialSourceId is provided
        else if (sortedSources.length > 0 && !selectedSource) {
          const firstSourceId = sortedSources[0].source_id;
          console.log("使用第一个源作为默认值:", firstSourceId);
          setSelectedSource(firstSourceId);
          fetchSourceData(firstSourceId);
          return; // 不再设置loading和renderingComplete，由fetchSourceData处理
        }
      }
      
      // 只有在不调用fetchSourceData的情况下才结束加载状态
      setLoading(false);
      // 延迟设置渲染完成，确保界面更新
      setTimeout(() => {
        // 再次检查是否仍然是初始加载请求
        if (requestId !== lastRequestedSourceIdRef.current) {
          console.log(`忽略过时的初始加载渲染完成事件 (当前最新: ${lastRequestedSourceIdRef.current})`);
          return;
        }
        
        setRenderingComplete(true);
      }, 300);
      
    } catch (err) {
      // 忽略取消的请求错误
      if (axios.isCancel(err)) {
        console.log(`初始加载请求已取消`);
        return;
      }
      
      console.error('Error fetching sources:', err);
      setError('获取新闻源失败，请稍后再试');
      setLoading(false);
      setRenderingComplete(true);
    }
  }, [fetchSourceData, initialSourceId, selectedSource]);

  // Fetch available sources on component mount
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // When initialSourceId prop changes, update selectedSource and fetch data
  useEffect(() => {
    console.log("initialSourceId变化检测:", initialSourceId, "当前选中:", selectedSource);
    if (initialSourceId && initialSourceId !== selectedSource) {
      console.log("initialSourceId发生变化，更新选中源为:", initialSourceId);
      setSelectedSource(initialSourceId);
      setViewMode('ranking'); // Reset view mode when source changes
      setSelectedItem(null); // Clear selected item
      // 直接获取新源的数据，不等待状态更新
      fetchSourceData(initialSourceId);
    }
  }, [initialSourceId, selectedSource, fetchSourceData]);

  // When source data is loaded, fetch heat scores
  useEffect(() => {
    if (sourceData && sourceData.news && sourceData.news.length > 0) {
      const fetchHeatScores = async () => {
        try {
          // Get all news IDs from the source data
          const newsIds = sourceData.news.map(item => item.id);
          
          // Fetch heat scores from the API
          const response = await newsHeatApi.getHeatScores(newsIds);
          if (response && response.heat_scores) {
            setNewsHeatMap(response.heat_scores);
            console.log(`从API获取了${Object.keys(response.heat_scores).length}条热度数据`);
          }
        } catch (error) {
          console.error('获取热度分数失败:', error);
        }
      };
      
      fetchHeatScores();
    }
  }, [sourceData]);

  const handleRefresh = async () => {
    if (!selectedSource) return;
    
    setRefreshing(true);
    setRenderingComplete(false); // 设置渲染未完成
    try {
      await fetchSourceData(selectedSource);
      // fetchSourceData 会负责设置 loading 和 renderingComplete 状态
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

  // 在源列表项的onClick处理中更新源
  const handleSourceChange = (sourceId) => {
    // 如果点击的是当前已选中的源，不做任何操作
    if (sourceId === selectedSource) return;
    
    console.log("切换到新的数据源:", sourceId);
    
    // 更新选中的源，但保留旧数据直到新数据加载完成
    setSelectedSource(sourceId);
    
    // 重置其他状态，但保留现有sourceData
    setViewMode('ranking');
    setSelectedItem(null);
    setError(null);
    
    // 手动设置加载状态，确保遮罩层显示
    setLoading(true);
    setRenderingComplete(false); // 设置渲染未完成
    
    // 使用replace选项更新URL，避免在历史记录中堆积过多条目
    navigate(`/hot-news/${sourceId}`, { replace: true });
    
    // 获取新源的数据，加载状态会在fetchSourceData内设置
    // 此时旧数据仍然可见，但会有半透明遮罩表示正在加载
    fetchSourceData(sourceId);
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

  // Get heat score for a news item
  const getNewsHeatScore = (newsId, defaultScore = 10) => {
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
              
              <span className="flex items-center text-sm text-gray-500">
                <FiEye className="mr-1.5 text-blue-500" />
                浏览: {Math.floor(Math.random() * 90000) + 10000}
              </span>
              
              {/* Add real heat score display */}
              <span className={`flex items-center text-sm ${getHeatColorClass(getNewsHeatScore(selectedItem.id))}`}>
                <FiStar className="mr-1.5" />
                热度 {Math.round(getNewsHeatScore(selectedItem.id))}
                {getHeatLevelText(getNewsHeatScore(selectedItem.id)) && ` (${getHeatLevelText(getNewsHeatScore(selectedItem.id))})`}
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
                        <span className={`flex items-center mr-3 ${getHeatColorClass(getNewsHeatScore(item.id))}`}>
                          <FiStar className="mr-1" />
                          热度 {Math.round(getNewsHeatScore(item.id))}
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
                      onClick={() => handleSourceChange(source.source_id)}
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
        <div className="w-3/4 overflow-y-auto relative">
          {(loading || !renderingComplete) && (
            <div className="absolute inset-0 bg-white bg-opacity-70 backdrop-blur-sm z-10 flex justify-center items-center transition-all duration-300 ease-in-out">
              <div className="flex items-center bg-white p-5 rounded-xl shadow-lg">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mr-3"></div>
                <span className="text-gray-700 font-medium">正在加载内容...</span>
              </div>
            </div>
          )}
          
          {error && !sourceData ? (
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
            <div className="opacity-100 transition-all transform duration-300 ease-in-out">
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
                          
                          <span className={`flex items-center ${getHeatColorClass(getNewsHeatScore(item.id))}`}>
                            <FiStar className="mr-1" />
                            热度 {Math.round(getNewsHeatScore(item.id))}
                            {getHeatLevelText(getNewsHeatScore(item.id)) && ` (${getHeatLevelText(getNewsHeatScore(item.id))})`}
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
          ) : selectedSource ? (
            // 已经选择了源但数据还未加载完成
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
              <p className="text-lg font-medium">正在加载数据...</p>
              <p className="text-sm mt-2">请稍候，正在获取来源内容</p>
            </div>
          ) : (
            // 还没有选择源
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