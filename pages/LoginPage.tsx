

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { supabase } from '../hooks/lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

type Inputs = {
  email: string;
};

const LoginPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
      setLoading(true);
      setMessage('');
      const { error } = await supabase.auth.signInWithOtp({ email: data.email });
      if (error) throw error;
      setMessage('Check your email for the login link!');
    } catch (error: any) {
      setMessage(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login to BIOTECHCENTRE</CardTitle>
          <CardDescription>Enter your email below to receive a magic link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
              <Input
                id="email"
                type="email"
                {...register("email", { required: "Email is required" })}
                className="mt-1"
                disabled={loading}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>
            {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;