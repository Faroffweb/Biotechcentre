import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Unit } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import UnitForm from '../components/UnitForm';
import { toast } from '../components/ui/Toaster';
import Pagination from '../components/ui/Pagination';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const fetchUnits = async (page: number): Promise<{ data: Unit[], count: number }> => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('units')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data || [], count: count || 0 };
};

const deleteUnit = async (unitId: string) => {
  const { error } = await supabase.from('units').delete().eq('id', unitId);
  if (error) throw new Error(error.message);
};

const UnitsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: unitsData, isLoading, error } = useQuery({
    queryKey: ['units', currentPage],
    queryFn: () => fetchUnits(currentPage),
    placeholderData: keepPreviousData,
  });

  const units = unitsData?.data ?? [];
  const totalCount = unitsData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      toast('Unit deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (error) => {
      toast(`Error deleting unit: ${error.message}`);
    },
  });

  const handleAddClick = () => {
    setSelectedUnit(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (unitId: string) => {
    if (window.confirm('Are you sure you want to delete this unit? This might affect products using it.')) {
      deleteMutation.mutate(unitId);
    }
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedUnit(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <Link to="/settings" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
              <ArrowLeft className="w-6 h-6" />
           </Link>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Manage Units</h1>
        </div>
        <Button onClick={handleAddClick}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Unit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unit List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading units...</p>}
          {error instanceof Error && <p className="text-red-500">Error: {error.message}</p>}
          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Abbreviation</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.length > 0 ? units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell data-label="Name" className="font-medium">{unit.name}</TableCell>
                        <TableCell data-label="Abbreviation">{unit.abbreviation}</TableCell>
                        <TableCell data-label="Actions">
                          <div className="flex items-center justify-center space-x-2 md:justify-center">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(unit)} aria-label="Edit Unit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(unit.id)} disabled={deleteMutation.isPending} aria-label="Delete Unit">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No units found. Click "Add Unit" to get started.</TableCell>
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

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedUnit ? 'Edit Unit' : 'Add New Unit'}>
        <UnitForm 
          unit={selectedUnit} 
          onSuccess={handleFormSuccess} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Dialog>
    </div>
  );
};

export default UnitsPage;