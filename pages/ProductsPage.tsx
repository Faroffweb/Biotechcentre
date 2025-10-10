// Fix: Implement the ProductsPage component, which was missing.
// Fix: Import `useState` from React to fix "Cannot find name 'useState'" errors.
import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, Category } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Pencil, Trash2, PlusCircle, Search } from 'lucide-react';
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
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
};

const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products', currentPage, debouncedSearchTerm, selectedCategory],
    queryFn: () => fetchProducts(currentPage, debouncedSearchTerm, selectedCategory),
    placeholderData: keepPreviousData,
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
      queryKey: ['categoriesList'],
      queryFn: fetchCategories
  });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory]);

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
      toast(`Error deleting product: ${error.message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      deleteMutation.mutate(productId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedProduct(undefined);
  };

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
                <select
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                    className="flex h-10 w-full sm:w-48 rounded-md border border-slate-300 bg-transparent py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingCategories}
                >
                    <option value="">All Categories</option>
                    {categories?.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
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
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(product.id)} disabled={deleteMutation.isPending} aria-label="Delete Product">
                              <Trash2 className="w-4 h-4 text-red-500" />
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

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedProduct ? 'Edit Product' : 'Add New Product'}>
        <ProductForm 
          product={selectedProduct} 
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
    </div>
  );
};

export default ProductsPage;