import React, { useState, useEffect, Suspense, lazy } from 'react'
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { AppGuard } from '@/components/AppGuard'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SetupWizard } from '@/pages/Auth/SetupWizard'
import { LoginPage } from '@/pages/Auth/LoginPage'
import { AppLoadingScreen } from '@/pages/Auth/AppLoadingScreen'

const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MedicineListPage = lazy(() => import('@/pages/Medicines/MedicineListPage').then((m) => ({ default: m.MedicineListPage })))
const InventoryPage = lazy(() => import('@/pages/Inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const InventoryDashboard = lazy(() => import('@/pages/Inventory/InventoryDashboard').then((m) => ({ default: m.InventoryDashboard })))
const StockTransactions = lazy(() => import('@/pages/Inventory/StockTransactions').then((m) => ({ default: m.StockTransactions })))
const ExpiryReport = lazy(() => import('@/pages/Inventory/ExpiryReport').then((m) => ({ default: m.ExpiryReport })))
const SuppliersPage = lazy(() => import('@/pages/Suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })))
const SupplierListPage = lazy(() => import('@/pages/Suppliers/SupplierListPage').then((m) => ({ default: m.SupplierListPage })))
const PurchaseOrdersPage = lazy(() => import('@/pages/Suppliers/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })))
const BillingPage = lazy(() => import('@/pages/Billing/BillingPage').then((m) => ({ default: m.BillingPage })))
const POSPage = lazy(() => import('@/pages/Billing/POSPage').then((m) => ({ default: m.POSPage })))
const BillHistoryPage = lazy(() => import('@/pages/Billing/BillHistoryPage').then((m) => ({ default: m.BillHistoryPage })))
const PrescriptionsPage = lazy(() => import('@/pages/Prescriptions/PrescriptionsPage').then((m) => ({ default: m.PrescriptionsPage })))
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const ReportsLayout = lazy(() => import('@/pages/Reports/ReportsLayout').then((m) => ({ default: m.ReportsLayout })))
const SalesReport = lazy(() => import('@/pages/Reports/SalesReport').then((m) => ({ default: m.SalesReport })))
const StockReport = lazy(() => import('@/pages/Reports/StockReport').then((m) => ({ default: m.StockReport })))
const PurchaseReport = lazy(() => import('@/pages/Reports/PurchaseReport').then((m) => ({ default: m.PurchaseReport })))
const IssueReport = lazy(() => import('@/pages/Reports/IssueReport').then((m) => ({ default: m.IssueReport })))
const LowStockReport = lazy(() => import('@/pages/Reports/LowStockReport').then((m) => ({ default: m.LowStockReport })))
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

type BootStatus = 'loading' | 'first-run' | 'ready'

/**
 * Runs first-run check before any route. If no users exist, redirects to /setup.
 * Ensures Setup Wizard is shown when DB is empty regardless of initial URL.
 */
export function AppBoot(): React.ReactElement {
  const [status, setStatus] = useState<BootStatus>('loading')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    window.api
      .invoke<boolean>('auth:checkFirstRun')
      .then((isFirstRun) => {
        if (cancelled) return
        if (isFirstRun) {
          setStatus('first-run')
          navigate('/setup', { replace: true })
        }
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F3F4F6'
        }}
      >
        <Spin size="large" tip="Loading..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app-loading"
          element={
            <AppGuard>
              <ProtectedRoute>
                <AppLoadingScreen />
              </ProtectedRoute>
            </AppGuard>
          }
        />
        <Route
        path="/"
        element={
          <AppGuard>
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          </AppGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="medicines" element={<MedicineListPage />} />
        <Route path="inventory" element={<InventoryPage />}>
          <Route index element={<InventoryDashboard />} />
          <Route path="transactions" element={<StockTransactions />} />
          <Route path="expiry" element={<ExpiryReport />} />
        </Route>
        <Route path="suppliers" element={<SuppliersPage />}>
          <Route index element={<SupplierListPage />} />
          <Route path="orders" element={<PurchaseOrdersPage />} />
        </Route>
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/pos" element={<POSPage />} />
        <Route path="billing/history" element={<BillHistoryPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="reports" element={<ReportsLayout />}>
          <Route index element={<ReportsPage />} />
          <Route path="sales" element={<SalesReport />} />
          <Route path="stock" element={<StockReport />} />
          <Route path="expiry" element={<ExpiryReport />} />
          <Route path="low-stock" element={<LowStockReport />} />
          <Route path="purchase" element={<PurchaseReport />} />
          <Route path="issue" element={<IssueReport />} />
        </Route>
        <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
