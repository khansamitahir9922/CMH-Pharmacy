import React, { useState, useEffect, useCallback } from 'react'
import { Typography, Card, Row, Col, Table, Spin, Button, Skeleton } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useNavigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/expiryStatus'

interface DailySummary {
  date: string
  totalSales: number
  billCount: number
}

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
  current_quantity: number
  min_stock_level: number
}

interface StockBalanceRow {
  medicine_name: string
  category_name: string | null
  closing: number
}

const GREETING = (): string => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const CHART_COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16']

export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)
  const [recentBills, setRecentBills] = useState<BillListRow[]>([])
  const [lowStockList, setLowStockList] = useState<LowStockRow[]>([])
  const [salesByDay, setSalesByDay] = useState<{ date: string; total: number }[]>([])
  const [stockByCategory, setStockByCategory] = useState<{ name: string; value: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchSalesChart = useCallback(() => {
    const weekStart = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    return window.api
      .invoke<{ summary: unknown; rows: { date: string; total_amount: number }[] }>('reports:getSales', {
        startDate: weekStart,
        endDate: today
      })
      .then((res) => {
        const rows = res?.rows ?? []
        const byDate = new Map<string, number>()
        for (let d = dayjs(weekStart); d.isBefore(dayjs(today).add(1, 'day')); d = d.add(1, 'day')) {
          const key = d.format('YYYY-MM-DD')
          byDate.set(key, 0)
        }
        rows.forEach((r) => {
          const key = r.date?.slice(0, 10) ?? ''
          if (byDate.has(key)) byDate.set(key, (byDate.get(key) ?? 0) + (r.total_amount ?? 0))
        })
        const arr = [...byDate.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, total]) => ({ date: dayjs(date).format('MMM D'), total }))
        setSalesByDay(arr)
      })
      .catch(() => setSalesByDay([]))
  }, [])

  const fetchDashboard = useCallback((showLoading = true): Promise<void> => {
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    const today = dayjs().format('YYYY-MM-DD')

    return Promise.all([
      window.api.invoke<DailySummary>('billing:getDailySummary', today),
      window.api.invoke<InventorySummary>('inventory:getSummary'),
      window.api.invoke<{ data: BillListRow[]; total: number }>('billing:getBills', { page: 1, pageSize: 5 }),
      window.api.invoke<LowStockRow[]>('inventory:getLowStock', 5),
      window.api.invoke<{ summary: unknown; rows: StockBalanceRow[] }>('reports:getStockBalance', { asOfDate: today })
    ])
      .then(([daily, inv, bills, lowStock, stockBalance]) => {
        setDailySummary(daily ?? null)
        setInventorySummary(inv ?? null)
        setRecentBills(bills?.data ?? [])
        setLowStockList(lowStock ?? [])
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
        fetchDashboard(false)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchDashboard, location.pathname])

  useEffect(() => {
    fetchSalesChart()
  }, [fetchSalesChart])

  const handleRefresh = (): void => {
    setRefreshing(true)
    Promise.all([fetchDashboard(false), fetchSalesChart()]).finally(() => setRefreshing(false))
  }

  const userName = currentUser?.full_name?.trim() || currentUser?.username || 'User'

  const billColumns: ColumnsType<BillListRow> = [
    { title: 'Bill#', dataIndex: 'bill_number', key: 'bill_number', render: (v, r) => <a onClick={() => navigate('/billing/history')}>{v}</a> },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', render: (v) => v ?? '—' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (v) => formatCurrency(v ?? 0) }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {GREETING()}, {userName}
          </Typography.Title>
          <Typography.Text type="secondary">{dayjs().format('dddd, MMMM D, YYYY')}</Typography.Text>
        </div>
        <Button
          type="default"
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={handleRefresh}
          loading={refreshing}
          title="Refresh dashboard"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Col xs={24} sm={12} md={8} lg={6} key={i}>
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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
            <Typography.Text type="secondary">Today&apos;s Sales</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {formatCurrency(dailySummary?.totalSales ?? 0)}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
            <Typography.Text type="secondary">Today&apos;s Bills</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {dailySummary?.billCount ?? 0}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
            <Typography.Text type="secondary">Medicine Products</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {inventorySummary?.totalMedicines ?? 0}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>product types in catalog</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #13c2c2' }}>
            <Typography.Text type="secondary">Total Stock (units)</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {(inventorySummary?.totalStockUnits ?? 0).toLocaleString()}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>reduces when you sell</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            size="small"
            style={{ borderLeft: '4px solid #fa8c16', cursor: 'pointer' }}
            onClick={() => navigate('/inventory')}
          >
            <Typography.Text type="secondary">Low Stock</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {inventorySummary?.lowStock ?? 0}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>View in Inventory</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            size="small"
            style={{ borderLeft: '4px solid #ff4d4f', cursor: 'pointer' }}
            onClick={() => navigate('/inventory/expiry')}
          >
            <Typography.Text type="secondary">Expiring Soon</Typography.Text>
            <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
              {(inventorySummary?.expiringThisMonth ?? 0) + (inventorySummary?.expired ?? 0)}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>View in Inventory</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Sales Last 7 Days">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={salesByDay} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Bar dataKey="total" fill="#1890ff" name="Revenue" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Stock by Category">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stockByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stockByCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Units']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
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
        </>
      )}
    </div>
  )
}
