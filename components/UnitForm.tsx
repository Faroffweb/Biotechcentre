import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Unit, UnitInsert, UnitUpdate } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';

interface UnitFormProps {
  unit?: Unit;
  onSuccess: () => void;
  onCancel: () => void;
}

type UnitFormData = Omit<Unit, 'id' | 'created_at'>;

const upsertUnit = async ({ unitData, id }: { unitData: UnitInsert | UnitUpdate, id?: string }) => {
  if (id) {
    const { data, error } = await supabase.from('units').update(unitData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('units').insert(unitData as UnitInsert).select().single();
    if (error) throw error;
    return data;
  }
};

const UnitForm: React.FC<UnitFormProps> = ({ unit, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormData>({
    defaultValues: {
      name: '',
      abbreviation: '',
    },
  });

  useEffect(() => {
    reset(unit || {
      name: '',
      abbreviation: '',
    });
  }, [unit, reset]);

  const mutation = useMutation({
    mutationFn: upsertUnit,
    onSuccess: () => {
      toast(`Unit ${unit ? 'updated' : 'added'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['unitsList'] }); // For dropdowns
      onSuccess();
    },
    onError: (error) => {
      toast(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<UnitFormData> = (data) => {
    mutation.mutate({ unitData: data, id: unit?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit Name</label>
        <Input id="name" {...register('name', { required: 'Unit name is required' })} placeholder="e.g., Pieces" />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name?.message}</p>}
      </div>
      
      <div>
        <label htmlFor="abbreviation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Abbreviation</label>
        <Input id="abbreviation" {...register('abbreviation', { required: 'Abbreviation is required' })} placeholder="e.g., PCS" />
        {errors.abbreviation && <p className="mt-1 text-sm text-red-500">{errors.abbreviation?.message}</p>}
      </div>
      
      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (unit ? 'Update Unit' : 'Create Unit')}
        </Button>
      </div>
    </form>
  );
};

export default UnitForm;