import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiExternalLink, FiTrendingUp, FiClock, FiChevronRight } from 'react-icons/fi';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// Update API URL to use the correct HeatLink endpoint
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const DISPLAY_COUNT = 5; // Number of news items to display per source

const Home = () => {
  const [popularSourcesData, setPopularSourcesData] = useState({});
  const [popularSources, setPopularSources] = useState([]); // State to store top 10 sources by weight
  const [sourcesMetadata, setSourcesMetadata] = useState([]); // State to store sources metadata
  const [sourceLoading, setSourceLoading] = useState({}); // Track loading state for each source
  const [initialLoading, setInitialLoading] = useState(true); // Only for initial sources list load
  const [error, setError] = useState(null);

  // Function to fetch news data for a specific source
  const fetchSourceData = useCallback(async (source) => {
    setSourceLoading(prev => ({ ...prev, [source.source_id]: true }));
    
    try {
      const response = await axios.get(`${API_URL}/external/source/${source.source_id}?limit=${DISPLAY_COUNT}`);
      if (response.data) {
        setPopularSourcesData(prev => ({
          ...prev,
          [source.source_id]: {
            ...response.data,
            metadata: source
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching data for source ${source.source_id}:`, err);
      // Don't set global error, just mark this source as loaded
    } finally {
      setSourceLoading(prev => ({ ...prev, [source.source_id]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Define fetchPopularSources first with useCallback - now just fetches metadata
  const fetchPopularSources = useCallback(async (sourcesList) => {
    try {
      // Fetch all sources first to get their metadata
      const sourcesResponse = await axios.get(`${API_URL}/external/sources`);
      const allSources = sourcesResponse.data?.sources || [];
      
      // Filter to just the popular sources we want to display
      const sourcesToFetch = allSources.filter(s => sourcesList.includes(s.source_id))
        // Sort sources to match the order in sourcesList
        .sort((a, b) => {
          const indexA = sourcesList.indexOf(a.source_id);
          const indexB = sourcesList.indexOf(b.source_id);
          return indexA - indexB;
        });
      
      // Set the sources metadata so we can render the framework
      setSourcesMetadata(sourcesToFetch);
      
      // Set initial loading to false once we have the sources metadata
      setInitialLoading(false);
      
      // Now fetch each source's data individually in parallel
      sourcesToFetch.forEach(source => {
        fetchSourceData(source);
      });
    } catch (err) {
      console.error('Error fetching source data:', err);
      setError('获取热门数据失败，请稍后再试');
      setInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSourceData]);

  // Now define fetchSourceWeights with fetchPopularSources in its dependencies
  const fetchSourceWeights = useCallback(async () => {
    try {
      // Use the heat-score/source-weights endpoint
      const response = await axios.get('http://127.0.0.1:8080/api/heat-score/source-weights');
      if (response.data && response.data.sources) {
        // Sort sources by weight in descending order and take top 10
        const sortedSources = response.data.sources
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 10)
          .map(source => source.source_id);
        
        setPopularSources(sortedSources);
        // After getting the source list, fetch their data
        fetchPopularSources(sortedSources);
      }
    } catch (err) {
      console.error('Error fetching source weights:', err);
      setError('获取热门站点列表失败，请稍后再试');
      setInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPopularSources]);

  useEffect(() => {
    fetchSourceWeights();
  }, [fetchSourceWeights]);

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

  // Helper to render news content or loading state for a source
  const renderNewsContent = (sourceId, sourceData) => {
    // If we don't have data yet for this source or it's loading
    if (!sourceData || !sourceData.news) {
      return (
        <div className="py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }
    
    // If there's no news items
    if (sourceData.news.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          暂无新闻
        </div>
      );
    }
    
    // Render the news items
    return (
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
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">热门站点</h1>
        <Link 
          to="/hot-news" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          查看全部热门资讯 <FiChevronRight className="ml-1" />
        </Link>
      </div>
      
      {initialLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        </div>
      ) : error && sourcesMetadata.length === 0 ? (
        <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sourcesMetadata.map((source) => (
            <div key={source.source_id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-gray-800">{source.name}</h2>
                  <div className="flex items-center gap-2">
                    {source.category && (
                      <span className="text-xs text-gray-500">
                        {getCategoryName(source.category)}
                      </span>
                    )}
                    {source.weight && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        权重: {source.weight}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/hot-news/${source.source_id}`}
                  className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                >
                  查看更多 <FiExternalLink className="ml-1" />
                </Link>
              </div>
              
              {renderNewsContent(source.source_id, popularSourcesData[source.source_id])}
            </div>
          ))}
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