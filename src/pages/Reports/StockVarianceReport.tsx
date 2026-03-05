import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'

interface StockVarianceRow {
  medicine_id: number
  medicine_name: string | null
  category_name: string | null
  received: number
  issued: number
  variance: number
}

const REPORT_NAME = 'Stock Variance Report'

export function StockVarianceReport(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<StockVarianceRow[]>([])

  useEffect(() => {
    window.api.invoke('audit:logReportView', { reportName: REPORT_NAME, userId: currentUser?.id }).catch(() => {})
  }, [])

  const start = dateRange[0].format('YYYY-MM-DD')
  const end = dateRange[1].format('YYYY-MM-DD')

  useEffect(() => {
    setLoading(true)
    window.api
      .invoke<StockVarianceRow[]>('reports:getStockVariance', { startDate: start, endDate: end })
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [start, end])

  const columns: ColumnsType<StockVarianceRow> = [
    {
      title: 'Medicine',
      key: 'medicine_name',
      render: (_: unknown, r: { medicine_name?: string | null; medicine_generic_name?: string | null }) =>
        r.medicine_generic_name ? `${r.medicine_name ?? '—'} (${r.medicine_generic_name})` : (r.medicine_name ?? '—')
    },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Received', dataIndex: 'received', key: 'received', width: 100, align: 'right' },
    { title: 'Issued', dataIndex: 'issued', key: 'issued', width: 100, align: 'right' },
    { title: 'Variance (R − I)', dataIndex: 'variance', key: 'variance', width: 120, align: 'right', render: (v) => (v !== 0 ? v : '—') }
  ]

  return (
    <div>
      <Typography.Title level={4}>Stock Variance Report</Typography.Title>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Received vs issued by medicine in the selected period. Variance = Received − Issued.
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
