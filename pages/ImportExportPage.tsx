import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../hooks/lib/supabase';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Dialog from '../components/ui/Dialog';
import { toast } from '../components/ui/Toaster';
import { ArrowLeft, Upload, Download } from 'lucide-react';

// More robust CSV parsing that handles quoted fields
const parseCSV = (text: string): { headers: string[], rows: Record<string, string>[] } => {
    const textNormalized = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = textNormalized.split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines.shift()!.split(',').map(h => h.trim());
    const rows = lines.map(line => {
        const row: Record<string, string> = {};
        // This regex handles commas inside quotes.
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        
        headers.forEach((header, i) => {
            let value = (values[i] || '').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                // Remove quotes and un-escape double quotes
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            row[header] = value;
        });
        return row;
    });
    return { headers, rows };
};

const ImportExportPage: React.FC = () => {
    const queryClient = useQueryClient();

    const [modalState, setModalState] = useState<{ isOpen: boolean; type: 'products' | 'customers' | 'purchases' | null }>({ isOpen: false, type: null });
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [exportingType, setExportingType] = useState<'products' | 'customers' | 'purchases' | null>(null);

    const handleOpenImportModal = (type: 'products' | 'customers' | 'purchases') => {
        setImportFile(null);
        setModalState({ isOpen: true, type });
    };

    const handleCloseImportModal = () => {
        setModalState({ isOpen: false, type: null });
    };

    const handleExport = async (type: 'products' | 'customers' | 'purchases') => {
        setExportingType(type);
        toast(`Preparing ${type} data for export...`);
        try {
            const { data, error } = await supabase.from(type).select('*').order('name' in (await supabase.from(type).select('*', { head: true })).data?.[0] ? 'name' : 'created_at');
            if (error) throw error;
            if (!data || data.length === 0) {
                toast(`No ${type} to export.`);
                return;
            }

            const headers = Object.keys(data[0]);
            const escapeCSV = (value: any) => {
                if (value == null) return '';
                const str = String(value);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const csvContent = [
                headers.join(','),
                ...data.map(row => headers.map(header => escapeCSV((row as any)[header])).join(','))
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${type}_export.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            toast(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully!`);

        } catch (err) {
            toast(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setExportingType(null);
        }
    };

    const handleImport = async () => {
        if (!importFile || !modalState.type) return;
        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const { headers, rows } = parseCSV(text);
                
                // Basic validation based on type
                let requiredHeaders: string[] = [];
                let dataToInsert: any[] = [];
                switch(modalState.type) {
                    case 'products':
                        requiredHeaders = ['name', 'unit_price', 'tax_rate', 'stock_quantity'];
                        dataToInsert = rows.map(row => ({
                            name: row.name, description: row.description || null, hsn_code: row.hsn_code || null,
                            stock_quantity: parseInt(row.stock_quantity, 10) || 0,
                            unit_price: parseFloat(row.unit_price) || 0,
                            tax_rate: parseFloat(row.tax_rate) || 0,
                            unit_id: row.unit_id || null, category_id: row.category_id || null
                        }));
                        break;
                    case 'customers':
                        requiredHeaders = ['name'];
                        dataToInsert = rows.map(row => ({
                            name: row.name, email: row.email || null, phone: row.phone || null, gstin: row.gstin || null,
                            billing_address: row.billing_address || null, is_guest: row.is_guest?.toLowerCase() === 'true' || false
                        }));
                        break;
                    case 'purchases':
                        requiredHeaders = ['product_id', 'purchase_date', 'quantity'];
                        dataToInsert = rows.map(row => ({
                            product_id: row.product_id, purchase_date: row.purchase_date,
                            reference_invoice: row.reference_invoice || null,
                            quantity: parseInt(row.quantity, 10) || 0,
                        }));
                        break;
                }

                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
                }

                const { error } = await supabase.from(modalState.type).insert(dataToInsert);
                if (error) throw error;

                toast(`${rows.length} ${modalState.type} imported successfully!`);
                queryClient.invalidateQueries({ queryKey: [modalState.type] });
                handleCloseImportModal();
            } catch (err) {
                toast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(importFile);
    };

    const downloadTemplate = (type: 'products' | 'customers' | 'purchases') => {
        let headers = '';
        switch(type) {
            case 'products': headers = 'name,description,hsn_code,stock_quantity,unit_price,tax_rate,unit_id,category_id'; break;
            case 'customers': headers = 'name,email,phone,gstin,billing_address,is_guest'; break;
            case 'purchases': headers = 'product_id,purchase_date,reference_invoice,quantity'; break;
        }
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${type}_import_template.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sections = [
        { type: 'products' as const, title: 'Products Data', description: 'Import or export your product inventory.' },
        { type: 'customers' as const, title: 'Customers Data', description: 'Import or export your customer list.' },
        { type: 'purchases' as const, title: 'Purchases Data', description: 'Import or export your purchase history.' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/settings" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    Import / Export Data
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map(section => (
                    <Card key={section.type}>
                        <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => handleOpenImportModal(section.type)}>
                                <Upload className="w-4 h-4 mr-2" /> Import {section.type}
                            </Button>
                            <Button variant="outline" onClick={() => handleExport(section.type)} disabled={exportingType === section.type}>
                                <Download className="w-4 h-4 mr-2" /> {exportingType === section.type ? 'Exporting...' : `Export ${section.type}`}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog isOpen={modalState.isOpen} onClose={handleCloseImportModal} title={`Import ${modalState.type}`}>
                {modalState.type && (
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium mb-2">Instructions</h4>
                            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <li>Download the template to see the required format.</li>
                                {modalState.type === 'products' && <li>For `unit_id` and `category_id`, you must provide the exact ID from the database.</li>}
                                {modalState.type === 'purchases' && <li>The `product_id` must be the exact ID from the database.</li>}
                            </ul>
                        </div>
                        <Button type="button" variant="secondary" onClick={() => downloadTemplate(modalState.type!)}>Download Template CSV</Button>
                        <div>
                            <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload CSV File</label>
                            <Input id="csv-upload" type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)} className="mt-1" />
                        </div>
                        <Button onClick={handleImport} disabled={isImporting || !importFile} className="w-full">
                            {isImporting ? 'Importing...' : 'Start Import'}
                        </Button>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default ImportExportPage;