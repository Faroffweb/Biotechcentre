

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Invoice, InvoiceItem, Customer, Product, CustomerInsert } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../hooks/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table';

// This type definition should match the one in InvoicesPage.tsx for prop compatibility
type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin'> | null;
    invoice_items: (InvoiceItem & { products: { name: string } | null })[];
};

interface InvoiceFormProps {
  invoice?: FullInvoice;
  onSuccess: () => void;
  onCancel: () => void;
}

type FormValues = {
  customer_id: string;
  invoice_date: string;
  invoice_number: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }[];
  // New customer fields
  new_customer_name?: string;
  new_customer_phone?: string;
  new_customer_gstin?: string;
  new_customer_billing_address?: string;
};

// Fetch functions
const fetchCustomers = async (): Promise<Pick<Customer, 'id' | 'name'>[]> => {
  const { data, error } = await supabase.from('customers').select('id, name').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

const upsertInvoice = async ({ formData, id }: { formData: Omit<FormValues, 'new_customer_name' | 'new_customer_phone' | 'new_customer_gstin' | 'new_customer_billing_address'>, id?: string }) => {
    // The total is now calculated reliably by a database trigger.
    // We only need to provide the core invoice data and items.
    const invoiceData = {
        customer_id: formData.customer_id,
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
    };

    if (id) {
        // Update
        const { data: updatedInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .update(invoiceData)
            .eq('id', id)
            .select('id')
            .single();
        if (invoiceError) throw invoiceError;

        // Easiest way to handle items is to delete old ones and insert new ones
        const { error: deleteError } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
        if (deleteError) throw deleteError;

        const itemsData = formData.items.map(item => ({
            ...item,
            invoice_id: id,
        }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;

        return updatedInvoice;

    } else {
        // Create
        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            // Fix: Remove total_amount from insert as it's handled by the DB.
            .insert(invoiceData)
            .select('id')
            .single();
        if (invoiceError) throw invoiceError;

        const itemsData = formData.items.map(item => ({
            ...item,
            invoice_id: newInvoice.id,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;

        return newInvoice;
    }
};


const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');

  const { data: customers, isLoading: isLoadingCustomers } = useQuery({ queryKey: ['customersList'], queryFn: fetchCustomers });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['productsListAll'], queryFn: fetchProducts });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customer_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      items: [],
      new_customer_name: '',
      new_customer_phone: '',
      new_customer_gstin: '',
      new_customer_billing_address: '',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    if (invoice) {
      setCustomerMode('existing');
      reset({
        customer_id: invoice.customer_id,
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        invoice_number: invoice.invoice_number,
        items: invoice.invoice_items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
      });
    } else {
       setCustomerMode('existing');
       reset({
        customer_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        items: [{ product_id: '', quantity: 1, unit_price: 0, tax_rate: 0 }],
        new_customer_name: '',
        new_customer_phone: '',
        new_customer_gstin: '',
        new_customer_billing_address: '',
      });
    }
  }, [invoice, reset]);

  const watchedItems = watch('items');

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (product) {
      update(index, {
        product_id: productId,
        quantity: 1,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
      });
    }
  };

  const totals = useMemo(() => {
    const subtotal = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const tax = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.tax_rate), 0);
    return {
      subtotal,
      tax,
      grandTotal: subtotal + tax,
    };
  }, [watchedItems]);

  const mutation = useMutation({
    mutationFn: upsertInvoice,
    onSuccess: () => {
      toast(`Invoice ${invoice ? 'updated' : 'created'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] }); // Invalidate customers in case a new one was added
      onSuccess();
    },
    onError: (error) => {
      toast(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (data.items.length === 0 || !data.items[0].product_id) {
        toast('Please add at least one valid item to the invoice.');
        return;
    }
    
    let finalCustomerId: string | undefined = data.customer_id;

    if (customerMode === 'new') {
        if (!data.new_customer_name) {
            toast('New customer name is required.');
            return;
        }
        const newCustomer: CustomerInsert = {
            name: data.new_customer_name,
            phone: data.new_customer_phone || null,
            gstin: data.new_customer_gstin || null,
            billing_address: data.new_customer_billing_address || null,
            email: null, // email not in form
            is_guest: false,
        };
        const { data: createdCustomer, error } = await supabase
            .from('customers')
            .insert(newCustomer)
            .select('id')
            .single();
        
        if (error) {
            toast(`Error creating customer: ${error.message}`);
            return;
        }
        finalCustomerId = createdCustomer.id;
    }

    if (!finalCustomerId) {
        toast('A customer must be selected or created.');
        return;
    }
    
    const invoiceAndItemsData = {
        ...data,
        customer_id: finalCustomerId,
    };
    
    mutation.mutate({ formData: invoiceAndItemsData, id: invoice?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Customer</h3>
            <label className="flex items-center">
                <input type="radio" value="existing" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} className="mr-2" />
                Existing
            </label>
            <label className="flex items-center">
                <input type="radio" value="new" checked={customerMode === 'new'} onChange={() => setCustomerMode('new')} className="mr-2" />
                New
            </label>
        </div>

        {customerMode === 'existing' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
              <select
                id="customer_id"
                {...register('customer_id', { required: customerMode === 'existing' ? 'Customer is required' : false })}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900 mt-1"
                disabled={isLoadingCustomers}
              >
                <option value="">{isLoadingCustomers ? 'Loading...' : 'Select a customer'}</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customer_id && <p className="mt-1 text-sm text-red-500">{errors.customer_id?.message}</p>}
            </div>
            <div>
              <label htmlFor="invoice_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
              <Input id="invoice_date" type="date" {...register('invoice_date', { required: 'Date is required' })} className="mt-1"/>
              {errors.invoice_date && <p className="mt-1 text-sm text-red-500">{errors.invoice_date?.message}</p>}
            </div>
          </div>
        ) : (
          <div className="p-4 border rounded-md space-y-4 bg-slate-50 dark:bg-slate-700/50">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="new_customer_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                    <Input id="new_customer_name" {...register('new_customer_name', { required: customerMode === 'new' ? 'Name is required' : false })} />
                    {errors.new_customer_name && <p className="mt-1 text-sm text-red-500">{errors.new_customer_name?.message}</p>}
                </div>
                 <div>
                    <label htmlFor="new_customer_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <Input id="new_customer_phone" {...register('new_customer_phone')} />
                </div>
                <div>
                    <label htmlFor="new_customer_gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</label>
                    <Input id="new_customer_gstin" {...register('new_customer_gstin')} />
                </div>
                <div>
                    <label htmlFor="new_customer_billing_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <Input id="new_customer_billing_address" {...register('new_customer_billing_address')} />
                </div>
             </div>
          </div>
        )}

      </div>

      <div>
          <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
          <Input id="invoice_number" {...register('invoice_number', { required: 'Invoice number is required' })} />
          {errors.invoice_number && <p className="mt-1 text-sm text-red-500">{errors.invoice_number?.message}</p>}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Items</h3>
        <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3 text-xs">Product</TableHead>
                <TableHead className="px-4 py-3 text-xs">Qty</TableHead>
                <TableHead className="px-4 py-3 text-xs">Price</TableHead>
                <TableHead className="px-4 py-3 text-xs">Total</TableHead>
                <TableHead className="px-4 py-3 text-xs text-right"><span className="sr-only">Remove</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id} className="bg-white dark:bg-gray-800">
                  <TableCell className="p-2 whitespace-nowrap" style={{minWidth: '200px'}}>
                     <select
                      {...register(`items.${index}.product_id`, { required: true })}
                      defaultValue={field.product_id}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
                      onChange={(e) => handleProductChange(index, e.target.value)}
                      disabled={isLoadingProducts}
                    >
                      <option value="">{isLoadingProducts ? 'Loading...' : 'Select product'}</option>
                      {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap">
                    <Input type="number" {...register(`items.${index}.quantity`, { required: true, valueAsNumber: true, min: 1 })} className="w-20" />
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap">
                     <Input type="number" step="0.01" {...register(`items.${index}.unit_price`, { required: true, valueAsNumber: true, min: 0 })} className="w-28" />
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {formatCurrency((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unit_price || 0))}
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap text-right">
                     <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button
            type="button"
            variant="outline"
            onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, tax_rate: 0 })}
        >
            Add Item
        </Button>
      </div>

      <div className="flex justify-end pt-4">
        <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</span>
            </div>
             <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax (GST):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.tax)}</span>
            </div>
             <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">Grand Total:</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(totals.grandTotal)}</span>
            </div>
        </div>
      </div>
      

      <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (invoice ? 'Update Invoice' : 'Create Invoice')}
        </Button>
      </div>
    </form>
  );
};

export default InvoiceForm;