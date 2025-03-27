import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { 
  FiHome, FiTrendingUp, FiEdit, FiLayers, FiBarChart2,
  FiMenu, FiX, FiSearch, FiSettings, FiInfo, FiHelpCircle
} from 'react-icons/fi';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // 定义导航项
  const navigationItems = [
    { path: '/', name: '首页', icon: <FiHome size={20} />, active: true },
    { path: '/hot-topics', name: '热点雷达', icon: <FiTrendingUp size={20} />, active: true },
    { path: '/content-workshop', name: '内容创作工坊', icon: <FiEdit size={20} />, active: true },
    { 
      path: '/topic/1/decompose', // 示例话题ID
      name: '话题解构系统', 
      icon: <FiLayers size={20} />,
      badge: "新功能",
      active: true 
    },
    { 
      path: '/data-lab', 
      name: '数据验证实验室', 
      icon: <FiBarChart2 size={20} />,
      badge: "开发中",
      active: false 
    },
    { 
      path: '/settings', 
      name: '用户设置', 
      icon: <FiSettings size={20} />, 
      active: false,
      isBottom: true 
    },
    { 
      path: '/help', 
      name: '使用帮助', 
      icon: <FiHelpCircle size={20} />, 
      active: false,
      isBottom: true 
    },
    { 
      path: '/about', 
      name: '关于平台', 
      icon: <FiInfo size={20} />, 
      active: false,
      isBottom: true 
    }
  ];

  // 顶部导航项
  const topNavigationItems = navigationItems.filter(item => !item.isBottom);
  
  // 底部导航项
  const bottomNavigationItems = navigationItems.filter(item => item.isBottom);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">HeatSight</span>
            </Link>
          </div>
          <button 
            className="p-1 text-gray-700 rounded-md hover:bg-gray-100 lg:hidden"
            onClick={toggleSidebar}
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-64px)]">
          {/* 主导航菜单 */}
          <nav className="p-4">
            <ul className="space-y-2">
              {topNavigationItems.map((item) => (
                <li key={item.path}>
                  {item.active ? (
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => 
                        `flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className="flex items-center">
                        <div className="mr-3">{item.icon}</div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed">
                      <div className="flex items-center">
                        <div className="mr-3">{item.icon}</div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          
          {/* 底部导航菜单 */}
          <div className="p-4 border-t">
            <ul className="space-y-2">
              {bottomNavigationItems.map((item) => (
                <li key={item.path}>
                  {item.active ? (
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => 
                        `flex items-center px-4 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className="mr-3">{item.icon}</div>
                      <span className="font-medium text-sm">{item.name}</span>
                    </NavLink>
                  ) : (
                    <div className="flex items-center px-4 py-2 rounded-lg text-gray-400 cursor-not-allowed">
                      <div className="mr-3">{item.icon}</div>
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <button 
              className="p-1 text-gray-700 rounded-md lg:hidden"
              onClick={toggleSidebar}
            >
              <FiMenu size={24} />
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">
                {navigationItems.find((item) => item.path === location.pathname)?.name || 
                navigationItems.find((item) => location.pathname.startsWith(item.path) && item.path !== '/')?.name ||
                ''}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full">
                  <FiSearch size={20} />
                </button>
              </div>
              <div className="relative flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  HS
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 