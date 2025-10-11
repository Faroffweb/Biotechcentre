// Fix: Implement the ProductsPage component, which was missing.
// Fix: Import `useState` from React to fix "Cannot find name 'useState'" errors.
import React, { useState, useRef, useEffect } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, Category } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Pencil, Trash2, PlusCircle, Search, ChevronDown, Copy } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import ProductForm from '../components/ProductForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';
import { Input } from '../components/ui/Input';
import { useDebounce } from '../hooks/useDebounce';
import Skeleton from '../components/ui/Skeleton';
import { Link } from 'react-router-dom';
import DynamicIcon from '../components/ui/DynamicIcon';

const ITEMS_PER_PAGE = 10;

const fetchProducts = async (page: number, searchTerm: string, categoryId: string | null): Promise<{ data: Product[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase
    .from('products')
    .select('*, units(abbreviation), categories(name, icon_name)', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }
  
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
};

const fetchCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
};

const deleteProduct = async (productId: string) => {
    // Check for dependencies first
    const { count: purchaseCount, error: purchaseError } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);
    
    if (purchaseError) throw new Error(`Failed to check purchases: ${purchaseError.message}`);
    if (purchaseCount && purchaseCount > 0) {
        throw new Error('This product cannot be deleted as it is part of purchase records.');
    }

    const { count: invoiceItemCount, error: invoiceItemError } = await supabase
        .from('invoice_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

    if (invoiceItemError) throw new Error(`Failed to check invoices: ${invoiceItemError.message}`);
    if (invoiceItemCount && invoiceItemCount > 0) {
        throw new Error('This product cannot be deleted as it is included in existing invoices.');
    }

    // If no dependencies, proceed with deletion
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new Error(error.message);
};

const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products', currentPage, debouncedSearchTerm, selectedCategory],
    queryFn: () => fetchProducts(currentPage, debouncedSearchTerm, selectedCategory),
    placeholderData: keepPreviousData,
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
      queryKey: ['categoriesList'],
      queryFn: fetchCategories
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const products = productsData?.data ?? [];
  const totalCount = productsData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast('Product deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Failed to delete product.');
    },
  });

  const handleAddClick = () => {
    setSelectedProduct(undefined);
    setIsDuplicateMode(false);
    setIsModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDuplicateMode(false);
    setIsModalOpen(true);
  };
  
  const handleDuplicateClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDuplicateMode(true);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteConfirmOpen(true);
  };
  
  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete);
    }
    setIsDeleteConfirmOpen(false);
    setProductToDelete(null);
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedProduct(undefined);
    setIsDuplicateMode(false);
  };

  const selectedCategoryLabel = categories?.find(c => c.id === selectedCategory)?.name || 'All Categories';

  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>HSN Code</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/3" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
              <TableCell>
                <div className="flex items-center justify-center space-x-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Inventory / Products</h1>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <CardTitle>Product List</CardTitle>
             <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-48" ref={dropdownRef}>
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full justify-between font-normal" 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        aria-haspopup="listbox"
                        aria-expanded={isDropdownOpen}
                        disabled={isLoadingCategories}
                    >
                        <span className="truncate">{isLoadingCategories ? 'Loading...' : selectedCategoryLabel}</span>
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {isDropdownOpen && (
                        <Card className="absolute z-10 w-full mt-1 rounded-md shadow-lg animate-scale-in origin-top">
                            <CardContent className="p-1 max-h-60 overflow-y-auto">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!selectedCategory}
                                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                    onClick={() => { setSelectedCategory(null); setIsDropdownOpen(false); }}
                                >
                                    All Categories
                                </button>
                                {categories?.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        role="option"
                                        aria-selected={selectedCategory === cat.id}
                                        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm flex items-center gap-2"
                                        onClick={() => { setSelectedCategory(cat.id); setIsDropdownOpen(false); }}
                                    >
                                      <DynamicIcon name={cat.icon_name} className="w-4 h-4 text-slate-500" />
                                      <span>{cat.name}</span>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input 
                        placeholder="Search by product name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
             </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? renderSkeleton() : error instanceof Error ? <p className="text-red-500">Error: {error.message}</p> : (
            <>
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>HSN Code</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length > 0 ? products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell data-label="Name" className="font-medium">
                          <Link to={`/stock/${product.id}`} className="hover:underline text-blue-600">
                            {product.name}
                          </Link>
                        </TableCell>
                        <TableCell data-label="Category">
                          <div className="flex items-center gap-2">
                            <DynamicIcon name={product.categories?.icon_name} className="w-4 h-4 text-slate-500" />
                            <span>{product.categories?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell data-label="HSN Code">{product.hsn_code || 'N/A'}</TableCell>
                        <TableCell data-label="Stock">{product.stock_quantity} {product.units?.abbreviation || ''}</TableCell>
                        <TableCell data-label="Tax">{product.tax_rate * 100}%</TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex items-center justify-center space-x-2 md:justify-center">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)} aria-label="Edit Product">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicateClick(product)} aria-label="Duplicate Product">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive-outline" size="icon" onClick={() => handleDeleteClick(product.id)} disabled={deleteMutation.isPending} aria-label="Delete Product">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">No products found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalCount={totalCount}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedProduct && !isDuplicateMode ? 'Edit Product' : 'Add New Product'}>
        <ProductForm 
          product={selectedProduct} 
          isDuplicate={isDuplicateMode}
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
      
      <Dialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Confirm Deletion">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this product? This action cannot be undone and will permanently remove the product record.
          </p>
          <div className="flex justify-end space-x-4 pt-6">
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default ProductsPage;