
import React from 'react';

// This is a placeholder for a real toast component library like 'react-hot-toast' or 'sonner'.
// In a real app, you would integrate one of those libraries.

let toastFunction: (message: string) => void = () => {};

export const toast = (message: string) => {
  toastFunction(message);
};

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = React.useState<string[]>([]);

  React.useEffect(() => {
    toastFunction = (message: string) => {
      const id = Date.now().toString();
      setToasts(currentToasts => [...currentToasts, message]);
      setTimeout(() => {
        setToasts(currentToasts => currentToasts.filter(m => m !== message));
      }, 3000);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((message, index) => (
        <div key={index} className="bg-slate-900 text-white rounded-md shadow-lg p-4 animate-fade-in-up">
          {message}
        </div>
      ))}
    </div>
  );
};
