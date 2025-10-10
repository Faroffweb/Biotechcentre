import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Invoice, InvoiceItem, Customer, Unit } from '../types';
import InvoiceForm from '../components/InvoiceForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { ArrowLeft } from 'lucide-react';

// This type definition should match the one in InvoicesPage.tsx for prop compatibility
type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin' | 'phone'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; hsn_code: string | null; units?: Pick<Unit, 'abbreviation'> | null; } | null })[];
};

const fetchInvoiceWithItems = async (invoiceId: string): Promise<FullInvoice> => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
        id, created_at, customer_id, invoice_number, invoice_date, notes, total_amount,
        customers(*),
        invoice_items(*, products(name, hsn_code, unit_price, tax_rate, units(abbreviation)))
    `)
    .eq('id', invoiceId)
    .single();

  if (error) {
    throw new Error(`Could not fetch invoice details: ${error.message}`);
  }
  return data as FullInvoice;
};

const CreateInvoicePage: React.FC = () => {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const navigate = useNavigate();
    const isEditing = !!invoiceId;

    const { data: invoice, isLoading, error } = useQuery({
        queryKey: ['invoice', invoiceId],
        queryFn: () => fetchInvoiceWithItems(invoiceId!),
        enabled: isEditing,
    });

    const handleSuccess = () => {
        navigate('/invoices');
    };

    const handleCancel = () => {
        navigate('/invoices');
    };

    const renderForm = () => {
        if (isEditing) {
            if (isLoading) {
                return <Skeleton className="h-96 w-full" />;
            }
            if (error) {
                return <p className="text-red-500">Error loading invoice: {error.message}</p>;
            }
            return <InvoiceForm invoice={invoice} onSuccess={handleSuccess} onCancel={handleCancel} />;
        }
        // For creating a new invoice
        return <InvoiceForm onSuccess={handleSuccess} onCancel={handleCancel} />;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/invoices" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Go back to invoices">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {isEditing ? `Edit Invoice #${invoice?.invoice_number || ''}` : 'Create New Invoice'}
                </h1>
            </div>
            <Card>
                <CardContent className="p-6">
                    {renderForm()}
                </CardContent>
            </Card>
        </div>
    );
};

export default CreateInvoicePage;