import React from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiSearch } from 'react-icons/fi';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10">
      <h1 className="text-9xl font-bold text-blue-500">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mt-4">页面未找到</h2>
      <p className="text-gray-600 mt-2 max-w-md">
        抱歉，您请求的页面不存在或已被移除。
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Link
          to="/"
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-300"
        >
          <FiHome className="mr-2" />
          返回首页
        </Link>
        <Link
          to="/hot-topics"
          className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition duration-300"
        >
          <FiSearch className="mr-2" />
          浏览热点
        </Link>
      </div>
    </div>
  );
};

export default NotFound; 