import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, Package, Users, ShoppingCart, BarChart2, Settings, Archive } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Stock', href: '/stock', icon: Archive },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'Reports', href: '/reports', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const linkClasses = "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors";
  const activeLinkClasses = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg";
  const inactiveLinkClasses = "text-gray-600 hover:bg-gray-200 hover:text-gray-900";

  const SidebarContent = ({ isMobile }: { isMobile: boolean }) => (
    <>
      <div className="flex items-center justify-center h-16 border-b shrink-0">
        <span className="text-xl font-bold text-gray-800">BIOTECHCENTRE</span>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r bg-white transform transition-transform md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent isMobile={true} />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 flex-col border-r bg-white">
        <SidebarContent isMobile={false} />
      </aside>
    </>
  );
};

export default Sidebar;