// Fix: Implement the ProductsPage component, which was missing.
import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import ProductForm from '../components/ProductForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';

const ITEMS_PER_PAGE = 10;

const fetchProducts = async (page: number): Promise<{ data: Product[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('products')
    .select('*, units(abbreviation), categories(name)', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
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

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products', currentPage],
    queryFn: () => fetchProducts(currentPage),
    // Fix: Replaced `keepPreviousData: true` with `placeholderData: keepPreviousData` for TanStack Query v5 compatibility.
    placeholderData: keepPreviousData,
  });

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
          <CardTitle>Product List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading products...</p>}
          {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
          {!isLoading && !error && (
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
                        <TableCell data-label="Name" className="font-medium">{product.name}</TableCell>
                        <TableCell data-label="Category">{product.categories?.name || 'N/A'}</TableCell>
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