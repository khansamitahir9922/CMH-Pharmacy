import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Tabs, Table, Card, Row, Col, Button, Skeleton, Space } from 'antd'
import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface SalesReportSummary {
  totalBills: number
  totalRevenue: number
  avgBillValue: number
  topMedicineName: string | null
}

interface SalesReportRow {
  date: string
  bill_id: number
  bill_number: string
  customer_name: string | null
  items_count: number
  total_amount: number
  payment_mode: string
}

type PeriodKey = 'today' | 'week' | 'month' | 'custom'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' }
]

function getRange(period: PeriodKey, customRange: [Dayjs, Dayjs] | null): { start: string; end: string } {
  const today = dayjs().format('YYYY-MM-DD')
  switch (period) {
    case 'today':
      return { start: today, end: today }
    case 'week': {
      const start = dayjs().startOf('week').format('YYYY-MM-DD')
      return { start, end: today }
    }
    case 'month': {
      const start = dayjs().startOf('month').format('YYYY-MM-DD')
      return { start, end: today }
    }
    case 'custom':
      if (customRange?.[0] && customRange?.[1]) {
        return {
          start: customRange[0].format('YYYY-MM-DD'),
          end: customRange[1].format('YYYY-MM-DD')
        }
      }
      return { start: today, end: today }
    default:
      return { start: today, end: today }
  }
}

export function SalesReport(): React.ReactElement {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(() => [
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SalesReportSummary | null>(null)
  const [rows, setRows] = useState<SalesReportRow[]>([])

  const range = getRange(period, customRange)

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<{ summary: SalesReportSummary; rows: SalesReportRow[] }>('reports:getSales', {
        startDate: range.start,
        endDate: range.end
      })
      .then((res) => {
        setSummary(res?.summary ?? null)
        setRows(res?.rows ?? [])
      })
      .catch(() => {
        setSummary(null)
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [range.start, range.end])

  const columns: ColumnsType<SalesReportRow> = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'Bill#', dataIndex: 'bill_number', key: 'bill_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', render: (v) => v ?? '—' },
    { title: 'Items', dataIndex: 'items_count', key: 'items_count', width: 80, align: 'right' },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 110,
      align: 'right',
      render: (v: number) => formatCurrency(v)
    },
    { title: 'Payment Mode', dataIndex: 'payment_mode', key: 'payment_mode', width: 110 }
  ]

  const dataWithSubtotals: { date?: string; bill_number?: string; isSubtotal?: boolean; total_amount?: number }[] = []
  let lastDate = ''
  for (const r of rows) {
    if (r.date !== lastDate && lastDate) {
      const dayTotal = rows.filter((x) => x.date === lastDate).reduce((s, x) => s + x.total_amount, 0)
      dataWithSubtotals.push({
        date: `Subtotal (${lastDate})`,
        isSubtotal: true,
        total_amount: dayTotal
      })
    }
    lastDate = r.date
    dataWithSubtotals.push({ ...r })
  }
  if (lastDate) {
    const dayTotal = rows.filter((x) => x.date === lastDate).reduce((s, x) => s + x.total_amount, 0)
    dataWithSubtotals.push({
      date: `Subtotal (${lastDate})`,
      isSubtotal: true,
      total_amount: dayTotal
    })
  }

  const tableColumns: ColumnsType<Record<string, unknown>> = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 180, render: (v: string, r) => r.isSubtotal ? <strong>{v}</strong> : v },
    { title: 'Bill#', dataIndex: 'bill_number', key: 'bill_number', width: 120, render: (v: string, r) => r.isSubtotal ? '—' : v },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', render: (v: string, r) => r.isSubtotal ? '—' : (v ?? '—') },
    { title: 'Items', dataIndex: 'items_count', key: 'items_count', width: 80, align: 'right' as const, render: (_: unknown, r) => r.isSubtotal ? '—' : r.items_count },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 110,
      align: 'right' as const,
      render: (v: number, r) => (r.isSubtotal ? <strong>{formatCurrency(v ?? 0)}</strong> : formatCurrency(v ?? 0))
    },
    { title: 'Payment Mode', dataIndex: 'payment_mode', key: 'payment_mode', width: 110, render: (_: unknown, r) => r.isSubtotal ? '—' : r.payment_mode }
  ]

  const handleExportExcel = (): void => {
    const data = rows.map((r) => ({
      Date: r.date,
      'Bill#': r.bill_number,
      Customer: r.customer_name ?? '',
      Items: r.items_count,
      Total: r.total_amount,
      'Payment Mode': r.payment_mode
    }))
    exportToExcel(data, ['Date', 'Bill#', 'Customer', 'Items', 'Total', 'Payment Mode'], `sales-report-${range.start}-${range.end}.xlsx`)
  }

  const handleExportPdf = (): void => {
    const data = rows.map((r) => ({
      Date: r.date,
      'Bill#': r.bill_number,
      Customer: r.customer_name ?? '',
      Items: r.items_count,
      Total: r.total_amount,
      'Payment Mode': r.payment_mode
    }))
    exportToPDF(
      data,
      ['Date', 'Bill#', 'Customer', 'Items', 'Total', 'Payment Mode'],
      `Sales Report (${range.start} to ${range.end})`,
      `sales-report-${range.start}-${range.end}.pdf`
    )
  }

  const handlePrint = (): void => window.print()

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Daily/Monthly Sales Report
      </Typography.Title>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Tabs
          activeKey={period}
          onChange={(k) => setPeriod(k as PeriodKey)}
          items={PERIODS.map((p) => ({
            key: p.key,
            label: p.label,
            children: null
          }))}
        />
        {period === 'custom' && (
          <DatePicker.RangePicker
            value={customRange}
            onChange={(v) => setCustomRange(v as [Dayjs, Dayjs] | null)}
          />
        )}
      </Space>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small" title="Total Bills">
                <Typography.Title level={3} style={{ margin: 0 }}>{summary?.totalBills ?? 0}</Typography.Title>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="Total Revenue">
                <Typography.Title level={3} style={{ margin: 0 }}>{formatCurrency(summary?.totalRevenue ?? 0)}</Typography.Title>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="Avg Bill Value">
                <Typography.Title level={3} style={{ margin: 0 }}>{formatCurrency(summary?.avgBillValue ?? 0)}</Typography.Title>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="Top Medicine Sold">
                <Typography.Title level={5} style={{ margin: 0 }}>{summary?.topMedicineName ?? '—'}</Typography.Title>
              </Card>
            </Col>
          </Row>

          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              Export to Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
              Export to PDF
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
          </div>

          <Table
            rowKey={(r) => (r as { isSubtotal?: boolean; bill_id?: number; date?: string }).isSubtotal ? `sub-${(r as { date?: string }).date}` : `row-${(r as { bill_id?: number }).bill_id}`}
            dataSource={dataWithSubtotals}
            columns={tableColumns}
            pagination={false}
            size="small"
          />
        </>
      )}
    </div>
  )
}
