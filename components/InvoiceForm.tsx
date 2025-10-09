

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Invoice, InvoiceItem, Customer, Product, CustomerInsert, Unit } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../hooks/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table';

// This type definition should match the one in InvoicesPage.tsx for prop compatibility
type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin' | 'phone'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; hsn_code: string | null; units?: Pick<Unit, 'abbreviation'> | null; } | null })[];
};

interface InvoiceFormProps {
  invoice?: FullInvoice;
  onSuccess: () => void;
  onCancel: () => void;
}

type FormValues = {
  customer_id: string | null;
  customer_name_display: string; // For the search input
  invoice_date: string;
  invoice_number: string;
  items: {
    product_id: string;
    product_name_display: string; // For the search input
    quantity: number;
    unit_price: number; // PRE-TAX unit price
    tax_rate: number;
    inclusive_rate_display: number; // For the controlled input
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
  const { data, error } = await supabase.from('products').select('*, units(abbreviation)').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

const upsertInvoice = async ({ formData, id }: { formData: Omit<FormValues, 'new_customer_name' | 'new_customer_phone' | 'new_customer_gstin' | 'new_customer_billing_address' | 'customer_name_display'>, id?: string }) => {
    const invoiceData = {
        customer_id: formData.customer_id,
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
    };
    
    const itemsToSave = formData.items.map(({ inclusive_rate_display, product_name_display, ...rest }) => rest);

    if (id) {
        // Update
        const { data: updatedInvoice, error: invoiceError } = await supabase.from('invoices').update(invoiceData).eq('id', id).select('id').single();
        if (invoiceError) throw invoiceError;
        const { error: deleteError } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
        if (deleteError) throw deleteError;
        const itemsData = itemsToSave.map(item => ({ ...item, invoice_id: id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;
        return updatedInvoice;
    } else {
        // Create
        const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert(invoiceData).select('id').single();
        if (invoiceError) throw invoiceError;
        const itemsData = itemsToSave.map(item => ({ ...item, invoice_id: newInvoice.id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;
        return newInvoice;
    }
};

const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const [customerMode, setCustomerMode] = useState<'existing' | 'new' | 'guest'>('existing');
  const [activeSuggestionBox, setActiveSuggestionBox] = useState<{ type: 'customer' | 'product', index?: number } | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: customers, isLoading: isLoadingCustomers } = useQuery({ queryKey: ['customersList'], queryFn: fetchCustomers });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['productsListAll'], queryFn: fetchProducts });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customer_id: null,
      customer_name_display: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (invoice) {
      const mode = invoice.customer_id ? 'existing' : 'guest';
      setCustomerMode(mode);
      reset({
        customer_id: invoice.customer_id,
        customer_name_display: invoice.customers?.name || '',
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        invoice_number: invoice.invoice_number,
        items: invoice.invoice_items.map(item => {
          const inclusiveRate = item.unit_price * (1 + item.tax_rate);
          return {
            product_id: item.product_id,
            product_name_display: item.products?.name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            inclusive_rate_display: parseFloat(inclusiveRate.toFixed(2)),
          };
        }),
      });
    } else {
       setCustomerMode('existing');
       reset({
        customer_id: null,
        customer_name_display: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        items: [{ product_id: '', product_name_display: '', quantity: 1, unit_price: 0, tax_rate: 0, inclusive_rate_display: 0 }],
      });
    }
  }, [invoice, reset]);
  
  // Real-time calculation for inclusive rate
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name && name.startsWith('items.') && name.endsWith('.inclusive_rate_display')) {
        const parts = name.split('.');
        const index = parseInt(parts[1], 10);
        const item = value.items?.[index];
        if (item) {
          const newUnitPrice = (1 + (item.tax_rate || 0)) > 0 ? (item.inclusive_rate_display || 0) / (1 + (item.tax_rate || 0)) : 0;
          if (Math.abs(newUnitPrice - (getValues(`items.${index}.unit_price`) || 0)) > 1e-5) {
            setValue(`items.${index}.unit_price`, newUnitPrice, { shouldDirty: true });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, getValues]);
  
  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
            setActiveSuggestionBox(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const watchedItems = watch('items');
  const customerNameDisplay = watch('customer_name_display');

  const filteredCustomers = useMemo(() => {
    if (!customerNameDisplay || !customers) return [];
    if (customers.some(c => c.name.toLowerCase() === customerNameDisplay.toLowerCase())) return [];
    return customers.filter(c => c.name.toLowerCase().includes(customerNameDisplay.toLowerCase()));
  }, [customerNameDisplay, customers]);

  const handleCustomerSelect = (customer: Pick<Customer, 'id' | 'name'>) => {
      setValue('customer_id', customer.id);
      setValue('customer_name_display', customer.name);
      setActiveSuggestionBox(null);
  };

  const handleProductSelect = (index: number, product: Product) => {
    // When a product is selected, update the form fields for that item row.
    // This ensures the correct pre-tax price and tax rate are used for all calculations.
    
    // Calculate the GST-inclusive rate based on the product's base price and tax rate.
    const inclusiveRate = product.unit_price * (1 + product.tax_rate);

    // Get the current quantity, defaulting to 1 if not set.
    const currentQuantity = watchedItems[index]?.quantity || 1;

    // Update the entire item object in the form state.
    update(index, {
      product_id: product.id,
      product_name_display: product.name,
      quantity: currentQuantity,
      
      // Set the core financial data from the selected product.
      unit_price: product.unit_price, // The pre-tax unit price.
      tax_rate: product.tax_rate,     // The tax rate as a decimal (e.g., 0.18 for 18%).
      
      // Update the user-facing 'Rate (GST Incl.)' field.
      inclusive_rate_display: parseFloat(inclusiveRate.toFixed(2)),
    });
    
    setActiveSuggestionBox(null);
  };
  
  const highlightMatch = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex === -1) return <span>{text}</span>;
    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + query.length);
    const after = text.slice(matchIndex + query.length);
    return (<span>{before}<strong className="font-semibold text-slate-900 dark:text-slate-100">{match}</strong>{after}</span>);
  };

  const totals = useMemo(() => {
    const subtotal = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const tax = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.tax_rate), 0);
    return { subtotal, tax, grandTotal: subtotal + tax };
  }, [watchedItems]);

  const mutation = useMutation({
    mutationFn: upsertInvoice,
    onSuccess: () => {
      toast(`Invoice ${invoice ? 'updated' : 'created'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSuccess();
    },
    onError: (error) => toast(`Error: ${error.message}`),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (data.items.length === 0 || !data.items.find(item => item.product_id)) {
        toast('Please add at least one valid item.'); return;
    }
    
    let finalCustomerId: string | null = data.customer_id;
    if (customerMode === 'existing' && !finalCustomerId) {
        toast('Please select a valid customer from the list.'); return;
    }

    if (customerMode === 'new') {
        if (!data.new_customer_name) { toast('New customer name is required.'); return; }
        const { data: createdCustomer, error } = await supabase.from('customers').insert({ name: data.new_customer_name, phone: data.new_customer_phone || null, gstin: data.new_customer_gstin || null, billing_address: data.new_customer_billing_address || null, email: null, is_guest: false }).select('id').single();
        if (error) { toast(`Error creating customer: ${error.message}`); return; }
        finalCustomerId = createdCustomer.id;
    } else if (customerMode === 'guest') {
        finalCustomerId = null;
    }
    
    mutation.mutate({ formData: { ...data, customer_id: finalCustomerId }, id: invoice?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Customer</h3>
            {['existing', 'new', 'guest'].map(mode => (
              <label key={mode} className="flex items-center capitalize">
                  <input type="radio" value={mode} checked={customerMode === mode} onChange={() => setCustomerMode(mode as any)} className="mr-2" /> {mode}
              </label>
            ))}
        </div>

        {customerMode === 'existing' && (
            <div className="relative" ref={suggestionsRef}>
              <label htmlFor="customer_name_display" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
              <Input id="customer_name_display" {...register('customer_name_display', { required: 'Customer name is required' })} disabled={isLoadingCustomers} placeholder="Type to search..." onFocus={() => setActiveSuggestionBox({ type: 'customer' })} autoComplete="off" />
              {activeSuggestionBox?.type === 'customer' && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                      <ul className="max-h-60 overflow-y-auto text-sm p-1">
                          {filteredCustomers.map(c => <li key={c.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700" onClick={() => handleCustomerSelect(c)}>{highlightMatch(c.name, customerNameDisplay)}</li>)}
                      </ul>
                  </div>
              )}
              {errors.customer_name_display && <p className="mt-1 text-sm text-red-500">{errors.customer_name_display.message}</p>}
            </div>
        )}

        {customerMode === 'new' && (
          <div className="p-4 border rounded-md space-y-4 bg-slate-50 dark:bg-slate-700/50">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="new_customer_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                    <Input id="new_customer_name" {...register('new_customer_name', { required: customerMode === 'new' ? 'Name is required' : false })} />
                    {errors.new_customer_name && <p className="mt-1 text-sm text-red-500">{errors.new_customer_name.message}</p>}
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

        {customerMode === 'guest' && (<div className="p-4 border rounded-md bg-slate-50 dark:bg-slate-700/50"><p className="text-sm text-gray-600 dark:text-gray-300">This invoice will be for a guest customer.</p></div>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
            <Input id="invoice_number" {...register('invoice_number', { required: 'Invoice number is required' })} />
            {errors.invoice_number && <p className="mt-1 text-sm text-red-500">{errors.invoice_number.message}</p>}
          </div>
          <div>
            <label htmlFor="invoice_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
            <Input id="invoice_date" type="date" {...register('invoice_date', { required: 'Date is required' })}/>
            {errors.invoice_date && <p className="mt-1 text-sm text-red-500">{errors.invoice_date.message}</p>}
          </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Items</h3>
        <div className="border rounded-lg dark:border-gray-700 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>HSN</TableHead><TableHead>Qty</TableHead><TableHead>Rate (GST Incl.)</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                 const item = watchedItems[index];
                 const product = products?.find(p => p.id === item?.product_id);
                 const amount = (item?.quantity || 0) * (item?.unit_price || 0);
                 const productNameQuery = item?.product_name_display || '';

                 // FIX: Removed useMemo hook from inside a loop to prevent conditional hook rendering, which causes React error #310.
                 // The filtering logic is now executed on every render, which is acceptable for this use case.
                 let filteredProducts: Product[] = [];
                 if (productNameQuery && products) {
                    const isExactMatch = products.some(p => p.name.toLowerCase() === productNameQuery.toLowerCase());
                    if (!isExactMatch) {
                        filteredProducts = products.filter(p => p.name.toLowerCase().includes(productNameQuery.toLowerCase()));
                    }
                 }

                return (
                <TableRow key={field.id} className="bg-white dark:bg-gray-800 align-top">
                  <TableCell className="p-2 whitespace-nowrap" style={{minWidth: '200px'}}>
                    <div className="relative" ref={suggestionsRef}>
                      <Input {...register(`items.${index}.product_name_display`, { required: true })} disabled={isLoadingProducts} placeholder="Type to search..." onFocus={() => setActiveSuggestionBox({ type: 'product', index })} autoComplete="off" />
                      {activeSuggestionBox?.type === 'product' && activeSuggestionBox.index === index && filteredProducts.length > 0 && (
                          <div className="absolute z-20 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                              <ul className="max-h-60 overflow-y-auto text-sm p-1">
                                  {filteredProducts.map(p => <li key={p.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700" onMouseDown={() => handleProductSelect(index, p)}>{highlightMatch(p.name, productNameQuery)}</li>)}
                              </ul>
                          </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-2"><Input value={product?.hsn_code || ''} readOnly className="w-24 bg-slate-100 dark:bg-slate-700/50" /></TableCell>
                  <TableCell className="p-2"><div className="flex items-start"><Input type="number" {...register(`items.${index}.quantity`, { required: true, valueAsNumber: true, min: 1 })} className="w-20" /><span className="ml-2 mt-2 text-sm text-gray-500 whitespace-nowrap">{product?.units?.abbreviation || ''}</span></div></TableCell>
                  <TableCell className="p-2"><Input type="number" step="0.01" {...register(`items.${index}.inclusive_rate_display`, { valueAsNumber: true, validate: v => v >= 0 || 'Rate must be non-negative' })} className="w-28" disabled={!item?.product_id} /></TableCell>
                  <TableCell className="p-2"><Input value={formatCurrency(amount)} readOnly className="w-28 bg-slate-100 dark:bg-slate-700/50" /></TableCell>
                  <TableCell className="p-2 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
        <Button type="button" variant="outline" onClick={() => append({ product_id: '', product_name_display: '', quantity: 1, unit_price: 0, tax_rate: 0, inclusive_rate_display: 0 })}>Add Item</Button>
      </div>

      {/* Invoice Totals Summary */}
      <div className="flex justify-end pt-6 mt-6 border-t dark:border-gray-700">
        <div className="w-full max-w-sm space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">CGST:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.tax / 2)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">SGST:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.tax / 2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 mt-2 border-t dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">Grand Total:</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(totals.grandTotal)}</span>
            </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (invoice ? 'Update Invoice' : 'Create Invoice')}</Button>
      </div>
    </form>
  );
};

export default InvoiceForm;