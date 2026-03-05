import React, { useState, useEffect } from 'react'
import { Card, Table, DatePicker, Select, Row, Col, Statistic, Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/expiryStatus'

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '—'
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

interface UserActivitySummary {
  salesCount: number
  salesAmount: number
  stockInQty: number
  stockOutQty: number
}

export function AuditLogTab(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [userId, setUserId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [summary, setSummary] = useState<UserActivitySummary | null>(null)
  const [printLoading, setPrintLoading] = useState(false)

  const handlePrintReport = (): void => {
    if (currentUser?.id == null) return
    setPrintLoading(true)
    const start = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
    const end = dateRange?.[1]?.format('YYYY-MM-DD') ?? null
    window.api.invoke('audit:logAction', {
      userId: currentUser.id,
      action: 'Print audit log',
      details: 'Audit Log Report'
    }).catch(() => {})
    window.api
      .invoke<{ data: AuditLogRow[]; total: number }>('audit:getLogs', {
        userId: currentUser.id,
        startDate: start,
        endDate: end,
        page: 1,
        pageSize: 10000
      })
      .then((res) => {
        const logRows = res?.data ?? []
        return window.api
          .invoke<UserActivitySummary>('audit:getUserActivitySummary', {
            userId: currentUser.id,
            startDate: start,
            endDate: end
          })
          .then((sum) => {
            const summaryRow = sum ?? null
            const periodText = start && end ? `${start} to ${end}` : 'All dates'
            const userName = currentUser?.full_name ?? currentUser?.username ?? 'User'
            const tableRows = logRows
              .map(
                (r) =>
                  `<tr><td>${escapeHtml(r.created_at ? new Date(r.created_at).toLocaleString() : null)}</td><td>${escapeHtml(r.user_name)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(r.details)}</td></tr>`
              )
              .join('')
            const summaryBlock =
              summaryRow != null
                ? `<p><strong>Bills (sales):</strong> ${summaryRow.salesCount} &nbsp; <strong>Sales amount:</strong> ${formatCurrency(summaryRow.salesAmount)} &nbsp; <strong>Stock in (units):</strong> ${summaryRow.stockInQty} &nbsp; <strong>Stock out (units):</strong> ${summaryRow.stockOutQty}</p>`
                : ''
            const html = `<!DOCTYPE html><html><head><title>Audit Log Report</title>
<style>body{font-family:system-ui;padding:24px;max-width:900px;margin:0 auto} table{border-collapse:collapse;width:100%;margin-top:16px} th,td{border:1px solid #ddd;padding:8px;text-align:left} @media print{body{padding:0}}</style></head><body>
<h1>SKBZ/CMH RAWALAKOT PHARMACY</h1>
<h2>Audit Log Report</h2>
<p><strong>User:</strong> ${escapeHtml(userName)}</p>
<p><strong>Period:</strong> ${escapeHtml(periodText)}</p>
${summaryBlock}
<table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>${tableRows}</tbody></table>
<p style="margin-top:24px">Generated: ${escapeHtml(new Date().toLocaleString())}</p>
</body></html>`
            const w = window.open('', '_blank')
            if (w) {
              w.document.write(html)
              w.document.close()
              w.focus()
              setTimeout(() => {
                w.print()
                w.close()
              }, 250)
            }
          })
      })
      .catch(() => {})
      .finally(() => setPrintLoading(false))
  }

  useEffect(() => {
    if (!isAdmin && currentUser?.id != null) setUserId(currentUser.id)
  }, [isAdmin, currentUser?.id])

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

  useEffect(() => {
    if (userId == null || userId <= 0) {
      setSummary(null)
      return
    }
    const start = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
    const end = dateRange?.[1]?.format('YYYY-MM-DD') ?? null
    window.api
      .invoke<UserActivitySummary>('audit:getUserActivitySummary', { userId, startDate: start, endDate: end })
      .then((s) => setSummary(s ?? null))
      .catch(() => setSummary(null))
  }, [userId, dateRange])

  const columns: ColumnsType<AuditLogRow> = [
    { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v) => (v ? new Date(v).toLocaleString() : '—') },
    { title: 'User', dataIndex: 'user_name', key: 'user_name', render: (v) => v ?? '—' },
    { title: 'Action', dataIndex: 'action', key: 'action', width: 120 },
    { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true }
  ]

  const userOptions = isAdmin
    ? [{ value: undefined as number | undefined, label: 'All users' }, ...users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` }))]
    : users.filter((u) => u.id === currentUser?.id).map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` }))

  return (
    <Card title="Audit Log">
      {!isAdmin && (
        <p style={{ marginBottom: 12, color: '#666' }}>
          You see only your own audit log. Track of medicines you sold or stocked in/out is below when you select yourself.
        </p>
      )}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
        />
        <Select
          placeholder={isAdmin ? 'All users' : 'User'}
          allowClear={isAdmin}
          style={{ width: 200 }}
          value={userId ?? undefined}
          onChange={(v) => setUserId(v ?? null)}
          options={userOptions}
        />
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          loading={printLoading}
          onClick={handlePrintReport}
          disabled={currentUser?.id == null}
        >
          Print my audit log
        </Button>
      </div>
      {summary != null && (
        <Card size="small" style={{ marginBottom: 16 }} title="User activity summary (filtered period)">
          <Row gutter={24}>
            <Col span={6}>
              <Statistic title="Bills (sales)" value={summary.salesCount} />
            </Col>
            <Col span={6}>
              <Statistic title="Sales amount" value={formatCurrency(summary.salesAmount)} />
            </Col>
            <Col span={6}>
              <Statistic title="Stock in (units)" value={summary.stockInQty} />
            </Col>
            <Col span={6}>
              <Statistic title="Stock out (units)" value={summary.stockOutQty} />
            </Col>
          </Row>
        </Card>
      )}
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
