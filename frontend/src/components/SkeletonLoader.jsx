import React from 'react';

// 话题骨架屏组件
export const TopicSkeleton = () => {
  return (
    <div className="p-4 flex animate-pulse">
      <div className="h-8 w-8 bg-gray-200 rounded-full mr-4 shrink-0"></div>
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="flex items-center space-x-4">
            <div className="h-4 bg-gray-200 rounded w-10"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mt-2"></div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
};

// 分类标签骨架屏
export const CategorySkeleton = () => {
  return (
    <div className="flex overflow-x-auto animate-pulse">
      <div className="px-4 py-2">
        <div className="h-5 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="px-4 py-2">
        <div className="h-5 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="px-4 py-2">
        <div className="h-5 bg-gray-200 rounded w-14"></div>
      </div>
      <div className="px-4 py-2">
        <div className="h-5 bg-gray-200 rounded w-18"></div>
      </div>
    </div>
  );
};

// 推荐内容卡片骨架屏
export const RecommendCardSkeleton = () => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-200"></div>
      <div className="p-4">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="flex items-center space-x-3">
            <div className="h-3 bg-gray-200 rounded w-8"></div>
            <div className="h-3 bg-gray-200 rounded w-8"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 新闻源卡片骨架屏组件
export const SourceCardSkeleton = () => {
  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden animate-pulse">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8 rounded-md bg-gray-200 mr-3"></div>
          <div>
            <div className="h-5 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div className="h-8 bg-gray-200 rounded-full w-16"></div>
      </div>
      
      {/* 内容部分 */}
      <div className="p-4">
        {/* 模拟5条新闻项目 */}
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex-shrink-0 h-4 w-4 rounded-full bg-gray-200 mr-2 mt-1"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="flex gap-2">
                <div className="h-3 bg-gray-200 rounded w-12"></div>
                <div className="h-3 bg-gray-200 rounded w-14"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 底部 */}
      <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
        <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
      </div>
    </div>
  );
}; 