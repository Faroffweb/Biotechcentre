import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Customer, CustomerInsert, CustomerUpdate } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';

interface CustomerFormProps {
  customer?: Customer;
  onSuccess: () => void;
  onCancel: () => void;
}

type CustomerFormData = Omit<Customer, 'id' | 'created_at'>;

const upsertCustomer = async ({ customer, id }: { customer: CustomerInsert | CustomerUpdate, id?: string }) => {
  if (id) {
    const { data, error } = await supabase.from('customers').update(customer).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('customers').insert(customer as CustomerInsert).select().single();
    if (error) throw error;
    return data;
  }
};

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    defaultValues: {
      name: '',
      phone: '',
      gstin: '',
      billing_address: '',
      is_guest: false,
    },
  });

  useEffect(() => {
    reset(customer || {
      name: '',
      phone: '',
      gstin: '',
      billing_address: '',
      is_guest: false,
    });
  }, [customer, reset]);

  const mutation = useMutation({
    mutationFn: upsertCustomer,
    onSuccess: () => {
      toast(`Customer ${customer ? 'updated' : 'added'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSuccess();
    },
    onError: (error) => {
      toast(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<CustomerFormData> = (data) => {
    mutation.mutate({ customer: data, id: customer?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
        <Input id="name" {...register('name', { required: 'Customer name is required' })} />
        {/* Fix: Use optional chaining to safely access error message and fix ReactNode type error. */}
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name?.message}</p>}
      </div>
      
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
        <Input id="phone" {...register('phone')} />
      </div>

      <div>
        <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</label>
        <Input id="gstin" {...register('gstin')} />
      </div>

      <div>
        <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Billing Address</label>
        <textarea
          id="billing_address"
          rows={3}
          className="flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
          {...register('billing_address')}
        />
      </div>
      
      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (customer ? 'Update Customer' : 'Create Customer')}
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;