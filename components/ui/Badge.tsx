import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseClasses = "inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

    const variantClasses = {
      default: 'bg-slate-900 text-slate-50 hover:bg-slate-900/80 border-transparent',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-100/80 border-transparent',
      destructive: 'bg-red-500 text-slate-50 hover:bg-red-500/80 border-transparent',
      success: 'bg-green-500 text-slate-50 hover:bg-green-500/80 border-transparent',
      outline: 'text-slate-950',
    };
    
    const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className || ''}`;

    return (
      <div className={combinedClasses} ref={ref} {...props} />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };