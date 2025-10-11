
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Category } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Dialog from '../components/ui/Dialog';
import CategoryForm from '../components/CategoryForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';
import Skeleton from '../components/ui/Skeleton';
import DynamicIcon from '../components/ui/DynamicIcon';

const ITEMS_PER_PAGE = 10;

const fetchCategories = async (page: number): Promise<{ data: Category[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('categories')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
};

const deleteCategory = async (categoryId: string) => {
  const { count, error: checkError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId);

  if (checkError) {
    throw new Error(`Failed to check for product dependencies: ${checkError.message}`);
  }

  if (count && count > 0) {
    throw new Error(`This category cannot be deleted as it is used by ${count} product(s). Please remove it from products first.`);
  }

  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw new Error(error.message);
};

const CategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: categoriesData, isLoading, error } = useQuery({
    queryKey: ['categories', currentPage],
    queryFn: () => fetchCategories(currentPage),
    placeholderData: keepPreviousData,
  });

  const categories = categoriesData?.data ?? [];
  const totalCount = categoriesData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast('Category deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast(`Error deleting category: ${message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedCategory(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteMutation.mutate(categoryId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedCategory(undefined);
  };
  
  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-sm" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
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
        <div className="flex items-center gap-4">
           <Link to="/settings" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
              <ArrowLeft className="w-6 h-6" />
           </Link>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Manage Categories</h1>
        </div>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? renderSkeleton() : error instanceof Error ? <p className="text-red-500">Error: {error.message}</p> : (
            <>
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length > 0 ? categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell data-label="Name" className="font-medium">
                          <div className="flex items-center gap-3">
                            <DynamicIcon name={category.icon_name} className="w-5 h-5 text-slate-500" />
                            <span>{category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell data-label="Description">{category.description || 'N/A'}</TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex items-center justify-center space-x-2 md:justify-center">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(category)} aria-label="Edit Category">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive-outline" size="icon" onClick={() => handleDeleteClick(category.id)} disabled={deleteMutation.isPending} aria-label="Delete Category">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No categories found. Click "Add Category" to get started.</TableCell>
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

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedCategory ? 'Edit Category' : 'Add New Category'}>
        <CategoryForm 
          category={selectedCategory} 
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
    </div>
  );
};

export default CategoriesPage;