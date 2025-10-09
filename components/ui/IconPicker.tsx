import React from 'react';
import DynamicIcon from './DynamicIcon';
import { Card, CardContent } from './Card';

// A curated list of icons relevant for this application, making the picker less overwhelming.
const iconNames = [
  'Leaf', 'Sprout', 'FlaskConical', 'TestTube2', 'Shield', 'Bug', 'SunSnow', 'Ban', 'Trees',
  'Package', 'Box', 'Warehouse', 'ShoppingCart', 'Tag', 'Receipt', 'Factory', 'Hammer', 'Wrench',
  'Tractor', 'Carrot', 'Wheat', 'Apple', 'Milestone', 'Coins', 'Building', 'LayoutGrid', 'Ruler'
];

interface IconPickerProps {
  onSelect: (name: string) => void;
  currentIcon: string | null;
}

const IconPicker: React.FC<IconPickerProps> = ({ onSelect, currentIcon }) => {
  return (
    <Card className="mt-2 shadow-lg animate-fade-in">
      <CardContent className="p-2">
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {iconNames.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              title={name}
              className={`flex items-center justify-center p-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                currentIcon === name
                  ? 'bg-blue-100 dark:bg-blue-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <DynamicIcon name={name} className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IconPicker;
