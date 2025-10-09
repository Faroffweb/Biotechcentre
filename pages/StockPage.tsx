import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Product, Unit } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { Badge } from '../components/ui/Badge';

const ITEMS_PER_PAGE = 10;

type StockProduct = Pick<Product, 'id' | 'name' | 'sku' | 'stock_quantity'> & {
    units: Pick<Unit, 'abbreviation'> | null;
};

const fetchStock = async (page: number): Promise<{ data: StockProduct[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('products')
    .select('id, name, sku, stock_quantity, units(abbreviation)', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data as StockProduct[], count: count || 0 };
};

const StockPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['stock', currentPage],
    queryFn: () => fetchStock(currentPage),
    placeholderData: keepPreviousData,
  });

  const products = stockData?.data ?? [];
  const totalCount = stockData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatus = (quantity: number): { text: string, variant: 'success' | 'secondary' | 'destructive' } => {
    if (quantity > 10) {
      return { text: 'In Stock', variant: 'success' };
    }
    if (quantity > 0) {
      return { text: 'Low Stock', variant: 'secondary' };
    }
    return { text: 'Out of Stock', variant: 'destructive' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Stock Overview</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Inventory Levels</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading stock levels...</p>}
          {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length > 0 ? products.map((product) => {
                      const status = getStatus(product.stock_quantity);
                      return (
                        <TableRow key={product.id}>
                          <TableCell data-label="Name" className="font-medium">{product.name}</TableCell>
                          <TableCell data-label="SKU">{product.sku || 'N/A'}</TableCell>
                          <TableCell data-label="Stock">{product.stock_quantity} {product.units?.abbreviation || ''}</TableCell>
                          <TableCell data-label="Status">
                             <Badge variant={status.variant}>{status.text}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No products found.</TableCell>
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
    </div>
  );
};

export default StockPage;