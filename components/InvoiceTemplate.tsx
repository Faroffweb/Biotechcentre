import React from 'react';
import { Invoice, InvoiceItem, Customer, Unit } from '../types';
import { formatDate, formatCurrency } from '../hooks/lib/utils';

type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; units?: Pick<Unit, 'abbreviation'> | null } | null })[];
};

interface InvoiceTemplateProps {
    invoice: FullInvoice;
}

const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(({ invoice }, ref) => {
    const subtotal = invoice.invoice_items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const tax = invoice.invoice_items.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.tax_rate), 0);
    const grandTotal = subtotal + tax;
    
    // Placeholder company details
    const company = {
        name: "GST Pro Solutions",
        address: "123 Business Rd, Financial District, Mumbai, Maharashtra 400001",
        gstin: "27ABCDE1234F1Z5",
    };

    return (
        <div ref={ref} className="p-8 bg-white text-gray-900 font-sans">
            <header className="flex justify-between items-start pb-6 border-b">
                <div>
                    <h1 className="text-3xl font-bold">{company.name}</h1>
                    <p className="text-sm text-gray-600">{company.address}</p>
                    <p className="text-sm text-gray-600">GSTIN: {company.gstin}</p>
                </div>
                <h2 className="text-4xl font-light uppercase text-gray-700">Invoice</h2>
            </header>

            <section className="grid grid-cols-2 gap-8 my-6">
                <div>
                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Billed To</h3>
                    <p className="font-bold">{invoice.customers?.name}</p>
                    <p className="text-sm text-gray-600">{invoice.customers?.billing_address || 'N/A'}</p>
                    <p className="text-sm text-gray-600">GSTIN: {invoice.customers?.gstin || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <div className="grid grid-cols-2">
                        <span className="font-semibold">Invoice Number:</span>
                        <span>{invoice.invoice_number}</span>
                        <span className="font-semibold">Invoice Date:</span>
                        <span>{formatDate(invoice.invoice_date)}</span>
                    </div>
                </div>
            </section>

            <section>
                <table className="w-full text-left">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-3 text-sm font-semibold">Item</th>
                            <th className="p-3 text-sm font-semibold text-right">Quantity</th>
                            <th className="p-3 text-sm font-semibold text-right">Price</th>
                            <th className="p-3 text-sm font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.invoice_items.map(item => (
                            <tr key={item.id} className="border-b">
                                <td className="p-3">{item.products?.name || 'Product not found'}</td>
                                <td className="p-3 text-right">{item.quantity} {item.products?.units?.abbreviation || ''}</td>
                                <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                                <td className="p-3 text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="flex justify-end mt-6">
                <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-gray-700">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                        <span>Total Tax (GST)</span>
                        <span>{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                        <span>Grand Total</span>
                        <span>{formatCurrency(grandTotal)}</span>
                    </div>
                </div>
            </section>

            <footer className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
                <p>Thank you for your business!</p>
            </footer>
        </div>
    );
});

export default InvoiceTemplate;