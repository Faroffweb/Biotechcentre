import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PurchaseWithProduct } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../lib/utils';
import Dialog from '../components/ui/Dialog';
import PurchaseForm from '../components/PurchaseForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';

const ITEMS_PER_PAGE = 10;

const fetchPurchases = async (page: number): Promise<{ data: PurchaseWithProduct[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('purchases')
    .select('*, products(name)', { count: 'exact' })
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

  const { data: purchasesData, isLoading, error } = useQuery({
    queryKey: ['purchases', currentPage],
    queryFn: () => fetchPurchases(currentPage),
    // Fix: Replaced `keepPreviousData: true` with `placeholderData: keepPreviousData` for TanStack Query v5 compatibility.
    placeholderData: keepPreviousData,
  });

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
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading purchases...</p>}
          {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
          {!isLoading && !error && (
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