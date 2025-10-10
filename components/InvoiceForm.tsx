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
  customer_name_display: string;
  invoice_date: string;
  invoice_number: string;
  notes: string;
  items: {
    product_id: string;
    product_name_display: string;
    quantity: number;
    unit_price: number; // pre-tax, calculated
    tax_rate: number;
    inclusive_rate: number; // GST-inclusive, this is what the user types in the "Rate" field
  }[];
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

const fetchLastInvoiceNumber = async (): Promise<string | null> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.invoice_number || null;
};

const upsertInvoice = async ({ formData, id }: { formData: Omit<FormValues, 'new_customer_name' | 'new_customer_phone' | 'new_customer_gstin' | 'new_customer_billing_address' | 'customer_name_display'>, id?: string }) => {
    const invoiceData = {
        customer_id: formData.customer_id,
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
        notes: formData.notes || null,
    };
    
    const itemsToSave = formData.items.map(({ product_name_display, inclusive_rate, ...rest }) => rest);
    
    // Calculate total amount on the client-side before sending to DB.
    // The DB trigger is a fallback, but this provides a value immediately.
    const total_amount = itemsToSave.reduce((acc, item) => {
        return acc + (item.quantity * item.unit_price * (1 + item.tax_rate));
    }, 0);

    const finalInvoiceData = { ...invoiceData, total_amount };

    if (id) {
        // Update
        const { data: updatedInvoice, error: invoiceError } = await supabase.from('invoices').update(finalInvoiceData).eq('id', id).select('id').single();
        if (invoiceError) throw invoiceError;
        const { error: deleteError } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
        if (deleteError) throw deleteError;
        const itemsData = itemsToSave.map(item => ({ ...item, invoice_id: id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;
        return updatedInvoice;
    } else {
        // Create
        const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert(finalInvoiceData).select('id').single();
        if (invoiceError) throw invoiceError;
        const itemsData = itemsToSave.map(item => ({ ...item, invoice_id: newInvoice.id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsData);
        if (itemsError) throw itemsError;
        return newInvoice;
    }
};

const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const isEditing = !!invoice;
  const [customerMode, setCustomerMode] = useState<'existing' | 'new' | 'guest'>(isEditing && !invoice.customer_id ? 'guest' : 'existing');
  const [activeSuggestionBox, setActiveSuggestionBox] = useState<{ type: 'customer' | 'product', index?: number } | null>(null);
  const suggestionsRef = useRef<HTMLFormElement>(null);

  const { data: customers, isLoading: isLoadingCustomers } = useQuery({ queryKey: ['customersList'], queryFn: fetchCustomers });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['productsListAll'], queryFn: fetchProducts });
  const { data: lastInvoiceNumber } = useQuery({ queryKey: ['lastInvoiceNumber'], queryFn: fetchLastInvoiceNumber, enabled: !isEditing });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customer_id: null,
      customer_name_display: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      notes: '',
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (invoice) {
      setCustomerMode(invoice.customer_id ? 'existing' : 'guest');
      reset({
        customer_id: invoice.customer_id,
        customer_name_display: invoice.customers?.name || '',
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        invoice_number: invoice.invoice_number,
        notes: invoice.notes || '',
        items: invoice.invoice_items.map(item => ({
            product_id: item.product_id,
            product_name_display: item.products?.name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            inclusive_rate: item.unit_price * (1 + item.tax_rate),
        })),
      });
    } else {
       reset({
        customer_id: null,
        customer_name_display: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        notes: '',
        items: [{ product_id: '', product_name_display: '', quantity: 1, unit_price: 0, tax_rate: 0, inclusive_rate: 0 }],
      });
    }
  }, [invoice, reset]);

  useEffect(() => {
    if (isEditing) return;

    if (lastInvoiceNumber) {
      const matches = lastInvoiceNumber.match(/(\d+)$/);
      if (matches) {
        const numberPart = parseInt(matches[0], 10);
        const prefix = lastInvoiceNumber.substring(0, lastInvoiceNumber.length - matches[0].length);
        const nextNumber = (numberPart + 1).toString().padStart(matches[0].length, '0');
        setValue('invoice_number', `${prefix}${nextNumber}`);
      } else {
        setValue('invoice_number', `${lastInvoiceNumber}-1`);
      }
    } else {
      // If no invoices exist yet, start with the user-defined format.
      setValue('invoice_number', 'BTC-001');
    }
  }, [lastInvoiceNumber, isEditing, setValue]);
  
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
    const currentQuantity = watchedItems[index]?.quantity || 1;
    const inclusiveRate = product.unit_price * (1 + product.tax_rate);
    update(index, { 
        product_id: product.id, 
        product_name_display: product.name, 
        quantity: currentQuantity, 
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
        inclusive_rate: inclusiveRate,
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
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onSuccess();
    },
    onError: (error) => toast(`Error: ${error.message}`),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (data.items.length === 0 || !data.items.find(item => item.product_id)) {
        toast('Please add at least one valid item.'); return;
    }
    let finalCustomerId: string | null = data.customer_id;
    if (customerMode === 'existing') {
        const matchingCustomer = customers?.find(c => c.name.toLowerCase() === data.customer_name_display.toLowerCase());
        if (!matchingCustomer) { toast('Please select a valid customer from the list.'); return; }
        finalCustomerId = matchingCustomer.id;
    } else if (customerMode === 'new') {
        if (!data.new_customer_name) { toast('New customer name is required.'); return; }
        const { data: createdCustomer, error } = await supabase.from('customers').insert({ name: data.new_customer_name, phone: data.new_customer_phone || null, gstin: data.new_customer_gstin || null, billing_address: data.new_customer_billing_address || null, email: null, is_guest: false }).select('id').single();
        if (error) { toast(`Error creating customer: ${error.message}`); return; }
        finalCustomerId = createdCustomer.id;
    } else if (customerMode === 'guest') {
        finalCustomerId = null;
    }

    // FIX: Prepare the form data for the mutation by removing temporary fields 
    // (`customer_name_display`, `new_customer_*`) to match the expected type of `upsertInvoice`.
    // This also resolves the error caused by an incorrect transformation of the `items` array.
    const { 
        customer_name_display, 
        new_customer_name, 
        new_customer_phone, 
        new_customer_gstin, 
        new_customer_billing_address, 
        ...formDataForMutation 
    } = {
      ...data,
      customer_id: finalCustomerId,
    };
    
    mutation.mutate({ formData: formDataForMutation, id: invoice?.id });
  };
  
  const customerSection = () => {
    switch (customerMode) {
        case 'existing':
            return (
                <div className="relative">
                    <label htmlFor="customer_name_display" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                    <Input id="customer_name_display" {...register('customer_name_display', { required: 'Please select a customer' })} disabled={isLoadingCustomers} placeholder={isLoadingCustomers ? "Loading customers..." : "Type to search for a customer"} onFocus={() => setActiveSuggestionBox({ type: 'customer' })} autoComplete="off" />
                    {activeSuggestionBox?.type === 'customer' && filteredCustomers.length > 0 && (
                        <div className="absolute z-20 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                            <ul className="max-h-60 overflow-y-auto text-sm p-1">
                                {filteredCustomers.map(c => <li key={c.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700" onMouseDown={(e) => { e.preventDefault(); handleCustomerSelect(c); }}>{highlightMatch(c.name, customerNameDisplay)}</li>)}
                            </ul>
                        </div>
                    )}
                    {errors.customer_name_display && <p className="mt-1 text-sm text-red-500">{errors.customer_name_display.message}</p>}
                </div>
            );
        case 'new':
            return (
                <div className="p-4 border rounded-md space-y-4 bg-slate-50 dark:bg-slate-700/50">
                    <h4 className="font-medium">New Customer Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="new_customer_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label><Input id="new_customer_name" {...register('new_customer_name', { required: customerMode === 'new' ? 'Customer name is required.' : false })} />{errors.new_customer_name && <p className="mt-1 text-sm text-red-500">{errors.new_customer_name.message}</p>}</div>
                        <div><label htmlFor="new_customer_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label><Input id="new_customer_phone" {...register('new_customer_phone')} /></div>
                        <div><label htmlFor="new_customer_gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</label><Input id="new_customer_gstin" {...register('new_customer_gstin')} /></div>
                        <div className="md:col-span-2"><label htmlFor="new_customer_billing_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Billing Address</label><textarea id="new_customer_billing_address" rows={2} className="flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700" {...register('new_customer_billing_address')} /></div>
                    </div>
                </div>
            );
        case 'guest':
            return (
                <div className="p-4 rounded-md bg-slate-100 dark:bg-slate-700/50">
                    <p className="text-sm text-slate-600 dark:text-slate-300">This invoice will be created without a customer record.</p>
                </div>
            );
        default:
            return null;
    }
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" ref={suggestionsRef}>
      <div className="p-4 border rounded-lg dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Customer</h3>
        <div className="flex items-center space-x-4">
            {['existing', 'new', 'guest'].map(mode => (
              <label key={mode} className="flex items-center capitalize text-sm">
                  <input type="radio" value={mode} checked={customerMode === mode} onChange={() => setCustomerMode(mode as any)} className="mr-2" /> {mode}
              </label>
            ))}
        </div>
        {customerSection()}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label><Input id="invoice_number" {...register('invoice_number', { required: 'Invoice number is required' })} />{errors.invoice_number && <p className="mt-1 text-sm text-red-500">{errors.invoice_number.message}</p>}</div>
          <div><label htmlFor="invoice_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label><Input id="invoice_date" type="date" {...register('invoice_date', { required: 'Date is required' })}/>{errors.invoice_date && <p className="mt-1 text-sm text-red-500">{errors.invoice_date.message}</p>}</div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Items</h3>
        <div className="hidden md:grid md:grid-cols-[1fr,110px,110px,110px,110px,40px] gap-x-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-t-lg text-sm font-semibold text-slate-600 dark:text-slate-300 text-right"><div className="text-left">Product</div><div>Qty</div><div>Rate (incl. GST)</div><div>Taxable</div><div>Total</div><div></div></div>
        <div className="border rounded-lg dark:border-gray-700 divide-y dark:divide-gray-700 md:border-t-0 md:rounded-t-none md:divide-y-0">
          {fields.map((field, index) => {
             const item = watchedItems[index]; const product = products?.find(p => p.id === item?.product_id); const taxableAmount = (item?.quantity || 0) * (item?.unit_price || 0); const totalAmount = taxableAmount * (1 + (item?.tax_rate || 0)); const productNameQuery = item?.product_name_display || ''; let filteredProducts: Product[] = []; if (productNameQuery && products) { const isExactMatch = products.some(p => p.name.toLowerCase() === productNameQuery.toLowerCase()); if (!isExactMatch) { filteredProducts = products.filter(p => p.name.toLowerCase().includes(productNameQuery.toLowerCase())); }}
            return (
              <div key={field.id} className="p-3 md:p-2 grid grid-cols-2 md:grid-cols-[1fr,110px,110px,110px,110px,40px] gap-x-2 gap-y-3 items-start">
                <div className="col-span-2 md:col-span-1"><label className="text-xs font-medium text-slate-500 md:hidden">Product</label><div className="relative"><Input {...register(`items.${index}.product_name_display`, { required: true })} disabled={isLoadingProducts} placeholder="Type to search..." onFocus={() => setActiveSuggestionBox({ type: 'product', index })} autoComplete="off" />{activeSuggestionBox?.type === 'product' && activeSuggestionBox.index === index && filteredProducts.length > 0 && (<div className="absolute z-20 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700"><ul className="max-h-60 overflow-y-auto text-sm p-1">{filteredProducts.map(p => <li key={p.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700" onMouseDown={(e) => e.preventDefault()} onClick={() => handleProductSelect(index, p)}>{highlightMatch(p.name, productNameQuery)}</li>)}</ul></div>)}{product && <div className="text-xs text-slate-500 mt-1">HSN: {product.hsn_code || 'N/A'} | Tax: {product.tax_rate*100}%</div>}</div></div>
                <div className="col-span-1"><label className="text-xs font-medium text-slate-500 md:hidden">Qty</label><Input type="number" {...register(`items.${index}.quantity`, { required: true, valueAsNumber: true, min: 1 })} /></div>
                <div className="col-span-1"><label className="text-xs font-medium text-slate-500 md:hidden">Rate (incl. GST)</label><Input type="number" step="0.01" {...register(`items.${index}.inclusive_rate`, { valueAsNumber: true, validate: v => v >= 0 || 'Rate must be non-negative' })} onChange={(e) => { const newInclusiveRate = parseFloat(e.target.value) || 0; const taxRate = watchedItems[index].tax_rate || 0; const newUnitPrice = newInclusiveRate / (1 + taxRate); setValue(`items.${index}.unit_price`, newUnitPrice); setValue(`items.${index}.inclusive_rate`, newInclusiveRate); }} disabled={!item?.product_id} /></div>
                <div className="col-span-1"><label className="text-xs font-medium text-slate-500 md:hidden">Taxable</label><Input value={formatCurrency(taxableAmount)} readOnly className="bg-slate-100 dark:bg-slate-700/50"/></div>
                <div className="col-span-1"><label className="text-xs font-medium text-slate-500 md:hidden">Total</label><Input value={formatCurrency(totalAmount)} readOnly className="bg-slate-100 dark:bg-slate-700/50"/></div>
                <div className="col-span-2 md:col-span-1 self-center flex-grow flex justify-end"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button></div>
              </div>
            )
          })}
        </div>
        <Button type="button" variant="outline" onClick={() => append({ product_id: '', product_name_display: '', quantity: 1, unit_price: 0, tax_rate: 0, inclusive_rate: 0 })}>Add Item</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Terms</label><textarea id="notes" {...register('notes')} rows={5} className="mt-1 flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-50" /></div>
        <div className="flex justify-end items-end">
          <div className="w-full max-w-sm space-y-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Subtotal:</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">CGST:</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.tax / 2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">SGST:</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.tax / 2)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 mt-2 border-t dark:border-gray-600"><span className="text-gray-900 dark:text-white">Grand Total:</span><span className="text-gray-900 dark:text-white">{formatCurrency(totals.grandTotal)}</span></div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (invoice ? 'Update Invoice' : 'Save Invoice')}</Button>
      </div>
    </form>
  );
};

export default InvoiceForm;