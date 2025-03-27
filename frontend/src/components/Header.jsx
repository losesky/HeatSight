import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">HeatSight</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <ul className="flex space-x-8">
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-700 hover:text-blue-600 transition-colors'
                  }
                  end
                >
                  热门资讯
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/content-workshop"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-700 hover:text-blue-600 transition-colors'
                  }
                >
                  内容工坊
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/trend-analysis"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-700 hover:text-blue-600 transition-colors'
                  }
                >
                  趋势分析
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-700 hover:text-blue-600 transition-colors'
                  }
                >
                  关于我们
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 focus:outline-none"
            >
              {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-3">
            <ul className="space-y-3">
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    isActive
                      ? 'block text-blue-600 font-medium py-2'
                      : 'block text-gray-700 hover:text-blue-600 py-2 transition-colors'
                  }
                  onClick={toggleMenu}
                  end
                >
                  热门资讯
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/content-workshop"
                  className={({ isActive }) =>
                    isActive
                      ? 'block text-blue-600 font-medium py-2'
                      : 'block text-gray-700 hover:text-blue-600 py-2 transition-colors'
                  }
                  onClick={toggleMenu}
                >
                  内容工坊
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/trend-analysis"
                  className={({ isActive }) =>
                    isActive
                      ? 'block text-blue-600 font-medium py-2'
                      : 'block text-gray-700 hover:text-blue-600 py-2 transition-colors'
                  }
                  onClick={toggleMenu}
                >
                  趋势分析
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    isActive
                      ? 'block text-blue-600 font-medium py-2'
                      : 'block text-gray-700 hover:text-blue-600 py-2 transition-colors'
                  }
                  onClick={toggleMenu}
                >
                  关于我们
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header; 