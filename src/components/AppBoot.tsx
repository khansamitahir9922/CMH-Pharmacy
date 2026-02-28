import React, { useState, useEffect } from 'react'
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { AppGuard } from '@/components/AppGuard'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SetupWizard } from '@/pages/Auth/SetupWizard'
import { LoginPage } from '@/pages/Auth/LoginPage'
import { DashboardPage } from '@/pages/Dashboard/DashboardPage'
import { MedicineListPage } from '@/pages/Medicines/MedicineListPage'
import { InventoryPage } from '@/pages/Inventory/InventoryPage'
import { InventoryDashboard } from '@/pages/Inventory/InventoryDashboard'
import { StockTransactions } from '@/pages/Inventory/StockTransactions'
import { ExpiryReport } from '@/pages/Inventory/ExpiryReport'
import { SuppliersPage } from '@/pages/Suppliers/SuppliersPage'
import { SupplierListPage } from '@/pages/Suppliers/SupplierListPage'
import { PurchaseOrdersPage } from '@/pages/Suppliers/PurchaseOrdersPage'
import { BillingPage } from '@/pages/Billing/BillingPage'
import { PrescriptionsPage } from '@/pages/Prescriptions/PrescriptionsPage'
import { ReportsPage } from '@/pages/Reports/ReportsPage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'

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
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
