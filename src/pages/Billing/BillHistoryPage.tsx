import React, { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Input, Select, Space, Table, Tag, Typography, Tooltip, notification, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/expiryStatus'
import { BillReceiptModal, type ReceiptData } from './BillReceiptModal'
import { VoidBillModal } from './VoidBillModal'
import { useNavigate } from 'react-router-dom'

type PaymentMode = 'cash' | 'card' | 'credit'

interface BillListRow {
  id: number
  bill_number: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  items_count: number
  subtotal: number
  total_amount: number
  payment_mode: PaymentMode
  is_voided: boolean
}

interface DailySummary {
  date: string
  totalSales: number
  billCount: number
}

export function BillHistoryPage(): React.ReactElement {
  const navigate = useNavigate()
  const { currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BillListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode | 'all'>('all')
  const [includeVoided, setIncludeVoided] = useState(false)

  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewData, setViewData] = useState<ReceiptData | null>(null)

  const [voidOpen, setVoidOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<BillListRow | null>(null)

  const fetchBills = (): void => {
    setLoading(true)
    const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
    const endDate = dateRange?.[1]?.format('YYYY-MM-DD') ?? null
    window.api
      .invoke<{ data: BillListRow[]; total: number }>('billing:getBills', {
        startDate,
        endDate,
        customerSearch: customerSearch.trim() || null,
        paymentMode: paymentMode === 'all' ? null : paymentMode,
        includeVoided,
        page,
        pageSize
      })
      .then((res) => {
        setRows(res?.data ?? [])
        setTotal(res?.total ?? 0)
      })
      .catch(() => {
        setRows([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }

  const fetchDailySummary = (): void => {
    const today = dayjs().format('YYYY-MM-DD')
    window.api
      .invoke<DailySummary>('billing:getDailySummary', today)
      .then((s) => setDailySummary(s ?? null))
      .catch(() => setDailySummary(null))
  }

  useEffect(() => {
    fetchBills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, dateRange, customerSearch, paymentMode, includeVoided])

  useEffect(() => {
    fetchDailySummary()
  }, [])

  const handleView = async (id: number): Promise<void> => {
    try {
      const res = await window.api.invoke<ReceiptData | null>('billing:getBillById', id)
      if (!res?.bill) throw new Error('Bill not found.')
      setViewData(res)
      setViewOpen(true)
    } catch (err) {
      notification.error({
        message: 'Failed to load bill',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  const columns: ColumnsType<BillListRow> = useMemo(() => [
    { title: 'Bill#', dataIndex: 'bill_number', key: 'bill_number', width: 150 },
    {
      title: 'Date & Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—')
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, r) => r.customer_name?.trim() ? r.customer_name : (r.customer_phone?.trim() ? r.customer_phone : '—')
    },
    { title: 'Items', dataIndex: 'items_count', key: 'items_count', width: 70 },
    { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 110, render: (v) => formatCurrency(v ?? 0) },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110, render: (v) => formatCurrency(v ?? 0) },
    {
      title: 'Mode',
      dataIndex: 'payment_mode',
      key: 'payment_mode',
      width: 90,
      render: (v: PaymentMode) => (v ?? 'cash').toUpperCase()
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, r) =>
        r.is_voided ? (
          <Tag color="red" style={{ textDecoration: 'line-through' }}>Voided</Tag>
        ) : (
          <Tag color="green">Active</Tag>
        )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap={false}>
          <Tooltip title="View">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { void handleView(r.id) }} />
          </Tooltip>
          {isAdmin && !r.is_voided ? (
            <Tooltip title="Void (Admin)">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setVoidTarget(r)
                  setVoidOpen(true)
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      )
    }
  ], [isAdmin])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Bill History
        </Typography.Title>
        <Button onClick={() => navigate('/billing/pos')}>Back to POS</Button>
      </div>

      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => { setDateRange(v as [Dayjs, Dayjs] | null); setPage(1) }}
          format="DD/MM/YYYY"
        />
        <Input
          placeholder="Customer name / phone"
          value={customerSearch}
          onChange={(e) => { setCustomerSearch(e.target.value); setPage(1) }}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          value={paymentMode}
          onChange={(v) => { setPaymentMode(v); setPage(1) }}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'All modes' },
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'credit', label: 'Credit' }
          ]}
        />
        <Space align="center">
          <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>Include voided bills</span>
          <Switch checked={includeVoided} onChange={(v) => { setIncludeVoided(v); setPage(1) }} />
          {includeVoided && rows.every((r) => !r.is_voided) && total > 0 && (
            <span style={{ fontSize: 12, color: '#6B7280' }}>No voided bills in current filters</span>
          )}
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t) => `Total ${t} bills`
        }}
        onChange={(p) => {
          if (p.current) setPage(p.current)
          if (p.pageSize) setPageSize(p.pageSize)
        }}
        scroll={{ x: 1100 }}
      />

      <div style={{ marginTop: 10, fontWeight: 700, color: '#111827' }}>
        Total Sales Today: <span style={{ color: '#1A56DB' }}>{formatCurrency(dailySummary?.totalSales ?? 0)}</span>
      </div>

      <BillReceiptModal
        open={viewOpen}
        data={viewData}
        onClose={() => {
          setViewOpen(false)
          setViewData(null)
        }}
      />

      {voidTarget && (
        <VoidBillModal
          open={voidOpen}
          bill={{ id: voidTarget.id, bill_number: voidTarget.bill_number, total_amount: voidTarget.total_amount }}
          onClose={() => {
            setVoidOpen(false)
            setVoidTarget(null)
          }}
          onSuccess={() => {
            setVoidOpen(false)
            setVoidTarget(null)
            fetchBills()
            fetchDailySummary()
          }}
        />
      )}
    </div>
  )
}

