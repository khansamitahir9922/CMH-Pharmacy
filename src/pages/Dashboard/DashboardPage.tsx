import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Typography, Card, Row, Col, Table, Button, Skeleton } from 'antd'
import {
  ReloadOutlined,
  ShoppingCartOutlined,
  PlusOutlined,
  InboxOutlined,
  BarChartOutlined,
  MedicineBoxOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import { formatCurrency, formatDate, getExpiryStatus } from '@/utils/expiryStatus'

interface InventorySummary {
  totalMedicines: number
  totalStockUnits: number
  lowStock: number
  expiringThisMonth: number
  expired: number
}

interface BillListRow {
  id: number
  bill_number: string
  created_at: string
  customer_name: string | null
  total_amount: number
}

interface LowStockRow {
  id: number
  name: string
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  min_stock_level: number
}

interface ExpiringSoonRow {
  id: number
  name: string
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  min_stock_level: number
}

interface StockBalanceRow {
  medicine_name: string
  category_name: string | null
  closing: number
}

const CHART_COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16']

export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)
  const [recentBills, setRecentBills] = useState<BillListRow[]>([])
  const [lowStockList, setLowStockList] = useState<LowStockRow[]>([])
  const [expiringSoonList, setExpiringSoonList] = useState<ExpiringSoonRow[]>([])
  const [stockByCategory, setStockByCategory] = useState<{ name: string; value: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const lastFocusFetchMsRef = useRef(0)

  const fetchDashboard = useCallback((showLoading = true): Promise<void> => {
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    const today = dayjs().format('YYYY-MM-DD')

    return Promise.all([
      window.api.invoke<InventorySummary>('inventory:getSummary'),
      window.api.invoke<{ data: BillListRow[]; total: number }>('billing:getBills', { page: 1, pageSize: 5 }),
      window.api.invoke<LowStockRow[]>('inventory:getLowStock', 5),
      window.api.invoke<ExpiringSoonRow[]>('inventory:getExpiringSoon', { days: 90, limit: 10 }),
      window.api.invoke<{ summary: unknown; rows: StockBalanceRow[] }>('reports:getStockBalance', { asOfDate: today })
    ])
      .then(([inv, bills, lowStock, expiringSoon, stockBalance]) => {
        setInventorySummary(inv ?? null)
        setRecentBills(bills?.data ?? [])
        setLowStockList(lowStock ?? [])
        setExpiringSoonList(expiringSoon ?? [])
        const rows = stockBalance?.rows ?? []
        const byCat = new Map<string, number>()
        rows.forEach((r) => {
          const cat = r.category_name?.trim() || 'Uncategorized'
          byCat.set(cat, (byCat.get(cat) ?? 0) + r.closing)
        })
        setStockByCategory([...byCat.entries()].map(([name, value]) => ({ name, value })))
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchDashboard(true)
  }, [fetchDashboard])

  // Refetch when user navigates back to dashboard or brings window to focus, so Stock Out / billing updates show
  useEffect(() => {
    const onFocus = (): void => {
      if (location.pathname === '/dashboard' || location.pathname.endsWith('/dashboard')) {
        const now = Date.now()
        if (now - lastFocusFetchMsRef.current < 20000) return
        lastFocusFetchMsRef.current = now
        fetchDashboard(false)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchDashboard, location.pathname])

  const handleRefresh = (): void => {
    setRefreshing(true)
    fetchDashboard(false).finally(() => setRefreshing(false))
  }

  const billColumns: ColumnsType<BillListRow> = [
    { title: 'Bill#', dataIndex: 'bill_number', key: 'bill_number', render: (v, r) => <a onClick={() => navigate('/billing/history')}>{v}</a> },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', render: (v) => v ?? '—' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (v) => formatCurrency(v ?? 0) }
  ]

  const expiringSoonNext3Months = useMemo(() => {
    const localTodayStart = dayjs().startOf('day')
    const localEnd90 = localTodayStart.add(90, 'day')
    return expiringSoonList
      .filter((r) => r.expiry_date && !dayjs(r.expiry_date).isBefore(localTodayStart))
      .filter((r) => r.expiry_date && !dayjs(r.expiry_date).isAfter(localEnd90))
      .slice(0, 5)
  }, [expiringSoonList])

  const expiredMedicines = useMemo(
    () => expiringSoonList.filter((r) => r.expiry_date && dayjs(r.expiry_date).isBefore(dayjs().startOf('day'))).slice(0, 5),
    [expiringSoonList]
  )

  const movingAlertLines = useMemo(
    () => [
      ...expiredMedicines.map((r) => `[Expired] ${r.name} (Batch ${r.batch_no ?? '—'})`),
      ...lowStockList.map((r) => `[Low Stock] ${r.name} (Current ${r.current_quantity}, Min ${r.min_stock_level})`)
    ],
    [expiredMedicines, lowStockList]
  )

  const stockOverviewRows = useMemo(
    () =>
      Array.from(
        // Keep unique medicines, but prioritize low/out-of-stock rows first.
        new Map<number, LowStockRow | ExpiringSoonRow>([...lowStockList, ...expiringSoonList].map((r) => [r.id, r])).values()
      )
        .sort((a, b) => {
          const aLow = a.current_quantity < a.min_stock_level ? 1 : 0
          const bLow = b.current_quantity < b.min_stock_level ? 1 : 0
          if (aLow !== bLow) return bLow - aLow

          const aStatus = getExpiryStatus(a.expiry_date)
          const bStatus = getExpiryStatus(b.expiry_date)
          const rank = (s: 'expired' | 'warning30' | 'warning90' | 'ok'): number => {
            if (s === 'warning30') return 0
            if (s === 'expired') return 1
            if (s === 'warning90') return 2
            return 3
          }
          return rank(aStatus) - rank(bStatus)
        })
        .slice(0, 5),
    [lowStockList, expiringSoonList]
  )

  const getStockOverviewStatus = (r: { current_quantity: number; min_stock_level: number; expiry_date: string | null }) => {
    if (r.current_quantity < r.min_stock_level) {
      return { label: 'Low Stock', bg: '#DC2626', color: '#FFFFFF' }
    }

    const expiryStatus = getExpiryStatus(r.expiry_date)
    if (expiryStatus === 'warning30') {
      return { label: 'Near Expiry', bg: '#F59E0B', color: '#FFFFFF' }
    }

    if (expiryStatus === 'expired') {
      return { label: 'Expired', bg: '#DC2626', color: '#FFFFFF' }
    }

    return { label: 'In Stock', bg: '#ECFDF5', color: '#059669' }
  }

  return (
    <div style={{ padding: 24 }}>
      {loading ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <Col xs={24} sm={12} md={6} lg={6} key={i}>
                <Card size="small"><Skeleton active paragraph={{ rows: 1 }} /></Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}><Card size="small"><Skeleton active paragraph={{ rows: 6 }} /></Card></Col>
            <Col xs={24} lg={12}><Card size="small"><Skeleton active paragraph={{ rows: 6 }} /></Card></Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}><Card size="small"><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
            <Col xs={24} lg={12}><Card size="small"><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
          </Row>
        </>
      ) : (
        <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={handleRefresh}
          loading={refreshing}
          title="Refresh dashboard"
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            size="default"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12
            }}
          >
            <div style={{ position: 'relative', minHeight: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MedicineBoxOutlined style={{ color: 'rgba(255,255,255,0.98)', fontSize: 15 }} />
                <Typography.Text style={{ color: 'rgba(255,255,255,0.96)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                  Total Medicines
                </Typography.Text>
              </div>
              <img
                src="/total-medicines.png"
                alt="Total medicines"
                style={{ position: 'absolute', left: -4, bottom: -2, width: 72, height: 58, objectFit: 'contain' }}
              />
              <Typography.Title
                level={1}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 28,
                  margin: 0,
                  color: '#fff',
                  fontWeight: 800,
                  lineHeight: 1,
                  fontSize: 42
                }}
              >
                {(inventorySummary?.totalMedicines ?? 0).toLocaleString()}
              </Typography.Title>
              <Button
                size="small"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.28)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  height: 30,
                  minWidth: 58,
                  fontWeight: 700
                }}
                onClick={() => navigate('/medicines')}
              >
                View
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            size="default"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12
            }}
          >
            <div style={{ position: 'relative', minHeight: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined style={{ color: 'rgba(255,255,255,0.98)', fontSize: 15 }} />
                <Typography.Text style={{ color: 'rgba(255,255,255,0.96)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                  Low Stock Alerts
                </Typography.Text>
              </div>
              <img
                src="/low-stock.png"
                alt="Low stock"
                style={{ position: 'absolute', left: -4, bottom: -2, width: 72, height: 58, objectFit: 'contain' }}
              />
              <Typography.Title
                level={1}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 28,
                  margin: 0,
                  color: '#fff',
                  fontWeight: 800,
                  lineHeight: 1,
                  fontSize: 42
                }}
              >
                {(inventorySummary?.lowStock ?? 0).toLocaleString()}
              </Typography.Title>
              <Button
                size="small"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.28)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  height: 30,
                  minWidth: 58,
                  fontWeight: 700
                }}
                onClick={() => navigate('/inventory')}
              >
                View
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            size="default"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12
            }}
          >
            <div style={{ position: 'relative', minHeight: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.98)', fontSize: 15 }} />
                <Typography.Text style={{ color: 'rgba(255,255,255,0.96)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                  Expiring Soon
                </Typography.Text>
              </div>
              <img
                src="/expiring-soon.png"
                alt="Expiring soon"
                style={{ position: 'absolute', left: -4, bottom: -2, width: 72, height: 58, objectFit: 'contain' }}
              />
              <Typography.Title
                level={1}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 28,
                  margin: 0,
                  color: '#fff',
                  fontWeight: 800,
                  lineHeight: 1,
                  fontSize: 42
                }}
              >
                {(inventorySummary?.expiringThisMonth ?? 0).toLocaleString()}
              </Typography.Title>
              <Button
                size="small"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.28)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  height: 30,
                  minWidth: 58,
                  fontWeight: 700
                }}
                onClick={() => navigate('/inventory/expiry')}
              >
                View
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            size="default"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12
            }}
          >
            <div style={{ position: 'relative', minHeight: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExclamationCircleOutlined style={{ color: 'rgba(255,255,255,0.98)', fontSize: 15 }} />
                <Typography.Text style={{ color: 'rgba(255,255,255,0.96)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                  Expired Medicines
                </Typography.Text>
              </div>
              <img
                src="/expired-medicine.png"
                alt="Expired medicines"
                style={{ position: 'absolute', left: -4, bottom: -2, width: 72, height: 58, objectFit: 'contain' }}
              />
              <Typography.Title
                level={1}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 28,
                  margin: 0,
                  color: '#fff',
                  fontWeight: 800,
                  lineHeight: 1,
                  fontSize: 42
                }}
              >
                {(inventorySummary?.expired ?? 0).toLocaleString()}
              </Typography.Title>
              <Button
                size="small"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.28)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  height: 30,
                  minWidth: 58,
                  fontWeight: 700
                }}
                onClick={() => navigate('/inventory/expiry')}
              >
                View
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Stock Overview">
            <div
              style={{
                background: '#ffffff',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Medicine Name', 'Batch No', 'Stock', 'Expiry Date', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          background: '#2B6CB0',
                          color: '#fff',
                          textAlign: 'left',
                          padding: '10px 12px',
                          fontWeight: 800,
                          fontSize: 12,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockOverviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: '#6B7280' }}>
                        No stock overview available
                      </td>
                    </tr>
                  ) : (
                    stockOverviewRows.map((r) => {
                      const s = getStockOverviewStatus(r)
                      return (
                        <tr key={r.id}>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <a
                              onClick={() => navigate('/medicines')}
                              style={{ color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {r.name}
                            </a>
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            {r.batch_no ?? '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.04)', textAlign: 'right' }}>
                            {(r.current_quantity ?? 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            {formatDate(r.expiry_date)}
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: s.bg,
                                color: s.color,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontWeight: 800,
                                fontSize: 12,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {s.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Expiry Alerts">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>▶ Expiring Soon (Next 3 Months):</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {expiringSoonNext3Months.length === 0 ? (
                    <li>No expiring items</li>
                  ) : (
                    expiringSoonNext3Months.map((r) => (
                      <li key={r.id}>
                        {r.name} (Batch {r.batch_no ?? '—'}) - {formatDate(r.expiry_date)}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>▶ Expired Medicines:</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {expiredMedicines.length === 0 ? (
                    <li>No expired items</li>
                  ) : (
                    expiredMedicines.map((r) => (
                      <li key={r.id}>
                        {r.name} (Batch {r.batch_no ?? '—'})
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Button
            block
            style={{
              height: 56,
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700
            }}
            icon={
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.22)'
                }}
              >
                <PlusOutlined style={{ color: '#ffffff', fontSize: 18 }} />
              </span>
            }
            onClick={() => navigate('/medicines?action=add')}
          >
            Add Medicine
          </Button>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Button
            block
            style={{
              height: 56,
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700
            }}
            icon={
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.22)'
                }}
              >
                <InboxOutlined style={{ color: '#ffffff', fontSize: 18 }} />
              </span>
            }
            onClick={() => navigate('/inventory/transactions')}
          >
            Stock Entry
          </Button>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Button
            block
            style={{
              height: 56,
              background: 'linear-gradient(135deg, #f97316, #fb7185)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700
            }}
            icon={
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.22)'
                }}
              >
                <ShoppingCartOutlined style={{ color: '#ffffff', fontSize: 18 }} />
              </span>
            }
            onClick={() => navigate('/billing/pos')}
          >
            Issue Medicine
          </Button>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Button
            block
            style={{
              height: 56,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700
            }}
            icon={
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.22)'
                }}
              >
                <BarChartOutlined style={{ color: '#ffffff', fontSize: 18 }} />
              </span>
            }
            onClick={() => navigate('/reports')}
          >
            Reports
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="Recent Bills"
            extra={<a onClick={() => navigate('/billing/history')}>View all</a>}
          >
            <Table
              rowKey="id"
              dataSource={recentBills}
              columns={billColumns}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No bills yet' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="Low Stock Alerts"
            extra={<a onClick={() => navigate('/inventory')}>View all</a>}
          >
            <Table
              rowKey="id"
              dataSource={lowStockList}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No low stock items' }}
              columns={[
                { title: 'Medicine', dataIndex: 'name', key: 'name', render: (v, r) => <a onClick={() => navigate('/inventory')}>{v}</a> },
                { title: 'Current', dataIndex: 'current_quantity', key: 'current_quantity', width: 80, align: 'right' as const },
                { title: 'Min', dataIndex: 'min_stock_level', key: 'min_stock_level', width: 80, align: 'right' as const }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={24}>
          <Card size="small" title="Stock by Medicine Category">
            <ResponsiveContainer width="100%" height={260} debounce={120}>
              <BarChart data={stockByCategory} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickMargin={8}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                <Tooltip formatter={(v: number) => [v, 'Units']} />
                <Bar dataKey="value" name="Units" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {stockByCategory.map((item, i) => (
                    <Cell key={`${item.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card size="small" title="Inventory Moving Alerts">
            {movingAlertLines.length === 0 ? (
              <Typography.Text type="secondary">No expired or low stock alerts.</Typography.Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {movingAlertLines.map((line, idx) => (
                  <div key={`${line}-${idx}`} className="dashboard-moving-headline">
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
        </>
      )}
    </div>
  )
}
