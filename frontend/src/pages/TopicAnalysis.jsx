import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { 
  FiExternalLink, FiClock, FiBarChart2, FiMessageSquare, 
  FiShare2, FiBookmark, FiTrendingUp, FiLayers, 
  FiZap, FiActivity
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// API methods will be implemented later
import { fetchTopicById, fetchRelatedTopics } from '../api/api';

const TopicAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analysis');
  
  // 跳转到话题解构页面
  const handleDecomposeTopic = () => {
    navigate(`/topic/${id}/decompose`);
  };

  // 跳转到内容工坊页面
  const handleGoToContentWorkshop = () => {
    navigate(`/content-workshop`);
  };

  // Fetch topic details
  const { 
    data: topic, 
    isLoading, 
    error 
  } = useQuery(['topic', id], () => fetchTopicById(id));

  // Fetch related topics
  const { 
    data: relatedTopics 
  } = useQuery(['relatedTopics', id], () => fetchRelatedTopics(id), {
    enabled: !!topic,
  });

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
        <h3 className="text-red-800 font-medium">获取话题详情失败</h3>
        <p className="text-red-700 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topic header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-x-2">
              {topic?.category && (
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                  {topic.category}
                </span>
              )}
              <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
                热度分析
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="text-gray-500 hover:text-blue-600">
                <FiBookmark />
              </button>
              <button className="text-gray-500 hover:text-blue-600">
                <FiShare2 />
              </button>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900">{topic?.title}</h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span>{topic?.source_name}</span>
            
            <span className="flex items-center">
              <FiClock className="mr-1" />
              {topic?.published_at ? (
                formatDistanceToNow(new Date(topic.published_at), {
                  addSuffix: true,
                  locale: zhCN,
                })
              ) : (
                "未知时间"
              )}
            </span>
            
            {topic?.url && (
              <a 
                href={topic.url} 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                <FiExternalLink className="mr-1" />
                查看原文
              </a>
            )}
          </div>
          
          {/* 添加话题解构和内容创作按钮 */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              onClick={handleDecomposeTopic}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <FiLayers className="mr-2" />
              深度话题解构
            </button>
            
            <button
              onClick={handleGoToContentWorkshop}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <FiZap className="mr-2" />
              内容创作工坊
            </button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white shadow rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'analysis'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  基础解析
                </button>
                <button
                  onClick={() => setActiveTab('content')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'content'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  内容推荐
                </button>
                <button
                  onClick={() => setActiveTab('trends')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'trends'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  趋势分析
                </button>
              </nav>
            </div>
            
            <div className="p-6">
              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <FiActivity className="mr-2" />
                    话题概览
                  </h2>
                  
                  {topic?.summary && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700">{topic.summary}</p>
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-800">话题要点</h3>
                      <button 
                        onClick={handleDecomposeTopic}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        查看完整解构
                        <FiExternalLink className="ml-1" />
                      </button>
                    </div>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                      {/* Placeholder for subtopics */}
                      {['行业影响', '政策解读', '市场反应', '未来趋势'].map((subtopic) => (
                        <div key={subtopic} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md">
                          <h4 className="font-medium text-gray-900">{subtopic}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            这里将展示与"{subtopic}"相关的内容...
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'content' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">内容创作建议</h2>
                    <button 
                      onClick={handleGoToContentWorkshop}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      前往内容工坊
                      <FiExternalLink className="ml-1" />
                    </button>
                  </div>
                  <p className="text-gray-700 mb-4">基于此话题的热度和用户关注点，我们生成了以下内容创作建议：</p>
                  <div className="space-y-3">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                      <h3 className="font-medium text-green-800">推荐标题</h3>
                      <p className="text-green-700 mt-1">《{topic?.title}》最新解析：5个你不容错过的关键点</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <h3 className="font-medium text-blue-800">推荐角度</h3>
                      <ul className="list-disc list-inside text-blue-700 mt-1">
                        <li>深度分析背后原因</li>
                        <li>对比不同观点</li>
                        <li>探讨未来发展趋势</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'trends' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">趋势分析</h2>
                  <div className="bg-gray-50 p-4 rounded-lg text-center mb-4">
                    <p className="text-gray-700">话题热度趋势图表将在这里显示</p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>预计热度持续时间:</span>
                    <span className="font-medium">3-5天</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>最佳内容发布窗口:</span>
                    <span className="font-medium text-green-600">现在</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Full content */}
          {topic?.content && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">原文内容</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-line">{topic.content}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Topic stats */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">话题统计</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">热度趋势</span>
                <div className="flex items-center text-green-600">
                  <FiTrendingUp className="mr-1" />
                  上升中
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">预计持续时间</span>
                <span className="font-medium">48小时</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">关注度</span>
                <div className="flex items-center">
                  <FiBarChart2 className="mr-1 text-blue-600" />
                  <span>高</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">讨论量</span>
                <div className="flex items-center">
                  <FiMessageSquare className="mr-1 text-blue-600" />
                  <span>2.3k</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Related topics */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">相关话题</h2>
            <div className="space-y-3">
              {relatedTopics && relatedTopics.length > 0 ? (
                relatedTopics.map((relatedTopic) => (
                  <a 
                    key={relatedTopic.id}
                    href={`/topic/${relatedTopic.id}`}
                    className="block p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <h3 className="font-medium text-gray-900">{relatedTopic.title}</h3>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span>{relatedTopic.source_name}</span>
                      <span className="mx-1">•</span>
                      <span className="flex items-center">
                        <FiBarChart2 className="mr-1" />
                        热度 {relatedTopic.extra?.heat || "-"}
                      </span>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-gray-500 text-center py-2">没有找到相关话题</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicAnalysis; 