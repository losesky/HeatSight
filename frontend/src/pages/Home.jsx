import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiExternalLink, FiTrendingUp, FiClock, FiChevronRight } from 'react-icons/fi';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';
const POPULAR_SOURCES = ['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao'];
const DISPLAY_COUNT = 3; // Number of news items to display per source

const Home = () => {
  const [popularSourcesData, setPopularSourcesData] = useState({});
  const [trendingNews, setTrendingNews] = useState({
    hot_news: [],
    recommended_news: [],
    categories: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPopularSources();
    fetchTrendingNews();
  }, []);

  const fetchTrendingNews = async () => {
    try {
      // Fetch aggregated hot news from the hot endpoint
      const response = await axios.get(`${API_URL}/external/hot`, {
        params: {
          hot_limit: 10,
          recommended_limit: 5,
          category_limit: 5
        }
      });
      
      if (response.data) {
        setTrendingNews(response.data);
      }
    } catch (err) {
      console.error('Error fetching trending news:', err);
      // Don't set global error here as we still want to show other content
    }
  };

  const fetchPopularSources = async () => {
    setLoading(true);
    const dataMap = {};
    
    try {
      // Fetch all sources first to get their metadata
      // Use the correct API endpoint from the documentation
      const sourcesResponse = await axios.get(`${API_URL}/external/sources`);
      const allSources = sourcesResponse.data?.sources || [];
      
      // Filter to just the popular sources we want to display
      const sourcesToFetch = allSources.filter(s => POPULAR_SOURCES.includes(s.source_id));
      
      // Use Promise.all to fetch data for all sources in parallel
      await Promise.all(
        sourcesToFetch.map(async (source) => {
          try {
            // Use the correct API endpoint from the documentation
            const response = await axios.get(`${API_URL}/external/source/${source.source_id}?limit=${DISPLAY_COUNT}`);
            if (response.data) {
              dataMap[source.source_id] = {
                ...response.data,
                metadata: source // Store the source metadata
              };
            }
          } catch (err) {
            console.error(`Error fetching data for source ${source.source_id}:`, err);
            // Continue with other sources if one fails
          }
        })
      );
      
      setPopularSourcesData(dataMap);
    } catch (err) {
      console.error('Error fetching source data:', err);
      setError('获取热门数据失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

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
    };
    
    return categoryNames[categoryKey] || categoryKey;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Trending Section */}
      {trendingNews.hot_news.length > 0 && (
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">全网热点</h2>
            <Link 
              to="/hot-news" 
              className="text-blue-600 hover:text-blue-800 flex items-center"
            >
              查看更多 <FiChevronRight className="ml-1" />
            </Link>
          </div>
          
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100">
              {trendingNews.hot_news.slice(0, 5).map((item, index) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center h-6 w-6 bg-blue-100 text-blue-800 rounded-full mr-3 text-xs font-bold shrink-0">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <h3 className="font-medium text-gray-900">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-600"
                          >
                            {item.title}
                          </a>
                        </h3>
                        
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                            {item.source_name}
                          </span>
                          
                          {item.extra?.metrics && (
                            <span className="flex items-center">
                              <FiTrendingUp className="mr-1" />
                              {item.extra.metrics}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {item.summary && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">热门资讯</h1>
        <Link 
          to="/hot-news" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          查看全部热门资讯 <FiChevronRight className="ml-1" />
        </Link>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(popularSourcesData).map(([sourceId, sourceData]) => {
            if (!sourceData || !sourceData.news || sourceData.news.length === 0) {
              return null; // Skip sources with no data
            }
            
            const source = sourceData.metadata || sourceData.source;
            
            return (
              <div key={sourceId} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-gray-800">{source.name}</h2>
                    {source.category && (
                      <span className="text-xs text-gray-500">
                        {getCategoryName(source.category)}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/hot-news/${sourceId}`}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                  >
                    查看更多 <FiExternalLink className="ml-1" />
                  </Link>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {sourceData.news.slice(0, DISPLAY_COUNT).map((item, index) => (
                    <div key={item.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start">
                        <div className="flex items-center justify-center h-6 w-6 bg-blue-100 text-blue-800 rounded-full mr-3 text-xs font-bold shrink-0">
                          {index + 1}
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-blue-600"
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
                                <FiTrendingUp className="mr-1" />
                                {item.extra.metrics}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link 
          to="/hot-news" 
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          查看全部热门资讯
        </Link>
      </div>
    </div>
  );
};

export default Home; 