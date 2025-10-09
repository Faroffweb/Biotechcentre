
import React from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Download } from 'lucide-react';

const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Reports</h1>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export All Data
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports & Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>GST summary, sales, and stock analytics will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;