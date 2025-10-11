import React, { useState } from 'react';
// Fix: Import `keepPreviousData` from TanStack Query v5.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Customer } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import CustomerForm from '../components/CustomerForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';
import { Input } from '../components/ui/Input';
import { useDebounce } from '../hooks/useDebounce';
import Skeleton from '../components/ui/Skeleton';

const ITEMS_PER_PAGE = 10;

const fetchCustomers = async (page: number, searchTerm: string): Promise<{ data: Customer[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
};

const deleteCustomer = async (customerId: string) => {
    const { count, error: invoiceError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);
    
    if (invoiceError) throw new Error(`Failed to check for invoices: ${invoiceError.message}`);
    if (count && count > 0) {
        throw new Error('This customer cannot be deleted because they have existing invoices.');
    }

    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) throw new Error(error.message);
};

const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: customersData, isLoading, error } = useQuery({
    queryKey: ['customers', currentPage, debouncedSearchTerm],
    queryFn: () => fetchCustomers(currentPage, debouncedSearchTerm),
    placeholderData: keepPreviousData,
  });
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);


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
      toast(error.message);
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

  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>GSTIN / PAN</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-2/3" /></TableCell>
              <TableCell><Skeleton className="h-5 w-2/3" /></TableCell>
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Customers</h1>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle>Customer List</CardTitle>
               <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                    placeholder="Search by customer name..."
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
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>GSTIN / PAN</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length > 0 ? customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell data-label="Name" className="font-medium">{customer.name}</TableCell>
                        <TableCell data-label="Email">{customer.email || 'N/A'}</TableCell>
                        <TableCell data-label="Phone">{customer.phone || 'N/A'}</TableCell>
                        <TableCell data-label="GSTIN / PAN">{customer.gst_pan || 'N/A'}</TableCell>
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