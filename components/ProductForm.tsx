// Fix: Implement the ProductForm component, which was missing.
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, ProductInsert, ProductUpdate, Unit, Category } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from './ui/Toaster';
import DynamicIcon from './ui/DynamicIcon';

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

type ProductFormData = Omit<Product, 'id' | 'created_at' | 'units' | 'categories'> & {
    category_name_display?: string; // For the category search input
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

const upsertProduct = async ({ product, id }: { product: ProductInsert | ProductUpdate, id?: string }) => {
  if (id) {
    const { data, error } = await supabase.from('products').update(product).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('products').insert(product as ProductInsert).select().single();
    if (error) throw error;
    return data;
  }
};

const ProductForm: React.FC<ProductFormProps> = ({ product, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categorySuggestionsRef = useRef<HTMLDivElement>(null);

  const { data: units, isLoading: isLoadingUnits } = useQuery({ queryKey: ['unitsList'], queryFn: fetchUnits });
  const { data: categories, isLoading: isLoadingCategories } = useQuery({ queryKey: ['categoriesList'], queryFn: fetchCategories });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    defaultValues: {
      name: '',
      description: '',
      hsn_code: '',
      sku: '',
      stock_quantity: 0,
      tax_rate: 0,
      unit_price: 0,
      unit_id: null,
      category_id: null,
      category_name_display: '',
    },
  });

  const categoryNameDisplay = watch('category_name_display');

  useEffect(() => {
    if (product && categories) {
        const categoryName = categories.find(c => c.id === product.category_id)?.name || '';
        reset({
            ...product,
            tax_rate: product.tax_rate * 100, // Convert decimal to percentage for display
            unit_id: product.unit_id || null,
            category_id: product.category_id || null,
            category_name_display: categoryName,
        });
    } else if (!product) {
        reset({
            name: '',
            description: '',
            hsn_code: '',
            sku: '',
            stock_quantity: 0,
            tax_rate: 0,
            unit_price: 0,
            unit_id: null,
            category_id: null,
            category_name_display: '',
        });
    }
  }, [product, reset, categories]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (categorySuggestionsRef.current && !categorySuggestionsRef.current.contains(event.target as Node)) {
            setShowCategorySuggestions(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    if (!categoryNameDisplay || !categories) return [];
    if (categories.some(c => c.name.toLowerCase() === categoryNameDisplay.toLowerCase())) return [];
    return categories.filter(c => c.name.toLowerCase().includes(categoryNameDisplay.toLowerCase()));
  }, [categoryNameDisplay, categories]);
  
  const handleCategorySelect = (category: Category) => {
    setValue('category_id', category.id);
    setValue('category_name_display', category.name);
    setShowCategorySuggestions(false);
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

  const mutation = useMutation({
    mutationFn: upsertProduct,
    onSuccess: () => {
      toast(`Product ${product ? 'updated' : 'added'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onSuccess();
    },
    onError: (error) => {
      toast(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<ProductFormData> = (data) => {
    // Ensure category_id is set if name exists but ID doesn't
    let finalCategoryId = data.category_id;
    if (data.category_name_display && !finalCategoryId) {
        const matchingCategory = categories?.find(c => c.name.toLowerCase() === data.category_name_display?.toLowerCase());
        if (matchingCategory) {
            finalCategoryId = matchingCategory.id;
        } else {
             // Handle case where text is typed but not selected (optional: treat as null or show error)
            finalCategoryId = null; 
        }
    }
    
    // If name is cleared, also clear id
    if (!data.category_name_display) {
        finalCategoryId = null;
    }

    const { category_name_display, ...productData } = data;
    mutation.mutate({ product: {
      ...productData,
      stock_quantity: Number(data.stock_quantity),
      tax_rate: Number(data.tax_rate) / 100, // Store tax rate as a decimal
      unit_id: data.unit_id || null,
      category_id: finalCategoryId,
    }, id: product?.id });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
        <Input id="name" {...register('name', { required: 'Product name is required' })} />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <textarea
          id="description"
          rows={3}
          className="flex w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
          {...register('description')}
        />
      </div>
      
       <div className="relative" ref={categorySuggestionsRef}>
          <label htmlFor="category_name_display" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <Input
            id="category_name_display"
            {...register('category_name_display')}
            onFocus={() => setShowCategorySuggestions(true)}
            autoComplete="off"
            disabled={isLoadingCategories}
            placeholder={isLoadingCategories ? 'Loading...' : 'Type to search for a category (optional)'}
          />
          {showCategorySuggestions && filteredCategories.length > 0 && (
            <div className="absolute z-10 w-full mt-1.5 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                <ul className="max-h-60 overflow-y-auto text-sm p-1">
                    {filteredCategories.map(c => 
                        <li 
                          key={c.id} 
                          className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700"
                          onMouseDown={() => handleCategorySelect(c)}
                        >
                          <div className="flex items-center gap-3">
                            <DynamicIcon name={c.icon_name} className="w-4 h-4 text-slate-500" />
                            <span>{highlightMatch(c.name, categoryNameDisplay || '')}</span>
                          </div>
                        </li>
                    )}
                </ul>
            </div>
          )}
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="hsn_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">HSN Code</label>
          <Input id="hsn_code" {...register('hsn_code')} />
        </div>
        <div>
          <label htmlFor="sku" className="block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
          <Input id="sku" {...register('sku')} />
        </div>
         <div>
          <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price (₹)</label>
          <Input id="unit_price" type="number" step="0.01" {...register('unit_price', { required: 'Unit price is required', valueAsNumber: true, min: { value: 0, message: 'Unit price must be non-negative' } })} />
          {errors.unit_price && <p className="mt-1 text-sm text-red-500">{errors.unit_price.message}</p>}
        </div>
        <div>
          <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
          <select
            id="unit_id"
            {...register('unit_id')}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900"
            disabled={isLoadingUnits}
          >
            <option value="">{isLoadingUnits ? 'Loading...' : 'Select unit'}</option>
            {units?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="stock_quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Quantity</label>
          <Input id="stock_quantity" type="number" {...register('stock_quantity', { required: true, valueAsNumber: true, min: 0 })} />
          {errors.stock_quantity && <p className="mt-1 text-sm text-red-500">Stock cannot be negative.</p>}
        </div>
        <div>
          <label htmlFor="tax_rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tax Rate (%)</label>
          <Input id="tax_rate" type="number" step="0.01" {...register('tax_rate', { required: true, valueAsNumber: true, min: 0, max: 100 })} />
          {errors.tax_rate && <p className="mt-1 text-sm text-red-500">Tax rate must be between 0 and 100.</p>}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;