import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FiFilter, FiRefreshCw, FiClock, FiBarChart2, 
  FiThumbsUp, FiMessageSquare, FiEye
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 使用自定义hooks
import { useHotTopics, useCategories, useInvalidateTopics } from '../hooks';
// 导入骨架屏组件
import { TopicSkeleton, CategorySkeleton, RecommendCardSkeleton } from '../components/SkeletonLoader';

const HotTopics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  // Get filter values from URL or use defaults
  const [activeCategory, setActiveCategory] = useState(
    searchParams.get('category') || 'all'
  );
  
  // 使用自定义hooks获取分类
  const { 
    data: categoriesData, 
    isLoading: isCategoriesLoading 
  } = useCategories();
  
  // 使用自定义hooks获取热门话题
  const { 
    data, 
    isLoading, 
    isFetching,
    error,
    refetch
  } = useHotTopics({ 
    hot_limit: 20, 
    recommended_limit: 10, 
    category_limit: 10,
    category: activeCategory === 'all' ? undefined : activeCategory
  });

  // 获取缓存失效函数
  const { invalidateHotTopics } = useInvalidateTopics();

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') {
      params.set('category', activeCategory);
    }
    
    const newSearch = params.toString();
    if (newSearch !== location.search.replace(/^\?/, '')) {
      navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
  }, [activeCategory, navigate, location.search]);

  // Handle filter changes
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  // Handle refresh
  const handleRefresh = () => {
    // 使用invalidateHotTopics使缓存失效，然后重新获取数据
    invalidateHotTopics().then(() => refetch());
  };

  // 获取展示的话题数据
  const getDisplayTopics = () => {
    if (!data) return [];
    
    if (activeCategory === 'all') {
      return data.hot_news || [];
    } else {
      return data.categories?.[activeCategory] || [];
    }
  };

  // 是否显示骨架屏：首次加载显示骨架屏，后续更新时使用以前的数据
  const showSkeleton = isLoading && !data;
  // 是否在更新中：数据已有但在刷新
  const isUpdating = isFetching && !isLoading;

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <h3 className="text-red-800 font-medium">获取热点数据失败</h3>
        <p className="text-red-700 mt-1">{error.message}</p>
      </div>
    );
  }

  // 获取分类数据
  const categories = categoriesData?.categories || [];

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">热点雷达</h1>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            className={`flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md ${
              isLoading || isFetching 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gray-50'
            }`}
          >
            <FiRefreshCw className={`mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? '刷新中...' : '刷新'}
          </button>
          
          <div className="relative">
            <button className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              <FiFilter className="mr-2" />
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {isCategoriesLoading ? (
            <CategorySkeleton />
          ) : (
            <>
              <button
                onClick={() => handleCategoryChange('all')}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                全部
              </button>
              
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryChange(cat.name)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeCategory === cat.name
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Hot topics list */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">热门话题</h2>
          {isUpdating && (
            <span className="text-xs text-blue-500 flex items-center">
              <FiRefreshCw className="mr-1 animate-spin" /> 
              正在刷新...
            </span>
          )}
        </div>
        
        <div className="divide-y">
          {showSkeleton ? (
            // 显示骨架屏
            Array(8).fill(0).map((_, index) => (
              <TopicSkeleton key={index} />
            ))
          ) : (
            // 显示实际数据
            getDisplayTopics().map((item, index) => (
              <div key={item.id} className="p-4 flex hover:bg-gray-50">
                <div className="flex items-center justify-center h-8 w-8 bg-blue-100 text-blue-800 rounded-full mr-4 font-bold shrink-0">
                  {index + 1}
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="font-medium text-gray-900">
                      <a href={`/topic/${item.id}`} className="hover:text-blue-600">
                        {item.title}
                      </a>
                    </h3>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <FiEye className="mr-1" />
                        {item.view_count || 0}
                      </span>
                      
                      <span className="flex items-center">
                        <FiBarChart2 className="mr-1" />
                        热度 {item.extra?.heat ? Math.round(item.extra.heat) : "-"}
                      </span>
                    </div>
                  </div>
                  
                  {item.summary && (
                    <p className="mt-1 text-sm text-gray-600">
                      {item.summary}
                    </p>
                  )}
                  
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500">
                      {item.source_id}
                    </span>
                    
                    <span className="flex items-center text-gray-500">
                      <FiClock className="mr-1" />
                      {item.published_at ? (
                        formatDistanceToNow(new Date(item.published_at), {
                          addSuffix: true,
                          locale: zhCN,
                        })
                      ) : (
                        "未知时间"
                      )}
                    </span>
                    
                    {item.category && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
            
          {/* Empty state */}
          {!isLoading && (!data?.hot_news || getDisplayTopics().length === 0) && (
            <div className="p-8 text-center text-gray-500">
              没有找到相关热点话题
            </div>
          )}
        </div>
      </div>

      {/* Recommended topics */}
      {data?.recommended_news && data.recommended_news.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">推荐话题</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {showSkeleton ? (
              // 显示骨架屏
              Array(6).fill(0).map((_, index) => (
                <RecommendCardSkeleton key={index} />
              ))
            ) : (
              // 显示实际数据
              data.recommended_news.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {item.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      <a href={`/topic/${item.id}`} className="hover:text-blue-600">
                        {item.title}
                      </a>
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {item.summary || "无描述信息"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.source_id}</span>
                      <div className="flex items-center space-x-3 text-gray-500">
                        <span className="flex items-center">
                          <FiThumbsUp className="mr-1" />
                          {item.extra?.likes || 0}
                        </span>
                        <span className="flex items-center">
                          <FiMessageSquare className="mr-1" />
                          {item.extra?.comments || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HotTopics; 