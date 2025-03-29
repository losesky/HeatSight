import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FiArrowLeft, FiBarChart2, FiClock, FiLink, FiUsers, 
  FiTrendingUp, FiZap, FiLayers, FiSearch, FiRefreshCw 
} from 'react-icons/fi';

const TopicDecomposition = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  
  // States
  const [topic, setTopic] = useState(null);
  const [subTopics, setSubTopics] = useState([]);
  const [relatedTopics, setRelatedTopics] = useState([]);
  const [audienceProfiles, setAudienceProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch topic details and related data
  useEffect(() => {
    const fetchTopicData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 在实际应用中，这应该是从HeatLink API获取主题详情的请求
        // 例如: const topicResponse = await axios.get(`/api/topics/${topicId}`);
        
        // 模拟获取主题数据
        const topicResponse = await simulateFetchTopic(topicId);
        setTopic(topicResponse.data);
        
        // 模拟获取子话题和相关话题
        const decompositionData = await simulateDecomposeTopic(topicId);
        setSubTopics(decompositionData.subTopics);
        setRelatedTopics(decompositionData.relatedTopics);
        setAudienceProfiles(decompositionData.audienceProfiles);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching topic data:', err);
        setError('获取主题详情失败，请稍后重试');
        setLoading(false);
      }
    };
    
    if (topicId) {
      fetchTopicData();
    }
  }, [topicId]);
  
  // 返回热点话题列表
  const handleBackToList = () => {
    navigate('/hot-topics');
  };
  
  // 查看详细主题
  const handleViewTopic = (id) => {
    navigate(`/topic/${id}`);
  };
  
  // 模拟请求，获取主题详情
  const simulateFetchTopic = async (id) => {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // 模拟API响应
    return {
      data: {
        id: id,
        title: '元宇宙技术发展与应用前景',
        category: '科技',
        summary: '随着Facebook更名为Meta，元宇宙概念再次升温。本话题探讨元宇宙相关技术的最新发展与未来应用场景。',
        published_at: new Date().toISOString(),
        source_id: '科技前沿报告',
        extra: {
          heat: 92,
          views: 1543,
          discussion_count: 268
        }
      }
    };
  };
  
  // 模拟请求，获取话题解构数据
  const simulateDecomposeTopic = async (id) => {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      // 子话题
      subTopics: [
        {
          id: `${id}-sub-1`,
          title: 'VR/AR技术在元宇宙中的应用',
          type: '技术实现',
          relevance: 0.95,
          heat: 88
        },
        {
          id: `${id}-sub-2`,
          title: '元宇宙经济体系构建',
          type: '商业模式',
          relevance: 0.89,
          heat: 86
        },
        {
          id: `${id}-sub-3`,
          title: '元宇宙中的身份认证与隐私保护',
          type: '安全隐私',
          relevance: 0.82,
          heat: 79
        },
        {
          id: `${id}-sub-4`,
          title: '元宇宙社交互动机制设计',
          type: '用户体验',
          relevance: 0.78,
          heat: 75
        },
        {
          id: `${id}-sub-5`,
          title: '元宇宙内容创作与IP保护',
          type: '内容生态',
          relevance: 0.76,
          heat: 72
        }
      ],
      
      // 相关话题
      relatedTopics: [
        {
          id: 'related-1',
          title: '区块链技术与数字资产',
          category: '科技',
          relevance: 0.86,
          heat: 85,
          connection: '技术支撑'
        },
        {
          id: 'related-2',
          title: '数字人民币应用场景探索',
          category: '财经',
          relevance: 0.72,
          heat: 83,
          connection: '支付体系'
        },
        {
          id: 'related-3',
          title: 'NFT市场发展与监管',
          category: '科技',
          relevance: 0.81,
          heat: 87,
          connection: '数字资产'
        },
        {
          id: 'related-4',
          title: '游戏产业转型升级',
          category: '文娱',
          relevance: 0.79,
          heat: 78,
          connection: '应用场景'
        }
      ],
      
      // 受众画像
      audienceProfiles: [
        {
          id: 'audience-1',
          name: '科技爱好者',
          percentage: 38,
          interests: ['新兴技术', '数字产品', '科学前沿'],
          behaviors: ['关注前沿科技新闻', '尝试新技术产品', '参与技术社区讨论']
        },
        {
          id: 'audience-2',
          name: '投资者',
          percentage: 24,
          interests: ['市场趋势', '投资机会', '行业分析'],
          behaviors: ['跟踪科技股走势', '分析商业模式可行性', '关注风险投资动向']
        },
        {
          id: 'audience-3',
          name: '内容创作者',
          percentage: 21,
          interests: ['创意表达', '数字艺术', '版权保护'],
          behaviors: ['创作数字内容', '探索新平台机会', '关注变现模式']
        },
        {
          id: 'audience-4',
          name: '产业从业者',
          percentage: 17,
          interests: ['行业应用', '解决方案', '商业合作'],
          behaviors: ['寻找转型机会', '评估应用场景', '分析竞争格局']
        }
      ]
    };
  };
  
  // 格式化热度显示
  const formatHeat = (heat) => {
    const roundedHeat = Math.round(heat);
    if (roundedHeat >= 90) return { text: '极热', class: 'bg-red-100 text-red-800' };
    if (roundedHeat >= 80) return { text: '热门', class: 'bg-orange-100 text-orange-800' };
    if (roundedHeat >= 70) return { text: '较热', class: 'bg-yellow-100 text-yellow-800' };
    if (roundedHeat > 0) return { text: '普通', class: 'bg-blue-100 text-blue-800' };
    return { text: '', class: 'bg-gray-100 text-gray-800' };
  };
  
  // 格式化相关度
  const formatRelevance = (relevance) => {
    return Math.round(relevance * 100) + '%';
  };
  
  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">加载话题解构数据...</p>
        </div>
      </div>
    );
  }
  
  // 错误状态
  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-lg max-w-3xl mx-auto my-8">
        <h2 className="text-red-800 font-bold text-xl mb-2">获取数据失败</h2>
        <p className="text-red-700 mb-4">{error}</p>
        <div className="flex space-x-4">
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            返回话题列表
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
  
  // 未找到主题
  if (!topic) {
    return (
      <div className="bg-yellow-50 p-6 rounded-lg max-w-3xl mx-auto my-8">
        <h2 className="text-yellow-800 font-bold text-xl mb-2">未找到话题</h2>
        <p className="text-yellow-700 mb-4">无法找到ID为 {topicId} 的话题信息</p>
        <button
          onClick={handleBackToList}
          className="px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          返回话题列表
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleBackToList}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-md"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">话题解构</h1>
        </div>
      </div>
      
      {/* 主题信息卡 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs ${formatHeat(topic.extra.heat).class}`}>
                {formatHeat(topic.extra.heat).text}
              </span>
              <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                {topic.category}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{topic.title}</h2>
            <p className="text-gray-600 mb-4">{topic.summary}</p>
            <div className="flex items-center text-sm text-gray-500">
              <span className="flex items-center mr-4">
                <FiBarChart2 className="mr-1" />
                热度 {topic.extra.heat}
              </span>
              <span className="flex items-center mr-4">
                <FiClock className="mr-1" />
                {new Date(topic.published_at).toLocaleDateString()}
              </span>
              <span>{topic.source_id}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 主要内容区域 - 3列网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 第一列 - 子话题 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <FiLayers className="mr-2" />
                子话题拆解
              </h3>
              <span className="text-sm text-gray-500">{subTopics.length}个子话题</span>
            </div>
            
            <div className="space-y-3">
              {subTopics.map(subTopic => (
                <div 
                  key={subTopic.id}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer"
                  onClick={() => handleViewTopic(subTopic.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-gray-900">{subTopic.title}</h4>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {subTopic.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">相关度: {formatRelevance(subTopic.relevance)}</span>
                    <span className="flex items-center text-gray-600">
                      <FiBarChart2 className="mr-1" />
                      {subTopic.heat}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 第二列 - 相关话题 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <FiLink className="mr-2" />
                相关话题映射
              </h3>
              <span className="text-sm text-gray-500">{relatedTopics.length}个相关话题</span>
            </div>
            
            <div className="space-y-3">
              {relatedTopics.map(relatedTopic => (
                <div 
                  key={relatedTopic.id}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer"
                  onClick={() => handleViewTopic(relatedTopic.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-gray-900">{relatedTopic.title}</h4>
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">
                      {relatedTopic.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">关联: {relatedTopic.connection}</span>
                    <span className="flex items-center text-gray-600">
                      <FiBarChart2 className="mr-1" />
                      {relatedTopic.heat}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 第三列 - 受众画像和竞争分析 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <FiUsers className="mr-2" />
                目标受众画像
              </h3>
            </div>
            
            <div className="space-y-4">
              {audienceProfiles.map(profile => (
                <div key={profile.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{profile.name}</h4>
                    <span className="text-sm text-blue-600">{profile.percentage}%</span>
                  </div>
                  
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">兴趣标签</div>
                    <div className="flex flex-wrap gap-1">
                      {profile.interests.map((interest, idx) => (
                        <span 
                          key={idx} 
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500 mb-1">行为特征</div>
                    <ul className="text-xs text-gray-700 list-disc list-inside">
                      {profile.behaviors.map((behavior, idx) => (
                        <li key={idx}>{behavior}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 创作建议卡片 */}
          <div className="bg-blue-50 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-800 flex items-center">
                <FiZap className="mr-2" />
                创作建议
              </h3>
            </div>
            
            <ul className="space-y-2 text-blue-700">
              <li className="flex items-start">
                <span className="inline-block bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center text-blue-700 mr-2 shrink-0 mt-0.5">1</span>
                <span>重点关注VR/AR技术实现子话题，该方向热度最高</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center text-blue-700 mr-2 shrink-0 mt-0.5">2</span>
                <span>针对"科技爱好者"受众群体进行内容定制</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center text-blue-700 mr-2 shrink-0 mt-0.5">3</span>
                <span>与NFT市场发展相关联，挖掘交叉价值点</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center text-blue-700 mr-2 shrink-0 mt-0.5">4</span>
                <span>结合区块链技术讨论，提升内容深度和专业性</span>
              </li>
            </ul>
            
            <button 
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md flex items-center justify-center"
              onClick={() => navigate('/content-workshop')}
            >
              <FiEdit className="mr-2" />
              前往内容工坊创作
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicDecomposition; 