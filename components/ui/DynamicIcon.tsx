import React from 'react';
import * as icons from 'lucide-react';

// Fix: The `icons` import contains more than just React components (e.g., helper functions),
// which makes a direct cast to a dictionary of components invalid. By first casting to `unknown`,
// we tell TypeScript to bypass its strict check, asserting that we will handle the types correctly at runtime.
const IconLibrary = icons as unknown as { [key: string]: React.FC<icons.LucideProps> };

interface DynamicIconProps extends icons.LucideProps {
  name: string | null | undefined;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  if (!name) {
    // Return a default placeholder icon if no name is provided.
    return <icons.Package {...props} />;
  }
  
  // Find the icon component from the library using the provided name.
  // This allows for dynamically rendering any icon from lucide-react.
  const LucideIcon = IconLibrary[name];

  if (!LucideIcon) {
    // If the icon name is invalid, return a default icon to avoid crashing.
    console.warn(`Icon "${name}" not found.`);
    return <icons.HelpCircle {...props} />;
  }

  return <LucideIcon {...props} />;
};

export default DynamicIcon;
