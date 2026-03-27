import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Alert, Table, Button, Skeleton } from 'antd'
import {
  MedicineBoxOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAlertStore } from '@/store/alertStore'
import { formatDate, getExpiryStatus, getExpiryColor, getDaysLeft } from '@/utils/expiryStatus'
import type { ColumnsType } from 'antd/es/table'

interface Summary {
  totalMedicines: number
  totalStockUnits: number
  lowStock: number
  expiringThisMonth: number
  expired: number
}

interface LowStockRow {
  id: number
  name: string
  current_quantity: number
  min_stock_level: number
}

interface ExpiringRow {
  id: number
  name: string
  expiry_date: string | null
  batch_no: string | null
  current_quantity: number
}

export function InventoryDashboard(): React.ReactElement {
  const navigate = useNavigate()
  const { summary, setSummary, dismissedBanners, dismissBanner } = useAlertStore()
  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState<Summary>(summary)
  const [lowStock, setLowStock] = useState<LowStockRow[]>([])
  const [expiringSoon, setExpiringSoon] = useState<ExpiringRow[]>([])

  const fetchDashboard = (): void => {
    setLoading(true)
    Promise.all([
      window.api.invoke<Summary>('inventory:getSummary'),
      window.api.invoke<LowStockRow[]>('inventory:getLowStock', 10),
      window.api.invoke<ExpiringRow[]>('inventory:getExpiringSoon', { days: 90, limit: 10 })
    ])
      .then(([s, low, exp]) => {
        setSummaryData(s)
        setSummary(s)
        setLowStock(low ?? [])
        setExpiringSoon(exp ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const showExpiredBanner = summaryData.expired > 0 && !dismissedBanners.has('expired')
  const showExpiringBanner = summaryData.expiringThisMonth > 0 && !dismissedBanners.has('expiring30')
  const showLowStockBanner = summaryData.lowStock > 0 && !dismissedBanners.has('lowStock')
  const movingHeadline = (text: string): React.ReactElement => (
    <div className="moving-headline">
      <span>{text}</span>
    </div>
  )

  const lowStockColumns: ColumnsType<LowStockRow> = [
    { title: 'Medicine Name', dataIndex: 'name', key: 'name' },
    { title: 'Current Stock', dataIndex: 'current_quantity', key: 'current_quantity', width: 120 },
    { title: 'Min Level', dataIndex: 'min_stock_level', key: 'min_stock_level', width: 100 },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      render: () => (
        <Button type="primary" size="small" onClick={() => navigate('/suppliers')}>
          Create Order
        </Button>
      )
    }
  ]

  const expiringColumns: ColumnsType<ExpiringRow> = [
    { title: 'Medicine Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (v: string | null) => formatDate(v)
    },
    {
      title: 'Days Left',
      key: 'daysLeft',
      width: 100,
      render: (_: unknown, r: ExpiringRow) => {
        const days = getDaysLeft(r.expiry_date)
        if (days === null) return '—'
        const status = getExpiryStatus(r.expiry_date ?? '')
        const { text } = getExpiryColor(status)
        return <span style={{ color: text, fontWeight: 500 }}>{days}</span>
      }
    },
    { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no', render: (v: string | null) => v ?? '—' },
    { title: 'Qty', dataIndex: 'current_quantity', key: 'current_quantity', width: 80 }
  ]

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <MedicineBoxOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.95)', marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summaryData.totalMedicines}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Medicine Products</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{(summaryData.totalStockUnits ?? 0).toLocaleString()}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Total Stock (units)</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <WarningOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.95)', marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summaryData.lowStock}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Low Stock</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <ClockCircleOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.95)', marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summaryData.expiringThisMonth}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Expiring This Month</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <ExclamationCircleOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.95)', marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summaryData.expired}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Expired</div>
          </Card>
        </Col>
      </Row>

      {showExpiredBanner && (
        <Alert
          type="error"
          message={movingHeadline(`${summaryData.expired} medicines have expired. Take action immediately.`)}
          showIcon
          closable
          onClose={() => dismissBanner('expired')}
          style={{ marginBottom: 16 }}
        />
      )}
      {showExpiringBanner && (
        <Alert
          type="warning"
          message={`${summaryData.expiringThisMonth} medicines are expiring within 30 days.`}
          showIcon
          closable
          onClose={() => dismissBanner('expiring30')}
          style={{ marginBottom: 16 }}
        />
      )}
      {showLowStockBanner && (
        <Alert
          message={movingHeadline(`${summaryData.lowStock} medicines are below minimum stock level.`)}
          showIcon
          closable
          onClose={() => dismissBanner('lowStock')}
          style={{ marginBottom: 16, backgroundColor: '#FEFCE8', borderColor: '#CA8A04', color: '#854D0E' }}
        />
      )}

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Card title="Low Stock Medicines" size="small">
            <Table
              rowKey="id"
              dataSource={lowStock}
              columns={lowStockColumns}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No low stock items' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Expiring Soon" size="small">
            <Table
              rowKey="id"
              dataSource={expiringSoon}
              columns={expiringColumns}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No items expiring soon' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
