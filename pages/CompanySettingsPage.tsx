import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { CompanyDetails } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import CompanyForm from '../components/CompanyForm';

const fetchCompanyDetails = async (): Promise<CompanyDetails | null> => {
    const { data, error } = await supabase
        .from('company_details')
        .select('*')
        .eq('id', 1)
        .single();
    
    if (error && error.code !== 'PGRST116') { // Ignore 'range not found' error for new users
        throw new Error(error.message);
    }
    return data;
};

const CompanySettingsPage: React.FC = () => {
    const { data: companyDetails, isLoading, error } = useQuery({
        queryKey: ['companyDetails'],
        queryFn: fetchCompanyDetails,
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/settings" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    Manage Company Details
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>
                        This information will appear on your invoices. Fill it out carefully.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                           <Skeleton className="h-10 w-full" />
                           <Skeleton className="h-20 w-full" />
                           <Skeleton className="h-10 w-1/2" />
                        </div>
                    ) : error instanceof Error ? (
                        <p className="text-red-500">Error loading company details: {error.message}</p>
                    ) : (
                        <CompanyForm companyDetails={companyDetails} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CompanySettingsPage;