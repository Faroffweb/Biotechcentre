import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, Purchase, ProductSaleItem, Unit } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Skeleton from '../components/ui/Skeleton';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '../hooks/lib/utils';
import { Badge } from '../components/ui/Badge';

const ITEMS_PER_PAGE = 10;

type ProductDetails = Pick<Product, 'name' | 'sku' | 'stock_quantity'> & {
    units: Pick<Unit, 'abbreviation'> | null;
};

// Represents a single movement in stock, either in or out
type StockMovement = {
    date: string;
    type: 'Purchase' | 'Sale';
    quantity: number;
    reference: string;
    details: string;
    id: string;
};

// Fetch Functions
const fetchProductDetails = async (productId: string): Promise<ProductDetails> => {
    const { data, error } = await supabase
        .from('products')
        .select('name, sku, stock_quantity, units(abbreviation)')
        .eq('id', productId)
        .single();
    if (error) throw new Error(error.message);
    return data as ProductDetails;
};

// Fetch ALL purchases for a product, not paginated
const fetchAllProductPurchases = async (productId: string): Promise<Purchase[]> => {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

// Fetch ALL sales for a product, not paginated
const fetchAllProductSales = async (productId: string): Promise<ProductSaleItem[]> => {
    const { data, error } = await supabase
        .from('invoice_items')
        .select('*, invoices!inner(invoice_number, invoice_date, customers!inner(name))')
        .eq('product_id', productId)
        .order('invoice_date', { ascending: false, foreignTable: 'invoices' });
    if (error) throw new Error(error.message);
    return (data as ProductSaleItem[]) || [];
};

const ProductStockReportPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);

    if (!productId) {
        return <p className="text-red-500">Product ID is missing.</p>;
    }

    // Queries
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

    // Merge and sort data once fetched
    const stockMovements = useMemo(() => {
        if (!purchases || !sales) return [];

        const purchaseMovements: StockMovement[] = purchases.map(p => ({
            id: `p-${p.id}`,
            date: p.purchase_date,
            type: 'Purchase',
            quantity: p.quantity,
            reference: p.reference_invoice || 'N/A',
            details: 'Stock In'
        }));

        const salesMovements: StockMovement[] = sales.map(s => ({
            id: `s-${s.id}`,
            date: s.invoices?.invoice_date || '',
            type: 'Sale',
            quantity: s.quantity,
            reference: s.invoices?.invoice_number || 'N/A',
            details: s.invoices?.customers?.name || 'N/A'
        }));

        return [...purchaseMovements, ...salesMovements]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [purchases, sales]);

    // Client-side pagination
    const totalPages = Math.ceil(stockMovements.length / ITEMS_PER_PAGE);
    const paginatedMovements = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return stockMovements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, stockMovements]);


    if (isLoadingProduct) {
      return <div><Skeleton className="h-12 w-1/2 mb-6" /><Skeleton className="h-48 w-full" /></div>;
    }

    if (productError) {
        return <p className="text-red-500">Error loading product: {productError.message}</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                   Stock Report: {product?.name}
                </h1>
            </div>

            <Card>
                <CardHeader><CardTitle>Product Summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">Product Name</p>
                        <p className="font-semibold">{product?.name}</p>
                    </div>
                     <div>
                        <p className="text-gray-500 dark:text-gray-400">SKU</p>
                        <p className="font-semibold">{product?.sku || 'N/A'}</p>
                    </div>
                     <div>
                        <p className="text-gray-500 dark:text-gray-400">Current Stock</p>
                        <p className="font-semibold text-lg">{product?.stock_quantity} {product?.units?.abbreviation}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Stock Movements</CardTitle></CardHeader>
                <CardContent>
                    {(isLoadingPurchases || isLoadingSales) && !stockMovements.length ? <Skeleton className="h-64 w-full" /> : (
                        <>
                            <div className="overflow-x-auto">
                                <Table className="responsive-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Quantity</TableHead>
                                            <TableHead>Reference #</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedMovements.length > 0 ? paginatedMovements.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell data-label="Date">{formatDate(item.date)}</TableCell>
                                                <TableCell data-label="Type">
                                                    <Badge variant={item.type === 'Purchase' ? 'success' : 'destructive'}>
                                                        {item.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell data-label="Quantity" className={`font-medium ${item.type === 'Purchase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {item.type === 'Purchase' ? '+' : '-'}{item.quantity}
                                                </TableCell>
                                                <TableCell data-label="Reference #">{item.reference}</TableCell>
                                                <TableCell data-label="Details">{item.details}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">No stock movements found for this product.</TableCell>
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