import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
// Fix: Import `Invoice` and `Customer` types for the `FullInvoice` type definition.
import { InvoiceWithDetails, InvoiceItem, Invoice, Customer, Unit } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2, Printer } from 'lucide-react';
import { formatDate, formatCurrency } from '../lib/utils';
import Pagination from '../components/ui/Pagination';
import Dialog from '../components/ui/Dialog';
import InvoiceForm from '../components/InvoiceForm';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { toast } from '../components/ui/Toaster';

const ITEMS_PER_PAGE = 10;

// This type definition must be compatible with InvoiceTemplate's props
type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; units?: Pick<Unit, 'abbreviation'> | null } | null })[];
};

// Fetch Functions
const fetchInvoices = async (page: number): Promise<{ data: InvoiceWithDetails[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('invoices')
    .select('*, customers(name)', { count: 'exact' })
    .order('invoice_date', { ascending: false })
    .range(from, to);
    
  if (error) throw new Error(error.message);
  return { data: data as InvoiceWithDetails[], count: count || 0 };
};

const fetchInvoiceWithItems = async (invoiceId: string): Promise<FullInvoice> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(*), invoice_items(*, products(name, units(abbreviation)))')
    .eq('id', invoiceId)
    .single();
  if (error) throw new Error(error.message);
  return data as FullInvoice;
}

const deleteInvoice = async (invoiceId: string) => {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw new Error(error.message);
};

const InvoicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FullInvoice | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [invoiceToPrint, setInvoiceToPrint] = useState<FullInvoice | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  useEffect(() => {
    if (isPrinting) {
      window.print();
      setIsPrinting(false);
      setInvoiceToPrint(null);
    }
  }, [isPrinting]);
  
  const { data: invoicesData, isLoading, error } = useQuery({
    queryKey: ['invoices', currentPage],
    queryFn: () => fetchInvoices(currentPage),
    placeholderData: keepPreviousData,
  });

  const invoices = invoicesData?.data ?? [];
  const totalCount = invoicesData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      toast('Invoice deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      toast(`Error deleting invoice: ${error.message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedInvoice(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = async (invoiceId: string) => {
    try {
      const fullInvoice = await fetchInvoiceWithItems(invoiceId);
      setSelectedInvoice(fullInvoice);
      setIsModalOpen(true);
    } catch (error: any) {
      toast(`Error fetching invoice details: ${error.message}`);
    }
  };
  
  const handlePrintClick = async (invoiceId: string) => {
    try {
        const fullInvoice = await fetchInvoiceWithItems(invoiceId);
        setInvoiceToPrint(fullInvoice);
        setIsPrinting(true);
    } catch (error: any) {
        toast(`Error fetching invoice for printing: ${error.message}`);
    }
  };

  const handleDeleteClick = (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice? This action is irreversible.')) {
      deleteMutation.mutate(invoiceId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedInvoice(undefined);
  };

  return (
    <>
      <div className="print-only">
        {invoiceToPrint && <InvoiceTemplate invoice={invoiceToPrint} />}
      </div>
      <div className="no-print space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Invoices</h1>
          <Button onClick={handleAddClick}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoice List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p>Loading invoices...</p>}
            {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
            {!isLoading && !error && (
              <>
                <div className="overflow-x-auto">
                  <Table className="responsive-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.length > 0 ? invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell data-label="Number" className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell data-label="Customer">{invoice.customers?.name || 'N/A'}</TableCell>
                          <TableCell data-label="Date">{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell data-label="Amount">{formatCurrency(invoice.total_amount)}</TableCell>
                          <TableCell data-label="Actions">
                            <div className="flex items-center justify-center space-x-2 md:justify-center">
                              <Button variant="ghost" size="icon" onClick={() => handlePrintClick(invoice.id)} aria-label="Print Invoice">
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEditClick(invoice.id)} aria-label="Edit Invoice">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(invoice.id)} disabled={deleteMutation.isPending} aria-label="Delete Invoice">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center h-24">No invoices found.</TableCell>
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
        
        <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedInvoice ? 'Edit Invoice' : 'Create New Invoice'}>
          <InvoiceForm
            invoice={selectedInvoice}
            onSuccess={handleFormSuccess}
            onCancel={() => setIsModalOpen(false)}
          />
        </Dialog>
      </div>
    </>
  );
};

export default InvoicesPage;