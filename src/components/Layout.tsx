import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Calculator, LogOut, FileSpreadsheet, BarChart3, Settings, Play } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavigationItems = () => {
    if (user?.role === 'agent') {
      return [
        {
          to: '/agent',
          icon: <Users className="h-5 w-5 mr-1" />,
          text: 'My Dashboard'
        }
      ];
    }

    if (user?.role === 'manager') {
      return [
        {
          to: '/',
          icon: <Calculator className="h-5 w-5 mr-1" />,
          text: 'Dashboard'
        },
        {
          to: '/designer',
          icon: <FileSpreadsheet className="h-5 w-5 mr-1" />,
          text: 'Scheme Designer'
        },
        {
          to: '/execution',
          icon: <Play className="h-5 w-5 mr-1" />,
          text: 'Scheme Execution'
        },
        {
          to: '/execution/log',
          icon: <BarChart3 className="h-5 w-5 mr-1" />,
          text: 'Execution Logs'
        },
        {
          to: '/reports',
          icon: <FileSpreadsheet className="h-5 w-5 mr-1" />,
          text: 'Reports'
        }
      ];
    }

    if (user?.role === 'admin') {
      return [
        {
          to: '/',
          icon: <Calculator className="h-5 w-5 mr-1" />,
          text: 'Dashboard'
        },
        {
          to: '/admin',
          icon: <Settings className="h-5 w-5 mr-1" />,
          text: 'Admin'
        },
        {
          to: '/reports',
          icon: <FileSpreadsheet className="h-5 w-5 mr-1" />,
          text: 'Reports'
        }
      ];
    }

    return [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center px-2 py-2 text-gray-900">
                <Calculator className="h-6 w-6 text-indigo-600" />
                <span className="ml-2 font-semibold text-xl">ICM Platform</span>
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {getNavigationItems().map((item) => (
                  <Link 
                    key={item.to}
                    to={item.to} 
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 hover:text-indigo-600"
                  >
                    {item.icon}
                    {item.text}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-700">
                <Users className="h-5 w-5 mr-1" />
                {user?.username} ({user?.role})
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-full text-gray-500 hover:text-indigo-600"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}