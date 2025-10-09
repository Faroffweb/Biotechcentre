import React from 'react';

const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700 ${className || ''}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-gray-300/50 to-transparent dark:via-gray-600/50"></div>
    </div>
  );
};

export default Skeleton;