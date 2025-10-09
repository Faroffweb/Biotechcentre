import React from 'react';
import { X } from 'lucide-react';

interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'default' | 'lg' | 'xl';
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ isOpen, onClose, title, children, size = 'default', className, ...props }, ref) => {
    React.useEffect(() => {
      const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };
      
      if (isOpen) {
        window.addEventListener('keydown', handleEsc);
      }

      return () => {
        window.removeEventListener('keydown', handleEsc);
      };
    }, [isOpen, onClose]);

    if (!isOpen) {
      return null;
    }

    const sizeClasses = {
      default: 'max-w-2xl',
      lg: 'max-w-4xl',
      xl: 'max-w-6xl',
    };

    return (
      <div
        ref={ref}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in ${className || ''}`}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        {...props}
      >
        <div
          className={`relative w-full ${sizeClasses[size]} m-4 bg-white rounded-lg shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col animate-scale-in`}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
        >
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              type="button"
              className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    );
  }
);
Dialog.displayName = "Dialog";


export default Dialog;