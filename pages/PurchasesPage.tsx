import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { PurchaseWithProduct } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';
import { formatDate, formatCurrency } from '../hooks/lib/utils';
import Dialog from '../components/ui/Dialog';
import PurchaseForm from '../components/PurchaseForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';
import { Input } from '../components/ui/Input';
import { useDebounce } from '../hooks/useDebounce';
import Skeleton from '../components/ui/Skeleton';

const ITEMS_PER_PAGE = 10;

const fetchPurchases = async (page: number, searchTerm: string): Promise<{ data: PurchaseWithProduct[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase
    .from('purchases')
    .select('*, products!inner(name)', { count: 'exact' });
    
  if (searchTerm) {
    query = query.or(`reference_invoice.ilike.%${searchTerm}%,products.name.ilike.%${searchTerm}%`)
  }

  const { data, error, count } = await query
    .order('purchase_date', { ascending: false })
    .range(from, to);
    
  if (error) throw new Error(error.message);
  return { data: data as PurchaseWithProduct[], count: count || 0 };
};

const deletePurchase = async (purchaseId: string) => {
  const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);
  if (error) throw new Error(error.message);
};

const PurchasesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithProduct | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: purchasesData, isLoading, error } = useQuery({
    queryKey: ['purchases', currentPage, debouncedSearchTerm],
    queryFn: () => fetchPurchases(currentPage, debouncedSearchTerm),
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);


  const purchases = purchasesData?.data ?? [];
  const totalCount = purchasesData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      toast('Purchase record deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      toast(`Error deleting purchase: ${error.message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedPurchase(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (purchase: PurchaseWithProduct) => {
    setSelectedPurchase(purchase);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (purchaseId: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record? This may affect stock levels.')) {
      deleteMutation.mutate(purchaseId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedPurchase(undefined);
  };

  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Reference Invoice</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Purchases</h1>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Purchase
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle>Purchase History</CardTitle>
               <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                    placeholder="Search by Product or Ref #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
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
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference Invoice</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.length > 0 ? purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell data-label="Product" className="font-medium">{purchase.products?.name || 'N/A'}</TableCell>
                      <TableCell data-label="Date">{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell data-label="Reference Invoice">{purchase.reference_invoice || 'N/A'}</TableCell>
                      <TableCell data-label="Quantity">{purchase.quantity}</TableCell>
                      <TableCell data-label="Actions">
                        <div className="flex items-center justify-center space-x-2 md:justify-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(purchase)} aria-label="Edit Purchase">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(purchase.id)} disabled={deleteMutation.isPending} aria-label="Delete Purchase">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">No purchase records found.</TableCell>
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
       <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedPurchase ? 'Edit Purchase' : 'Add New Purchase'}>
        <PurchaseForm 
          purchase={selectedPurchase} 
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
    </div>
  );
};

export default PurchasesPage;