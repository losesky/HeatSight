import React from 'react';
import { useParams, Link } from 'react-router-dom';

const TopicDetail = () => {
  const { id } = useParams();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">话题详情</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-4">
          这是话题详情页，显示ID为 {id} 的话题内容。
        </p>
        
        <Link 
          to="/content-workshop" 
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          前往内容工坊
        </Link>
      </div>
    </div>
  );
};

export default TopicDetail; 