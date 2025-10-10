import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { CompanyDetails, CompanyDetailsUpdate } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';

interface CompanyFormProps {
  companyDetails: CompanyDetails | null;
}

type CompanyFormData = Omit<CompanyDetails, 'id' | 'created_at'>;

const upsertCompanyDetails = async (details: CompanyDetailsUpdate) => {
    const { data, error } = await supabase
        .from('company_details')
        .upsert({ ...details, id: 1 }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
};

const CompanyForm: React.FC<CompanyFormProps> = ({ companyDetails }) => {
    const queryClient = useQueryClient();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CompanyFormData>();

    useEffect(() => {
        if (companyDetails) {
            reset(companyDetails);
        }
    }, [companyDetails, reset]);
    
    const mutation = useMutation({
        mutationFn: upsertCompanyDetails,
        onSuccess: () => {
            toast('Company details saved successfully!');
            queryClient.invalidateQueries({ queryKey: ['companyDetails'] });
        },
        onError: (error) => {
            toast(`Error saving details: ${error.message}`);
        },
    });

    const onSubmit: SubmitHandler<CompanyFormData> = (data) => {
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Company Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
                        <Input id="name" {...register('name', { required: "Company name is required" })} />
                        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                    </div>
                     <div>
                        <label htmlFor="slogan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slogan (Optional)</label>
                        <Input id="slogan" {...register('slogan')} />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</label>
                        <Input id="gstin" {...register('gstin', {
                            pattern: {
                                value: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i,
                                message: "Invalid GSTIN format. Should be like 29ABCDE1234F1Z5."
                            }
                        })} />
                        {errors.gstin && <p className="mt-1 text-sm text-red-500">{errors.gstin.message}</p>}
                    </div>
                     <div className="md:col-span-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                        <textarea
                            id="address"
                            rows={3}
                            className="flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
                            {...register('address')}
                        />
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bank Details</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Name</label>
                        <Input id="account_name" {...register('account_name')} />
                    </div>
                    <div>
                        <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                        <Input id="account_number" {...register('account_number')} />
                    </div>
                    <div>
                        <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Type</label>
                        <Input id="account_type" {...register('account_type')} />
                    </div>
                    <div>
                        <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name</label>
                        <Input id="bank_name" {...register('bank_name')} />
                    </div>
                    <div>
                        <label htmlFor="ifsc_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code</label>
                        <Input id="ifsc_code" {...register('ifsc_code')} />
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
};

export default CompanyForm;