

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import Skeleton from '../components/ui/Skeleton';
import { formatDate } from '../hooks/lib/utils';
import { Download, ChevronDown } from 'lucide-react';

const ITEMS_PER_PAGE = 15;

type ReportDataItem = {
    transaction_id: string;
    transaction_date: string;
    transaction_type: 'Sale' | 'Purchase';
    reference_number: string;
    product_name: string;
    quantity_change: number;
};

const fetchReportData = async ({ page, transactionType, startDate, endDate }: { page: number, transactionType: string, startDate: string, endDate: string })
: Promise<{ data: ReportDataItem[], count: number }> => {
    const from = (page - 1) * ITEMS_PER_PAGE;

    const [
        { data, error },
        { data: countData, error: countError }
    ] = await Promise.all([
        supabase.rpc('get_combined_report', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_transaction_type: transactionType,
            p_limit: ITEMS_PER_PAGE,
            p_offset: from
        }),
        supabase.rpc('get_combined_report_count', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_transaction_type: transactionType
        })
    ]);

    if (error) throw new Error(`Failed to fetch report data: ${error.message}`);
    if (countError) throw new Error(`Failed to fetch report count: ${countError.message}`);

    return { data: data || [], count: countData || 0 };
};

const formatDateForInput = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
};


const ReportsPage: React.FC = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [transactionType, setTransactionType] = useState('all');
    const [startDate, setStartDate] = useState(formatDateForInput(firstDayOfMonth));
    const [endDate, setEndDate] = useState(formatDateForInput(today));
    const [currentPage, setCurrentPage] = useState(1);
    
    // State and ref for the custom dropdown
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['reports', currentPage, transactionType, startDate, endDate],
        queryFn: () => fetchReportData({ page: currentPage, transactionType, startDate, endDate }),
        placeholderData: keepPreviousData,
    });

    const reportItems = data?.data ?? [];
    const totalCount = data?.count ?? 0;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // Effect to close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [transactionType, startDate, endDate]);

    const renderSkeleton = () => (
        <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Product</TableHead><TableHead>Quantity</TableHead><TableHead>Reference #</TableHead></TableRow></TableHeader>
            <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    const transactionTypeOptions = [
        { value: 'all', label: 'All Types' },
        { value: 'sale', label: 'Sales' },
        { value: 'purchase', label: 'Purchases' }
    ];
    const selectedLabel = transactionTypeOptions.find(o => o.value === transactionType)?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Transaction Report</h1>
        <Button variant="outline" disabled>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle>Filter Transactions</CardTitle>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-gray-500">to</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                <div className="relative w-full sm:w-40" ref={dropdownRef}>
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full justify-between font-normal" 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        aria-haspopup="listbox"
                        aria-expanded={isDropdownOpen}
                    >
                        <span>{selectedLabel}</span>
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {isDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 animate-scale-in origin-top">
                            <div className="p-1" role="listbox">
                                {transactionTypeOptions.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={transactionType === option.value}
                                        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                        onClick={() => {
                                            setTransactionType(option.value);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reference #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportItems.length > 0 ? reportItems.map((item) => (
                      <TableRow key={item.transaction_id}>
                        <TableCell data-label="Date">{formatDate(item.transaction_date)}</TableCell>
                        <TableCell data-label="Type">
                            <Badge variant={item.transaction_type === 'Purchase' ? 'success' : 'destructive'}>
                                {item.transaction_type}
                            </Badge>
                        </TableCell>
                        <TableCell data-label="Product" className="font-medium">{item.product_name}</TableCell>
                        <TableCell data-label="Quantity" className={`font-semibold ${item.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                        </TableCell>
                        <TableCell data-label="Reference #">{item.reference_number || 'N/A'}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No transactions found for the selected filters.</TableCell>
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

export default ReportsPage;