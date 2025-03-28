import axios from 'axios';

// 从环境变量获取API配置
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';
const API_TIMEOUT = parseInt(process.env.REACT_APP_API_TIMEOUT || '15000', 10);
const ENABLE_DEBUG_LOGS = process.env.REACT_APP_ENABLE_DEBUG_LOGS === 'true';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 调试日志函数
const logDebug = (message, data) => {
  if (ENABLE_DEBUG_LOGS) {
    console.log(`[API Debug] ${message}`, data);
  }
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    logDebug('API请求:', { url: config.url, method: config.method, params: config.params });
    return config;
  },
  (error) => {
    logDebug('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    logDebug('API响应成功:', { url: response.config.url, status: response.status });
    return response.data;
  },
  (error) => {
    logDebug('API响应错误:', { 
      url: error.config?.url, 
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// 接口定义
export const topicsApi = {
  // 获取热门话题
  getHotTopics: async (params = {}) => {
    try {
      logDebug('获取热门话题, 参数:', params);
      // 使用API实例调用，而不是直接使用axios
      const response = await api.get('/topics/hot', { params });
      return response;
    } catch (error) {
      console.error('获取热门话题失败:', error);
      throw new Error('获取热门话题失败');
    }
  },
  
  // 获取分类
  getCategories: async () => {
    try {
      const response = await api.get('/topics/categories');
      return response;
    } catch (error) {
      console.error('获取分类失败:', error);
      throw new Error('获取分类失败');
    }
  },
  
  // 获取单个话题详情
  getTopicById: async (id) => {
    try {
      const response = await api.get(`/topics/${id}`);
      return response;
    } catch (error) {
      console.error(`获取话题${id}详情失败:`, error);
      throw new Error(`获取话题${id}详情失败`);
    }
  },
  
  // 获取相关话题
  getRelatedTopics: async (id) => {
    try {
      const response = await api.get(`/topics/${id}/related`);
      return response;
    } catch (error) {
      console.error(`获取相关话题失败:`, error);
      throw new Error(`获取相关话题失败`);
    }
  },
  
  // 搜索话题
  searchTopics: async (query, params = {}) => {
    try {
      const response = await api.get('/topics/search', { 
        params: { 
          query,
          ...params 
        } 
      });
      return response;
    } catch (error) {
      console.error('搜索话题失败:', error);
      throw new Error('搜索话题失败');
    }
  },
  
  // 获取推荐话题
  getRecommendedTopics: (params = {}) => {
    return api.get('/topics/recommended', { params });
  },
  
  // 获取特定分类的话题
  getTopicsByCategory: (category, params = {}) => {
    return api.get('/topics/category', { 
      params: { 
        category,
        ...params 
      } 
    });
  }
};

export const contentApi = {
  // 为特定话题生成内容建议
  generateContent: (topicId) => {
    return api.get(`/content/generate/${topicId}`);
  },
  
  // 获取相关子话题
  getSubtopics: (topicTitle, category = null) => {
    return api.get('/content/subtopics', {
      params: {
        topic_title: topicTitle,
        category
      }
    });
  }
};

// 热度评分API
export const newsHeatApi = {
  // 获取多个新闻的热度分数
  getHeatScores: async (newsIds) => {
    try {
      const response = await api.get('/heat-score/scores', {
        params: { news_ids: newsIds }
      });
      return response;
    } catch (error) {
      console.error('获取热度分数失败:', error);
      throw new Error('获取热度分数失败');
    }
  },
  
  // 获取多个新闻的详细热度数据
  getDetailedHeatScores: async (newsIds) => {
    try {
      const response = await api.get('/heat-score/detailed-scores', {
        params: { news_ids: newsIds }
      });
      return response;
    } catch (error) {
      console.error('获取详细热度数据失败:', error);
      throw new Error('获取详细热度数据失败');
    }
  },
  
  // 获取热门新闻列表
  getTopNews: async (params = {}) => {
    try {
      const response = await api.get('/heat-score/top', { params });
      return response;
    } catch (error) {
      console.error('获取热门新闻失败:', error);
      throw new Error('获取热门新闻失败');
    }
  },
  
  // 触发热度更新任务
  triggerHeatUpdate: async () => {
    try {
      const response = await api.post('/heat-score/update');
      return response;
    } catch (error) {
      console.error('触发热度更新失败:', error);
      throw new Error('触发热度更新失败');
    }
  }
};

// 为了兼容旧代码，提供与utils/api.js相同的导出函数
export const fetchHotTopics = topicsApi.getHotTopics;
export const fetchCategories = topicsApi.getCategories;
export const fetchTopicById = topicsApi.getTopicById;
export const fetchRelatedTopics = topicsApi.getRelatedTopics;
export const searchTopics = topicsApi.searchTopics;

// 导出API配置，方便在其他文件中使用
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  debug: ENABLE_DEBUG_LOGS
};

// 创建用于导出的API对象
const apiObject = {
  topics: topicsApi,
  content: contentApi,
  newsHeat: newsHeatApi,
  config: apiConfig
};

// 导出默认对象
export default apiObject; 