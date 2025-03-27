import React, { useState, useEffect } from 'react';
import { apiConfig } from '../api/api';

/**
 * API状态组件
 * 显示当前API配置信息，用于调试和状态监控
 */
const ApiStatus = () => {
  const [apiStatus, setApiStatus] = useState({
    baseUrl: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    debugEnabled: apiConfig.debug,
    environment: process.env.NODE_ENV,
    connected: false,
    lastChecked: null
  });

  useEffect(() => {
    // 定期检查API连接状态
    const checkApiConnection = async () => {
      try {
        // 只是检查连接状态，使用HEAD请求
        await fetch(`${apiConfig.baseURL}/health`, { 
          method: 'HEAD',
          // 较短的超时时间，避免长时间等待
          signal: AbortSignal.timeout(3000)
        });
        
        setApiStatus(prev => ({
          ...prev,
          connected: true,
          lastChecked: new Date().toLocaleTimeString()
        }));
      } catch (error) {
        console.log('API连接检查失败:', error.message);
        setApiStatus(prev => ({
          ...prev,
          connected: false,
          lastChecked: new Date().toLocaleTimeString()
        }));
      }
    };

    // 页面加载时检查一次
    checkApiConnection();
    
    // 每60秒检查一次
    const interval = setInterval(checkApiConnection, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-sm my-4 text-sm">
      <h3 className="text-lg font-medium mb-2">API状态</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-gray-600">环境:</div>
        <div className="font-medium">{apiStatus.environment}</div>
        
        <div className="text-gray-600">API地址:</div>
        <div className="font-medium">{apiStatus.baseUrl}</div>
        
        <div className="text-gray-600">超时设置:</div>
        <div className="font-medium">{apiStatus.timeout}ms</div>
        
        <div className="text-gray-600">调试日志:</div>
        <div className="font-medium">{apiStatus.debugEnabled ? '开启' : '关闭'}</div>
        
        <div className="text-gray-600">连接状态:</div>
        <div className={`font-medium ${apiStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
          {apiStatus.connected ? '已连接' : '未连接'}
        </div>
        
        {apiStatus.lastChecked && (
          <>
            <div className="text-gray-600">最后检查:</div>
            <div className="font-medium">{apiStatus.lastChecked}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApiStatus; 