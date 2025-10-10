import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, Purchase, ProductSaleItem, Unit, CompanyDetails } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Skeleton from '../components/ui/Skeleton';
import { ArrowLeft, Download } from 'lucide-react';
import { formatDate } from '../hooks/lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toaster';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 20;

type ProductDetails = Pick<Product, 'name' | 'stock_quantity'> & {
    units: Pick<Unit, 'abbreviation'> | null;
};

// Represents a single day's stock movement summary
type StockMovement = {
    date: string;
    invoice: string;
    openingStock: number;
    purchase: number;
    total: number;
    sale: number;
    closingStock: number;
};

// Fetch Functions
const fetchProductDetails = async (productId: string): Promise<ProductDetails> => {
    const { data, error } = await supabase
        .from('products')
        .select('name, stock_quantity, units(abbreviation)')
        .eq('id', productId)
        .single();
    if (error) throw new Error(error.message);
    return data as ProductDetails;
};

const fetchAllProductPurchases = async (productId: string): Promise<Purchase[]> => {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('product_id', productId);
    if (error) throw new Error(error.message);
    return data || [];
};

const fetchAllProductSales = async (productId: string): Promise<ProductSaleItem[]> => {
    const { data, error } = await supabase
        .from('invoice_items')
        .select('*, invoices!inner(invoice_number, invoice_date, customers(name))')
        .eq('product_id', productId);
    if (error) throw new Error(error.message);
    return (data as ProductSaleItem[]) || [];
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

const getFormattedDate = (date: Date) => date.toISOString().split('T')[0];

const ProductStockReportPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    
    const [startDate, setStartDate] = useState<string>(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return getFormattedDate(firstDay);
    });
    const [endDate, setEndDate] = useState<string>(() => getFormattedDate(new Date()));

    if (!productId) {
        return <p className="text-red-500">Product ID is missing.</p>;
    }

    const { data: product, isLoading: isLoadingProduct, error: productError } = useQuery({
        queryKey: ['productDetails', productId],
        queryFn: () => fetchProductDetails(productId),
    });

    const { data: purchases, isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['allProductPurchases', productId],
        queryFn: () => fetchAllProductPurchases(productId),
    });
    
    const { data: sales, isLoading: isLoadingSales } = useQuery({
        queryKey: ['allProductSales', productId],
        queryFn: () => fetchAllProductSales(productId),
    });

    const { data: companyDetails } = useQuery({
        queryKey: ['companyDetails'],
        queryFn: fetchCompanyDetails,
    });

    const stockMovements = useMemo(() => {
        if (!purchases || !sales || !product) return [];

        const filterStartDate = startDate ? new Date(startDate) : null;
        if (filterStartDate) filterStartDate.setHours(0, 0, 0, 0);

        const filterEndDate = endDate ? new Date(endDate) : null;
        if (filterEndDate) filterEndDate.setHours(23, 59, 59, 999);

        const totalPurchasesEver = purchases.reduce((acc, p) => acc + p.quantity, 0);
        const totalSalesEver = sales.reduce((acc, s) => acc + s.quantity, 0);
        const absoluteInitialStock = product.stock_quantity - (totalPurchasesEver - totalSalesEver);

        let openingStockForPeriod = absoluteInitialStock;
        if (filterStartDate) {
            const purchasesBefore = purchases
                .filter(p => new Date(p.purchase_date) < filterStartDate)
                .reduce((acc, p) => acc + p.quantity, 0);
            const salesBefore = sales
                .filter(s => s.invoices?.invoice_date && new Date(s.invoices.invoice_date) < filterStartDate)
                .reduce((acc, s) => acc + s.quantity, 0);
            openingStockForPeriod += (purchasesBefore - salesBefore);
        }

        const filteredPurchases = purchases.filter(p => {
            const pDate = new Date(p.purchase_date);
            const startMatch = !filterStartDate || pDate >= filterStartDate;
            const endMatch = !filterEndDate || pDate <= filterEndDate;
            return startMatch && endMatch;
        });

        const filteredSales = sales.filter(s => {
            if (!s.invoices?.invoice_date) return false;
            const sDate = new Date(s.invoices.invoice_date);
            const startMatch = !filterStartDate || sDate >= filterStartDate;
            const endMatch = !filterEndDate || sDate <= filterEndDate;
            return startMatch && endMatch;
        });
        
        const dailyData = new Map<string, { purchase: number; sale: number; references: string[] }>();

        filteredPurchases.forEach(p => {
            const dateStr = p.purchase_date;
            const entry = dailyData.get(dateStr) || { purchase: 0, sale: 0, references: [] };
            entry.purchase += p.quantity;
            if (p.reference_invoice && !entry.references.includes(p.reference_invoice)) {
                entry.references.push(p.reference_invoice);
            }
            dailyData.set(dateStr, entry);
        });

        filteredSales.forEach(s => {
            const dateStr = s.invoices?.invoice_date || '';
            if (!dateStr) return;
            const entry = dailyData.get(dateStr) || { purchase: 0, sale: 0, references: [] };
            entry.sale += s.quantity;
            if (s.invoices?.invoice_number && !entry.references.includes(s.invoices.invoice_number)) {
                entry.references.push(s.invoices.invoice_number);
            }
            dailyData.set(dateStr, entry);
        });

        const sortedDates = Array.from(dailyData.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        let lastClosingStock = openingStockForPeriod;
        const movements: StockMovement[] = [];
        
        sortedDates.forEach(date => {
            const data = dailyData.get(date)!;
            const openingStock = lastClosingStock;
            const purchase = data.purchase;
            const total = openingStock + purchase;
            const sale = data.sale;
            const closingStock = total - sale;

            movements.push({
                date, invoice: data.references.join(', '), openingStock, purchase, total, sale, closingStock,
            });
            lastClosingStock = closingStock;
        });
        
        return movements;
    }, [purchases, sales, product, startDate, endDate]);
    
    React.useEffect(() => {
      setCurrentPage(1);
    }, [startDate, endDate]);

    const totalPages = Math.ceil(stockMovements.length / ITEMS_PER_PAGE);
    const paginatedMovements = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return stockMovements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, stockMovements]);


    const handleExportPDF = () => {
        if (!product || !companyDetails) {
            toast('Cannot export PDF: Missing required data.');
            return;
        }

        setIsExporting(true);
        toast('Generating PDF...');

        try {
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(18);
            doc.text(companyDetails.name || 'Bio Tech Centre', 105, 15, { align: 'center' });
            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text(`Stock Movement Report`, 105, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`For: ${product.name}`, 105, 28, { align: 'center' });
            if (startDate && endDate) {
              doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 105, 33, { align: 'center' });
            }

            // Product Details
            const detailsY = 42;
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold'); doc.text('Current Stock:', 14, detailsY);
            doc.setFont('helvetica', 'normal'); doc.text(`${product.stock_quantity} ${product.units?.abbreviation || ''}`, 40, detailsY);
            
            const tableStartY = detailsY + 8;

            const tableData = stockMovements.map(item => [
                formatDate(item.date), item.invoice, item.openingStock.toString(),
                item.purchase > 0 ? `+${item.purchase}` : '0', item.total.toString(),
                item.sale > 0 ? `-${item.sale}` : '0', item.closingStock.toString(),
            ]);

            autoTable(doc, {
                startY: tableStartY,
                head: [['Date', 'Invoice', 'Opening', 'Purchase', 'Total', 'Sale', 'Closing']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: 20 },
                styles: { fontSize: 8 },
                columnStyles: { 1: { cellWidth: 35 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
                didParseCell: (data) => {
                    if (data.column.index === 3 && data.section === 'body' && parseInt(data.cell.text[0].replace('+', '')) > 0) {
                        data.cell.styles.textColor = [40, 167, 69]; data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.column.index === 5 && data.section === 'body' && parseInt(data.cell.text[0].replace('-', '')) > 0) {
                        data.cell.styles.textColor = [220, 53, 69]; data.cell.styles.fontStyle = 'bold';
                    }
                },
            });
            
            // FIX: The original didDrawPage hook had a logic error for displaying total page count ("Page X of Y") and a type error.
            // The correct way is to add page numbers after the table has been rendered completely.
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8).setTextColor(150);
                doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            doc.save(`Stock-Report-${product.name.replace(/\s/g, '_')}.pdf`);
            toast('Report exported successfully!');
        } catch (err) {
            console.error("Export error:", err);
            toast(`Export Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoadingProduct) {
      return <div><Skeleton className="h-12 w-1/2 mb-6" /><Skeleton className="h-48 w-full" /></div>;
    }

    if (productError) {
        return <p className="text-red-500">Error loading product: {productError.message}</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Go back">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                       Stock Report: {product?.name}
                    </h1>
                </div>
                <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
                    <Download className="w-4 h-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export to PDF'}
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row justify-between md:items-center">
                    <div>
                        <CardTitle>Product Details</CardTitle>
                        <CardDescription>Current snapshot of the product inventory.</CardDescription>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4 md:mt-0">
                        <div><p className="text-gray-500 dark:text-gray-400">Current Stock</p><p className="font-semibold text-lg">{product?.stock_quantity} {product?.units?.abbreviation}</p></div>
                    </div>
                </CardHeader>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filter Report</CardTitle>
                    <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                        <div className="w-full sm:w-auto">
                            <label htmlFor="start-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                            <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label htmlFor="end-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                            <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader><CardTitle>Daily Stock Summary</CardTitle></CardHeader>
                <CardContent>
                    {(isLoadingPurchases || isLoadingSales) && !stockMovements.length ? <Skeleton className="h-64 w-full" /> : (
                        <>
                            <div className="overflow-x-auto">
                                <Table className="responsive-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Invoice</TableHead>
                                            <TableHead className="text-right">Opening</TableHead>
                                            <TableHead className="text-right">Purchase</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Sale</TableHead>
                                            <TableHead className="text-right">Closing</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedMovements.length > 0 ? paginatedMovements.map(item => (
                                            <TableRow key={item.date}>
                                                <TableCell data-label="Date">{formatDate(item.date)}</TableCell>
                                                <TableCell data-label="Invoice" className="truncate max-w-xs">{item.invoice || 'N/A'}</TableCell>
                                                <TableCell data-label="Opening" className="text-right">{item.openingStock}</TableCell>
                                                <TableCell data-label="Purchase" className="text-right font-medium text-green-600 dark:text-green-400">
                                                    {item.purchase > 0 ? `+${item.purchase}` : '0'}
                                                </TableCell>
                                                <TableCell data-label="Total" className="text-right">{item.total}</TableCell>
                                                 <TableCell data-label="Sale" className="text-right font-medium text-red-600 dark:text-red-400">
                                                    {item.sale > 0 ? `-${item.sale}` : '0'}
                                                </TableCell>
                                                <TableCell data-label="Closing" className="text-right font-semibold">{item.closingStock}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-24">No stock movements found for the selected period.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <Pagination 
                                currentPage={currentPage} 
                                totalPages={totalPages} 
                                onPageChange={setCurrentPage} 
                                totalCount={stockMovements.length} 
                                itemsPerPage={ITEMS_PER_PAGE} 
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ProductStockReportPage;