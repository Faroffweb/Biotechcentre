import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Purchase, PurchaseInsert, PurchaseUpdate, Product, ProductInsert, Unit, Category } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';

interface PurchaseFormProps {
  purchase?: Purchase;
  onSuccess: () => void;
  onCancel: () => void;
}

type PurchaseFormData = Omit<Purchase, 'id' | 'created_at' | 'product_id'> & {
    product_name: string;
    new_product_name?: string;
    new_product_hsn_code?: string;
    new_product_tax_rate?: number;
    new_product_unit_id?: string | null;
    new_product_unit_name?: string;
    new_product_category_id?: string | null;
    new_product_category_name?: string;
};

const fetchProducts = async (): Promise<Pick<Product, 'id' | 'name'>[]> => {
  const { data, error } = await supabase.from('products').select('id, name').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchUnits = async (): Promise<Unit[]> => {
    const { data, error } = await supabase.from('units').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
};

const fetchCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
};

const upsertPurchase = async ({ purchaseData, id }: { purchaseData: PurchaseInsert | PurchaseUpdate, id?: string }) => {
  if (id) {
    const { data, error } = await supabase.from('purchases').update(purchaseData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('purchases').insert(purchaseData as PurchaseInsert).select().single();
    if (error) throw error;
    return data;
  }
};

const PurchaseForm: React.FC<PurchaseFormProps> = ({ purchase, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const [productMode, setProductMode] = useState<'existing' | 'new'>('existing');
  
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);

  const productSuggestionsRef = useRef<HTMLDivElement>(null);
  const categorySuggestionsRef = useRef<HTMLDivElement>(null);
  const unitSuggestionsRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<PurchaseFormData>({
    defaultValues: {
      purchase_date: new Date().toISOString().split('T')[0],
      reference_invoice: '',
      quantity: 1,
      product_name: '',
      new_product_name: '',
      new_product_hsn_code: '',
      new_product_tax_rate: 0,
      new_product_unit_id: null,
      new_product_unit_name: '',
      new_product_category_id: null,
      new_product_category_name: '',
    },
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery<Pick<Product, 'id' | 'name'>[]>({
      queryKey: ['productsList'],
      queryFn: fetchProducts
  });
  const { data: units, isLoading: isLoadingUnits } = useQuery({ queryKey: ['unitsList'], queryFn: fetchUnits });
  const { data: categories, isLoading: isLoadingCategories } = useQuery({ queryKey: ['categoriesList'], queryFn: fetchCategories });
  
  const isEditing = !!purchase;

  useEffect(() => {
    if (isEditing && purchase) {
      reset({
        ...purchase,
        purchase_date: new Date(purchase.purchase_date).toISOString().split('T')[0],
        product_name: '',
      });
    } else {
      reset({
        purchase_date: new Date().toISOString().split('T')[0],
        reference_invoice: '',
        quantity: 1,
        product_name: '',
      });
    }
  }, [purchase, isEditing, reset]);

  useEffect(() => {
    if (isEditing && purchase && products?.length) {
        const productName = products.find(p => p.id === purchase.product_id)?.name || '';
        setValue('product_name', productName);
    }
  }, [isEditing, purchase, products, setValue]);
  
  useEffect(() => {
    if (isEditing) setProductMode('existing');
  }, [isEditing]);
  
  const productNameValue = watch('product_name');
  const categoryNameValue = watch('new_product_category_name');
  const unitNameValue = watch('new_product_unit_name');

  const filteredProducts = useMemo(() => {
    if (!productNameValue || !products) return [];
    const isExactMatch = products.some(p => p.name.toLowerCase() === productNameValue.toLowerCase());
    if (isExactMatch) return [];
    return products.filter(p => p.name.toLowerCase().includes(productNameValue.toLowerCase()));
  }, [productNameValue, products]);

  const filteredCategories = useMemo(() => {
    if (!categoryNameValue || !categories) return [];
    const isExactMatch = categories.some(c => c.name.toLowerCase() === categoryNameValue.toLowerCase());
    if (isExactMatch) return [];
    return categories.filter(c => c.name.toLowerCase().includes(categoryNameValue.toLowerCase()));
  }, [categoryNameValue, categories]);

  const filteredUnits = useMemo(() => {
    if (!unitNameValue || !units) return [];
    const isExactMatch = units.some(u => `${u.name} (${u.abbreviation})`.toLowerCase() === unitNameValue.toLowerCase());
    if (isExactMatch) return [];
    return units.filter(u => 
        u.name.toLowerCase().includes(unitNameValue.toLowerCase()) || 
        u.abbreviation.toLowerCase().includes(unitNameValue.toLowerCase())
    );
  }, [unitNameValue, units]);

  const handleProductSuggestionClick = (product: Pick<Product, 'id' | 'name'>) => {
    setValue('product_name', product.name, { shouldValidate: true });
    setShowProductSuggestions(false);
  };

  const handleCategorySuggestionClick = (category: Category) => {
    setValue('new_product_category_name', category.name);
    setValue('new_product_category_id', category.id);
    setShowCategorySuggestions(false);
  };

  const handleUnitSuggestionClick = (unit: Unit) => {
    setValue('new_product_unit_name', `${unit.name} (${unit.abbreviation})`);
    setValue('new_product_unit_id', unit.id);
    setShowUnitSuggestions(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (productSuggestionsRef.current && !productSuggestionsRef.current.contains(event.target as Node)) setShowProductSuggestions(false);
        if (categorySuggestionsRef.current && !categorySuggestionsRef.current.contains(event.target as Node)) setShowCategorySuggestions(false);
        if (unitSuggestionsRef.current && !unitSuggestionsRef.current.contains(event.target as Node)) setShowUnitSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mutation = useMutation({
    mutationFn: upsertPurchase,
    onSuccess: () => {
      toast(`Purchase ${purchase ? 'updated' : 'added'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      queryClient.invalidateQueries({ queryKey: ['productsList'] }); 
      onSuccess();
    },
    onError: (error) => toast(`Error: ${error.message}`),
  });

  const onSubmit: SubmitHandler<PurchaseFormData> = async (data) => {
    let productId = purchase?.product_id;

    if (productMode === 'new' && !isEditing) {
        if (!data.new_product_name) { toast('New product name is required.'); return; }
        
        let categoryId = data.new_product_category_id;
        if (data.new_product_category_name && !categoryId) {
            const cat = categories?.find(c => c.name.toLowerCase() === data.new_product_category_name?.toLowerCase());
            if (cat) categoryId = cat.id; else { toast('Invalid category. Please select from list.'); return; }
        }

        let unitId = data.new_product_unit_id;
        if (data.new_product_unit_name && !unitId) {
            const unit = units?.find(u => `${u.name} (${u.abbreviation})`.toLowerCase() === data.new_product_unit_name?.toLowerCase());
            if (unit) unitId = unit.id; else { toast('Invalid unit. Please select from list.'); return; }
        }

        const newProduct: ProductInsert = {
            name: data.new_product_name,
            description: null,
            hsn_code: data.new_product_hsn_code || null,
            sku: null,
            tax_rate: (data.new_product_tax_rate || 0) / 100,
            stock_quantity: 0,
            unit_price: 0,
            unit_id: unitId || null,
            category_id: categoryId || null,
        };
        const { data: createdProduct, error } = await supabase.from('products').insert(newProduct).select('id').single();
        if (error) { toast(`Error creating product: ${error.message}`); return; }
        productId = createdProduct.id;
    }

    if (productMode === 'existing' && !isEditing) {
        const selectedProduct = products?.find(p => p.name === data.product_name);
        if (!selectedProduct) { toast('Please select a valid product from the list.'); return; }
        productId = selectedProduct.id;
    }

    if (!productId) { toast('A product must be selected or created.'); return; }
    const purchaseData: PurchaseInsert | PurchaseUpdate = {
        product_id: productId,
        purchase_date: data.purchase_date,
        reference_invoice: data.reference_invoice,
        quantity: Number(data.quantity),
    };
    mutation.mutate({ purchaseData, id: purchase?.id });
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!isEditing && (
        <div className="flex items-center space-x-4">
            <label className="flex items-center"><input type="radio" value="existing" checked={productMode === 'existing'} onChange={() => setProductMode('existing')} className="mr-2" />Existing Product</label>
            <label className="flex items-center"><input type="radio" value="new" checked={productMode === 'new'} onChange={() => setProductMode('new')} className="mr-2" />New Product</label>
        </div>
      )}
      {productMode === 'existing' ? (
        <div className="relative" ref={productSuggestionsRef}>
            <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product</label>
            <Input id="product_name" {...register('product_name', { required: 'Please select a product' })} disabled={isLoadingProducts || isEditing} placeholder={isLoadingProducts ? "Loading..." : "Type to search"} onFocus={() => setShowProductSuggestions(true)} autoComplete="off" />
            {showProductSuggestions && productNameValue && (
              <div className="absolute z-10 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                <ul className="max-h-60 overflow-y-auto text-sm p-1">
                  {isLoadingProducts && <li className="px-3 py-2.5 text-slate-500 italic">Loading...</li>}
                  {!isLoadingProducts && filteredProducts.length === 0 && <li className="px-3 py-2.5 text-slate-500 italic">No products found.</li>}
                  {!isLoadingProducts && filteredProducts.map(p => <li key={p.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors duration-150" onClick={() => handleProductSuggestionClick(p)} onMouseDown={(e) => e.preventDefault()}>{highlightMatch(p.name, productNameValue)}</li>)}
                </ul>
              </div>
            )}
            {/* FIX: Removed optional chaining to resolve ReactNode type error */}
            {errors.product_name && <p className="mt-1 text-sm text-red-500">{errors.product_name.message}</p>}
        </div>
      ) : (
        <div className="p-4 border rounded-md space-y-4 bg-slate-50 dark:bg-slate-700/50">
            <h4 className="font-medium">Create New Product</h4>
            <div>
                <label htmlFor="new_product_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                <Input id="new_product_name" {...register('new_product_name', { required: productMode === 'new' ? 'Product name is required.' : false })} />
                {/* FIX: Removed optional chaining to resolve ReactNode type error */}
                {errors.new_product_name && <p className="mt-1 text-sm text-red-500">{errors.new_product_name.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new_product_hsn_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">HSN Code</label>
                  <Input id="new_product_hsn_code" {...register('new_product_hsn_code')} />
                </div>
                <div>
                  <label htmlFor="new_product_tax_rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tax Rate (%)</label>
                  <Input id="new_product_tax_rate" type="number" step="0.01" {...register('new_product_tax_rate', { valueAsNumber: true, min: 0, max: 100 })} />
                </div>
                <div className="relative" ref={categorySuggestionsRef}>
                    <label htmlFor="new_product_category_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <Input id="new_product_category_name" {...register('new_product_category_name')} disabled={isLoadingCategories} placeholder={isLoadingCategories ? 'Loading...' : 'Type to search'} onFocus={() => setShowCategorySuggestions(true)} autoComplete="off" />
                    {showCategorySuggestions && categoryNameValue && (
                        <div className="absolute z-10 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                            <ul className="max-h-60 overflow-y-auto text-sm p-1">
                                {isLoadingCategories && <li className="px-3 py-2.5 text-slate-500 italic">Loading...</li>}
                                {!isLoadingCategories && filteredCategories.length === 0 && <li className="px-3 py-2.5 text-slate-500 italic">No categories found.</li>}
                                {!isLoadingCategories && filteredCategories.map(c => <li key={c.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors duration-150" onClick={() => handleCategorySuggestionClick(c)} onMouseDown={(e) => e.preventDefault()}>{highlightMatch(c.name, categoryNameValue)}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="relative" ref={unitSuggestionsRef}>
                    <label htmlFor="new_product_unit_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
                    <Input id="new_product_unit_name" {...register('new_product_unit_name')} disabled={isLoadingUnits} placeholder={isLoadingUnits ? 'Loading...' : 'Type to search'} onFocus={() => setShowUnitSuggestions(true)} autoComplete="off" />
                    {showUnitSuggestions && unitNameValue && (
                        <div className="absolute z-10 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                            <ul className="max-h-60 overflow-y-auto text-sm p-1">
                                {isLoadingUnits && <li className="px-3 py-2.5 text-slate-500 italic">Loading...</li>}
                                {!isLoadingUnits && filteredUnits.length === 0 && <li className="px-3 py-2.5 text-slate-500 italic">No units found.</li>}
                                {!isLoadingUnits && filteredUnits.map(u => <li key={u.id} className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors duration-150" onClick={() => handleUnitSuggestionClick(u)} onMouseDown={(e) => e.preventDefault()}>{highlightMatch(`${u.name} (${u.abbreviation})`, unitNameValue)}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Date</label>
          <Input id="purchase_date" type="date" {...register('purchase_date', { required: 'Date is required' })} />
          {errors.purchase_date && <p className="mt-1 text-sm text-red-500">{errors.purchase_date.message}</p>}
        </div>
        <div>
          <label htmlFor="reference_invoice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference Invoice</label>
          <Input id="reference_invoice" {...register('reference_invoice')} />
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
          <Input id="quantity" type="number" {...register('quantity', { required: 'Quantity is required', valueAsNumber: true, min: { value: 1, message: 'Quantity must be positive' } })} />
          {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity.message}</p>}
        </div>
      </div>
      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (purchase ? 'Update Purchase' : 'Create Purchase')}</Button>
      </div>
    </form>
  );
};

export default PurchaseForm;