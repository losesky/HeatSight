import React from 'react';
import { useQuery } from 'react-query';
import { FiTrendingUp, FiExternalLink, FiClock } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// API client will be implemented later
import { fetchHotTopics } from '../api/api';

const Dashboard = () => {
  const { data, isLoading, error } = useQuery('hotTopics', () => 
    fetchHotTopics({ hot_limit: 5, recommended_limit: 5, category_limit: 3 })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <h3 className="text-red-800 font-medium">获取热点数据失败</h3>
        <p className="text-red-700 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular topics */}
        <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">实时热点</h2>
            <a
              href="/hot-topics"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              查看全部
              <FiExternalLink className="ml-1" />
            </a>
          </div>

          <div className="space-y-4">
            {data?.hot_news?.slice(0, 5).map((item, index) => (
              <div
                key={item.id}
                className="flex items-start p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center h-8 w-8 bg-blue-100 text-blue-800 rounded-full mr-3 font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">
                    <a href={`/topic/${item.id}`} className="hover:text-blue-600">
                      {item.title}
                    </a>
                  </h3>
                  <div className="flex items-center text-sm text-gray-500">
                    <span>{item.source_id}</span>
                    <span className="mx-2">•</span>
                    <div className="flex items-center">
                      <FiClock className="mr-1" />
                      {item.published_at ? (
                        <span>
                          {formatDistanceToNow(new Date(item.published_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      ) : (
                        <span>未知时间</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">热门分类</h2>
          <div className="space-y-2">
            {Object.keys(data?.categories || {}).slice(0, 5).map((category) => (
              <a
                key={category}
                href={`/hot-topics?category=${category}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-700">{category}</span>
                <div className="flex items-center text-sm">
                  <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                    {data?.categories[category]?.length || 0} 条
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended topics */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">推荐内容</h2>
          <div className="text-sm text-gray-500">基于您的兴趣智能推荐</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.recommended_news?.slice(0, 6).map((item) => (
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
                  <span className="flex items-center text-gray-500">
                    <FiTrendingUp className="mr-1" />
                    热度 {item.extra?.heat || "-"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 