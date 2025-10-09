import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DollarSign, Package, Users, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../hooks/lib/utils';
import Skeleton from '../components/ui/Skeleton';

const fetchDashboardStats = async () => {
  // Parallel queries for performance
  const invoicesPromise = supabase.from('invoices').select('total_amount, invoice_date', { count: 'exact' });
  const customersPromise = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_guest', false);
  const productsPromise = supabase.from('products').select('stock_quantity');

  const [
    { data: invoices, error: invoicesError, count: invoiceCount },
    { count: customerCount, error: customersError },
    { data: products, error: productsError },
  ] = await Promise.all([invoicesPromise, customersPromise, productsPromise]);

  if (invoicesError) throw invoicesError;
  if (customersError) throw customersError;
  if (productsError) throw productsError;

  // --- Client-side data processing ---
  const totalRevenue = (invoices || []).reduce((sum, inv) => sum + inv.total_amount, 0);
  const productsInStock = (products || []).reduce((sum, prod) => sum + prod.stock_quantity, 0);

  // Initialize data for the last 6 months for the chart
  const last6Months = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    last6Months.push({ name: monthNames[d.getMonth()], Sales: 0 });
  }

  // Aggregate sales data by month
  (invoices || []).forEach(invoice => {
    const invoiceDate = new Date(invoice.invoice_date);
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0,0,0,0);
    
    if (invoiceDate >= sixMonthsAgo) {
      const monthName = monthNames[invoiceDate.getMonth()];
      const monthData = last6Months.find(m => m.name === monthName);
      if (monthData) {
        monthData.Sales += invoice.total_amount;
      }
    }
  });

  return {
    totalRevenue,
    totalInvoices: invoiceCount || 0,
    activeCustomers: customerCount || 0,
    productsInStock,
    chartData: last6Months,
  };
};

const DashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  const StatCardSkeleton: React.FC = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-1/2 mb-2" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Dashboard</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Card className="bg-gradient-to-b from-white to-slate-50 dark:from-gray-800 dark:to-gray-900/50">
          <CardHeader><CardTitle>Sales Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
      return (
          <div className="flex items-center justify-center h-full">
              <Card className="p-6">
                  <CardTitle>Error</CardTitle>
                  <CardContent>
                      <p className="text-red-500 mt-4">Failed to load dashboard data: {error instanceof Error ? error.message : 'An unknown error occurred'}</p>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Dashboard</h1>
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <div className="p-2 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-lg shadow-md">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.totalRevenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground">From all invoices</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <div className="p-2 bg-gradient-to-tr from-purple-500 to-pink-400 rounded-lg shadow-md">
                <FileText className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground">Across all customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <div className="p-2 bg-gradient-to-tr from-teal-500 to-lime-400 rounded-lg shadow-md">
                <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeCustomers ?? 0}</div>
            <p className="text-xs text-muted-foreground">Excluding guest checkouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products in Stock</CardTitle>
             <div className="p-2 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-lg shadow-md">
                <Package className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.productsInStock ?? 0}</div>
            <p className="text-xs text-muted-foreground">Sum of all product quantities</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-b from-white to-slate-50 dark:from-gray-800 dark:to-gray-900/50">
        <CardHeader>
          <CardTitle>Sales Overview (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => formatCurrency(value as number)} />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Bar dataKey="Sales" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;