import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Lock } from 'lucide-react';

interface PasswordProtectPageProps {
  onSuccess: () => void;
}

const CORRECT_PASSWORD = '9474615046';

const PasswordProtectPage: React.FC<PasswordProtectPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate a small delay for better UX
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        sessionStorage.setItem('isAppAuthenticated', 'true');
        onSuccess();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <Card className="w-full max-w-sm animate-scale-in">
        <CardHeader className="text-center">
          <div className="mx-auto bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full w-fit mb-4">
            <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Access Required</CardTitle>
          <CardDescription>This site is password protected. Please enter the password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
                disabled={loading}
                required
              />
              {error && <p className="mt-2 text-sm text-red-500 text-center">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordProtectPage;