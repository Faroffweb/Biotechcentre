import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { InvoiceWithDetails, InvoiceItem, Invoice, Customer, Unit, CompanyDetails } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2, Download, Search, Eye } from 'lucide-react';
import { formatDate, formatCurrency } from '../hooks/lib/utils';
import Pagination from '../components/ui/Pagination';
import Dialog from '../components/ui/Dialog';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { toast } from '../components/ui/Toaster';
import { Input } from '../components/ui/Input';
import { useDebounce } from '../hooks/useDebounce';
import Skeleton from '../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 10;

type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin' | 'phone'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; hsn_code: string | null; units?: Pick<Unit, 'abbreviation'> | null } | null })[];
};

// Fetch Functions
const fetchInvoices = async (page: number, searchTerm: string): Promise<{ data: InvoiceWithDetails[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase
    .from('invoices')
    .select('*, customers(name)', { count: 'exact' });
  
  if (searchTerm) {
    query = query.or(`invoice_number.ilike.%${searchTerm}%,customers.name.ilike.%${searchTerm}%`);
  }
    
  const { data, error, count } = await query
    .order('invoice_date', { ascending: false })
    .range(from, to);
    
  if (error) throw new Error(error.message);
  return { data: data as InvoiceWithDetails[], count: count || 0 };
};

const fetchInvoiceWithItems = async (invoiceId: string): Promise<FullInvoice> => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
        id, created_at, customer_id, invoice_number, invoice_date, notes, total_amount,
        customers(*),
        invoice_items(*, products(name, hsn_code, units(abbreviation)))
    `)
    .eq('id', invoiceId)
    .single();

  if (error) {
    console.error('Error fetching single invoice:', error);
    throw new Error(`Could not fetch invoice details: ${error.message}`);
  }
  return data as FullInvoice;
};

const fetchCompanyDetails = async (): Promise<CompanyDetails | null> => {
    const { data, error } = await supabase
        .from('company_details')
        .select('*')
        .eq('id', 1)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

const deleteInvoice = async (invoiceId: string) => {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw new Error(error.message);
};

const InvoicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FullInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: invoicesData, isLoading, error } = useQuery({
    queryKey: ['invoices', currentPage, debouncedSearchTerm],
    queryFn: () => fetchInvoices(currentPage, debouncedSearchTerm),
    placeholderData: keepPreviousData,
  });
  
  const { data: companyDetails } = useQuery({
    queryKey: ['companyDetails'],
    queryFn: fetchCompanyDetails,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

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

  const handleViewClick = async (invoiceId: string) => {
    try {
        const fullInvoice = await fetchInvoiceWithItems(invoiceId);
        setSelectedInvoice(fullInvoice);
        setIsModalOpen(true);
    } catch (err) {
        toast(`Error fetching invoice details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  const handleExportPDF = () => {
    if (!selectedInvoice || !companyDetails) {
        toast('Cannot export PDF: Missing invoice or company data.');
        return;
    }
    
    toast('Generating PDF...');

    const doc = new jsPDF();
    const invoice = selectedInvoice;
    const company = companyDetails;
    const pageHeight = doc.internal.pageSize.getHeight();
    let finalY = 0; // Track the final Y position after the table

    // --- Header ---
    doc.setFontSize(20);
    doc.text(company.name || 'Company Name', 14, 22);
    doc.setFontSize(10);
    doc.text(company.address || '', 14, 30);
    doc.text(`GSTIN: ${company.gstin || 'N/A'}`, 14, 35);
    doc.text(`PAN: ${company.pan || 'N/A'}`, 14, 40);

    doc.setFontSize(16);
    doc.text('Tax Invoice', 200, 22, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Invoice No: ${invoice.invoice_number}`, 200, 30, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 200, 35, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(14, 45, 200, 45);

    // --- Billed To Section ---
    doc.setFontSize(10).setFont('helvetica', 'bold');
    doc.text('Billed To:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customers?.name || 'Guest Customer', 14, 60);
    const addressLines = doc.splitTextToSize(invoice.customers?.billing_address || 'N/A', 80);
    doc.text(addressLines, 14, 65);
    const addressHeight = addressLines.length * 5;
    doc.text(`GSTIN: ${invoice.customers?.gstin || 'N/A'}`, 14, 65 + addressHeight);
    doc.text(`Phone: ${invoice.customers?.phone || 'N/A'}`, 14, 70 + addressHeight);

    // --- Items Table ---
    const tableData = invoice.invoice_items.map((item, index) => {
        const taxableAmount = item.quantity * item.unit_price;
        const total = taxableAmount * (1 + item.tax_rate);
        return [
            index + 1,
            item.products?.name || 'N/A',
            item.products?.hsn_code || 'N/A',
            item.quantity,
            formatCurrency(item.unit_price),
            formatCurrency(taxableAmount),
            `${(item.tax_rate * 100).toFixed(0)}%`,
            formatCurrency(total),
        ];
    });

    autoTable(doc, {
        startY: 80 + addressHeight,
        head: [['#', 'Item', 'HSN', 'Qty', 'Rate', 'Taxable', 'GST', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 20 },
        didDrawPage: (data) => {
            // This captures the y position after the table is drawn.
            finalY = data.cursor?.y || 0;
        }
    });

    // --- Totals Section ---
    const taxableTotal = invoice.invoice_items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
    const taxTotal = invoice.total_amount - taxableTotal;
    const totalsY = finalY + 10 > pageHeight - 50 ? 20 : finalY + 10;
    
    autoTable(doc, {
        startY: totalsY,
        body: [
            ['Subtotal', formatCurrency(taxableTotal)],
            ['CGST', formatCurrency(taxTotal / 2)],
            ['SGST', formatCurrency(taxTotal / 2)],
            [{ content: 'Grand Total', styles: { fontStyle: 'bold' } }, { content: formatCurrency(invoice.total_amount), styles: { fontStyle: 'bold' } }],
        ],
        theme: 'plain',
        tableWidth: 80,
        margin: { left: 115 }, // Align to the right
    });
    
    finalY = (doc as any).lastAutoTable.finalY; // Update finalY after totals table

    // --- Notes & Bank Details ---
    let notesY = finalY + 15;
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold').text('Notes:', 14, notesY);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(invoice.notes, 180);
      doc.text(notesLines, 14, notesY + 5);
      notesY += notesLines.length * 5 + 5;
    }

    doc.setFont('helvetica', 'bold').text('Bank Details:', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Account Name: ${company.account_name || 'N/A'}`, 14, notesY + 5);
    doc.text(`Account No: ${company.account_number || 'N/A'}`, 14, notesY + 10);
    doc.text(`Bank: ${company.bank_name || 'N/A'}`, 14, notesY + 15);
    doc.text(`IFSC: ${company.ifsc_code || 'N/A'}`, 14, notesY + 20);

    // --- Footer ---
    doc.setFontSize(8).setTextColor(150);
    doc.text('This is a computer-generated invoice.', 105, pageHeight - 10, { align: 'center' });

    doc.save(`Invoice-${invoice.invoice_number}.pdf`);
  };

  const handleDeleteClick = (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      deleteMutation.mutate(invoiceId);
    }
  };

  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Invoices</h1>
        <Button onClick={() => navigate('/invoices/new')}>
          <PlusCircle className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle>Invoice List</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by # or Customer..."
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
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length > 0 ? invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell data-label="Invoice #" className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell data-label="Customer">{invoice.customers?.name || 'Guest'}</TableCell>
                        <TableCell data-label="Date">{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell data-label="Amount">{formatCurrency(invoice.total_amount)}</TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex items-center justify-center space-x-2 md:justify-center">
                             <Button variant="ghost" size="icon" onClick={() => handleViewClick(invoice.id)} aria-label="View Invoice">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/edit/${invoice.id}`)} aria-label="Edit Invoice">
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
                        <TableCell colSpan={6} className="text-center h-24">No invoices found.</TableCell>
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

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Invoice Preview: ${selectedInvoice?.invoice_number}`} size="lg">
         {selectedInvoice && (
          <div>
            <div className="flex justify-end gap-2 mb-4 no-print">
               <Button onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to PDF
               </Button>
            </div>
            <div>
               <InvoiceTemplate invoice={selectedInvoice} companyDetails={companyDetails || null} />
            </div>
          </div>
         )}
      </Dialog>
    </div>
  );
};

export default InvoicesPage;