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

const ITEMS_PER_PAGE = 5;

type ProductDetails = Pick<Product, 'name' | 'sku' | 'stock_quantity'> & {
    units: Pick<Unit, 'abbreviation'> | null;
};

// Represents a single movement in stock, with running totals
type StockMovement = {
    date: string;
    createdAt: string;
    type: 'Purchase' | 'Sale';
    quantity: number;
    quantityChange: number;
    reference: string;
    id: string;
    openingStock: number;
    closingStock: number;
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
        .eq('product_id', productId);
    if (error) throw new Error(error.message);
    return data || [];
};

// Fetch ALL sales for a product, not paginated
const fetchAllProductSales = async (productId: string): Promise<ProductSaleItem[]> => {
    const { data, error } = await supabase
        .from('invoice_items')
        .select('*, invoices!inner(invoice_number, invoice_date, customers(name))')
        .eq('product_id', productId);
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

    const stockMovements = useMemo(() => {
        if (!purchases || !sales || !product) return [];

        const purchaseMovements = purchases.map(p => ({
            id: `p-${p.id}`,
            date: p.purchase_date,
            createdAt: p.created_at,
            type: 'Purchase' as 'Purchase' | 'Sale',
            quantity: p.quantity,
            quantityChange: p.quantity,
            reference: p.reference_invoice || 'N/A',
        }));

        const salesMovements = sales.map(s => ({
            id: `s-${s.id}`,
            date: s.invoices?.invoice_date || '',
            createdAt: s.created_at,
            type: 'Sale' as 'Purchase' | 'Sale',
            quantity: s.quantity,
            quantityChange: -s.quantity,
            reference: s.invoices?.invoice_number || 'N/A',
        }));

        const sortedMovements = [...purchaseMovements, ...salesMovements]
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        // Calculate initial stock before any transactions
        const totalChange = sortedMovements.reduce((acc, mov) => acc + mov.quantityChange, 0);
        const initialOpeningStock = product.stock_quantity - totalChange;

        // Calculate running totals going forward in time
        let lastClosingStock = initialOpeningStock;
        const movementsWithTotals = sortedMovements.map(movement => {
            const openingStock = lastClosingStock;
            const closingStock = openingStock + movement.quantityChange;
            lastClosingStock = closingStock;
            return { ...movement, openingStock, closingStock };
        });

        return movementsWithTotals; // Show oldest first (chronological "up to down" order)

    }, [purchases, sales, product]);

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
                <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Go back">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                   Stock Report: {product?.name}
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400">Product Name</p>
                            <p className="font-semibold text-base">{product?.name}</p>
                        </div>
                         <div>
                            <p className="text-gray-500 dark:text-gray-400">SKU</p>
                            <p className="font-semibold text-base">{product?.sku || 'N/A'}</p>
                        </div>
                         <div>
                            <p className="text-gray-500 dark:text-gray-400">Current Stock</p>
                            <p className="font-semibold text-lg">{product?.stock_quantity} {product?.units?.abbreviation}</p>
                        </div>
                    </div>
                </CardHeader>
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
                                            <TableHead className="text-right">Opening</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead>Reference</TableHead>
                                            <TableHead className="text-right">Closing</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedMovements.length > 0 ? paginatedMovements.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell data-label="Date">{formatDate(item.date)}</TableCell>
                                                <TableCell data-label="Type">
                                                    <Badge variant={item.type === 'Purchase' ? 'success' : 'destructive'}>{item.type}</Badge>
                                                </TableCell>
                                                <TableCell data-label="Opening" className="text-right">{item.openingStock}</TableCell>
                                                <TableCell data-label="Quantity" className={`text-right font-medium ${item.type === 'Purchase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {item.quantityChange > 0 ? `+${item.quantityChange}` : item.quantityChange}
                                                </TableCell>
                                                <TableCell data-label="Reference">{item.reference}</TableCell>
                                                <TableCell data-label="Closing" className="text-right font-semibold">{item.closingStock}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24">No stock movements found for this product.</TableCell>
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