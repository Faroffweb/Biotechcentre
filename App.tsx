import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/Toaster';
import DashboardPage from './pages/DashboardPage';
// Fix: Correct import for InvoicesPage.tsx which is now a module.
import InvoicesPage from './pages/InvoicesPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import PurchasesPage from './pages/PurchasesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import MainLayout from './components/layout/MainLayout';
import StockPage from './pages/StockPage';
import UnitsPage from './pages/UnitsPage';
import CategoriesPage from './pages/CategoriesPage';
import ProductStockReportPage from './pages/ProductStockReportPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import CreateInvoicePage from './pages/CreateInvoicePage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<CreateInvoicePage />} />
          <Route path="invoices/edit/:invoiceId" element={<CreateInvoicePage />} />
          <Route path="inventory" element={<ProductsPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="stock/:productId" element={<ProductStockReportPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/units" element={<UnitsPage />} />
          <Route path="settings/categories" element={<CategoriesPage />} />
          <Route path="settings/company" element={<CompanySettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  );
};

export default App;