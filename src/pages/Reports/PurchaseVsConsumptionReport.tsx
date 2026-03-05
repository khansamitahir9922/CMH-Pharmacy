import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Table, Skeleton } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'

interface PurchaseVsConsumptionRow {
  medicine_id: number
  medicine_name: string | null
  category_name: string | null
  purchase_qty: number
  consumption_qty: number
  difference: number
}

const REPORT_NAME = 'Purchase vs Consumption Analysis'

export function PurchaseVsConsumptionReport(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PurchaseVsConsumptionRow[]>([])

  useEffect(() => {
    window.api.invoke('audit:logReportView', { reportName: REPORT_NAME, userId: currentUser?.id }).catch(() => {})
  }, [])

  const start = dateRange[0].format('YYYY-MM-DD')
  const end = dateRange[1].format('YYYY-MM-DD')

  useEffect(() => {
    setLoading(true)
    window.api
      .invoke<PurchaseVsConsumptionRow[]>('reports:getPurchaseVsConsumption', { startDate: start, endDate: end })
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [start, end])

  const columns: ColumnsType<PurchaseVsConsumptionRow> = [
    {
      title: 'Medicine',
      key: 'medicine_name',
      render: (_: unknown, r: { medicine_name?: string | null; medicine_generic_name?: string | null }) =>
        r.medicine_generic_name ? `${r.medicine_name ?? '—'} (${r.medicine_generic_name})` : (r.medicine_name ?? '—')
    },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Purchase Qty', dataIndex: 'purchase_qty', key: 'purchase_qty', width: 120, align: 'right' },
    { title: 'Consumption Qty', dataIndex: 'consumption_qty', key: 'consumption_qty', width: 120, align: 'right' },
    { title: 'Difference (P − C)', dataIndex: 'difference', key: 'difference', width: 120, align: 'right', render: (v) => (v !== 0 ? v : '—') }
  ]

  return (
    <div>
      <Typography.Title level={4}>Purchase vs Consumption Analysis</Typography.Title>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Purchase (stock in from purchase orders) vs consumption (stock out) in the selected period.
      </p>
      <div style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs] ?? dateRange)} />
      </div>
      <Table
        rowKey="medicine_id"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No data in this period.' }}
      />
    </div>
  )
}
