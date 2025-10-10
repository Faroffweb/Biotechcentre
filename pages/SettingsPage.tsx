import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Building, LayoutGrid, Ruler, UploadCloud, ChevronRight } from 'lucide-react';

const settingsOptions = [
  {
    title: 'Manage Company',
    description: 'Update your company details, GSTIN, and address.',
    icon: <Building className="w-6 h-6 text-slate-500" />,
    href: '/settings/company',
  },
  {
    title: 'Categories',
    description: 'Manage product and service categories for better organization.',
    icon: <LayoutGrid className="w-6 h-6 text-slate-500" />,
    href: '/settings/categories',
  },
  {
    title: 'Units',
    description: 'Add or edit measurement units (e.g., PCS, KG, LTR).',
    icon: <Ruler className="w-6 h-6 text-slate-500" />,
    href: '/settings/units',
  },
  {
    title: 'Import / Export',
    description: 'Bulk import or export your data for backup and offline use.',
    icon: <UploadCloud className="w-6 h-6 text-slate-500" />,
    href: '/settings/import-export',
  },
];

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {settingsOptions.map((option) => (
              <Link
                key={option.title}
                to={option.href}
                className="flex items-center justify-between p-4 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-100 rounded-lg dark:bg-slate-700">
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{option.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;