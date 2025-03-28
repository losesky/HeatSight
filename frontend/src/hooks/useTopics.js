import { useQuery, useQueryClient } from 'react-query';
import { topicsApi } from '../api/api';

// 查询键常量，便于统一管理
export const QUERY_KEYS = {
  HOT_TOPICS: 'hotTopics',
  TOPIC_DETAIL: 'topicDetail',
  CATEGORIES: 'categories',
  RELATED_TOPICS: 'relatedTopics',
  RECOMMENDED_TOPICS: 'recommendedTopics',
};

/**
 * Hook 用于获取热门话题
 * @param {Object} params - 请求参数
 * @param {Object} options - React Query 选项
 */
export const useHotTopics = (params = {}, options = {}) => {
  return useQuery(
    [QUERY_KEYS.HOT_TOPICS, params],
    () => topicsApi.getHotTopics(params),
    {
      // 使用全局默认值，同时允许被覆盖
      ...options,
    }
  );
};

/**
 * Hook 用于获取话题分类
 */
export const useCategories = (options = {}) => {
  return useQuery(
    QUERY_KEYS.CATEGORIES,
    () => topicsApi.getCategories(),
    {
      // 分类数据变化较少，可以缓存更长时间
      staleTime: 30 * 60 * 1000, // 30分钟
      ...options,
    }
  );
};

/**
 * Hook 用于获取话题详情
 * @param {string} id - 话题ID
 */
export const useTopicDetail = (id, options = {}) => {
  return useQuery(
    [QUERY_KEYS.TOPIC_DETAIL, id],
    () => topicsApi.getTopicById(id),
    {
      // 仅当ID有效时才获取数据
      enabled: !!id,
      ...options,
    }
  );
};

/**
 * Hook 用于获取相关话题
 * @param {string} id - 话题ID
 */
export const useRelatedTopics = (id, options = {}) => {
  return useQuery(
    [QUERY_KEYS.RELATED_TOPICS, id],
    () => topicsApi.getRelatedTopics(id),
    {
      // 仅当ID有效时才获取数据
      enabled: !!id,
      ...options,
    }
  );
};

/**
 * Hook 用于搜索话题
 * @param {string} query - 搜索关键词
 * @param {Object} params - 其他搜索参数
 */
export const useSearchTopics = (query, params = {}, options = {}) => {
  return useQuery(
    ['searchTopics', query, params],
    () => topicsApi.searchTopics(query, params),
    {
      // 仅当有搜索词时才获取数据
      enabled: !!query,
      // 搜索结果缓存时间短一些
      staleTime: 2 * 60 * 1000, // 2分钟
      ...options,
    }
  );
};

/**
 * 手动使话题缓存失效的工具函数
 */
export const useInvalidateTopics = () => {
  const queryClient = useQueryClient();
  
  return {
    // 使所有热门话题缓存失效
    invalidateHotTopics: () => {
      return queryClient.invalidateQueries(QUERY_KEYS.HOT_TOPICS);
    },
    
    // 使特定话题缓存失效
    invalidateTopic: (id) => {
      return queryClient.invalidateQueries([QUERY_KEYS.TOPIC_DETAIL, id]);
    },
    
    // 使分类缓存失效
    invalidateCategories: () => {
      return queryClient.invalidateQueries(QUERY_KEYS.CATEGORIES);
    },
    
    // 使所有话题相关查询失效
    invalidateAllTopics: () => {
      return Promise.all([
        queryClient.invalidateQueries(QUERY_KEYS.HOT_TOPICS),
        queryClient.invalidateQueries(QUERY_KEYS.TOPIC_DETAIL),
        queryClient.invalidateQueries(QUERY_KEYS.CATEGORIES),
        queryClient.invalidateQueries(QUERY_KEYS.RELATED_TOPICS),
        queryClient.invalidateQueries(QUERY_KEYS.RECOMMENDED_TOPICS),
      ]);
    }
  };
}; 