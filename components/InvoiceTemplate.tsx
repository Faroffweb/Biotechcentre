import React from 'react';
import { Invoice, InvoiceItem, Customer, Unit } from '../types';
import { formatDate, formatCurrency } from '../hooks/lib/utils';

type FullInvoice = Invoice & {
    customers: Pick<Customer, 'name' | 'billing_address' | 'gstin' | 'phone'> | null;
    invoice_items: (InvoiceItem & { products: { name: string; hsn_code: string | null; units?: Pick<Unit, 'abbreviation'> | null } | null })[];
};

interface InvoiceTemplateProps {
    invoice: FullInvoice;
}

const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(({ invoice }, ref) => {
    // Placeholder details, as they are not in the database model
    const company = {
        name: "GST Pro Solutions",
        address: "123 Business Rd, Financial District, Mumbai, Maharashtra 400001",
        gstin: "27ABCDE1234F1Z5",
        pan: "ABCDE1234F",
    };
    const bankDetails = {
        accountName: "GST Pro Solutions",
        accountNumber: "123456789012",
        accountType: "Current",
        bank: "State Bank of India",
        ifsc: "SBIN0001234",
    };

    // Calculations
    const taxableAmount = invoice.invoice_items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const totalCGST = invoice.invoice_items.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.tax_rate / 2), 0);
    const totalSGST = invoice.invoice_items.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.tax_rate / 2), 0);
    const grandTotal = taxableAmount + totalCGST + totalSGST;
    
    const styles = `
      body { font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f4f4; color: #333; }
      .page { max-width:900px; margin:0 auto; background:#fff; padding:20px; }
      @media screen {
        .page {
           margin:20px auto;
           box-shadow:0 0 10px rgba(0,0,0,.1);
        }
      }
      h1,h2,h3 { margin:0; color: #111; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:20px; }
      .company h1 { font-size: 1.8em; }
      .invoice-meta { text-align:right; }
      .invoice-meta h2 { margin:0 0 5px 0; font-size: 1.5em; color: #555; }
      .invoice-meta p { margin: 0; line-height: 1.4; }
      .columns { display:flex; justify-content:space-between; margin-bottom:20px; }
      .panel { width:48%; border:1px solid #ddd; padding:10px; border-radius:6px; font-size: 0.9em; }
      .panel h3 { font-size: 1.1em; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
      .panel p { margin: 0; line-height: 1.6; }
      table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size: 0.85em; }
      table th, table td { border:1px solid #ddd; padding:8px; text-align:left; }
      table th { background:#f9f9f9; font-weight: bold; }
      table td.number, table th.number { text-align: right; }
      .totals { max-width:300px; margin-left:auto; }
      .totals td { border:none; padding: 4px 8px; }
      .footer { border-top:1px solid #ddd; margin-top:20px; padding-top:10px; font-size: 0.9em; }
      .footer h3 { font-size: 1.1em; margin-bottom: 10px; }
      .signatures { display:flex; justify-content:space-between; margin-top:60px; }
      .sign-box { width:40%; text-align:center; }
      .sign-line { border-top:1px solid #000; margin-top:60px; }
    `;

    return (
        <div ref={ref}>
            <style>{styles}</style>
            <div className="page">
                <div className="header">
                    <div className="company">
                        <h1>{company.name}</h1>
                    </div>
                    <div className="invoice-meta">
                        <h2>Invoice</h2>
                        <p><strong>No:</strong> {invoice.invoice_number}<br />
                        <strong>Date:</strong> {formatDate(invoice.invoice_date)}</p>
                    </div>
                </div>

                <div className="columns">
                    <div className="panel">
                        <h3>Billed By</h3>
                        <p><strong>Name:</strong> {company.name}<br />
                        <strong>Address:</strong> {company.address}<br />
                        <strong>GSTIN:</strong> {company.gstin}<br />
                        <strong>PAN:</strong> {company.pan}</p>
                    </div>
                    <div className="panel">
                        <h3>Billed To</h3>
                        <p><strong>Customer:</strong> {invoice.customers?.name || 'Guest'}<br />
                        <strong>Phone:</strong> {invoice.customers?.phone || 'N/A'}<br />
                        <strong>Address:</strong> {invoice.customers?.billing_address || 'N/A'}<br />
                        <strong>GSTIN:</strong> {invoice.customers?.gstin || 'N/A'}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>HSN/SAC</th>
                            <th className="number">Qty</th>
                            <th>Unit</th>
                            <th className="number">Taxable Amount</th>
                            <th className="number">GST %</th>
                            <th className="number">CGST</th>
                            <th className="number">SGST</th>
                            <th className="number">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.invoice_items.map(item => {
                            const itemTaxableAmount = item.quantity * item.unit_price;
                            const itemTotalCGST = itemTaxableAmount * item.tax_rate / 2;
                            const itemTotalSGST = itemTaxableAmount * item.tax_rate / 2;
                            const itemTotal = itemTaxableAmount + itemTotalCGST + itemTotalSGST;
                            
                            return (
                                <tr key={item.id}>
                                    <td>{item.products?.name || 'N/A'}</td>
                                    <td>{item.products?.hsn_code || 'N/A'}</td>
                                    <td className="number">{item.quantity}</td>
                                    <td>{item.products?.units?.abbreviation || 'N/A'}</td>
                                    <td className="number">{formatCurrency(itemTaxableAmount)}</td>
                                    <td className="number">{(item.tax_rate * 100).toFixed(2)}%</td>
                                    <td className="number">{formatCurrency(itemTotalCGST)}</td>
                                    <td className="number">{formatCurrency(itemTotalSGST)}</td>
                                    <td className="number">{formatCurrency(itemTotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <table className="totals">
                    <tbody>
                        <tr><td>Taxable Amount:</td><td className="number">{formatCurrency(taxableAmount)}</td></tr>
                        <tr><td>CGST:</td><td className="number">{formatCurrency(totalCGST)}</td></tr>
                        <tr><td>SGST:</td><td className="number">{formatCurrency(totalSGST)}</td></tr>
                        <tr><td><strong>Total (INR):</strong></td><td className="number"><strong>{formatCurrency(grandTotal)}</strong></td></tr>
                    </tbody>
                </table>

                <div className="footer">
                    <h3>Bank Details</h3>
                    <p><strong>Account Name:</strong> {bankDetails.accountName}<br />
                    <strong>Account Number:</strong> {bankDetails.accountNumber}<br />
                    <strong>Account Type:</strong> {bankDetails.accountType}<br />
                    <strong>Bank:</strong> {bankDetails.bank}<br />
                    <strong>IFSC:</strong> {bankDetails.ifsc}</p>
                    <p><em>Thank you for your business!</em></p>
                </div>

                <div className="signatures">
                    <div className="sign-box">
                        <div className="sign-line"></div>
                        <p>Authorized Signatory</p>
                    </div>
                    <div className="sign-box">
                        <div className="sign-line"></div>
                        <p>Customer Signature</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InvoiceTemplate;
