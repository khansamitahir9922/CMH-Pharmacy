import React, { useState, useEffect } from 'react'
import { Typography, Tabs, Table, Button, Skeleton } from 'antd'
import { PrinterOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { formatDate, getExpiryColor } from '@/utils/expiryStatus'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface ExpiryReportRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  days_left: number | null
  status: 'expired' | 'warning30' | 'warning90' | 'ok'
}

interface ExpiryReportData {
  expired: ExpiryReportRow[]
  warning30: ExpiryReportRow[]
  warning90: ExpiryReportRow[]
  ok: ExpiryReportRow[]
}

const TAB_KEYS = ['expired', 'warning30', 'warning90', 'ok'] as const
const TAB_LABELS: Record<(typeof TAB_KEYS)[number], string> = {
  expired: 'Expired',
  warning30: 'Expiring in 30 Days',
  warning90: 'Expiring in 90 Days',
  ok: 'All OK'
}

export function ExpiryReport(): React.ReactElement {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ExpiryReportData | null>(null)
  const [activeTab, setActiveTab] = useState<string>('expired')

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<ExpiryReportData>('inventory:getExpiryReport')
      .then((res) => setData(res ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const getExportRows = (): Record<string, unknown>[] => {
    if (!data) return []
    const rows: Record<string, unknown>[] = []
    TAB_KEYS.forEach((key) => {
      const list = data[key]
      list.forEach((r) => {
        rows.push({
          Status: TAB_LABELS[key],
          'Medicine Name': r.name,
          Category: r.category_name ?? '',
          'Batch No': r.batch_no ?? '',
          'Expiry Date': formatDate(r.expiry_date),
          'Days Left': r.days_left ?? '—',
          'Current Stock': r.current_quantity
        })
      })
    })
    return rows
  }

  const handleExportExcel = (): void => {
    const rows = getExportRows()
    if (rows.length === 0) return
    const headers = ['Status', 'Medicine Name', 'Category', 'Batch No', 'Expiry Date', 'Days Left', 'Current Stock']
    exportToExcel(rows, headers, `expiry-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportPdf = (): void => {
    const rows = getExportRows()
    if (rows.length === 0) return
    const headers = ['Status', 'Medicine Name', 'Category', 'Batch No', 'Expiry Date', 'Days Left', 'Current Stock']
    exportToPDF(rows, headers, 'Expiry Report', `expiry-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const handlePrint = (): void => {
    window.print()
  }

  const columns: ColumnsType<ExpiryReportRow> = [
    { title: 'Medicine Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no', render: (v) => v ?? '—' },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (v) => formatDate(v)
    },
    {
      title: 'Days Left',
      dataIndex: 'days_left',
      key: 'days_left',
      render: (v: number | null, r) => {
        if (v === null) return '—'
        const { text, bg } = getExpiryColor(r.status)
        return <span style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: bg, color: text }}>{v}</span>
      }
    },
    { title: 'Current Stock', dataIndex: 'current_quantity', key: 'current_quantity', width: 110 }
  ]

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  const d = data ?? { expired: [], warning30: [], warning90: [], ok: [] }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Expiry Report
        </Typography.Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Print
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
            Export to Excel
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
            Export to PDF
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={TAB_KEYS.map((key) => ({
          key,
          label: (
            <span>
              {TAB_LABELS[key]} <span style={{ marginLeft: 4, fontWeight: 600 }}>({d[key].length})</span>
            </span>
          ),
          children: (
            <Table
              rowKey="id"
              dataSource={d[key]}
              columns={columns}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No medicines in this category' }}
            />
          )
        }))}
      />
    </div>
  )
}
