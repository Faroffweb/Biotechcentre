import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    return (
        // On desktop, the sidebar is fixed and this header is not needed.
        // On mobile, this provides a simple bar with the menu button.
        <div className="md:hidden flex items-center p-4 sm:px-6">
            <button
                onClick={onMenuClick}
                className="p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Open sidebar"
            >
                <Menu className="h-6 w-6" />
            </button>
        </div>
    );
};

export default Header;