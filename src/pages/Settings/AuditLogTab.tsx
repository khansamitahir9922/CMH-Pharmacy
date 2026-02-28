import React, { useState, useEffect } from 'react'
import { Card, Table, DatePicker, Select } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'

interface AuditLogRow {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  table_name: string | null
  record_id: number | null
  details: string | null
  created_at: string
}

interface UserOption {
  id: number
  full_name: string
  username: string
}

export function AuditLogTab(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [userId, setUserId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])

  useEffect(() => {
    window.api.invoke<UserOption[]>('users:getAll').then((data) => setUsers(data ?? []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const start = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
    const end = dateRange?.[1]?.format('YYYY-MM-DD') ?? null
    window.api
      .invoke<{ data: AuditLogRow[]; total: number }>('audit:getLogs', {
        userId: userId ?? undefined,
        startDate: start,
        endDate: end,
        page,
        pageSize
      })
      .then((res) => {
        setLogs(res?.data ?? [])
        setTotal(res?.total ?? 0)
      })
      .catch(() => {
        setLogs([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [userId, dateRange, page, pageSize])

  const columns: ColumnsType<AuditLogRow> = [
    { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v) => (v ? new Date(v).toLocaleString() : '—') },
    { title: 'User', dataIndex: 'user_name', key: 'user_name', render: (v) => v ?? '—' },
    { title: 'Action', dataIndex: 'action', key: 'action', width: 120 },
    { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true }
  ]

  return (
    <Card title="Audit Log">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
        />
        <Select
          placeholder="All users"
          allowClear
          style={{ width: 200 }}
          value={userId ?? undefined}
          onChange={(v) => setUserId(v ?? null)}
          options={[
            { value: null, label: 'All users' },
            ...users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` }))
          ]}
        />
      </div>
      <Table
        rowKey="id"
        dataSource={logs}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps ?? 20)
          }
        }}
        locale={{ emptyText: 'No audit log entries.' }}
      />
    </Card>
  )
}
