import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  FiTrendingUp, 
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

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

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

  // If we have a sourceId but the active tab is not detail, set it to detail
  if (sourceId && activeTab !== 'detail') {
    setActiveTab('detail');
  }
  
  const fetchHotNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/external/hot`, {
        params: {
          hot_limit: 50,
          recommended_limit: 10,
          category_limit: 10
        }
      });
      
      if (response.data) {
        setHotNews(response.data);
      }
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
    if (activeCategory === 'all') {
      return hotNews.hot_news || [];
    } else if (hotNews.categories && hotNews.categories[activeCategory]) {
      return hotNews.categories[activeCategory];
    }
    return [];
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
          {news.map((item, index) => (
            <div key={item.id} className="hover:bg-gray-50 transition-colors">
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
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSourceColor(item.category, item.source_name)}`}>
                          {item.source_name}
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
                      
                      {item.extra?.metrics && (
                        <span className="flex items-center">
                          <FiTrendingUp className="mr-1 text-red-500" />
                          热度 {item.extra.metrics}
                        </span>
                      )}
                      
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
          ))}
        </div>
      </div>
    );
  };
  
  const renderGridView = (news) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {news.map((item, index) => (
          <div key={item.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
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
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getSourceColor(item.category, item.source_name)}`}>
                        {item.source_name}
                      </span>
                      
                      {item.extra?.metrics && (
                        <span className="flex items-center text-xs text-gray-500">
                          <FiTrendingUp className="mr-1 text-red-500" />
                          {item.extra.metrics}
                        </span>
                      )}
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