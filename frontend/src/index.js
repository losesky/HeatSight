import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { QueryClient, QueryClientProvider } from 'react-query';

// 创建 QueryClient 实例，配置全局默认选项
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // 默认不在窗口聚焦时重新获取数据
      staleTime: 5 * 60 * 1000, // 数据5分钟内视为新鲜
      cacheTime: 10 * 60 * 1000, // 缓存保留10分钟
      retry: 1, // 失败时最多重试1次
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
); 