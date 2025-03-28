import { useQuery } from 'react-query';
import { contentApi } from '../api/api';

// 查询键常量
export const CONTENT_QUERY_KEYS = {
  GENERATE_CONTENT: 'generateContent',
  SUBTOPICS: 'subtopics',
};

/**
 * Hook 用于获取内容生成建议
 * @param {string} topicId - 话题ID
 */
export const useContentGeneration = (topicId, options = {}) => {
  return useQuery(
    [CONTENT_QUERY_KEYS.GENERATE_CONTENT, topicId],
    () => contentApi.generateContent(topicId),
    {
      // 仅当topicId有效时才获取数据
      enabled: !!topicId,
      // 生成的内容可能变化较快，缓存时间较短
      staleTime: 5 * 60 * 1000, // 5分钟
      // 内容生成可能较慢，增加超时时间
      retry: 2,
      ...options,
    }
  );
};

/**
 * Hook 用于获取子话题
 * @param {string} topicTitle - 话题标题
 * @param {string} category - 可选的分类
 */
export const useSubtopics = (topicTitle, category = null, options = {}) => {
  return useQuery(
    [CONTENT_QUERY_KEYS.SUBTOPICS, topicTitle, category],
    () => contentApi.getSubtopics(topicTitle, category),
    {
      // 仅当topicTitle有效时才获取数据
      enabled: !!topicTitle,
      ...options,
    }
  );
}; 