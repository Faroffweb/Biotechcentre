import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-white border-b dark:bg-gray-800 dark:border-gray-700">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex-1 md:hidden">
        {/* Mobile: No title to save space */}
      </div>
      <div className="hidden md:block">
        {/* Placeholder for breadcrumbs or page title */}
      </div>
      <div className="flex items-center space-x-4">
        {/* User-specific content removed */}
      </div>
    </header>
  );
};

export default Header;