import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Category, CategoryInsert, CategoryUpdate } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';

interface CategoryFormProps {
  category?: Category;
  onSuccess: () => void;
  onCancel: () => void;
}

type CategoryFormData = Omit<Category, 'id' | 'created_at'>;

const upsertCategory = async ({ categoryData, id }: { categoryData: CategoryInsert | CategoryUpdate, id?: string }) => {
  if (id) {
    const { data, error } = await supabase.from('categories').update(categoryData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('categories').insert(categoryData as CategoryInsert).select().single();
    if (error) throw error;
    return data;
  }
};

const CategoryForm: React.FC<CategoryFormProps> = ({ category, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    reset(category || {
      name: '',
      description: '',
    });
  }, [category, reset]);

  const mutation = useMutation({
    mutationFn: upsertCategory,
    onSuccess: () => {
      toast(`Category ${category ? 'updated' : 'added'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesList'] }); // For dropdowns
      onSuccess();
    },
    onError: (error) => {
      toast(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<CategoryFormData> = (data) => {
    mutation.mutate({ categoryData: data, id: category?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category Name</label>
        <Input id="name" {...register('name', { required: 'Category name is required' })} placeholder="e.g., Electronics" />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name?.message}</p>}
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
        <textarea
          id="description"
          rows={3}
          className="flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
          {...register('description')}
          placeholder="e.g., All electronic items and accessories"
        />
      </div>
      
      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (category ? 'Update Category' : 'Create Category')}
        </Button>
      </div>
    </form>
  );
};

export default CategoryForm;