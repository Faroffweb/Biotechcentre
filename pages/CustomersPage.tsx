import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import CustomerForm from '../components/CustomerForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';

const ITEMS_PER_PAGE = 10;

const fetchCustomers = async (page: number): Promise<{ data: Customer[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
};

const deleteCustomer = async (customerId: string) => {
  const { error } = await supabase.from('customers').delete().eq('id', customerId);
  if (error) throw new Error(error.message);
};

const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: customersData, isLoading, error } = useQuery({
    queryKey: ['customers', currentPage],
    queryFn: () => fetchCustomers(currentPage),
    // Fix: Replaced `keepPreviousData: true` with `placeholderData: keepPreviousData` for TanStack Query v5 compatibility.
    placeholderData: keepPreviousData,
  });

  const customers = customersData?.data ?? [];
  const totalCount = customersData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      toast('Customer deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => {
      toast(`Error deleting customer: ${error.message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedCustomer(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      deleteMutation.mutate(customerId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedCustomer(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Customers</h1>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading customers...</p>}
          {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length > 0 ? customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell data-label="Name" className="font-medium">{customer.name}</TableCell>
                        <TableCell data-label="Email">{customer.email || 'N/A'}</TableCell>
                        <TableCell data-label="Phone">{customer.phone || 'N/A'}</TableCell>
                        <TableCell data-label="GSTIN">{customer.gstin || 'N/A'}</TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex items-center justify-center space-x-2 md:justify-center">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(customer)} aria-label="Edit Customer">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(customer.id)} disabled={deleteMutation.isPending} aria-label="Delete Customer">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No customers found. Click "Add Customer" to get started.</TableCell>
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

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedCustomer ? 'Edit Customer' : 'Add New Customer'}>
        <CustomerForm 
          customer={selectedCustomer} 
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
    </div>
  );
};

export default CustomersPage;