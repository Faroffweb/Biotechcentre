import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Product, Unit } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Search } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import Skeleton from '../components/ui/Skeleton';
import { Link } from 'react-router-dom';


const ITEMS_PER_PAGE = 10;

type StockProduct = Pick<Product, 'id' | 'name' | 'stock_quantity'> & {
    units: Pick<Unit, 'abbreviation'> | null;
};

const fetchStock = async (page: number, searchTerm: string): Promise<{ data: StockProduct[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase
    .from('products')
    .select('id, name, stock_quantity, units(abbreviation)', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data as StockProduct[], count: count || 0 };
};

const StockPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['stock', currentPage, debouncedSearchTerm],
    queryFn: () => fetchStock(currentPage, debouncedSearchTerm),
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);


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

  const renderSkeleton = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/3" /></TableCell>
              <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Stock Overview</h1>
      </div>

      <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle>Current Inventory Levels</CardTitle>
               <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                    placeholder="Search by name..."
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
                      <TableHead>Product Name</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length > 0 ? products.map((product) => {
                      const status = getStatus(product.stock_quantity);
                      return (
                        <TableRow key={product.id}>
                          <TableCell data-label="Name" className="font-medium">
                            <Link to={`/stock/${product.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                                {product.name}
                            </Link>
                          </TableCell>
                          <TableCell data-label="Stock">{product.stock_quantity} {product.units?.abbreviation || ''}</TableCell>
                          <TableCell data-label="Status">
                             <Badge variant={status.variant}>{status.text}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No products found.</TableCell>
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