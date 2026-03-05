import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Select, Table, Button, Skeleton } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'

interface AdjustmentLogRow {
  id: number
  created_at: string
  medicine_name: string | null
  batch_no: string | null
  transaction_type: string
  quantity: number
  reason: string | null
  performer_name: string | null
}

const REPORT_NAME = 'Adjustment Log Report'

export function AdjustmentLogReport(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [userId, setUserId] = useState<number | null>(null)
  const [users, setUsers] = useState<{ id: number; full_name: string; username: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AdjustmentLogRow[]>([])

  useEffect(() => {
    window.api.invoke('audit:logReportView', { reportName: REPORT_NAME, userId: currentUser?.id }).catch(() => {})
  }, [])

  useEffect(() => {
    window.api.invoke('users:getAll').then((data) => setUsers(data ?? [])).catch(() => setUsers([]))
  }, [])

  const start = dateRange[0].format('YYYY-MM-DD')
  const end = dateRange[1].format('YYYY-MM-DD')

  useEffect(() => {
    setLoading(true)
    window.api
      .invoke<AdjustmentLogRow[]>('reports:getAdjustmentLog', {
        startDate: start,
        endDate: end,
        userId: userId ?? undefined
      })
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [start, end, userId])

  const columns: ColumnsType<AdjustmentLogRow> = [
    { title: 'Date/Time', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v) => (v ? new Date(v).toLocaleString() : '—') },
    {
      title: 'Medicine',
      key: 'medicine_name',
      render: (_: unknown, r: { medicine_name?: string | null; medicine_generic_name?: string | null }) =>
        r.medicine_generic_name ? `${r.medicine_name ?? '—'} (${r.medicine_generic_name})` : (r.medicine_name ?? '—')
    },
    { title: 'Batch', dataIndex: 'batch_no', key: 'batch_no', render: (v) => v ?? '—' },
    { title: 'Type', dataIndex: 'transaction_type', key: 'transaction_type', width: 90 },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v) => v ?? '—' },
    { title: 'Performed by', dataIndex: 'performer_name', key: 'performer_name', render: (v) => v ?? '—' }
  ]

  return (
    <div>
      <Typography.Title level={4}>Adjustment Log Report</Typography.Title>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <DatePicker.RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs] ?? dateRange)} />
        <Select
          placeholder="All users"
          allowClear
          style={{ width: 200 }}
          value={userId ?? undefined}
          onChange={(v) => setUserId(v ?? null)}
          options={[{ value: undefined, label: 'All users' }, ...users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` }))]}
        />
      </div>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No adjustment log entries in this period.' }}
      />
    </div>
  )
}
